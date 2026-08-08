import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, SegmentState } from './entities.ts';
import { computeOpHistory, computeScenario, opNumbersIn, scenariosFromValue } from './history.ts';
import { computeRollup } from './rollup.ts';

const SEGMENTS: SegmentState[] = [
    { uid: 'a', poa: 40 },
    { uid: 'b', poa: 30 },
    { uid: 'c', poa: 10 },
];
const ROW = 20;

function rec(opNumber: number, segmentUid: string, pod: number): DebriefRecord {
    return { opNumber, segmentUid, pod };
}

test('computeOpHistory: step 0 is the initial consensus', () => {
    const h = computeOpHistory(SEGMENTS, ROW, []);
    assert.equal(h.steps.length, 1);
    assert.deepEqual(h.final.poa, { a: 40, b: 30, c: 10 });
    assert.equal(h.final.rowPoa, 20);
    assert.equal(h.final.cumulativePos, 0);
});

test('computeOpHistory: single OP matches hand math', () => {
    // OP1: segment a searched POD 50 → OPOS = 40·0.5 = 20
    const h = computeOpHistory(SEGMENTS, ROW, [rec(1, 'a', 50)]);
    assert.equal(h.steps.length, 2);
    const s1 = h.steps[1];
    assert.equal(s1.opos, 20);
    assert.equal(s1.cumulativePos, 20);
    assert.equal(s1.poa.a, 25);       // 20/80
    assert.equal(s1.poa.b, 37.5);
    assert.equal(s1.rowPoa, 25);
});

test('computeOpHistory: sequential replay composes to single-shot computeRollup', () => {
    const records = [
        rec(1, 'a', 50), rec(1, 'b', 30),
        rec(2, 'a', 60), rec(2, 'c', 40),
        rec(3, 'b', 70),
    ];
    const history = computeOpHistory(SEGMENTS, ROW, records);
    const single = computeRollup(SEGMENTS, ROW, records);

    // Final POA per segment identical (±0.05 rounding)
    for (const seg of single.segments) {
        assert.ok(Math.abs(history.final.poa[seg.uid] - seg.adjustedPoa) < 0.05,
            `${seg.uid}: ${history.final.poa[seg.uid]} vs ${seg.adjustedPoa}`);
    }
    assert.ok(Math.abs(history.final.rowPoa - single.row.adjustedPoa) < 0.05);
    // Cumulative POS identical
    assert.ok(Math.abs(history.final.cumulativePos - single.cumulativePos) < 0.05,
        `${history.final.cumulativePos} vs ${single.cumulativePos}`);
    // POA sums to 100 at every step
    for (const step of history.steps) {
        const total = Object.values(step.poa).reduce((a, b) => a + b, 0) + step.rowPoa;
        assert.ok(Math.abs(total - 100) < 0.1, `OP${step.opNumber} total ${total}`);
    }
    // OPOS monotonic accumulation
    assert.ok(history.steps[1].cumulativePos <= history.steps[2].cumulativePos);
    assert.ok(history.steps[2].cumulativePos <= history.steps[3].cumulativePos);
});

test('computeOpHistory: skips unknown segments and out-of-range OP numbers', () => {
    const h = computeOpHistory(SEGMENTS, ROW, [rec(1, 'ghost', 90), rec(0, 'a', 50), rec(-2, 'b', 50)]);
    // rec(1,'ghost') creates an OP-1 step with zero effect; 0/-2 are ignored
    assert.equal(opNumbersIn([rec(0, 'a', 50), rec(-2, 'b', 50)]).length, 0);
    assert.equal(h.final.cumulativePos, 0);
});

test('computeScenario: forks from a known-good point', () => {
    const records = [rec(1, 'a', 50), rec(2, 'b', 60)];
    // Fork after OP1, hypothetically search c at POD 80 in OP2 instead
    const scenario = {
        name: 'what if we had searched C',
        throughOp: 1,
        hypotheticals: [rec(2, 'c', 80)],
    };
    const forked = computeScenario(SEGMENTS, ROW, records, scenario);
    // Step 1 identical to the real replay
    const real = computeOpHistory(SEGMENTS, ROW, records);
    assert.deepEqual(forked.steps[1].poa, real.steps[1].poa);
    // Step 2 differs: c was searched, not b
    assert.ok(forked.steps[2].podEff.c === 80);
    assert.equal(forked.steps[2].podEff.b, undefined);
    assert.ok(forked.final.poa.c < real.final.poa.c);
});

test('scenariosFromValue: tolerant parse', () => {
    const parsed = scenariosFromValue([
        { name: 'S1', throughOp: 2, hypotheticals: [{ opNumber: 3, segmentUid: 'a', pod: 70 }] },
        { name: '', throughOp: 1, hypotheticals: [] },      // no name
        { name: 'bad', throughOp: -1 },                      // bad op
        'junk',
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].hypotheticals.length, 1);
});
