import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    INTERVAL_OPTIONS,
    SPEED_PRESETS,
    convertSpeedText,
    formatElapsed,
    speedKmh,
    travelTimeProblem,
    travelTimeRequest,
} from './wisarTravelTime.ts';

const IPP = { lat: 34.9523, lon: -111.761 };

test('presets and intervals match the web tool', () => {
    assert.deepEqual(SPEED_PRESETS.map((p) => [p.mph, p.label]),
        [[0.5, 'Impaired'], [1.0, 'Slow'], [2.0, 'Moderate'], [3.1, 'Fit hiker']]);
    assert.deepEqual([...INTERVAL_OPTIONS], [2, 4, 6, 8, 10, 12]);
});

test('unit switch converts and rounds to 0.1 like setIsoUnit', () => {
    assert.equal(convertSpeedText('2', 'mph', 'kmh'), '3.2');
    assert.equal(convertSpeedText('5', 'kmh', 'mph'), '3.1');
    assert.equal(convertSpeedText('2', 'mph', 'mph'), '2');
    assert.equal(convertSpeedText('', 'mph', 'kmh'), '');
    assert.equal(convertSpeedText('abc', 'mph', 'kmh'), 'abc');
});

test('travelTimeProblem: IPP, speed, limit, intervals', () => {
    assert.equal(travelTimeProblem(null, '2', 'mph', [2]), 'Choose an IPP.');
    assert.equal(travelTimeProblem(IPP, '', 'mph', [2]), 'Enter a travel speed.');
    assert.equal(travelTimeProblem(IPP, '0', 'mph', [2]), 'Enter a travel speed.');
    assert.match(travelTimeProblem(IPP, '12.5', 'mph', [2]) ?? '', /at most 20 km\/h \(12\.4 mph\)/);
    assert.equal(travelTimeProblem(IPP, '20', 'kmh', [2]), null);
    assert.equal(travelTimeProblem(IPP, '2', 'mph', []), 'Select at least one time interval.');
    assert.equal(travelTimeProblem(IPP, '3.1', 'mph', [2, 4]), null);
});

test('travelTimeRequest matches the API contract', () => {
    assert.deepEqual(travelTimeRequest(IPP, '2.0', 'mph', [8, 2, 4, 2]), {
        ipp: { lat: 34.9523, lon: -111.761 },
        speed: { value: 2, unit: 'mph' },
        intervals_hours: [2, 4, 8],
    });
    assert.ok(Math.abs(speedKmh(2, 'mph') - 3.218688) < 1e-9);
});

test('formatElapsed', () => {
    assert.equal(formatElapsed(0), '0:00');
    assert.equal(formatElapsed(65_400), '1:05');
});
