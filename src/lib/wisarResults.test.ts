import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ContourCollection, ContourFeature, Job } from './wisar.ts';
import {
    OUTPUT_LABELS,
    TT_FOLDER_NAME,
    compareWisarAreas,
    contourBounds,
    isWisarAreaKey,
    contourLabel,
    ringNaming,
    tarrFolderName,
    tarrNaming,
    contourKey,
    mainOutline,
    selectContours,
    simplifyRing,
    sortedContours,
    travelTimeCallsign,
    uniqueName,
    type Ring,
} from './wisarResults.ts';
import { OUTPUT_NAMES } from './wisar.ts';

const square = (x: number, y: number, s: number): Ring => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];

function feature(hours: number, geometry: ContourFeature['geometry']): ContourFeature {
    return {
        type: 'Feature',
        geometry,
        properties: {
            callsign: `${hours}h`, remarks: '', color: '#00bcd4', threshold_m: hours * 1000, hours,
            stroke: '#00bcd4', 'stroke-width': 3, 'stroke-opacity': 1, fill: '#00bcd4', 'fill-opacity': 0.1,
        },
    };
}

test('naming follows decision 5 and the LPB unique-suffix rule', () => {
    assert.equal(TT_FOLDER_NAME, 'WiSAR Distance Traveled');
    assert.equal(travelTimeCallsign(2), '2h Travel Time');
    assert.equal(travelTimeCallsign(4.5), '4.5h Travel Time');
    assert.equal(uniqueName(TT_FOLDER_NAME, []), 'WiSAR Distance Traveled');
    assert.equal(uniqueName(TT_FOLDER_NAME, [TT_FOLDER_NAME, `${TT_FOLDER_NAME} (2)`]), 'WiSAR Distance Traveled (3)');
});

test('mainOutline picks the largest polygon and counts what is dropped', () => {
    const multi = { type: 'MultiPolygon' as const, coordinates: [
        [square(0, 0, 1)],
        [square(10, 10, 5), square(11, 11, 1)],
    ] };
    const out = mainOutline(multi);
    assert.ok(out);
    assert.deepEqual(out.ring[0], [10, 10]);
    assert.equal(out.parts, 2);
    assert.equal(out.holes, 1);
    assert.equal(mainOutline({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] }), null);
});

test('simplifyRing removes stair-steps but keeps a closed ring', () => {
    // A 1 km square edge made of 1 m stair-steps.
    const ring: Ring = [];
    for (let i = 0; i <= 100; i++) ring.push([i * 0.0001, (i % 2) * 0.000005]);
    ring.push([0.01, 0.01], [0, 0.01], [0, 0]);
    const s = simplifyRing(ring);
    assert.ok(s.length < 10, `got ${s.length}`);
    assert.deepEqual(s[0], s[s.length - 1]);
    assert.ok(s.length >= 4);
    assert.deepEqual(simplifyRing(square(0, 0, 1)), square(0, 0, 1));
});

test('contourBounds and sortedContours', () => {
    const fc: ContourCollection = { type: 'FeatureCollection', features: [
        feature(4, { type: 'Polygon', coordinates: [square(-112, 35, 0.2)] }),
        feature(2, { type: 'Polygon', coordinates: [square(-111.9, 35.05, 0.1)] }),
    ] };
    assert.deepEqual(contourBounds(fc), [-112, 35, -111.8, 35.2]);
    assert.deepEqual(sortedContours(fc).map((f) => f.properties.hours), [2, 4]);
    assert.equal(contourBounds({ type: 'FeatureCollection', features: [] }), null);
});

test('every API data output has a download label; overlays are map layers, not downloads', () => {
    const data = OUTPUT_NAMES.filter((n) => !n.startsWith('overlay-'));
    assert.deepEqual(OUTPUT_LABELS.map((o) => o.name).sort(), [...data].sort());
});

test('selectContours keeps only the chosen contours', () => {
    const fc: ContourCollection = { type: 'FeatureCollection', features: [
        feature(2, { type: 'Polygon', coordinates: [square(0, 0, 1)] }),
        feature(4, { type: 'Polygon', coordinates: [square(0, 0, 2)] }),
        feature(6, { type: 'Polygon', coordinates: [square(0, 0, 3)] }),
    ] };
    assert.deepEqual(fc.features.map(contourKey), ['2', '4', '6']);
    assert.deepEqual(selectContours(fc, new Set(['2', '6'])).features.map((f) => f.properties.hours), [2, 6]);
    assert.equal(selectContours(fc, new Set()).features.length, 0);
});

test('TARR naming follows decision 5 for each source', () => {
    const listed = { type: 'tarr', request: { subject: { kind: 'listed', category: 'Hiker' } } } as unknown as Job;
    const az = { type: 'tarr', request: { subject: { kind: 'custom', name: 'Search-Hiker (AZ)' } } } as unknown as Job;
    const azEdited = { type: 'tarr', request: { subject: { kind: 'custom', name: 'Search-Hiker (AZ, edited)' } } } as unknown as Job;
    const kEdited = { type: 'tarr', request: { subject: { kind: 'custom', name: 'Hiker (edited)' } } } as unknown as Job;
    assert.equal(tarrFolderName(listed), 'Koester LPB Hiker WiSAR');
    assert.equal(tarrFolderName(az), 'AZ LPB Search-Hiker WiSAR');
    assert.equal(tarrFolderName(azEdited), 'AZ LPB Search-Hiker WiSAR');
    assert.equal(tarrFolderName(kEdited), 'Koester LPB Hiker WiSAR');
    assert.deepEqual(tarrNaming({ request: { subject: { kind: 'custom', name: 'Odd' } } } as unknown as Job), { category: 'Odd', source: 'AZ' });

    const f = feature(0, { type: 'Polygon', coordinates: [square(0, 0, 1)] });
    f.properties.hours = undefined;
    f.properties.percentile = '25%';
    f.properties.threshold_m = 1287.4752; // 0.80 mi
    assert.equal(contourLabel(f), '25%');
    assert.deepEqual(ringNaming(az, f), { folder: 'AZ LPB Search-Hiker WiSAR', callsign: '25% - 0.80mi - Search-Hiker', areaPrefix: 'wisar-tarr', areaId: '25' });
    const tt = { type: 'travel_time', request: {} } as unknown as Job;
    const g = feature(4, { type: 'Polygon', coordinates: [square(0, 0, 1)] });
    assert.deepEqual(ringNaming(tt, g), { folder: 'WiSAR Distance Traveled', callsign: '4h Travel Time', areaPrefix: 'wisar-tt', areaId: '4' });
    assert.equal(contourLabel(g), '4h');
});

test('Search Area grouping helpers for WiSAR rings', () => {
    assert.ok(isWisarAreaKey('wisar-tt:abc:2'));
    assert.ok(isWisarAreaKey('wisar-tarr:abc:25'));
    assert.ok(!isWisarAreaKey('lpb:abc:A'));
    assert.ok(!isWisarAreaKey('wisar-ttx'));
    const rows = [
        { key: 'wisar-tt:p1:10', folder: 'WiSAR Distance Traveled' },
        { key: 'wisar-tarr:p2:75', folder: 'AZ LPB Search-Hiker WiSAR' },
        { key: 'wisar-tt:p1:2', folder: 'WiSAR Distance Traveled' },
        { key: 'wisar-tarr:p2:25', folder: 'AZ LPB Search-Hiker WiSAR' },
    ];
    assert.deepEqual([...rows].sort(compareWisarAreas).map((r) => r.key),
        ['wisar-tarr:p2:25', 'wisar-tarr:p2:75', 'wisar-tt:p1:2', 'wisar-tt:p1:10']);
});
