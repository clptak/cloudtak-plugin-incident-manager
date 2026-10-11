import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    formatIppSummary,
    ippTypeFromLabel,
    ippTypeToLabel,
    IPP_TYPE_OPTIONS,
    pointCoordsFromFeature,
} from './ippFormat.ts';

test('ippTypeFromLabel / ippTypeToLabel round-trip LKP and PLS', () => {
    assert.equal(ippTypeFromLabel(IPP_TYPE_OPTIONS[0]), 'LKP');
    assert.equal(ippTypeFromLabel(IPP_TYPE_OPTIONS[1]), 'PLS');
    assert.equal(ippTypeFromLabel('other'), 'LKP');
    assert.equal(ippTypeToLabel('LKP'), IPP_TYPE_OPTIONS[0]);
    assert.equal(ippTypeToLabel('PLS'), IPP_TYPE_OPTIONS[1]);
});

test('pointCoordsFromFeature reads Point geometry then properties.center', () => {
    assert.deepEqual(
        pointCoordsFromFeature({ geometry: { type: 'Point', coordinates: [-111.5, 35.2] } }),
        [-111.5, 35.2],
    );
    assert.deepEqual(
        pointCoordsFromFeature({
            geometry: { type: 'Polygon', coordinates: [] },
            properties: { center: [-110, 34] },
        }),
        [-110, 34],
    );
    assert.equal(pointCoordsFromFeature({ geometry: { type: 'LineString' } }), undefined);
});

test('formatIppSummary prints type and lat, lng', () => {
    assert.equal(
        formatIppSummary([-105.2705, 40.015], 'LKP'),
        'Plotting around IPP (LKP) at 40.01500, -105.27050.',
    );
});
