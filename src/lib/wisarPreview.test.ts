import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ContourCollection } from './wisar.ts';
import { PREVIEW_FILL, PREVIEW_LINE, PREVIEW_SOURCE, clearPreview, showPreview, type PreviewMap } from './wisarPreview.ts';

function fakeMap() {
    const sources = new Map<string, unknown>();
    const layers = new Map<string, Record<string, unknown>>();
    const fits: unknown[] = [];
    const map: PreviewMap = {
        getSource: (id) => sources.get(id),
        addSource: (id, s) => { assert.ok(!sources.has(id)); sources.set(id, s); },
        removeSource: (id) => sources.delete(id),
        getLayer: (id) => layers.get(id),
        addLayer: (l) => { assert.ok(!layers.has(String(l.id))); layers.set(String(l.id), l); },
        removeLayer: (id) => layers.delete(id),
        fitBounds: (b) => { fits.push(b); },
    };
    return { map, sources, layers, fits };
}

const FC: ContourCollection = { type: 'FeatureCollection', features: [{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[-112, 35], [-111.9, 35], [-111.9, 35.1], [-112, 35]]] },
    properties: { callsign: '2h', remarks: '', color: '#00bcd4', threshold_m: 1, hours: 2,
        stroke: '#00bcd4', 'stroke-width': 3, 'stroke-opacity': 1, fill: '#00bcd4', 'fill-opacity': 0.1 },
}] };

test('showPreview adds one source and two layers, fits, and can be repeated', () => {
    const m = fakeMap();
    showPreview(m.map, FC);
    showPreview(m.map, FC);
    assert.deepEqual([...m.sources.keys()], [PREVIEW_SOURCE]);
    assert.deepEqual([...m.layers.keys()].sort(), [PREVIEW_FILL, PREVIEW_LINE].sort());
    assert.deepEqual(m.fits[0], [[-112, 35], [-111.9, 35.1]]);
    clearPreview(m.map);
    assert.equal(m.sources.size + m.layers.size, 0);
    clearPreview(m.map); // no-op when already clear
});
