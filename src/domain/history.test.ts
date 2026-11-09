import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, SegmentState } from './entities.ts';
import { applyClue, clueExponent, computeOpHistory, computeScenario, opNumbersIn, scenariosFromValue } from './history.ts';
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
    // Wallet in segment a: a=A(16), others G(2), ROW C(8)
    const result = applyClue({ a: 40, b: 30, c: 10 }, 20, {
        opNumber: 1, description: 'wallet', authenticity: 1,
        letters: { a: 'A', b: 'G', c: 'G', ROW: 'C' },
    });
    // weights: 640, 60, 20, 160 → total 880
    assert.equal(result.poa.a, 72.73);
    assert.equal(result.poa.b, 6.82);
    assert.equal(result.poa.c, 2.27);
    assert.equal(result.rowPoa, 18.18);
    const sum = result.poa.a + result.poa.b + result.poa.c + result.rowPoa;
    assert.ok(Math.abs(sum - 100) < 0.05);
});

// Win CASIE III runs posted on issue #9: R.O.W. 10, S1 50, S2 30, S3 10,
// each clue added on its own. Expected values are WC3's Incident Status.
const WC3_START = { s1: 50, s2: 30, s3: 10 };
const WC3_CASES: { name: string; letters: Record<string, string>; authenticity: number; expect: [number, number, number, number] }[] = [
    { name: 'E,A,E,I almost surely', letters: { ROW: 'E', s1: 'A', s2: 'E', s3: 'I' }, authenticity: 1, expect: [82.47, 12.37, 1.03, 4.12] },
    { name: 'E,A,E,I probably', letters: { ROW: 'E', s1: 'A', s2: 'E', s3: 'I' }, authenticity: 0.75, expect: [76.46, 16.22, 1.91, 5.41] },
    { name: 'E,A,E,I even chance', letters: { ROW: 'E', s1: 'A', s2: 'E', s3: 'I' }, authenticity: 0.5, expect: [68.97, 20.69, 3.45, 6.90] },
    { name: 'E,A,E,I probably not', letters: { ROW: 'E', s1: 'A', s2: 'E', s3: 'I' }, authenticity: 0.25, expect: [60.04, 25.47, 6.00, 8.49] },
    { name: 'E,A,E,I almost surely not', letters: { ROW: 'E', s1: 'A', s2: 'E', s3: 'I' }, authenticity: 0, expect: [50, 30, 10, 10] },
    { name: 'C,A,C,C almost surely', letters: { ROW: 'C', s1: 'A', s2: 'C', s3: 'C' }, authenticity: 1, expect: [66.67, 20, 6.67, 6.67] },
];
for (const c of WC3_CASES) {
    test(`applyClue matches Win CASIE III: ${c.name}`, () => {
        const r = applyClue(WC3_START, 10, { opNumber: 0, description: c.name, authenticity: c.authenticity, letters: c.letters });
        assert.deepEqual([r.poa.s1, r.poa.s2, r.poa.s3, r.rowPoa], c.expect);
    });
}

test('clueExponent: clues saved with the old 0.95 / 0.05 read as 1 / 0', () => {
    assert.equal(clueExponent(0.95), 1);
    assert.equal(clueExponent(0.05), 0);
    assert.equal(clueExponent(0.75), 0.75);
    assert.equal(clueExponent(50), 1);
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
