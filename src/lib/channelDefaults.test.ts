import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableDefaults } from './channelDefaults.ts';

const channels = [
    { name: 'SAR Members', active: true, direction: ['IN', 'OUT'] },
    { name: 'IMT', active: true, direction: ['IN'] },
    { name: 'Inactive', active: false, direction: ['IN', 'OUT'] },
    { name: 'Out Only', active: true, direction: ['OUT'] },
];

test('availableDefaults keeps configured order and drops channels the user cannot pick', () => {
    assert.deepEqual(
        availableDefaults(['IMT', 'Missing', 'SAR Members', 'Inactive', 'Out Only', 'IMT'], channels),
        ['IMT', 'SAR Members'],
    );
});

test('availableDefaults matches channel names exactly', () => {
    assert.deepEqual(availableDefaults(['imt'], channels), []);
    assert.deepEqual(availableDefaults([], channels), []);
});
