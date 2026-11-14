import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    declareSegments,
    drawnSegmentUids,
    isUndrawn,
    markDrawn,
    matchPolygonsToDeclared,
    nextSegmentNames,
    sameSegmentName,
} from './declaredSegments.ts';

test('nextSegmentNames continues the numbering and keeps zero padding', () => {
    assert.deepEqual(nextSegmentNames([], 3), ['1', '2', '3']);
    assert.deepEqual(nextSegmentNames(['1', '3', 'A'], 2), ['4', '5']);
    assert.deepEqual(nextSegmentNames(['01', '02'], 2), ['03', '04']);
    assert.deepEqual(nextSegmentNames(['1'], 0), []);
});

test('declareSegments adds undrawn records under minted uids', () => {
    let n = 0;
    const { segments, added } = declareSegments(
        { a: { callsign: '1', created: 'x' } },
        ['2', '3'],
        { now: 'T', newId: () => `d${++n}` },
    );
    assert.deepEqual(added, ['d1', 'd2']);
    assert.deepEqual(segments.d1, { callsign: '2', created: 'T', undrawn: true });
    assert.ok(isUndrawn(segments.d2));
    assert.ok(!isUndrawn(segments.a));
    assert.deepEqual(drawnSegmentUids(segments), ['a']);
});

test('declareSegments rejects repeats and non-numbers', () => {
    const base = { a: { callsign: '01', created: 'x' } };
    assert.throws(() => declareSegments(base, ['1']), /already exists/);
    assert.throws(() => declareSegments({}, ['2', '2']), /already exists/);
    assert.throws(() => declareSegments({}, ['3A']), /whole numbers/);
});

test('markDrawn keeps the name and created time and drops the flag', () => {
    assert.deepEqual(markDrawn({ callsign: '4', created: 'T', undrawn: true }), { callsign: '4', created: 'T' });
});

test('matchPolygonsToDeclared suggests only unambiguous name matches', () => {
    assert.ok(sameSegmentName('01', '1'));
    const declared = [
        { uid: 'd1', callsign: '1' },
        { uid: 'd2', callsign: '2' },
        { uid: 'd3', callsign: '3' },
    ];
    const polygons = [
        { uid: 'p1', callsign: '01' },
        { uid: 'p2a', callsign: '2' },
        { uid: 'p2b', callsign: '2' },
        { uid: 'p9', callsign: '9' },
    ];
    assert.deepEqual(matchPolygonsToDeclared(declared, polygons), { d1: 'p1' });
});
