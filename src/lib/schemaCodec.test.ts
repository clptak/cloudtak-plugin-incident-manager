import assert from 'node:assert/strict';
import { test } from 'node:test';
import template from '../data/mission_schema.json' with { type: 'json' };
import { createMemoryPropertyServer } from './memoryPropertyTransport.ts';
import { createMissionPropertyClient, MissionPropertyError } from './missionProperties.ts';
import type { MissionSchema } from './missionSchema.ts';
import { decodeSchema, diffEncoded, encodeSchema } from './schemaCodec.ts';
import { createSchemaPropertyBackend, findConflicts, inParallel, SchemaConflictError } from './schemaPropertyBackend.ts';
import { createPropertyDebriefStore } from './propertyStores.ts';

const GUID = 'meta-guid';
const SEG1 = 'a381a139-9346-4bfa-88d2-3db203c26374';
const SEG2 = 'd28407c4-619f-40b9-8a82-dbf779cd5612';

/** A synthetic incident shaped like a real multi-op schema (no real data). */
function sampleSchema(): MissionSchema {
    const s = JSON.parse(JSON.stringify(template)) as MissionSchema;
    s.event_id = 'Z0000001';
    s.incident_id = 'S0000001';
    s.tak_missions = [
        { opNumber: 1, name: 'Test - OP01', guid: 'op1', status: 'closed', channels: ['Sworn'], ownerToken: 't1' },
        { opNumber: 2, name: 'Test - OP02', guid: 'op2', status: 'open', channels: ['Sworn'] },
    ];
    const ir = s.incident_response as Record<string, unknown>;
    ir.incident_name = 'Test Search';
    ir.debriefs = [
        { opNumber: 1, segmentUid: SEG1, pod: 10, resource: 'GT1', recordedAt: '2026-10-10T23:10:55.402Z' },
        { opNumber: 1, segmentUid: SEG2, pod: 15, resource: 'GT2', recordedAt: '2026-10-10T23:11:16.938Z' },
        { opNumber: 2, segmentUid: SEG1, pod: 20, resource: 'GT5', recordedAt: '2026-10-10T23:17:52.667Z' },
    ];
    ir.iap_plans = { 1: { opNumber: 1, objectives: 'Search segments 01-04', comms: [] } };
    ir.casie = { initial_consensus: { accepted: true, respondents: [{ name: 'A', row: 30 }] } };
    ir.indicent_datetime = '';
    return s;
}

const roundTrip = (s: MissionSchema) => decodeSchema(encodeSchema(s)).schema;

// --- codec -------------------------------------------------------------------

test('codec: encode then decode returns the same schema', () => {
    const s = sampleSchema();
    assert.deepEqual(roundTrip(s), s);
});

test('codec: the shipped template round-trips unchanged', () => {
    const s = JSON.parse(JSON.stringify(template)) as MissionSchema;
    const back = roundTrip(s);
    // An empty debriefs array is not stored; readers treat absent as empty.
    assert.deepEqual(back, s);
});

test('codec: key layout - one key per OP, per debrief, per section', () => {
    const keys = [...encodeSchema(sampleSchema()).keys()];
    assert.ok(keys.includes('meta.schema'));
    assert.ok(keys.includes('op.1.mission') && keys.includes('op.2.mission'));
    assert.equal(keys.filter((k) => k.startsWith('op.1.debrief.')).length, 2);
    assert.ok(keys.includes('s.cad-data'));
    assert.ok(keys.includes('s.incident-response.casie'));
    assert.ok(keys.includes('s.incident-response.iap-plans'));
    assert.ok(keys.includes('s.incident-response.indicent-datetime'), 'typo field kept as its own key');
    assert.ok(keys.every((k) => !/[_%/]/.test(k)), 'no key contains _ % or /');
});

test('codec: field names that cannot become a key are kept in s.rest, nothing dropped', () => {
    const s = sampleSchema() as Record<string, unknown>;
    s['odd-name'] = 1;
    (s.incident_response as Record<string, unknown>)['also.odd'] = { x: 1 };
    const encoded = encodeSchema(s as MissionSchema);
    assert.ok(encoded.has('s.rest'));
    assert.deepEqual(roundTrip(s as MissionSchema), s);
});

test('codec: OP entries without a valid number and duplicate debriefs go to s.rest', () => {
    const s = sampleSchema();
    s.tak_missions.push({ name: 'no number', guid: 'x' });
    const ir = s.incident_response as Record<string, unknown>;
    (ir.debriefs as unknown[]).push({ ...(ir.debriefs as Record<string, unknown>[])[0] });
    const back = roundTrip(s);
    assert.equal(back.tak_missions.length, 3);
    assert.equal(((back.incident_response as Record<string, unknown>).debriefs as unknown[]).length, 4);
});

test('codec: keys from other features are ignored by decode', () => {
    const encoded = encodeSchema(sampleSchema());
    encoded.set('cad.published.20260906T221503Z-b644', '{"mission":"OP-00"}');
    assert.deepEqual(decodeSchema(encoded).schema, sampleSchema());
});

test('codec: unparseable keys are reported, not thrown', () => {
    const encoded = encodeSchema(sampleSchema());
    encoded.set('s.incident-response.casie', '{broken');
    const { invalid } = decodeSchema(encoded);
    assert.deepEqual(invalid, ['s.incident-response.casie']);
});

test('diff: only changed keys are written; removed keys are deleted', () => {
    const before = encodeSchema(sampleSchema());
    const s = sampleSchema();
    (s.incident_response as Record<string, unknown>).incident_name = 'Renamed';
    s.tak_missions = s.tak_missions.slice(0, 1);
    const { set, remove } = diffEncoded(before, encodeSchema(s));
    assert.deepEqual(set.map(([k]) => k), ['s.incident-response.incident-name']);
    assert.deepEqual(remove, ['op.2.mission']);
});

// --- backend ---------------------------------------------------------------

function backendWith(srv = createMemoryPropertyServer(GUID)) {
    const backend = createSchemaPropertyBackend((missionGuid, missionToken) =>
        createMissionPropertyClient({ missionGuid, missionToken, transport: srv.transport }));
    return { srv, backend };
}

test('backend: a mission without meta.schema stays on the file', async () => {
    const { backend } = backendWith();
    assert.equal(await backend.load(GUID), null);
    assert.equal(await backend.save(GUID, sampleSchema()), false);
});

test('backend: a server without Mission Properties is probed once, then left alone', async () => {
    let calls = 0;
    const backend = createSchemaPropertyBackend((missionGuid) => createMissionPropertyClient({
        missionGuid,
        transport: async () => { calls++; return { status: 404, text: 'Not Found' }; },
    }));
    assert.equal(await backend.load(GUID), null);
    assert.equal(await backend.load(GUID), null);
    assert.equal(await backend.save(GUID, sampleSchema()), false);
    assert.equal(calls, 1);
});

test('backend: a permission error is surfaced, not treated as "no properties"', async () => {
    const backend = createSchemaPropertyBackend((missionGuid) => createMissionPropertyClient({
        missionGuid,
        transport: async () => ({ status: 403, json: { message: 'Forbidden' }, text: '' }),
    }));
    await assert.rejects(backend.load(GUID), MissionPropertyError);
});

test('backend: migrate writes every key with meta.schema last, then load returns the same schema', async () => {
    const { srv, backend } = backendWith();
    const s = sampleSchema();
    const { written } = await backend.migrate(GUID, s, 'tok');
    const puts = srv.calls.filter((c) => c.method === 'PUT');
    assert.equal(written, puts.length);
    assert.equal((puts.at(-1)?.body as { key: string }).key, 'meta.schema');
    assert.ok(puts.every((c) => c.missionToken === 'tok'));
    assert.deepEqual((await backend.load(GUID))?.schema, s);
});

test('backend: migrating twice is refused', async () => {
    const { backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    await assert.rejects(backend.migrate(GUID, sampleSchema()), /already stored/);
});

test('backend: a save writes only what changed since that load', async () => {
    const { srv, backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const loaded = (await backend.load(GUID))!;
    (loaded.schema.incident_response as Record<string, unknown>).incident_name = 'Renamed';
    const before = srv.calls.length;
    assert.equal(await backend.save(GUID, loaded.schema), true);
    const writes = srv.calls.slice(before).filter((c) => c.method !== 'GET');
    assert.deepEqual(writes.map((c) => (c.body as { key: string }).key), ['s.incident-response.incident-name']);
});

test('backend: two managers editing different sections both keep their change', async () => {
    const { backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const a = (await backend.load(GUID))!.schema;
    const b = (await backend.load(GUID))!.schema;
    (a.incident_response as Record<string, unknown>).incident_name = 'From A';
    (b.incident_response as Record<string, unknown>).casie = { initial_consensus: { accepted: false } };
    await backend.save(GUID, a);
    await backend.save(GUID, b);
    const final = (await backend.load(GUID))!.schema.incident_response as Record<string, unknown>;
    assert.equal(final.incident_name, 'From A');
    assert.deepEqual(final.casie, { initial_consensus: { accepted: false } });
});

test('backend: two managers appending debriefs at the same time both keep theirs', async () => {
    const { backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const a = (await backend.load(GUID))!.schema;
    const b = (await backend.load(GUID))!.schema;
    const add = (s: MissionSchema, resource: string, at: string) =>
        ((s.incident_response as Record<string, unknown>).debriefs as unknown[]).push(
            { opNumber: 2, segmentUid: SEG2, pod: 30, resource, recordedAt: at });
    add(a, 'GT6', '2026-10-10T23:18:11.222Z');
    add(b, 'GT7', '2026-10-10T23:18:31.067Z');
    await backend.save(GUID, a);
    await backend.save(GUID, b);
    const debriefs = (await backend.load(GUID))!.schema.incident_response as unknown as { debriefs: Array<{ resource: string }> };
    assert.deepEqual(debriefs.debriefs.map((d) => d.resource), ['GT1', 'GT2', 'GT5', 'GT6', 'GT7']);
});

test('backend: a same-section edit over someone else\'s is refused and writes nothing', async () => {
    const { srv, backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const a = (await backend.load(GUID))!.schema;
    const b = (await backend.load(GUID))!.schema;
    (a.incident_response as Record<string, unknown>).incident_name = 'From A';
    (b.incident_response as Record<string, unknown>).incident_name = 'From B';
    (b as Record<string, unknown>).default_agency = 'B agency';
    await backend.save(GUID, a);
    const before = srv.calls.length;
    await assert.rejects(backend.save(GUID, b), (err: unknown) =>
        err instanceof SchemaConflictError
        && err.keys.join() === 's.incident-response.incident-name'
        && /Initial Information/.test(err.message));
    assert.equal(srv.calls.slice(before).filter((c) => c.method !== 'GET').length, 0);
    const now = (await backend.load(GUID))!.schema;
    assert.equal((now.incident_response as Record<string, unknown>).incident_name, 'From A');
});

test('backend: after a reload the same edit goes through', async () => {
    const { backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const a = (await backend.load(GUID))!.schema;
    const b = (await backend.load(GUID))!.schema;
    (a.incident_response as Record<string, unknown>).incident_name = 'From A';
    await backend.save(GUID, a);
    (b.incident_response as Record<string, unknown>).incident_name = 'From B';
    await assert.rejects(backend.save(GUID, b), SchemaConflictError);
    const fresh = (await backend.load(GUID))!.schema;
    (fresh.incident_response as Record<string, unknown>).incident_name = 'From B';
    await backend.save(GUID, fresh);
    assert.equal(((await backend.load(GUID))!.schema.incident_response as Record<string, unknown>).incident_name, 'From B');
});

test('backend: saving twice from one copy is not a conflict with itself', async () => {
    const { backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const a = (await backend.load(GUID))!.schema;
    (a.incident_response as Record<string, unknown>).incident_name = 'One';
    await backend.save(GUID, a);
    (a.incident_response as Record<string, unknown>).incident_name = 'Two';
    await backend.save(GUID, a);
    assert.equal(((await backend.load(GUID))!.schema.incident_response as Record<string, unknown>).incident_name, 'Two');
});

test('findConflicts: someone else\'s change conflicts; the same value or an untouched key does not', () => {
    const before = new Map([['k', '1'], ['j', '1']]);
    const after = new Map([['k', '2'], ['j', '2']]);
    assert.deepEqual(findConflicts(['k', 'j'], before, after, new Map([['k', '9'], ['j', '2']])), ['k']);
    assert.deepEqual(findConflicts(['k'], before, after, new Map([['k', '1']])), []);
    assert.deepEqual(findConflicts(['k'], before, new Map(), new Map()), []);
    assert.deepEqual(findConflicts(['k'], before, new Map(), new Map([['k', '5']])), ['k']);
});

test('backend: saving a schema it did not hand out diffs against the server', async () => {
    const { srv, backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const fresh = sampleSchema();
    fresh.event_id = 'Z0000002';
    const before = srv.calls.length;
    assert.equal(await backend.save(GUID, fresh), true);
    const writes = srv.calls.slice(before).filter((c) => c.method !== 'GET');
    assert.deepEqual(writes.map((c) => (c.body as { key: string }).key), ['s.event-id']);
});

test('backend: keys owned by other features survive a save', async () => {
    const { srv, backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    srv.store.set('cad.published.20260906T221503Z-b644', '{"mission":"OP-00"}');
    const loaded = (await backend.load(GUID))!;
    loaded.schema.tak_missions = [];
    await backend.save(GUID, loaded.schema);
    assert.equal(srv.store.has('cad.published.20260906T221503Z-b644'), true);
    assert.equal(srv.store.has('op.1.mission'), false);
});

test('backend: the step-2 debrief store and the schema view see the same records', async () => {
    const { srv, backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const store = createPropertyDebriefStore(createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport }));
    await store.append({ opNumber: 2, segmentUid: SEG2, pod: 25, resource: 'GT8', recordedAt: '2026-10-10T23:18:56.863Z' });
    const viaSchema = ((await backend.load(GUID))!.schema.incident_response as unknown as { debriefs: unknown[] }).debriefs;
    assert.equal(viaSchema.length, 4);
    assert.equal((await store.load()).length, 4);
});

test('backend: storage() reports unsupported, file, then keys after migrate', async () => {
    const { backend } = backendWith();
    assert.equal(await backend.storage(GUID), 'file');
    await backend.migrate(GUID, sampleSchema());
    assert.equal(await backend.storage(GUID), 'keys');

    const old = createSchemaPropertyBackend((missionGuid) => createMissionPropertyClient({
        missionGuid,
        transport: async () => ({ status: 404, text: 'Not Found' }),
    }));
    assert.equal(await old.storage(GUID), 'unsupported');
});

test('backend: correcting one debrief rewrites only its key; deleting one removes only its key', async () => {
    const { srv, backend } = backendWith();
    await backend.migrate(GUID, sampleSchema());
    const debriefsOf = (s: MissionSchema) =>
        (s.incident_response as Record<string, unknown>).debriefs as Array<Record<string, unknown>>;

    const s1 = (await backend.load(GUID))!.schema;
    debriefsOf(s1)[0] = { ...debriefsOf(s1)[0], pod: 35, correctedAt: '2026-10-11T17:00:00Z' };
    const before = srv.calls.length;
    await backend.save(GUID, s1);
    const writes = srv.calls.slice(before).filter((c) => c.method !== 'GET');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, 'PUT');

    const s2 = (await backend.load(GUID))!.schema;
    debriefsOf(s2).splice(1, 1);
    const before2 = srv.calls.length;
    await backend.save(GUID, s2);
    const writes2 = srv.calls.slice(before2).filter((c) => c.method !== 'GET');
    assert.deepEqual(writes2.map((c) => c.method), ['DELETE']);
    const final = debriefsOf((await backend.load(GUID))!.schema);
    assert.deepEqual(final.map((d) => [d.resource, d.pod]), [['GT1', 35], ['GT5', 20]]);
});

test('inParallel: runs every task, at most `limit` at once, and rethrows the first failure', async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    const tasks = Array.from({ length: 20 }, (_, i) => async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 1));
        running--;
        done.push(i);
    });
    await inParallel(tasks, 4);
    assert.equal(done.length, 20);
    assert.ok(peak <= 4);
    await assert.rejects(inParallel([async () => { throw new Error('boom'); }, async () => {}]), /boom/);
});

