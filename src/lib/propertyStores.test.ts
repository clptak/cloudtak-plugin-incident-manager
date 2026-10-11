import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, OpPeriodRegistryEntry } from '../domain/entities.ts';
import { debriefKey } from '../domain/trackLog.ts';
import { createMemoryPropertyServer } from './memoryPropertyTransport.ts';
import { createMissionPropertyClient } from './missionProperties.ts';
import { debriefPropertyKey, shortHash, uidSegment } from './propertyKeys.ts';
import { createPropertyDebriefStore, createPropertyRegistryStore } from './propertyStores.ts';

const GUID = '59d13f52-55b7-438b-a4d9-c6a2e87bc68c';

function setup() {
    const srv = createMemoryPropertyServer(GUID);
    const client = () => createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    return { srv, client };
}

function op(n: number, extra: Partial<OpPeriodRegistryEntry> = {}): OpPeriodRegistryEntry {
    return { opNumber: n, name: `Incident - OP${n}`, guid: `guid-${n}`, status: 'open', channels: ['CCSO Sworn'], ...extra };
}

// --- keys ------------------------------------------------------------------

test('shortHash is stable and 8 hex chars', () => {
    assert.equal(shortHash('abc'), shortHash('abc'));
    assert.match(shortHash('anything'), /^[0-9a-f]{8}$/);
    assert.notEqual(shortHash('GT1|2026-10-10T23:10:55.402Z'), shortHash('GT2|2026-10-10T23:10:55.402Z'));
});

test('uidSegment keeps UUIDs readable and hashes uids that would break the key', () => {
    assert.equal(uidSegment('41d72bf4-1d6e-460d-876d-19b2cf6959f5'), '41d72bf4-1d6e-460d-876d-19b2cf6959f5');
    assert.match(uidSegment('ANDROID_abc.123'), /^h[0-9a-f]{8}$/);
});

// --- registry --------------------------------------------------------------

test('registry: save then load round-trips, sorted, ownerToken kept', async () => {
    const { client } = setup();
    const store = createPropertyRegistryStore(client());
    await store.save([op(2), op(1, { ownerToken: 'tok-1', openedAt: '2026-10-10T23:06:40Z' })]);
    const loaded = await createPropertyRegistryStore(client()).load();
    assert.deepEqual(loaded.map((e) => e.opNumber), [1, 2]);
    assert.equal(loaded[0].ownerToken, 'tok-1');
});

test('registry: stored as one op.<n>.mission key per period, ignoring other op.* keys', async () => {
    const { srv, client } = setup();
    srv.store.set('op.1.debrief.seg.abc', '{"opNumber":1,"segmentUid":"seg"}');
    await createPropertyRegistryStore(client()).save([op(1), op(2)]);
    assert.deepEqual([...srv.store.keys()].filter((k) => k.endsWith('.mission')).sort(), ['op.1.mission', 'op.2.mission']);
    assert.equal((await createPropertyRegistryStore(client()).load()).length, 2);
});

test('registry: save writes only changed periods', async () => {
    const { srv, client } = setup();
    const store = createPropertyRegistryStore(client());
    await store.save([op(1), op(2)]);
    const before = srv.calls.filter((c) => c.method === 'PUT').length;
    const entries = await store.load();
    entries[1] = { ...entries[1], status: 'closed', closedAt: '2026-10-11T01:00:00Z' };
    await store.save(entries);
    const puts = srv.calls.filter((c) => c.method === 'PUT').slice(before);
    assert.deepEqual(puts.map((c) => (c.body as { key: string }).key), ['op.2.mission']);
});

test('registry: a stale caller does not overwrite another manager\'s change to a different OP', async () => {
    const { client } = setup();
    await createPropertyRegistryStore(client()).save([op(1), op(2)]);

    const alice = createPropertyRegistryStore(client());
    const bob = createPropertyRegistryStore(client());
    const aliceList = await alice.load();
    const bobList = await bob.load();

    // Bob closes OP2; Alice, still holding the old list, renames OP1.
    bobList[1] = { ...bobList[1], status: 'closed' };
    await bob.save(bobList);
    aliceList[0] = { ...aliceList[0], name: 'Incident - OP1 (renamed)' };
    await alice.save(aliceList);

    const final = await createPropertyRegistryStore(client()).load();
    assert.equal(final[0].name, 'Incident - OP1 (renamed)');
    assert.equal(final[1].status, 'closed');
});

test('registry: removing a period deletes its key', async () => {
    const { srv, client } = setup();
    const store = createPropertyRegistryStore(client());
    await store.save([op(1), op(2)]);
    await store.load();
    await store.save([op(1)]);
    assert.equal(srv.store.has('op.2.mission'), false);
    assert.equal(srv.store.has('op.1.mission'), true);
});

test('registry: duplicate op numbers are refused before any write', async () => {
    const { srv, client } = setup();
    await assert.rejects(createPropertyRegistryStore(client()).save([op(1), op(1, { guid: 'other' })]), /numbered 1/);
    assert.equal(srv.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('registry: unparseable or invalid values are skipped on load', async () => {
    const { srv, client } = setup();
    srv.store.set('op.1.mission', '{broken');
    srv.store.set('op.2.mission', '{"opNumber":2}');
    srv.store.set('op.3.mission', JSON.stringify(op(3)));
    assert.deepEqual((await createPropertyRegistryStore(client()).load()).map((e) => e.opNumber), [3]);
});

// --- debriefs ----------------------------------------------------------------

const SEG = 'a381a139-9346-4bfa-88d2-3db203c26374';

function debrief(extra: Partial<DebriefRecord> = {}): DebriefRecord {
    return { opNumber: 1, segmentUid: SEG, pod: 10, resource: 'GROUND TEAM 1', recordedAt: '2026-10-10T23:10:55.402Z', ...extra };
}

test('debriefs: append is a single key write; load returns every record', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    await store.append(debrief());
    await store.append(debrief({ opNumber: 2, pod: 20, resource: 'Ground Team 5', recordedAt: '2026-10-10T23:17:52.667Z' }));
    assert.equal(srv.calls.filter((c) => c.method === 'PUT').length, 2);
    assert.equal(srv.calls.filter((c) => c.method === 'GET').length, 0);
    const loaded = await store.load();
    assert.deepEqual(loaded.map((r) => [r.opNumber, r.pod]), [[1, 10], [2, 20]]);
});

test('debriefs: two resources on the same segment get separate keys', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    await store.append(debrief({ resource: 'GT1' }));
    await store.append(debrief({ resource: 'GT2' }));
    assert.equal([...srv.store.keys()].filter((k) => k.startsWith(`op.1.debrief.${SEG}.`)).length, 2);
});

test('debriefs: append stamps recordedAt when missing', async () => {
    const { client } = setup();
    const store = createPropertyDebriefStore(client(), () => '2026-10-11T12:00:00.000Z');
    await store.append({ opNumber: 1, segmentUid: SEG, pod: 15 });
    assert.equal((await store.load())[0].recordedAt, '2026-10-11T12:00:00.000Z');
});

test('debriefs: concurrent appends by two managers both survive', async () => {
    const { client } = setup();
    await Promise.all([
        createPropertyDebriefStore(client()).append(debrief({ resource: 'GT1' })),
        createPropertyDebriefStore(client()).append(debrief({ resource: 'GT2', segmentUid: 'd28407c4-619f-40b9-8a82-dbf779cd5612' })),
    ]);
    assert.equal((await createPropertyDebriefStore(client()).load()).length, 2);
});

test('debriefs: a non-search uid that is unsafe in a key is hashed, and the original uid is kept', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    await store.append(debrief({ segmentUid: 'ANDROID_structure.12' }));
    const key = [...srv.store.keys()][0];
    assert.match(key, /^op\.1\.debrief\.h[0-9a-f]{8}\.[0-9a-f]{8}$/);
    assert.equal((await store.load())[0].segmentUid, 'ANDROID_structure.12');
});

test('debriefs: setTracks rewrites only the matching record', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    const a = debrief({ resource: 'GT1' });
    const b = debrief({ resource: 'GT2' });
    await store.append(a);
    await store.append(b);
    const track = { uid: 'trk-1', name: 'TRK 01', source: 'map', points: 230, lengthMi: 6.39 };
    await store.setTracks(debriefKey(a), [track]);

    const stored = (k: DebriefRecord) => JSON.parse(srv.store.get(debriefPropertyKey(k)) ?? '{}');
    assert.equal(stored(a).tracks?.[0].uid, 'trk-1');
    assert.equal(stored(b).tracks, undefined);

    await store.setTracks(debriefKey(a), []);
    assert.equal(stored(a).tracks, undefined);
});

test('debriefs: setTracks throws when the record is gone', async () => {
    const { client } = setup();
    await assert.rejects(
        createPropertyDebriefStore(client()).setTracks(debriefKey(debrief()), []),
        /no longer in the incident record/,
    );
});

test('debriefs: replace overwrites the same key when the resource is unchanged', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    const a = debrief({ resource: 'GT1' });
    await store.append(a);
    await store.replace(debriefKey(a), { ...a, pod: 30, correctedAt: '2026-10-11T17:00:00Z' });
    const keys = [...srv.store.keys()];
    assert.deepEqual(keys, [debriefPropertyKey(a)]);
    assert.equal((await store.load())[0].pod, 30);
});

test('debriefs: replace with a new resource moves the record to its new key', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    const a = debrief({ resource: 'GT1' });
    await store.append(a);
    const moved = { ...a, resource: 'GT3' };
    await store.replace(debriefKey(a), moved);
    assert.deepEqual([...srv.store.keys()], [debriefPropertyKey(moved)]);
});

test('debriefs: replace throws when the record is gone; remove does not', async () => {
    const { client } = setup();
    const store = createPropertyDebriefStore(client());
    await assert.rejects(store.replace(debriefKey(debrief()), debrief()), /no longer in the incident record/);
    await store.remove(debriefKey(debrief()));
});

test('debriefs: remove deletes only that key', async () => {
    const { srv, client } = setup();
    const store = createPropertyDebriefStore(client());
    const a = debrief({ resource: 'GT1' });
    const b = debrief({ resource: 'GT2' });
    await store.append(a);
    await store.append(b);
    await store.remove(debriefKey(a));
    assert.deepEqual([...srv.store.keys()], [debriefPropertyKey(b)]);
});
