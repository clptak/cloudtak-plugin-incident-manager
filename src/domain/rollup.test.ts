import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, SegmentState } from './entities.ts';
import { computeRollup, cumulativePod, splitSegment } from './rollup.ts';

function record(partial: Partial<DebriefRecord> & { segmentUid: string; pod: number }): DebriefRecord {
    return { opNumber: 1, ...partial };
}

test('cumulativePod: single search passes through', () => {
    assert.equal(cumulativePod([record({ segmentUid: 'a', pod: 60 })]), 60);
});

test('cumulativePod: two searches compound (FindEm)', () => {
    // 1 − (0.4 · 0.5) = 0.8
    const pods = [
        record({ segmentUid: 'a', pod: 60 }),
        record({ segmentUid: 'a', pod: 50, opNumber: 2 }),
    ];
    assert.equal(cumulativePod(pods), 80);
});

test('cumulativePod: coverage scales a partial search', () => {
    // POD 80% over half the segment ⇒ effective 40%
    assert.equal(cumulativePod([record({ segmentUid: 'a', pod: 80, coverage: 0.5 })]), 40);
});

test('cumulativePod: clamps out-of-range inputs', () => {
    assert.equal(cumulativePod([record({ segmentUid: 'a', pod: 150 })]), 100);
    assert.equal(cumulativePod([record({ segmentUid: 'a', pod: -10 })]), 0);
    assert.equal(cumulativePod([]), 0);
});

const SEGMENTS: SegmentState[] = [
    { uid: 'a', poa: 40 },
    { uid: 'b', poa: 30 },
    { uid: 'c', poa: 10 },
];
const ROW = 20;

test('computeRollup: unsearched incident leaves POA unchanged', () => {
    const result = computeRollup(SEGMENTS, ROW, []);
    assert.equal(result.cumulativePos, 0);
    assert.deepEqual(result.segments.map((s) => s.adjustedPoa), [40, 30, 10]);
    assert.equal(result.row.adjustedPoa, 20);
});

test('computeRollup: searching one segment shifts POA to the others', () => {
    // Segment a searched with POD 50 ⇒ w = [20, 30, 10], row 20, Σ = 80
    const result = computeRollup(SEGMENTS, ROW, [record({ segmentUid: 'a', pod: 50 })]);
    const [a, b, c] = result.segments;
    assert.equal(a.cumulativePod, 50);
    assert.equal(a.adjustedPoa, 25);      // 20/80
    assert.equal(b.adjustedPoa, 37.5);    // 30/80
    assert.equal(c.adjustedPoa, 12.5);    // 10/80
    assert.equal(result.row.adjustedPoa, 25);
    assert.equal(a.pos, 20);              // 40 · 0.5
    assert.equal(result.cumulativePos, 20);
    // POA still sums to 100
    const total = result.segments.reduce((acc, s) => acc + s.adjustedPoa, 0) + result.row.adjustedPoa;
    assert.ok(Math.abs(total - 100) < 0.05);
});

test('computeRollup: ignores debriefs for unknown segments', () => {
    const result = computeRollup(SEGMENTS, ROW, [record({ segmentUid: 'ghost', pod: 90 })]);
    assert.equal(result.cumulativePos, 0);
    assert.deepEqual(result.segments.map((s) => s.searches), [0, 0, 0]);
});

test('splitSegment: children inherit POA by fraction with lineage', () => {
    const next = splitSegment(SEGMENTS, 'a', [
        { uid: 'a1', fraction: 0.75 },
        { uid: 'a2', fraction: 0.25 },
    ]);
    assert.equal(next.length, 4);
    assert.ok(!next.some((s) => s.uid === 'a'));
    const a1 = next.find((s) => s.uid === 'a1')!;
    const a2 = next.find((s) => s.uid === 'a2')!;
    assert.equal(a1.poa, 30);
    assert.equal(a2.poa, 10);
    assert.equal(a1.parentUid, 'a');
    assert.equal(a2.parentUid, 'a');
});

test('splitSegment: rejects bad fractions, unknown parents, duplicate uids', () => {
    assert.throws(() => splitSegment(SEGMENTS, 'nope', [
        { uid: 'x', fraction: 0.5 }, { uid: 'y', fraction: 0.5 },
    ]));
    assert.throws(() => splitSegment(SEGMENTS, 'a', [
        { uid: 'x', fraction: 0.5 }, { uid: 'y', fraction: 0.4 },
    ]));
    assert.throws(() => splitSegment(SEGMENTS, 'a', [
        { uid: 'b', fraction: 0.5 }, { uid: 'y', fraction: 0.5 },
    ]));
    assert.throws(() => splitSegment(SEGMENTS, 'a', [
        { uid: 'x', fraction: 1 },
    ]));
});
