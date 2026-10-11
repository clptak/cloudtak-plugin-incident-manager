import assert from 'node:assert/strict';
import { test } from 'node:test';
import template from '../data/mission_schema.json' with { type: 'json' };
import { createMemoryPropertyServer } from './memoryPropertyTransport.ts';
import { createMissionPropertyClient } from './missionProperties.ts';
import type { MissionSchema } from './missionSchema.ts';
import { decodeSchema, encodeSchema } from './schemaCodec.ts';
import { isVolatileKey } from './schemaCollections.ts';
import { createSchemaPropertyBackend, SchemaConflictError } from './schemaPropertyBackend.ts';

const GUID = 'meta-guid';
const S1 = '41d72bf4-1d6e-460d-876d-19b2cf6959f5';
const S2 = '94e69286-5de5-4b6e-9472-15025120b2fd';
const S3 = 'ANDROID_seg.3';

type Rec = Record<string, unknown>;
const ir = (s: MissionSchema) => s.incident_response as Rec;

/** Synthetic incident with every keyed collection populated (no real data). */
function busySchema(): MissionSchema {
    const s = JSON.parse(JSON.stringify(template)) as MissionSchema;
    const r = s as unknown as Rec;
    r.segments = {
        [S1]: { callsign: '01', created: '2026-10-11T10:00:00Z' },
        [S2]: { callsign: '02', created: '2026-10-11T10:05:00Z' },
        [S3]: { callsign: '03', created: '2026-10-11T10:10:00Z' },
    };
    r.row_segments = { row1: { callsign: 'ROW', created: '2026-10-11T10:00:00Z' } };
    ir(s).resource_assignments = [
        { id: 'r-1', resourceIdentifier: 'GT1', status: 'assigned' },
        { id: 'r-2', resourceIdentifier: 'GT2', status: 'assigned' },
        { resourceIdentifier: 'no id' },
        { id: 'r-1', resourceIdentifier: 'duplicate id' },
    ];
    ir(s).work_assignments = [{ id: 'w-1', assignmentNumber: 1 }];
    ir(s).op_assignments = [
        { opNumber: 1, segmentUid: S1, label: '01', createdAt: '2026-10-11T11:00:00Z' },
        { opNumber: 1, segmentUid: S2, label: '02', createdAt: '2026-10-11T11:01:00Z' },
    ];
    ir(s).clues = [{ opNumber: 1, description: 'boot print', authenticity: 50, letters: {}, recordedAt: '2026-10-11T12:00:00Z' }];
    ir(s).iap_plans = {
        1: { opNumber: 1, objectives: ['Search 01-04'], commandEmphasis: 'Safety', updated: '2026-10-11T09:00:00Z' },
    };
    const remark = (n: number) => ({
        source: 'CAD', mission_name: 'm', dtg: `2026-10-11T0${n}:00:00-07:00`, servertime: '', uid: `u${n}`,
        'msg-content-remark': `note ${n}`, keywords: '', lat: '', lon: '',
    });
    s.cad_data.call_remarks = [[remark(1)], [remark(2)]];
    s.tak_server.mission_logs = [remark(1), remark(2)];
    return s;
}

function backendWith(srv = createMemoryPropertyServer(GUID)) {
    const backend = createSchemaPropertyBackend((missionGuid, missionToken) =>
        createMissionPropertyClient({ missionGuid, missionToken, transport: srv.transport }));
    return { srv, backend };
}

const keysWith = (enc: Map<string, string>, prefix: string) => [...enc.keys()].filter((k) => k.startsWith(prefix)).sort();

test('collections: each record gets its own key', () => {
    const enc = encodeSchema(busySchema());
    assert.equal(keysWith(enc, 'c.segments.').length, 3);
    assert.ok(enc.has(`c.segments.${S1}`));
    assert.match(keysWith(enc, 'c.segments.h')[0], /^c\.segments\.h[0-9a-f]{8}$/);
    assert.deepEqual(keysWith(enc, 'c.resources.'), ['c.resources.r-1', 'c.resources.r-2']);
    assert.deepEqual(keysWith(enc, 'c.op-assignments.'), [`c.op-assignments.1-${S1}`, `c.op-assignments.1-${S2}`]);
    assert.equal(keysWith(enc, 'c.clues.').length, 1);
    assert.deepEqual(keysWith(enc, 'c.iap.'), ['c.iap.1.commandEmphasis', 'c.iap.1.objectives', 'c.iap.1.opNumber', 'c.iap.1.updated']);
    assert.equal(keysWith(enc, 'c.cad-remarks.').length, 2);
    assert.equal(keysWith(enc, 'c.cad-logs.').length, 2);
});

test('collections: records without a usable id stay in their field key; nothing is lost', () => {
    const enc = encodeSchema(busySchema());
    const left = JSON.parse(enc.get('s.incident-response.resource-assignments')!);
    assert.deepEqual(left.map((r: Rec) => r.resourceIdentifier), ['no id', 'duplicate id']);
    const cad = JSON.parse(enc.get('s.cad-data')!);
    assert.deepEqual(cad.call_remarks, []);
});

test('collections: lossless round trip (ordered collections in their natural order)', () => {
    const s = busySchema();
    const { schema, invalid } = decodeSchema(encodeSchema(s));
    assert.deepEqual(invalid, []);
    assert.deepEqual(schema, s);
    assert.deepEqual(Object.keys((schema as unknown as Rec).segments as Rec), [S1, S2, S3]);
    assert.deepEqual([...encodeSchema(schema)].sort(), [...encodeSchema(s)].sort());
});

test('collections: an upserted op assignment keeps its key and the others are untouched', () => {
    const s = busySchema();
    const before = encodeSchema(s);
    const list = ir(s).op_assignments as Rec[];
    ir(s).op_assignments = [list[1], { ...list[0], team: 'GT9' }]; // upsert moves it to the end
    const after = encodeSchema(s);
    const changed = [...after].filter(([k, v]) => before.get(k) !== v).map(([k]) => k);
    assert.deepEqual(changed, [`c.op-assignments.1-${S1}`]);
});

test('collections: only the IAP updated stamp is volatile', () => {
    assert.ok(isVolatileKey('c.iap.1.updated'));
    assert.ok(!isVolatileKey('c.iap.1.objectives'));
    assert.ok(!isVolatileKey('s.incident-response.updated'));
});

// --- concurrency through the backend ---------------------------------------

async function twoCopies() {
    const env = backendWith();
    await env.backend.migrate(GUID, busySchema());
    const a = (await env.backend.load(GUID))!.schema;
    const b = (await env.backend.load(GUID))!.schema;
    return { ...env, a, b };
}

test('backend: two managers adding different segments at once both keep theirs', async () => {
    const { backend, a, b } = await twoCopies();
    ((a as unknown as Rec).segments as Rec)['seg-a'] = { callsign: '04', created: '2026-10-11T13:00:00Z' };
    ((b as unknown as Rec).segments as Rec)['seg-b'] = { callsign: '05', created: '2026-10-11T13:00:01Z' };
    await backend.save(GUID, a);
    await backend.save(GUID, b);
    const segs = (await backend.load(GUID))!.schema as unknown as { segments: Rec };
    assert.deepEqual(Object.values(segs.segments).map((x) => (x as Rec).callsign), ['01', '02', '03', '04', '05']);
});

test('backend: two managers editing different IAP sections of the same OP both keep theirs', async () => {
    const { backend, a, b } = await twoCopies();
    const plan = (s: MissionSchema) => (ir(s).iap_plans as Rec)['1'] as Rec;
    plan(a).objectives = ['Search 05-08'];
    plan(a).updated = '2026-10-11T14:00:00Z';
    plan(b).commandEmphasis = 'Heat';
    plan(b).updated = '2026-10-11T14:00:02Z';
    await backend.save(GUID, a);
    await backend.save(GUID, b);
    const p = plan((await backend.load(GUID))!.schema);
    assert.deepEqual(p.objectives, ['Search 05-08']);
    assert.equal(p.commandEmphasis, 'Heat');
});

test('backend: CAD notes appended by two managers both survive', async () => {
    const { backend, a, b } = await twoCopies();
    const note = (n: string) => ({ source: 'CAD', mission_name: 'm', dtg: n, servertime: '', uid: n, 'msg-content-remark': n, keywords: '', lat: '', lon: '' });
    a.cad_data.call_remarks.push([note('a')]);
    a.tak_server.mission_logs.push(note('a'));
    b.cad_data.call_remarks.push([note('b')]);
    b.tak_server.mission_logs.push(note('b'));
    await backend.save(GUID, a);
    await backend.save(GUID, b);
    const s = (await backend.load(GUID))!.schema;
    assert.deepEqual(s.cad_data.call_remarks.map((r) => r[0].uid), ['u1', 'u2', 'a', 'b']);
    assert.equal(s.tak_server.mission_logs.length, 4);
});

test('backend: two edits to the same resource still conflict', async () => {
    const { backend, a, b } = await twoCopies();
    (ir(a).resource_assignments as Rec[])[0].status = 'demobilized';
    (ir(b).resource_assignments as Rec[])[0].status = 'out of service';
    (ir(b).resource_assignments as Rec[])[1].status = 'available';
    await backend.save(GUID, a);
    await assert.rejects(backend.save(GUID, b), (err: unknown) =>
        err instanceof SchemaConflictError && err.keys.join() === 'c.resources.r-1');
});

// --- upgrade from layout 2 ---------------------------------------------------

async function v2Incident() {
    const env = backendWith();
    for (const [k, v] of encodeSchema(busySchema(), { layout: 2 })) env.srv.store.set(k, v);
    return env;
}

test('upgrade: a layout-2 incident loads unchanged', async () => {
    const { backend } = await v2Incident();
    const loaded = (await backend.load(GUID))!.schema;
    assert.deepEqual(loaded, decodeSchema(encodeSchema(busySchema())).schema);
});

test('upgrade: the first save rewrites it as layout 3; a deleted segment does not come back', async () => {
    const { srv, backend } = await v2Incident();
    assert.equal(srv.store.get('meta.schema'), '2');
    const s = (await backend.load(GUID))!.schema;
    delete ((s as unknown as Rec).segments as Rec)[S2];
    await backend.save(GUID, s);

    assert.equal(srv.store.get('meta.schema'), '3');
    assert.equal(srv.store.get('s.segments'), '{}');
    assert.ok(srv.store.has(`c.segments.${S1}`));
    assert.ok(!srv.store.has(`c.segments.${S2}`));
    const segs = ((await backend.load(GUID))!.schema as unknown as { segments: Rec }).segments;
    assert.deepEqual(Object.keys(segs), [S1, S3]);
    // The server now holds exactly the layout-3 encoding.
    const expected = encodeSchema((await backend.load(GUID))!.schema);
    assert.deepEqual([...srv.store].filter(([k]) => k !== 'meta.schema').sort(), [...expected].filter(([k]) => k !== 'meta.schema').sort());
});

test('upgrade: keys owned by other features are left alone', async () => {
    const { srv, backend } = await v2Incident();
    srv.store.set('cad.published.x', '1');
    const s = (await backend.load(GUID))!.schema;
    (s as unknown as Rec).default_agency = 'CCSO';
    await backend.save(GUID, s);
    assert.equal(srv.store.get('cad.published.x'), '1');
});
