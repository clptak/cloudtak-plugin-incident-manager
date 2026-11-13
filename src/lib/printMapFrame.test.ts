import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    centredView, fitFrame, mercX, mercY, metersPerPixel, naturalAspect, neighbours, paperScale, paperScaleLabel, ringsOf, scaleBar, shapesTouch, trimmedView, zoomForFrame,
    type LngLat,
} from './printMapFrame.ts';

/** A square cell `size` degrees wide with its south-west corner at (lng, lat). */
function cell(lng: number, lat: number, size = 0.01): LngLat[][] {
    return [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]];
}

test('ringsOf reads polygons, multipolygons, lines and points', () => {
    assert.equal(ringsOf({ type: 'Polygon', coordinates: cell(0, 0) }).length, 1);
    assert.equal(ringsOf({ type: 'MultiPolygon', coordinates: [cell(0, 0), cell(1, 1)] }).length, 2);
    assert.deepEqual(ringsOf({ type: 'LineString', coordinates: [[1, 2], [3, 4]] }), [[[1, 2], [3, 4]]]);
    assert.deepEqual(ringsOf({ type: 'Point', coordinates: [1, 2] }), [[[1, 2]]]);
    assert.deepEqual(ringsOf({ type: 'Polygon', coordinates: 'junk' }), []);
    assert.deepEqual(ringsOf(undefined), []);
});

test('shapesTouch: shared edge, shared corner and near-miss count; a gap does not', () => {
    const a = cell(-112, 33);
    assert.equal(shapesTouch(a, cell(-111.99, 33)), true, 'shared edge');
    assert.equal(shapesTouch(a, cell(-111.99, 33.01)), true, 'shared corner');
    // 0.0001° ≈ 9 m: hand-drawn borders that don't quite meet.
    assert.equal(shapesTouch(a, cell(-111.9899, 33)), true, 'small gap within tolerance');
    assert.equal(shapesTouch(a, cell(-111.98, 33)), false, 'a cell away');
    assert.equal(shapesTouch(a, cell(-111.995, 33.002, 0.002)), true, 'inside');
});

test('neighbours: the ring of cells around the target, not the target or farther cells', () => {
    const grid: { id: string; rings: LngLat[][] }[] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) grid.push({ id: `${i}${j}`, rings: cell(i * 0.01, j * 0.01) });
    const target = grid.find((g) => g.id === '22')!;
    const ids = neighbours(target.rings, grid, '22').map((n) => n.id).sort();
    assert.deepEqual(ids, ['11', '12', '13', '21', '23', '31', '32', '33']);
    const corner = grid.find((g) => g.id === '00')!;
    assert.deepEqual(neighbours(corner.rings, grid, '00').map((n) => n.id).sort(), ['01', '10', '11']);
});

test('centredView centres on the target even when neighbours sit on one side', () => {
    const target = cell(0, 0);
    const v = centredView(target, [cell(0.01, 0)], 600, 600, 0)!;
    assert.ok(Math.abs(v.center[0] - 0.005) < 1e-9);
    assert.ok(Math.abs(v.center[1] - 0.005) < 1e-6);
    // Half-width reaches to the neighbour's far edge at 0.02, so 0.015° each way.
    const halfPx = 300;
    const halfMerc = mercX(0.02) - mercX(0.005);
    assert.ok(Math.abs(512 * 2 ** v.zoom * halfMerc - halfPx) < 1e-6);
});

test('centredView fits the page shape and keeps the target and neighbours inside', () => {
    const target = cell(-112, 33);
    const include = [cell(-112.01, 33), cell(-111.99, 33), cell(-112, 33.01)];
    for (const [w, h] of [[720, 960], [960, 720]]) {
        const v = centredView(target, include, w, h)!;
        const world = 512 * 2 ** v.zoom;
        const cx = mercX(v.center[0]) * world;
        const cy = mercY(v.center[1]) * world;
        for (const p of [target, ...include].flat(2)) {
            assert.ok(Math.abs(mercX(p[0]) * world - cx) <= w / 2 + 1e-6);
            assert.ok(Math.abs(mercY(p[1]) * world - cy) <= h / 2 + 1e-6);
        }
    }
    assert.equal(centredView([], [], 100, 100), null);
});

test('naturalAspect: wider spread → landscape', () => {
    assert.ok(naturalAspect(cell(0, 0), [cell(-0.01, 0), cell(0.01, 0)]) > 1);
    assert.ok(naturalAspect(cell(0, 0), [cell(0, -0.01), cell(0, 0.01)]) < 1);
});

test('trimmedView: the output never shows beyond the live view', () => {
    // Live 1000×500, output 500×500: output is narrower, so height governs — zoom unchanged.
    assert.equal(trimmedView([1, 2], 12, 1000, 500, 500, 500).zoom, 12);
    // Output twice the live width at the same height: zoom in one level.
    assert.equal(trimmedView([1, 2], 12, 500, 500, 1000, 500).zoom, 13);
    assert.deepEqual(trimmedView([1, 2], 12, 500, 500, 500, 500).center, [1, 2]);
});

test('metersPerPixel at the equator, zoom 0', () => {
    assert.ok(Math.abs(metersPerPixel(0, 0) - 40075016.686 / 512) < 1e-6);
});

test('scaleBar picks the longest round distance that fits', () => {
    // 10 m per point, 100 pt available → up to 1000 m → 0.5 mi (804 m).
    const bar = scaleBar(10, 100)!;
    assert.equal(bar.label, '0.5 mi');
    assert.ok(Math.abs(bar.length - 80.4672) < 1e-6);
    assert.equal(scaleBar(1, 100)!.label, '250 ft');
    assert.equal(scaleBar(1, 10), null);
    assert.equal(scaleBar(0, 10), null);
});

test('fitFrame keeps the aspect, fits inside the margins, leaves room for the bar', () => {
    const r = fitFrame(1200, 800, 2, 48, 40);
    assert.ok(Math.abs(r.w / r.h - 2) < 1e-9);
    assert.ok(r.x >= 48 && r.x + r.w <= 1200 - 48 + 1e-9);
    assert.ok(r.y >= 88 && r.y + r.h <= 800 - 48 + 1e-9);
    // Tall container: width limits.
    const t = fitFrame(400, 1000, 1.3, 48, 40);
    assert.ok(Math.abs(t.w - (400 - 96)) < 1e-9);
});

test('zoomForFrame: a print twice the frame width is one zoom level in', () => {
    assert.equal(zoomForFrame(12, 500, 1000), 13);
    assert.equal(zoomForFrame(12, 500, 500), 12);
});

test('paperScale and its label', () => {
    // Zoom 15 at the equator (512 px tiles): ~2.39 m/px → ×(96/72) m/pt × 72/0.0254 ≈ 1:9,000.
    const s = paperScale(0, 15);
    assert.ok(s > 8500 && s < 9500, String(s));
    assert.equal(paperScaleLabel(24123), '1:24,000');
    assert.equal(paperScaleLabel(987), '1:990');
    assert.equal(paperScaleLabel(0), '');
});
