import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankSubjectForm } from './subjectInfo.ts';
import {
    ippAfterSavedForm,
    ippFromSubjects,
    resolveDefaultIpp,
    resolveDisplayedIpp,
    subjectsOnSchema,
    toIppField,
} from './defaultIpp.ts';

const formatUtm = (lat: number, lng: number) => `UTM(${lat},${lng})`;

function subject(id: string, ipp = '', fromTak = '') {
    const form = blankSubjectForm(id);
    form.subjectIpp = ipp;
    form.subjectIppFromTak = fromTak;
    return form;
}

test('strips the marker uid from a DataSync IPP', () => {
    const picked = ippFromSubjects([subject('01', '', '36.05432 ,-112.12345;uid-1')]);
    assert.equal(picked?.text, '36.05432 ,-112.12345');
    const field = toIppField(picked!.text, formatUtm);
    assert.equal(field.latLng?.lat, 36.05432);
    assert.equal(field.latLng?.lng, -112.12345);
    assert.equal(field.text, 'UTM(36.05432,-112.12345)');
});

test('typed coordinates win over a DataSync marker', () => {
    const picked = ippFromSubjects([
        subject('01', '36.10000, -112.20000', '36.05432 ,-112.12345;uid-1'),
    ]);
    assert.equal(picked?.text, '36.10000, -112.20000');
});

test('subject 01 is used before 02, and a subject with no IPP is skipped', () => {
    const onlySecond = ippFromSubjects([
        subject('02', '36.20000, -112.20000'),
        subject('01'),
    ]);
    assert.equal(onlySecond?.number, '02');

    const first = ippFromSubjects([
        subject('02', '36.20000, -112.20000'),
        subject('01', '36.10000, -112.10000'),
    ]);
    assert.equal(first?.number, '01');
});

test('falls back to Search Area coordinates, then the injected map marker', async () => {
    const fromArea = await resolveDefaultIpp({
        schema: { incident_response: { ipp_coordinates: { lat: 36.5, lng: -112.5 } } },
        formatUtm,
        markerLookup: async () => ({ lat: 1, lng: 2 }),
    });
    assert.equal(fromArea?.source, 'Search Area IPP');
    assert.equal(fromArea?.text, 'UTM(36.5,-112.5)');

    const fromMarker = await resolveDefaultIpp({
        schema: { incident_response: {} },
        formatUtm,
        markerLookup: async () => ({ lat: 36.9, lng: -112.9 }),
    });
    assert.equal(fromMarker?.source, 'Map marker');
    assert.equal(fromMarker?.latLng?.lat, 36.9);

    const fromSubject = await resolveDefaultIpp({
        schema: {
            incident_response: {
                ipp_coordinates: { lat: 1, lng: 2 },
                subjects: [{
                    initial_information: {
                        subjectCaseID: '01',
                        subjectIpp: '36.11111, -112.11111',
                    },
                }],
            },
        },
        formatUtm,
        markerLookup: async () => ({ lat: 9, lng: 9 }),
    });
    assert.equal(fromSubject?.source, 'Subject 01');
    assert.equal(fromSubject?.latLng?.lat, 36.11111);
});

test('non-coordinate text is kept and has no lat/lng', () => {
    const field = toIppField('near the trailhead', formatUtm);
    assert.equal(field.text, 'near the trailhead');
    assert.equal(field.latLng, null);
});

test('an edited IPP is kept; a saved ICS 201 IPP is kept on reload', () => {
    assert.equal(resolveDisplayedIpp('user edit', 'UTM(1,2)', true), 'user edit');
    assert.equal(resolveDisplayedIpp('UTM(1,2)', 'UTM(3,4)', false), 'UTM(3,4)');
    assert.equal(ippAfterSavedForm('saved IPP', 'UTM(1,2)'), 'saved IPP');
    assert.equal(ippAfterSavedForm('  ', 'UTM(1,2)'), 'UTM(1,2)');
});

test('a stored subject without a case number is subject 01; a later record for a number replaces the earlier', () => {
    const subjects = subjectsOnSchema({
        incident_response: {
            subjects: [
                { initial_information: { subjectIpp: '36.1, -112.1' } },
                { initial_information: { subjectCaseID: '02', subjectIpp: 'old' } },
                { initial_information: { subjectCaseID: '02', subjectIpp: 'new' } },
            ],
        },
    });
    assert.deepEqual(subjects.map((x) => [x.subjectCaseID, x.subjectIpp]), [['01', '36.1, -112.1'], ['02', 'new']]);
    assert.equal(ippFromSubjects(subjects)?.number, '01');
});

test('non-numeric case numbers sort after numbered subjects', () => {
    const picked = ippFromSubjects([subject('X', 'x-ipp'), subject('02', 'two')]);
    assert.equal(picked?.number, '02');
});

test('typed text that is not coordinates keeps weather on the DataSync marker', async () => {
    const ipp = await resolveDefaultIpp({
        schema: {
            incident_response: {
                ipp_coordinates: { lat: 1, lng: 2 },
                subjects: [{
                    initial_information: {
                        subjectCaseID: '01',
                        subjectIpp: '12S 431234 3881234',
                        subjectIppFromTak: '36.05432 ,-112.12345;uid-1',
                    },
                }],
            },
        },
        formatUtm,
        markerLookup: async () => ({ lat: 9, lng: 9 }),
    });
    assert.equal(ipp?.text, '12S 431234 3881234');
    assert.equal(ipp?.latLng, null);
    assert.deepEqual(ipp?.weatherLatLng, { lat: 36.05432, lng: -112.12345 });
});

test('weather falls back to the Search Area IPP, then the map marker, when the subject has no coordinates', async () => {
    const schemaWith = (extra: Record<string, unknown>) => ({
        incident_response: {
            ...extra,
            subjects: [{ initial_information: { subjectCaseID: '01', subjectIpp: 'by the trailhead' } }],
        },
    });
    let lookups = 0;
    const markerLookup = async () => { lookups++; return { lat: 9, lng: 9 }; };

    const area = await resolveDefaultIpp({ schema: schemaWith({ ipp_coordinates: { lat: 1, lng: 2 } }), formatUtm, markerLookup });
    assert.deepEqual(area?.weatherLatLng, { lat: 1, lng: 2 });
    assert.equal(lookups, 0);

    const marker = await resolveDefaultIpp({ schema: schemaWith({}), formatUtm, markerLookup });
    assert.equal(marker?.text, 'by the trailhead');
    assert.deepEqual(marker?.weatherLatLng, { lat: 9, lng: 9 });
});

test('weather uses the IPP itself when it is coordinates', async () => {
    const ipp = await resolveDefaultIpp({
        schema: { incident_response: { subjects: [{ initial_information: { subjectCaseID: '01', subjectIpp: '36.2, -112.2' } }] } },
        formatUtm,
        markerLookup: async () => ({ lat: 9, lng: 9 }),
    });
    assert.deepEqual(ipp?.weatherLatLng, { lat: 36.2, lng: -112.2 });
});
