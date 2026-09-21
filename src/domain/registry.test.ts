import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OpPeriodRegistryEntry } from './entities.ts';
import {
    closeRegistryEntry,
    currentOpPeriod,
    nextOpNumber,
    opSyncName,
    registryFromSchemaValue,
    upsertRegistryEntry,
} from './registry.ts';

function entry(partial: Partial<OpPeriodRegistryEntry> & { opNumber: number; guid: string }): OpPeriodRegistryEntry {
    return {
        name: `OP${partial.opNumber}`,
        status: 'open',
        channels: ['CCSO Sworn', 'CCSO SarVol'],
        ...partial,
    };
}

test('registryFromSchemaValue: tolerates legacy free-form content', () => {
    const parsed = registryFromSchemaValue([
        'legacy mission name',                              // legacy string
        { guid: 'g2', name: 'OP2', opNumber: 2 },           // minimal valid
        { guid: '', name: 'broken', opNumber: 1 },          // missing guid
        { guid: 'g1', name: 'OP1', opNumber: 1, status: 'closed', ownerToken: 't1' },
        42,
        null,
    ]);
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed.map((e) => e.guid), ['g1', 'g2']); // sorted by opNumber
    assert.equal(parsed[0].status, 'closed');
    assert.equal(parsed[0].ownerToken, 't1');
    assert.equal(parsed[1].status, 'open'); // default
});

test('upsertRegistryEntry: replaces by guid and keeps order', () => {
    const list = [entry({ opNumber: 1, guid: 'g1' }), entry({ opNumber: 2, guid: 'g2' })];
    const updated = upsertRegistryEntry(list, entry({ opNumber: 2, guid: 'g2', status: 'debriefing' }));
    assert.equal(updated.length, 2);
    assert.equal(updated[1].status, 'debriefing');
    const appended = upsertRegistryEntry(updated, entry({ opNumber: 3, guid: 'g3' }));
    assert.deepEqual(appended.map((e) => e.guid), ['g1', 'g2', 'g3']);
});

test('closeRegistryEntry: closes by guid with timestamp', () => {
    const list = [entry({ opNumber: 1, guid: 'g1' })];
    const closed = closeRegistryEntry(list, 'g1', '2026-08-06T12:00:00Z');
    assert.equal(closed[0].status, 'closed');
    assert.equal(closed[0].closedAt, '2026-08-06T12:00:00Z');
    // unknown guid is a no-op
    assert.deepEqual(closeRegistryEntry(list, 'nope', 'x'), list);
});

test('nextOpNumber / currentOpPeriod', () => {
    assert.equal(nextOpNumber([]), 1);
    const list = [
        entry({ opNumber: 1, guid: 'g1', status: 'closed' }),
        entry({ opNumber: 2, guid: 'g2', status: 'closed' }),
        entry({ opNumber: 3, guid: 'g3' }),
    ];
    assert.equal(nextOpNumber(list), 4);
    assert.equal(currentOpPeriod(list)?.guid, 'g3');
    assert.equal(currentOpPeriod(list.map((e) => ({ ...e, status: 'closed' as const }))), null);
});

test('opSyncName: replaces Create-form _OP-00 instead of appending', () => {
    assert.equal(opSyncName('2026-09-21_search_foo_OP-00', 1), '2026-09-21_search_foo_OP-01');
    assert.equal(opSyncName('2026-09-21_search_foo_OP-00', 2), '2026-09-21_search_foo_OP-02');
    assert.equal(opSyncName('base_OP-03', 1), 'base_OP-01');
});

test('opSyncName: keeps Area Search suffix when the common map has no _OP-NN', () => {
    assert.equal(opSyncName('X', 1), 'X - OP1');
    assert.equal(opSyncName('X', 2), 'X - OP2');
    assert.equal(opSyncName('Alpha Incident - MGMT', 1), 'Alpha Incident - OP1');
});
