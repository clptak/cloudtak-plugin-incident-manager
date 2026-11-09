import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lpbCenterChoices, lpbCenterSummary } from './lpbCenter.ts';

const schema = {
    incident_response: {
        ipp_coordinates: { lat: 33.5, lng: -111.9 },
        subjects: [
            { initial_information: { subjectCaseID: '01', subjectIpp: '33.6, -112.0', subjectIppFromTak: '' } },
            { initial_information: { subjectCaseID: '02', subjectIpp: 'by the trailhead', subjectIppFromTak: '' } },
        ],
    },
};

test('lpbCenterChoices: IPP, then subject locations, then markers', () => {
    const choices = lpbCenterChoices({
        schema,
        ippType: 'PLS',
        markers: [{ uid: 'm1', callsign: 'Truck', coords: [-111.8, 33.4] }, { uid: 'm2', callsign: 'No coords' }],
    });
    assert.deepEqual(choices.map((c) => c.value), ['ipp', 'subject:01', 'marker:m1']);
    assert.equal(choices[0].label, 'IPP (PLS) — 33.50000, -111.90000');
    assert.deepEqual(choices[1].coords, [-112, 33.6]);
    assert.equal(choices[1].label, 'Subject 01 estimated location — 33.60000, -112.00000');
});

test('lpbCenterChoices: no schema IPP means no IPP choice', () => {
    const choices = lpbCenterChoices({ schema: { incident_response: {} }, markers: [] });
    assert.equal(choices.length, 0);
});

test('lpbCenterSummary: adds coordinates only when the label lacks them', () => {
    assert.equal(lpbCenterSummary('Truck', [-111.8, 33.4]), 'Plotting around Truck at 33.40000, -111.80000.');
    assert.equal(lpbCenterSummary('IPP — 33.50000, -111.90000', [-111.9, 33.5]), 'Plotting around IPP — 33.50000, -111.90000.');
});
