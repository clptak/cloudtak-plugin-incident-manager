import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    MAX_PERSONNEL,
    mergePersonnelById,
    normalizePersonnel,
    parsePersonnelText,
    selectEffectiveMembers,
} from './personnel.ts';
import type { D4HMember } from './d4hTypes.ts';

function member(id: number, name: string, extra: Partial<D4HMember> = {}): D4HMember {
    return { id, name, ...extra };
}

test('parsePersonnelText reads a D4H roster object', () => {
    const parsed = parsePersonnelText(JSON.stringify({
        members: [
            { id: 1, name: 'Smith, Jane', ref: '42', position: 'Field', status: 'operational', phone: '555' },
        ],
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
        assert.deepEqual(parsed.value, [member(1, 'Smith, Jane', { ref: '42', position: 'Field' })]);
    }
});

test('parsePersonnelText reads a members array and { personnel }', () => {
    const arr = parsePersonnelText(JSON.stringify([
        { id: '2', name: '  Doe, John  ', callsign: 'JD', email: 'j@x.com' },
    ]));
    assert.equal(arr.ok, true);
    if (arr.ok) {
        assert.deepEqual(arr.value, [member(2, 'Doe, John', { callsign: 'JD', email: 'j@x.com' })]);
    }

    const obj = parsePersonnelText(JSON.stringify({
        personnel: [{ id: 3, name: 'Lee' }],
    }));
    assert.equal(obj.ok, true);
    if (obj.ok) assert.deepEqual(obj.value, [member(3, 'Lee')]);
});

test('parsePersonnelText reads CSV with quoted names', () => {
    const csv = 'id,name,ref,position\n1,"Smith, Jane",42,Field\n2,Doe,7,';
    const parsed = parsePersonnelText(csv);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
        assert.deepEqual(parsed.value, [
            member(1, 'Smith, Jane', { ref: '42', position: 'Field' }),
            member(2, 'Doe', { ref: '7' }),
        ]);
    }
});

test('parsePersonnelText rejects missing id or name', () => {
    const noId = parsePersonnelText(JSON.stringify([{ name: 'No Id' }]));
    assert.equal(noId.ok, false);
    if (!noId.ok) assert.match(noId.error, /id/);

    const noName = parsePersonnelText(JSON.stringify([{ id: 1, name: '  ' }]));
    assert.equal(noName.ok, false);
    if (!noName.ok) assert.match(noName.error, /name/);

    const badCsv = parsePersonnelText('name,ref\nJane,1');
    assert.equal(badCsv.ok, false);
    if (!badCsv.ok) assert.match(badCsv.error, /id and name/);
});

test('normalizePersonnel de-dupes by id and caps at MAX_PERSONNEL', () => {
    assert.deepEqual(
        normalizePersonnel([member(1, 'A'), member(1, 'B'), member(2, 'C')]),
        [member(1, 'A'), member(2, 'C')],
    );
    const many = Array.from({ length: MAX_PERSONNEL + 10 }, (_, i) => member(i + 1, `P${i}`));
    assert.equal(normalizePersonnel(many).length, MAX_PERSONNEL);
});

test('mergePersonnelById replaces matching ids then appends', () => {
    const merged = mergePersonnelById(
        [member(1, 'Old', { ref: 'a' }), member(2, 'Keep')],
        [member(1, 'New', { ref: 'b' }), member(3, 'Added')],
    );
    assert.deepEqual(merged, [
        member(1, 'New', { ref: 'b' }),
        member(2, 'Keep'),
        member(3, 'Added'),
    ]);
});

test('selectEffectiveMembers uses KV when D4H is on, else settings', () => {
    const kv = [member(1, 'D4H')];
    const custom = [member(9, 'Custom')];
    assert.deepEqual(selectEffectiveMembers(true, kv, custom), kv);
    assert.deepEqual(selectEffectiveMembers(true, null, custom), []);
    assert.deepEqual(selectEffectiveMembers(false, kv, custom), custom);
});
