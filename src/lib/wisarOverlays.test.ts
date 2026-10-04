import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OVERLAY_OPACITY, clearOverlay, imageCoordinates, overlaySourceId, showOverlay, type OverlayMap } from './wisarOverlays.ts';

function fakeMap(existingLayers: string[] = []) {
    const sources = new Map<string, Record<string, unknown>>();
    const layers: { id: string; before?: string; layer: Record<string, unknown> }[] = existingLayers.map((id) => ({ id, layer: {} }));
    const map: OverlayMap = {
        getSource: (id) => sources.get(id),
        addSource: (id, s) => { assert.ok(!sources.has(id)); sources.set(id, s); },
        removeSource: (id) => sources.delete(id),
        getLayer: (id) => layers.find((l) => l.id === id),
        addLayer: (l, before) => { layers.push({ id: String(l.id), before, layer: l }); },
        removeLayer: (id) => { layers.splice(layers.findIndex((l) => l.id === id), 1); },
    };
    return { map, sources, layers };
}

const B = { west: -112, south: 35, east: -111.9, north: 35.1 };

test('image corners run top-left, top-right, bottom-right, bottom-left', () => {
    assert.deepEqual(imageCoordinates(B), [[-112, 35.1], [-111.9, 35.1], [-111.9, 35], [-112, 35]]);
});

test('showOverlay adds one image source and one raster layer at 60%, repeatable, then clears', () => {
    const m = fakeMap();
    const src = overlaySourceId('im-wisar-preview-1', 'attractor');
    assert.equal(src, 'im-wisar-preview-1-overlay-attractor');
    showOverlay(m.map, src, 'blob:a', B);
    showOverlay(m.map, src, 'blob:b', B);
    assert.deepEqual(m.sources.get(src), { type: 'image', url: 'blob:b', coordinates: imageCoordinates(B) });
    assert.equal(m.layers.length, 1);
    assert.equal((m.layers[0].layer.paint as Record<string, number>)['raster-opacity'], OVERLAY_OPACITY);
    assert.equal(OVERLAY_OPACITY, 0.6);
    clearOverlay(m.map, src);
    assert.equal(m.sources.size + m.layers.length, 0);
    clearOverlay(m.map, src); // no-op when already clear
});

test('the raster goes under the contour preview when it is on the map', () => {
    const m = fakeMap(['panel-fill']);
    showOverlay(m.map, 's', 'blob:a', B, { beforeId: 'panel-fill' });
    assert.equal(m.layers[1].before, 'panel-fill');
    const n = fakeMap();
    showOverlay(n.map, 's', 'blob:a', B, { beforeId: 'panel-fill' });
    assert.equal(n.layers[0].before, undefined);
});
