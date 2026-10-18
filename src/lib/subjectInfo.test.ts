import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    blankSubjectForm,
    buildSubjectKeywords,
    fieldsFromLog,
    legacySubjectProfile,
    subjectDetailRows,
} from './subjectInfo.ts';

test('legacySubjectProfile prefers subjectProfile, then subjectType, then category label', () => {
    assert.equal(legacySubjectProfile({
        subjectProfile: 'Hiker',
        subjectType: 'Hunter',
        subjectCategory: 'child',
    }), 'Hiker');
    assert.equal(legacySubjectProfile({ subjectType: 'Hunter', subjectCategory: 'child' }), 'Hunter');
    assert.equal(legacySubjectProfile({ subjectCategory: 'mental_illness' }), 'Mental Illness');
    assert.equal(legacySubjectProfile({ subjectCategory: 'alzheimer_dementia' }), "Alzheimer's/Dementia");
    assert.equal(legacySubjectProfile({ subjectCategory: 'custom_saved' }), 'custom_saved');
    assert.equal(legacySubjectProfile({}), '');
});

test('fieldsFromLog reads subjectProfile, then subjectType, then category', () => {
    assert.equal(
        fieldsFromLog(['subject-information', 'subject:01', 'subjectProfile:Hiker']).subjectProfile,
        'Hiker',
    );
    assert.equal(
        fieldsFromLog(['subject-information', 'subject:01', 'subjectType:Hunter']).subjectProfile,
        'Hunter',
    );
    assert.equal(
        fieldsFromLog(['subject-information', 'subject:01', 'category:substance_abuse']).subjectProfile,
        'Substance Abuse',
    );
    assert.equal(
        fieldsFromLog([
            'subject-information',
            'subject:01',
            'subjectProfile:Hiker',
            'subjectType:Hunter',
            'category:child',
        ]).subjectProfile,
        'Hiker',
    );
});

test('buildSubjectKeywords writes subjectProfile and not the old keys', () => {
    const form = blankSubjectForm('01');
    form.subjectProfile = 'Hiker';
    const kws = buildSubjectKeywords(form);
    assert.ok(kws.includes('subjectProfile:Hiker'));
    assert.equal(kws.some((k) => k.startsWith('subjectType:') || k.startsWith('category:')), false);
});

test('subjectDetailRows labels Subject Profile and drops Category', () => {
    const form = blankSubjectForm('01');
    form.subjectProfile = 'Hiker';
    const rows = subjectDetailRows(form);
    assert.deepEqual(rows, [{ label: 'Subject Profile', value: 'Hiker' }]);
});
