import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildAgencyOptions,
    resolveEffectiveDefaultAgency,
} from './resourceAssignments.ts';

test('resolveEffectiveDefaultAgency prefers mission, then Your Agency, then D4H', () => {
    assert.equal(
        resolveEffectiveDefaultAgency('Mission SAR', 'D4H Team', 'Settings Agency'),
        'Mission SAR',
    );
    assert.equal(
        resolveEffectiveDefaultAgency('', 'D4H Team', 'Settings Agency'),
        'Settings Agency',
    );
    assert.equal(
        resolveEffectiveDefaultAgency('', 'D4H Team', ''),
        'D4H Team',
    );
    assert.equal(resolveEffectiveDefaultAgency('  ', '', '  '), '');
});

test('buildAgencyOptions puts home first then sorted aiding names', () => {
    assert.deepEqual(
        buildAgencyOptions(['Forest Service', 'BLM', 'County SAR'], 'County SAR'),
        ['County SAR', 'BLM', 'Forest Service'],
    );
});

test('buildAgencyOptions de-dupes the home agency from the aiding list', () => {
    assert.deepEqual(
        buildAgencyOptions(['BLM', 'NPS'], 'BLM'),
        ['BLM', 'NPS'],
    );
});
