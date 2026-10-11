import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    STORED_IPP_ID,
    defaultIppUid,
    distanceM,
    formatLatLon,
    ippOptions,
    type IppMarker,
} from './wisarIpp.ts';

const MARKERS: IppMarker[] = [
    { uid: 'a', callsign: 'Trailhead', coords: [-111.70, 35.20] },
    { uid: 'b', callsign: 'IPP-LKP', coords: [-111.761, 34.9523] },
    { uid: 'c', callsign: 'No coords' },
    { uid: 'd', callsign: 'Bad', coords: [Number.NaN, 35] },
];

test('ippOptions keeps markers with usable coordinates, as lat/lon', () => {
    const opts = ippOptions(MARKERS, null);
    assert.deepEqual(opts.map((o) => [o.uid, o.lat, o.lon, o.source]), [
        ['a', 35.20, -111.70, 'marker'],
        ['b', 34.9523, -111.761, 'marker'],
    ]);
});

test('stored IPP on a marker preselects that marker; no extra entry', () => {
    const stored = { lat: 34.9523, lng: -111.761, type: 'LKP' as const };
    const opts = ippOptions(MARKERS, stored);
    assert.ok(!opts.some((o) => o.uid === STORED_IPP_ID));
    assert.equal(defaultIppUid(opts, stored), 'b');
});

test('an IPP- callsign wins when two markers sit on the stored IPP', () => {
    const stored = { lat: 34.9523, lng: -111.761, type: 'PLS' as const };
    const markers: IppMarker[] = [
        { uid: 'x', callsign: 'Vehicle', coords: [-111.761, 34.9523] },
        { uid: 'b', callsign: 'IPP-PLS', coords: [-111.76100001, 34.9523] },
    ];
    assert.equal(defaultIppUid(ippOptions(markers, stored), stored), 'b');
});

test('stored IPP with no marker on it is offered and preselected', () => {
    const stored = { lat: 35.1, lng: -111.6, type: 'PLS' as const };
    const opts = ippOptions(MARKERS, stored);
    const entry = opts.find((o) => o.uid === STORED_IPP_ID);
    assert.ok(entry);
    assert.equal(entry.label, 'Incident IPP (PLS, no marker)');
    assert.deepEqual([entry.lat, entry.lon, entry.source], [35.1, -111.6, 'stored']);
    assert.equal(defaultIppUid(opts, stored), STORED_IPP_ID);
});

test('no stored IPP: nothing preselected, even with an IPP- marker', () => {
    assert.equal(defaultIppUid(ippOptions(MARKERS, null), null), '');
});

test('distanceM and formatLatLon', () => {
    assert.ok(Math.abs(distanceM({ lat: 35, lon: -111 }, { lat: 35.001, lon: -111 }) - 111.2) < 0.5);
    assert.equal(formatLatLon({ lat: 34.95231234, lon: -111.761 }), '34.95231, -111.76100');
});
