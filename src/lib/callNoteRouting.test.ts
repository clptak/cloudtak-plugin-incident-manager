import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callNoteContent, callNoteDuplicates, toggleDest } from './callNoteRouting.ts';

test('toggleDest: picks, switches, and clears', () => {
    assert.equal(toggleDest(null, 'field'), 'field');
    assert.equal(toggleDest('field', 'mgmt'), 'mgmt');
    assert.equal(toggleDest('mgmt', 'mgmt'), null);
});

test('callNoteContent: appends coordinates when present', () => {
    assert.equal(callNoteContent({ remark: 'RP on scene', lat: '', lon: '' }), 'RP on scene');
    assert.equal(callNoteContent({ remark: 'Truck', lat: 33.5, lon: -111.9 }), 'Truck [33.5, -111.9]');
});

test('callNoteDuplicates: matches identical wording per DataSync, ignoring case and spacing', () => {
    const rows = [
        { remark: 'RP on scene', lat: '' as const, lon: '' as const },
        { remark: 'Subject last seen', lat: '' as const, lon: '' as const },
    ];
    const dups = callNoteDuplicates(rows, { field: ['rp  on scene '], mgmt: ['Subject last seen', 'RP on scene'] });
    assert.deepEqual(dups, [{ field: true, mgmt: true }, { field: false, mgmt: true }]);
});
