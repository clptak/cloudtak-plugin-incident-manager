import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keepOverlay, keptLayerName, type KeepDeps } from './wisarKeep.ts';

const AZ_TARR = { type: 'tarr' as const, request: { subject: { kind: 'custom', name: 'Search-Hiker (AZ)' } },
    created_at: '2026-10-04T21:00:00Z', finished_at: new Date(2026, 9, 4, 14, 32).toISOString() };

test('kept layer name: folder name, layer, local finish time', () => {
    assert.equal(keptLayerName(AZ_TARR, 'Terrain Attractor Priority'),
        'AZ LPB Search-Hiker WiSAR - Terrain Attractor Priority - 10-04 14:32');
    const tt = { type: 'travel_time' as const, request: {}, created_at: new Date(2026, 0, 2, 3, 4).toISOString(), finished_at: null };
    assert.equal(keptLayerName(tt, 'Terrain Difficulty'), 'WiSAR Distance Traveled - Terrain Difficulty - 01-02 03:04');
    const slash = { ...AZ_TARR, request: { subject: { kind: 'listed', category: 'Dementia/Alzheimer' } } };
    assert.equal(keptLayerName(slash, 'Probability (TARR bands)'),
        'Koester LPB Dementia-Alzheimer WiSAR - Probability (TARR bands) - 10-04 14:32');
});

function deps(over: Partial<KeepDeps> = {}) {
    const calls: string[] = [];
    let polls = 0;
    let tileTries = 0;
    const d: KeepDeps = {
        upload: async (_f, name) => { calls.push(`upload ${name}`); return 'imp-1'; },
        getImport: async () => {
            polls += 1;
            return polls < 3 ? { status: 'Running' } : { status: 'Success', results: [{ type: 'Asset', type_id: 'asset-9' }] };
        },
        tileJSON: async () => {
            tileTries += 1;
            if (tileTries < 2) throw new Error('404');
            return { tiles: ['https://x/api/profile/asset/asset-9.pmtiles/tile/{z}/{x}/{y}.png'] };
        },
        createOverlay: async (id, name, file) => { calls.push(`overlay ${id} ${name} ${file}`); },
        sleep: async () => {},
        ...over,
    };
    return { d, calls };
}

test('keep: upload, wait for the import, wait for tiles, add the overlay', async () => {
    const { d, calls } = deps();
    const phases: string[] = [];
    const name = await keepOverlay(d, new Blob(['x']), 'N', { onPhase: (p) => phases.push(p) });
    assert.equal(name, 'N');
    assert.deepEqual(calls, ['upload N.tif', 'overlay asset-9 N N.tif']);
    assert.deepEqual(phases, ['uploading', 'converting', 'adding', 'done']);
});

test('keep: a failed import is reported with CloudTAK\'s reason', async () => {
    const { d } = deps({ getImport: async () => ({ status: 'Fail', error: 'gdal failed' }) });
    await assert.rejects(keepOverlay(d, new Blob(['x']), 'N'), /could not import the layer: gdal failed/);
});

test('keep: vector tiles are refused; a slow conversion points to Files', async () => {
    const vec = deps({ tileJSON: async () => ({ tiles: ['https://x/t/{z}/{x}/{y}.mvt'] }) });
    await assert.rejects(keepOverlay(vec.d, new Blob(['x']), 'N'), /vector data/);
    const slow = deps({ getImport: async () => ({ status: 'Running' }) });
    await assert.rejects(keepOverlay(slow.d, new Blob(['x']), 'N', { timeoutMs: -1 }), /appear in your Files/);
});

test('keep: cancelling stops the wait', async () => {
    const ac = new AbortController();
    const { d } = deps({ getImport: async () => { ac.abort(); return { status: 'Running' }; } });
    await assert.rejects(keepOverlay(d, new Blob(['x']), 'N', { signal: ac.signal }), { name: 'AbortError' });
});
