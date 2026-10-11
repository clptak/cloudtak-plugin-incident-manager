import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ringCentroid, ringFromGeometry } from './polygonRing.ts';

test('ringFromGeometry reads a Polygon outer ring', () => {
    const ring = ringFromGeometry({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    });
    assert.deepEqual(ring, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
});

test('ringFromGeometry reads the first MultiPolygon ring', () => {
    const ring = ringFromGeometry({
        type: 'MultiPolygon',
        coordinates: [
            [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
            [[[9, 9], [10, 9], [10, 10], [9, 10], [9, 9]]],
        ],
    });
    assert.deepEqual(ring, [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]);
});

test('ringFromGeometry rejects too-short or non-polygon geometry', () => {
    assert.equal(ringFromGeometry({ type: 'Point', coordinates: [0, 0] }), null);
    assert.equal(ringFromGeometry({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 0]]],
    }), null);
});

test('ringCentroid averages ring vertices', () => {
    assert.deepEqual(ringCentroid([[0, 0], [2, 0], [2, 2], [0, 2]]), [1, 1]);
});
