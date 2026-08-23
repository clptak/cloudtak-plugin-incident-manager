import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    incidentStemFromName,
    isSameIncidentFamily,
    isSearchIncidentType,
    parentIncidentCandidateNames,
    parseIncidentTypeFromKeywords,
    parseIncidentTypeFromRecord,
    SEARCH_ONLY_HTAB_KEYS,
    SEARCH_ONLY_NAV_KEYS,
} from './incidentType.ts';

test('parseIncidentTypeFromKeywords reads incidentType slug', () => {
    assert.equal(parseIncidentTypeFromKeywords(['incidentType:search']), 'search');
    assert.equal(parseIncidentTypeFromKeywords(['activityNumber:1', 'incidentType:rescue']), 'rescue');
    assert.equal(parseIncidentTypeFromKeywords(['other:x']), '');
    assert.equal(parseIncidentTypeFromKeywords([]), '');
    assert.equal(parseIncidentTypeFromKeywords(undefined), '');
});

test('parseIncidentTypeFromRecord checks keywords and meta.keywords', () => {
    assert.equal(parseIncidentTypeFromRecord({ keywords: ['incidentType:search'] }), 'search');
    assert.equal(parseIncidentTypeFromRecord({ meta: { keywords: ['incidentType:disaster'] } }), 'disaster');
    assert.equal(parseIncidentTypeFromRecord({ keywords: ['noop'], meta: { keywords: ['incidentType:other'] } }), 'other');
    assert.equal(parseIncidentTypeFromRecord(null), '');
    assert.equal(parseIncidentTypeFromRecord({}), '');
});

test('isSearchIncidentType is strict', () => {
    assert.equal(isSearchIncidentType('search'), true);
    assert.equal(isSearchIncidentType('Search'), false);
    assert.equal(isSearchIncidentType('rescue'), false);
    assert.equal(isSearchIncidentType(''), false);
    assert.equal(isSearchIncidentType(undefined), false);
});

test('incident stem treats OP DataSyncs as the same incident', () => {
    assert.equal(incidentStemFromName('2026-08-21_search_foo_OP-00'), '2026-08-21_search_foo');
    assert.equal(incidentStemFromName('2026-08-21_search_foo_OP-01'), '2026-08-21_search_foo');
    assert.equal(incidentStemFromName('Alpha Incident - OP2'), 'Alpha Incident');
    assert.equal(incidentStemFromName('Alpha Incident - MGMT'), 'Alpha Incident');
    assert.ok(isSameIncidentFamily('Alpha Incident', 'Alpha Incident - OP1'));
    assert.ok(isSameIncidentFamily('base_OP-00', 'base_OP-03'));
    assert.ok(!isSameIncidentFamily('Alpha', 'Bravo - OP1'));
    assert.deepEqual(parentIncidentCandidateNames('Alpha Incident - OP2'), [
        'Alpha Incident',
        'Alpha Incident_OP-00',
        'Alpha Incident - MGMT',
    ]);
});

test('search-only key sets cover the planned chrome', () => {
    for (const key of ['search-urgency', 'search-scenarios', 'search-area', 'segmentation', 'initial-consensus', 'operational-periods']) {
        assert.ok(SEARCH_ONLY_NAV_KEYS.has(key), key);
    }
    for (const key of ['task', 'clues', 'casie']) {
        assert.ok(SEARCH_ONLY_HTAB_KEYS.has(key), key);
    }
});
