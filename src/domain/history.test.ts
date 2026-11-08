import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, SegmentState } from './entities.ts';
import { applyClue, computeOpHistory, computeScenario, opNumbersIn, scenariosFromValue } from './history.ts';
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
    assert.deepEqual(h.final.cpod, { a: 0, b: 0, c: 0 });
});

test('computeOpHistory: single OP matches hand math', () => {
    // OP1: segment a searched POD 50 → weights a 20, b 30, c 10, ROW 20 (Σ 80)
    const h = computeOpHistory(SEGMENTS, ROW, [rec(1, 'a', 50)]);
    assert.equal(h.steps.length, 2);
    const s1 = h.steps[1];
    assert.equal(s1.cpod.a, 50);
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
    // Running CPOD equals single-shot cumulative POD
    for (const seg of single.segments) {
        assert.ok(Math.abs(history.final.cpod[seg.uid] - seg.cumulativePod) < 0.05,
            `${seg.uid}: ${history.final.cpod[seg.uid]} vs ${seg.cumulativePod}`);
    }
    // POA sums to 100 at every step
    for (const step of history.steps) {
        const total = Object.values(step.poa).reduce((a, b) => a + b, 0) + step.rowPoa;
        assert.ok(Math.abs(total - 100) < 0.1, `OP${step.opNumber} total ${total}`);
    }
    // CPOD never decreases from one OP to the next
    for (let i = 1; i < history.steps.length; i++) {
        for (const uid of Object.keys(history.steps[i].cpod)) {
            assert.ok(history.steps[i - 1].cpod[uid] <= history.steps[i].cpod[uid]);
        }
    }
});

test('computeOpHistory: skips unknown segments and out-of-range OP numbers', () => {
    const h = computeOpHistory(SEGMENTS, ROW, [rec(1, 'ghost', 90), rec(0, 'a', 50), rec(-2, 'b', 50)]);
    // rec(1,'ghost') creates an OP-1 step with zero effect; 0/-2 are ignored
    assert.equal(opNumbersIn([rec(0, 'a', 50), rec(-2, 'b', 50)]).length, 0);
    assert.deepEqual(h.final.cpod, { a: 0, b: 0, c: 0 });
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

test('applyClue: uniform letters are informationless; E default is neutral', () => {
    const clue = { opNumber: 0, description: 'x', authenticity: 1, letters: {} };
    const same = applyClue({ a: 40, b: 30, c: 10 }, 20, clue);
    assert.deepEqual(same.poa, { a: 40, b: 30, c: 10 });
    assert.equal(same.rowPoa, 20);
    const allA = applyClue({ a: 40, b: 30, c: 10 }, 20, {
        ...clue, letters: { a: 'A', b: 'A', c: 'A', ROW: 'A' },
    });
    assert.deepEqual(allA.poa, { a: 40, b: 30, c: 10 });
});

test('applyClue: authentic clue shifts mass toward suggested segments', () => {
    // Wallet in segment a: a=A(9), others G(3), ROW C(7)
    const result = applyClue({ a: 40, b: 30, c: 10 }, 20, {
        opNumber: 1, description: 'wallet', authenticity: 1,
        letters: { a: 'A', b: 'G', c: 'G', ROW: 'C' },
    });
    // weights: 360, 90, 30, 140 → total 620
    assert.equal(result.poa.a, 58.06);
    assert.equal(result.poa.b, 14.52);
    assert.equal(result.poa.c, 4.84);
    assert.equal(result.rowPoa, 22.58);
    const sum = result.poa.a + result.poa.b + result.poa.c + result.rowPoa;
    assert.ok(Math.abs(sum - 100) < 0.05);
});

test('applyClue: authenticity blends toward the prior', () => {
    const letters = { a: 'A', b: 'G', c: 'G', ROW: 'C' };
    const zero = applyClue({ a: 40, b: 30, c: 10 }, 20, {
        opNumber: 1, description: 'hoax', authenticity: 0, letters,
    });
    assert.deepEqual(zero.poa, { a: 40, b: 30, c: 10 });
    const half = applyClue({ a: 40, b: 30, c: 10 }, 20, {
        opNumber: 1, description: 'maybe', authenticity: 0.5, letters,
    });
    assert.ok(Math.abs(half.poa.a - 49.03) < 0.02, String(half.poa.a));
});

test('computeOpHistory: clue applies after its OP and shows in the step', () => {
    const clue = {
        opNumber: 1, description: 'wallet', authenticity: 1,
        letters: { a: 'A', b: 'E', c: 'E', ROW: 'E' }, recordedAt: '2026-08-07T00:00:00Z',
    };
    const withClue = computeOpHistory(SEGMENTS, ROW, [rec(1, 'b', 50)], [clue]);
    const noClue = computeOpHistory(SEGMENTS, ROW, [rec(1, 'b', 50)]);
    // CPOD unaffected (a clue is not a search)
    assert.deepEqual(withClue.steps[1].cpod, noClue.steps[1].cpod);
    // POA for a is boosted relative to the no-clue replay
    assert.ok(withClue.steps[1].poa.a > noClue.steps[1].poa.a);
    // Clue-only OP still creates a step
    const clueOnly = computeOpHistory(SEGMENTS, ROW, [], [clue]);
    assert.equal(clueOnly.steps.length, 2);
    assert.deepEqual(clueOnly.steps[1].cpod, { a: 0, b: 0, c: 0 });
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

// Find'Em ch. 8.6 worked example (Win CASIE III, Figs 8.27 and 8.31):
// consensus ROW 10, Seg 1/2/3 = 45/30/15; OP1 helicopter Seg 1 POD 50,
// helicopter Seg 2 POD 50, grid team Seg 1 POD 60.
test("computeOpHistory: matches Find'Em Win CASIE POA and CPOD example", () => {
    const segs: SegmentState[] = [{ uid: 's1', poa: 45 }, { uid: 's2', poa: 30 }, { uid: 's3', poa: 15 }];
    const one = computeOpHistory(segs, 10, [rec(1, 's1', 50)]).final;
    assert.deepEqual(one.poa, { s1: 29.03, s2: 38.71, s3: 19.35 });
    assert.equal(one.rowPoa, 12.9);
    assert.deepEqual(one.cpod, { s1: 50, s2: 0, s3: 0 });

    const all = computeOpHistory(segs, 10, [rec(1, 's1', 50), rec(1, 's2', 50), rec(1, 's1', 60)]).final;
    assert.deepEqual(all.poa, { s1: 18.37, s2: 30.61, s3: 30.61 });
    assert.equal(all.rowPoa, 20.41);
    assert.deepEqual(all.cpod, { s1: 80, s2: 50, s3: 0 });
});

test('computeOpHistory: CPOD accumulates across OPs', () => {
    // Find'Em Fig 8.17: POD 40 then POD 60 → CPOD 76, here split over two OPs.
    const h = computeOpHistory(SEGMENTS, ROW, [rec(1, 'a', 40), rec(2, 'a', 60)]);
    assert.deepEqual(h.steps.map((s) => s.cpod.a), [0, 40, 76]);
    assert.equal(h.steps[2].podEff.a, 60);
    assert.equal(h.final.cpod.b, 0);
});
