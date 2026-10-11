import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    assertValidKey,
    createMissionPropertyClient,
    MissionPropertyError,
    supportsMissionProperties,
    type PropertyTransport,
    type PropertyTransportRequest,
} from './missionProperties.ts';

const GUID = '59d13f52-55b7-438b-a4d9-c6a2e87bc68c';
const BASE = `/api/marti/missions/${GUID}/property`;

/**
 * In-memory stand-in for CloudTAK + TAK Server 5.9, mirroring the response
 * shapes of the #1852 routes and the server semantics verified live.
 */
function fakeServer(opts: { unsupported?: boolean; forbidden?: boolean } = {}) {
    const store = new Map<string, string>();
    const calls: PropertyTransportRequest[] = [];
    const ok = (json: unknown) => ({ status: 200, json, text: JSON.stringify(json) });
    const err = (status: number, message: string) => ({ status, json: { status, message }, text: JSON.stringify({ status, message }) });

    const transport: PropertyTransport = async (req) => {
        calls.push(req);
        if (opts.forbidden) return err(403, 'Forbidden');
        if (opts.unsupported) return err(404, 'Not Found');

        if (req.path === BASE) {
            if (req.method === 'GET') {
                const prefix = req.query?.prefix ?? '';
                const items = [...store].filter(([k]) => k.startsWith(prefix))
                    .sort(([a], [b]) => (a < b ? -1 : 1))
                    .map(([key, value]) => ({ key, value }));
                return ok({ total: items.length, items });
            }
            if (req.method === 'PUT') {
                const { key, value } = req.body as { key: string; value: string };
                store.set(key, value);
                return ok({ version: '3', data: { key, value } });
            }
            if (req.method === 'DELETE') {
                store.clear();
                return ok({ status: 200, message: 'Properties Deleted' });
            }
        }

        const key = decodeURIComponent(req.path.slice(BASE.length + 1));
        if (req.method === 'GET') {
            return store.has(key) ? ok({ version: '3', data: { key, value: store.get(key) } }) : err(404, `MissionProperty ${key} not found`);
        }
        if (req.method === 'DELETE') {
            if (!store.has(key)) return err(404, `MissionProperty ${key} not found`);
            store.delete(key);
            return ok({ status: 200, message: 'Property Deleted' });
        }
        return err(400, 'unexpected request');
    };

    return { store, calls, transport };
}

test('set then get round-trips a value', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    await client.set('incident.name', 'Test Incident');
    assert.equal(await client.get('incident.name'), 'Test Incident');
});

test('get returns null for a missing key instead of throwing', async () => {
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: fakeServer().transport });
    assert.equal(await client.get('incident.missing'), null);
});

test('list with a prefix returns only that section, sorted by key', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    await client.set('op.2.mission', 'b');
    await client.set('incident.name', 'x');
    await client.set('op.1.mission', 'a');
    assert.deepEqual(await client.list('op.'), [
        { key: 'op.1.mission', value: 'a' },
        { key: 'op.2.mission', value: 'b' },
    ]);
    assert.deepEqual(srv.calls.at(-1)?.query, { prefix: 'op.' });
});

test('list without a prefix sends no prefix parameter', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    await client.list();
    assert.equal(srv.calls[0].query, undefined);
});

test('the mission token is sent on every request', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport, missionToken: 'owner-token' });
    await client.set('a.b', '1');
    await client.get('a.b');
    await client.delete('a.b');
    assert.ok(srv.calls.every((c) => c.missionToken === 'owner-token'));
});

test('delete of a missing key is not an error; deleteAll clears everything', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    await client.delete('never.set');
    await client.set('a.one', '1');
    await client.set('a.two', '2');
    await client.deleteAll();
    assert.equal(srv.store.size, 0);
});

test('JSON helpers store JSON text and skip unparseable values when listing', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    await client.setJson('op.1.mission', { status: 'planning', channels: ['MGMT'] });
    assert.equal(srv.store.get('op.1.mission'), '{"status":"planning","channels":["MGMT"]}');
    assert.deepEqual(await client.getJson('op.1.mission'), { status: 'planning', channels: ['MGMT'] });

    srv.store.set('op.1.broken', '{not json');
    const listed = await client.listJson<{ status: string }>('op.1.');
    assert.deepEqual(listed.items.map((i) => i.key), ['op.1.mission']);
    assert.deepEqual(listed.invalid, ['op.1.broken']);
});

test('getJson returns null for a missing or empty value', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    assert.equal(await client.getJson('x.missing'), null);
    srv.store.set('x.empty', '');
    assert.equal(await client.getJson('x.empty'), null);
});

test('keys with LIKE wildcards or path separators are rejected before any request', async () => {
    const srv = fakeServer();
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: srv.transport });
    for (const bad of ['op_1', 'op%1', 'op/1', '', '.op', 'op 1']) {
        assert.throws(() => assertValidKey(bad), /Invalid mission property key/, bad);
        await assert.rejects(client.set(bad, 'x'), /Invalid mission property key/, bad);
    }
    assert.equal(srv.calls.length, 0);
    for (const good of ['op.1.mission', 'op.1.debrief.41d72bf4-1d6e-460d-876d-19b2cf6959f5', 'cad.remark.20260906T221503Z-b644', 'meta.schema']) {
        assert.doesNotThrow(() => assertValidKey(good), good);
    }
});

test('server errors surface status and message', async () => {
    const client = createMissionPropertyClient({ missionGuid: GUID, transport: fakeServer({ forbidden: true }).transport });
    await assert.rejects(client.set('a.b', '1'), (e: unknown) => {
        assert.ok(e instanceof MissionPropertyError);
        assert.equal(e.status, 403);
        assert.match(e.message, /Set a\.b failed \(403\): Forbidden/);
        return true;
    });
});

test('supportsMissionProperties: true on 5.9, false on older servers, rethrows permission errors', async () => {
    const mk = (o: { unsupported?: boolean; forbidden?: boolean }) =>
        createMissionPropertyClient({ missionGuid: GUID, transport: fakeServer(o).transport });
    assert.equal(await supportsMissionProperties(mk({})), true);
    assert.equal(await supportsMissionProperties(mk({ unsupported: true })), false);
    await assert.rejects(supportsMissionProperties(mk({ forbidden: true })), MissionPropertyError);
});
