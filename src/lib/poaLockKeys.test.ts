import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPoaLock } from '../domain/poaLock.ts';
import { createMemoryPropertyServer } from './memoryPropertyTransport.ts';
import { createMissionPropertyClient } from './missionProperties.ts';
import { decodeSchema, isSchemaKey } from './schemaCodec.ts';

import { listPoaLocksWith, poaLockKey, savePoaLockWith } from './poaLockKeys.ts';

const GUID = 'meta-guid';

function lockAt(op: number, iso: string, poaA: number) {
    const lock = buildPoaLock({
        segments: [{ uid: 'A', poa: 50 }, { uid: 'B', poa: 30 }],
        rowPoa: 20,
        records: [],
        clues: [],
        segmentLabels: {},
    }, op, { now: () => new Date(iso) });
    lock.poa.A = poaA;
    return lock;
}

test('poa locks: each lock is its own key; listed oldest first; other OPs ignored', async () => {
    const srv = createMemoryPropertyServer(GUID);
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    await savePoaLockWith(client, lockAt(2, '2026-10-11T22:05:00Z', 30));
    await savePoaLockWith(client, lockAt(2, '2026-10-11T22:00:00Z', 25));
    await savePoaLockWith(client, lockAt(3, '2026-10-12T08:00:00Z', 10));
    assert.ok(srv.store.has('op.2.poa.20261011T220000000Z'));
    const locks = await listPoaLocksWith(client, 2);
    assert.deepEqual(locks.map((l) => l.poa.A), [25, 30]);
    assert.equal(poaLockKey({ opNumber: 2, lockedAt: '2026-10-11T22:00:00.000Z' }), 'op.2.poa.20261011T220000000Z');
});

test('poa lock keys are not schema keys: decode ignores them, upgrades leave them alone', () => {
    const key = 'op.2.poa.20261011T220000000Z';
    assert.equal(isSchemaKey(key), false);
    const { schema, invalid } = decodeSchema([['meta.schema', '3'], [key, '{"opNumber":2}']]);
    assert.deepEqual(invalid, []);
    assert.deepEqual(schema.tak_missions, []);
});
