import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProfileDataset } from './wisar.ts';
import {
    OTHER_DEFAULT,
    arizonaPercentiles,
    arizonaRowProblem,
    categoryCalibration,
    ecoOptions,
    findCategory,
    formatMultipliers,
    p90Status,
    resolveVariant,
    tarrProblem,
    tarrRequest,
    terrainOptions,
    type ArizonaRow,
    type TarrFormState,
} from './wisarTarr.ts';
import azTable from '../data/azlpb_table.json' with { type: 'json' };

const d = (p25: number, p50: number, p75: number) => ({ p25, p50, p75 });
const DS: ProfileDataset = {
    id: 'koester',
    name: 'Koester',
    default_calibration: { m25: 1.05, m50: 1.35, m75: 1.8 },
    categories: [
        { name: 'Hiker', calibration: { m25: 1, m50: 1.1, m75: 1.4 }, variants: [
            { eco_region: 'Temperate', terrain: 'Mountainous', distances_km: d(1, 2, 3) },
            { eco_region: 'Temperate', terrain: 'Flat', distances_km: d(1.1, 2.1, 3.1) },
            { eco_region: 'Dry', terrain: 'Mountainous', distances_km: d(2, 3, 4) },
            { eco_region: 'Dry', terrain: null, distances_km: d(2.5, 3.5, 4.5) },
            { eco_region: null, terrain: null, distances_km: d(5, 6, 7) },
        ] },
        { name: 'Runner', calibration: null, variants: [{ eco_region: null, terrain: null, distances_km: d(3, 4, 5) }] },
    ],
};
const IPP = { lat: 35, lon: -111.7 };

function state(over: Partial<TarrFormState> = {}): TarrFormState {
    return { source: 'koester', category: 'Hiker', eco: 'Dry', terrain: 'Mountainous', dataset: 'koester',
        edited: null, globalCalibration: false, ...over };
}

test('eco and terrain buttons follow the web tool', () => {
    const hiker = findCategory(DS, 'Hiker');
    assert.deepEqual(ecoOptions(hiker), ['Temperate', 'Dry', OTHER_DEFAULT]);
    assert.deepEqual(terrainOptions(hiker, 'Temperate'), ['Mountainous', 'Flat']);
    assert.deepEqual(terrainOptions(hiker, 'Dry'), ['Mountainous', OTHER_DEFAULT]);
    assert.deepEqual(terrainOptions(hiker, null), []);
    assert.deepEqual(ecoOptions(findCategory(DS, 'Runner')), []);
});

test('variant fallback matches applyLPB', () => {
    const hiker = findCategory(DS, 'Hiker');
    assert.deepEqual(resolveVariant(hiker, 'Dry', 'Mountainous')?.distances_km, d(2, 3, 4));
    assert.deepEqual(resolveVariant(hiker, 'Dry', 'Flat')?.distances_km, d(2.5, 3.5, 4.5));
    assert.deepEqual(resolveVariant(hiker, 'Urban', null)?.distances_km, d(5, 6, 7));
});

test('calibration line: category-specific or dataset default', () => {
    const c1 = categoryCalibration(DS, findCategory(DS, 'Hiker'));
    assert.equal(c1?.profileSpecific, true);
    assert.equal(formatMultipliers(c1!.mult), '×1.00 / ×1.10 / ×1.40');
    const c2 = categoryCalibration(DS, findCategory(DS, 'Runner'));
    assert.equal(c2?.profileSpecific, false);
    assert.equal(formatMultipliers(c2!.mult), '×1.05 / ×1.35 / ×1.80');
});

test('Arizona rows WiSAR would reject are blocked with the reason', () => {
    const rows = azTable as ArizonaRow[];
    const missing = rows.find((r) => r.category === 'Aircraft-Missing');
    assert.ok(missing);
    assert.match(arizonaRowProblem(missing!) ?? '', /strictly increasing/);
    assert.equal(arizonaRowProblem({ category: 'x', cases: 0, qAmi: 0, qBmi: 0, qCmi: 0, qDmi: 0 }), 'The table has no cases for this category.');
    const ok = rows.find((r) => r.category === 'Aircraft-Crashed');
    assert.equal(arizonaRowProblem(ok!), null);
});

test('tarrProblem', () => {
    assert.equal(tarrProblem(null, state(), d(1, 2, 3), undefined), 'Choose an IPP.');
    assert.equal(tarrProblem(IPP, state({ category: '' }), null, undefined), 'Choose a subject profile.');
    assert.match(tarrProblem(IPP, state({ edited: d(3, 2, 1) }), d(3, 2, 1), undefined) ?? '', /strictly increasing/);
    assert.equal(tarrProblem(IPP, state(), d(2, 3, 4), undefined), null);
});

test('Koester unedited → listed subject with auto calibration', () => {
    assert.deepEqual(tarrRequest(IPP, state(), d(2, 3, 4)), {
        ipp: { lat: 35, lon: -111.7 },
        dataset: 'koester',
        subject: { kind: 'listed', category: 'Hiker', eco_region: 'Dry', terrain: 'Mountainous' },
        calibration: 'auto',
    });
});

test('Arizona percentiles include the 90% table distance, and the job sends it', () => {
    const row = { category: 'Hiker', cases: 10, qAmi: 0.9, qBmi: 1.9, qCmi: 3.5, qDmi: 8.2 };
    assert.deepEqual(arizonaPercentiles(row), { p25: 0.9, p50: 1.9, p75: 3.5, p90: 8.2 });
    const az = state({ source: 'arizona', category: 'Hiker', eco: null, terrain: null });
    const sent = tarrRequest(IPP, az, arizonaPercentiles(row));
    assert.deepEqual(sent.subject, {
        kind: 'custom',
        name: 'Hiker (AZ)',
        distances: { p25: 0.9, p50: 1.9, p75: 3.5, p90: 8.2, unit: 'mi' },
    });
});

test('a 90% that cannot form a ring is left out and the run goes ahead', () => {
    const az = state({ source: 'arizona', category: 'Hiker', eco: null, terrain: null });
    const blank = { ...d(0.9, 1.9, 3.5), p90: 0 };
    assert.deepEqual(p90Status(az, blank), { note: 'No 90% ring: the 90% distance is blank.', warn: true });
    assert.deepEqual(p90Status(az, { ...d(0.9, 1.9, 3.5), p90: Number.NaN }).send, undefined);
    assert.deepEqual(p90Status(az, { ...d(0.9, 1.9, 3.5), p90: 3.5 }),
        { note: 'No 90% ring: the 90% distance must be greater than 75% (3.50 mi).', warn: true });
    assert.equal(tarrProblem(IPP, az, blank, undefined), null);
    const sent = tarrRequest(IPP, az, blank);
    assert.deepEqual((sent.subject as { distances: object }).distances, { p25: 0.9, p50: 1.9, p75: 3.5, unit: 'mi' });
});

test('90% with global calibration: never calibrated; predicted drop when calibrated 75% reaches it', () => {
    const az = state({ source: 'arizona', category: 'Hiker', eco: null, terrain: null, globalCalibration: true });
    assert.deepEqual(p90Status(az, { ...d(1.2, 2.4, 4.6), p90: 9 }, 1.8),
        { send: 9, note: "The 90% ring isn't calibrated (there is no Coconino 90% multiplier); it stays at 9.00 mi.", warn: false });
    assert.deepEqual(p90Status(az, { ...d(1.2, 2.4, 4.6), p90: 5 }, 1.8), {
        send: 5,
        note: 'No 90% ring expected: calibration moves 75% to 8.28 mi, past the uncalibrated 90% (5.00 mi).',
        warn: true,
    });
    // still sent: WiSAR decides, and its p90 warning shows in the results
    const sent = tarrRequest(IPP, az, { ...d(1.2, 2.4, 4.6), p90: 5 });
    assert.equal((sent.subject as { distances: { p90?: number } }).distances.p90, 5);
});

test('Koester never sends a 90%', () => {
    assert.deepEqual(p90Status(state(), { ...d(2, 3, 4), p90: 9 }), { note: null, warn: false });
    const r = tarrRequest(IPP, state({ edited: { ...d(1, 2, 5), p90: 9 } }), { ...d(1, 2, 5), p90: 9 });
    assert.equal((r.subject as { distances: { p90?: number } }).distances.p90, undefined);
});

test('Arizona → custom subject in miles, calibration off by default, global when checked', () => {
    const az = state({ source: 'arizona', category: 'Hiker', eco: null, terrain: null });
    assert.deepEqual(tarrRequest(IPP, az, d(0.9, 1.9, 3.5)), {
        ipp: { lat: 35, lon: -111.7 },
        subject: { kind: 'custom', name: 'Hiker (AZ)', distances: { p25: 0.9, p50: 1.9, p75: 3.5, unit: 'mi' } },
        calibration: 'none',
    });
    const cal = tarrRequest(IPP, { ...az, globalCalibration: true }, d(0.9, 1.9, 3.5));
    assert.equal(cal.calibration, 'global');
    assert.equal(cal.dataset, 'koester');
});

test('edited values → custom subject named as edited', () => {
    const r = tarrRequest(IPP, state({ edited: d(1, 2, 5) }), d(1, 2, 5));
    assert.deepEqual(r.subject, { kind: 'custom', name: 'Hiker (edited)', distances: { p25: 1, p50: 2, p75: 5, unit: 'km' } });
    assert.equal(r.calibration, 'none');
    const az = tarrRequest(IPP, state({ source: 'arizona', edited: d(1, 2, 5) }), d(1, 2, 5));
    assert.equal((az.subject as { name: string }).name, 'Hiker (AZ, edited)');
});
