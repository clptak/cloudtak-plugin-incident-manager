import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, OpAssignment, OpPeriodRegistryEntry } from './entities.ts';
import type { DebriefStore, OpPeriodGateway, RegistryStore } from './ports.ts';
import {
    attachTrackLog,
    checkInSubscriber,
    closeOperationalPeriod,
    detachTrackLog,
    openOperationalPeriod,
    publishAssignments,
    recordDebrief,
    TRACK_LOG_FOLDER,
} from './usecases.ts';
import { debriefKey, MAX_TRACK_POINTS } from './trackLog.ts';

function fakeRegistry(initial: OpPeriodRegistryEntry[] = []): RegistryStore & { entries: OpPeriodRegistryEntry[] } {
    const state = { entries: [...initial] };
    return {
        get entries() { return state.entries; },
        async load() { return [...state.entries]; },
        async save(entries: OpPeriodRegistryEntry[]) { state.entries = entries; },
    };
}

interface Call { method: string; args: unknown[] }

function fakeGateway(subscribers: { clientUid: string; username: string; role: string }[] = []): OpPeriodGateway & { calls: Call[] } {
    const calls: Call[] = [];
    return {
        calls,
        async create(op) {
            calls.push({ method: 'create', args: [op] });
            return {
                opNumber: op.opNumber,
                name: op.name,
                guid: `guid-${op.opNumber}`,
                status: 'open',
                channels: op.channels,
                ownerToken: `token-${op.opNumber}`,
            };
        },
        async setSubscriberRole(op, subscriber) {
            calls.push({ method: 'setSubscriberRole', args: [op.guid, subscriber] });
        },
        async listSubscribers() { return subscribers; },
        async setChannels(op, channels) {
            calls.push({ method: 'setChannels', args: [op.guid, channels] });
        },
        async ensureFolder(op, name) {
            calls.push({ method: 'ensureFolder', args: [op.guid, name] });
            return `layer-${op.guid}-${name}`;
        },
    };
}

function fakeDebriefStore(initial: DebriefRecord[] = []) {
    const records = [...initial];
    const store: DebriefStore = {
        async load() { return [...records]; },
        async append(r) { records.push(r); },
        async setTracks(key, tracks) {
            const index = records.findIndex((r) => debriefKey(r) === key);
            if (index === -1) throw new Error(`No debrief matching ${key}`);
            const next = { ...records[index] };
            if (tracks.length) next.tracks = tracks;
            else delete next.tracks;
            records[index] = next;
        },
    };
    return Object.assign(store, { records });
}

const NOW = () => new Date('2026-08-06T20:00:00Z');

test('openOperationalPeriod: numbers, names, registers, keeps owner token', async () => {
    const registry = fakeRegistry([{
        opNumber: 1, name: 'X - OP1', guid: 'g1', status: 'closed', channels: [],
    }]);
    const gateway = fakeGateway();
    const entry = await openOperationalPeriod({ registry, gateway, now: NOW }, {
        incidentName: 'X',
        channels: ['CCSO Sworn', 'CCSO SarVol'],
    });
    assert.equal(entry.opNumber, 2);
    assert.equal(entry.name, 'X - OP2');
    assert.equal(entry.ownerToken, 'token-2');
    assert.equal(entry.openedAt, '2026-08-06T20:00:00.000Z');
    assert.equal(registry.entries.length, 2);
    assert.equal(registry.entries[1].guid, 'guid-2');
});

test('openOperationalPeriod: forwards incident type keywords', async () => {
    const registry = fakeRegistry();
    const gateway = fakeGateway();
    await openOperationalPeriod({ registry, gateway, now: NOW }, {
        incidentName: 'X',
        channels: ['a'],
        keywords: ['incidentType:search'],
    });
    assert.deepEqual(gateway.calls[0].args[0], {
        name: 'X - OP1',
        opNumber: 1,
        channels: ['a'],
        description: undefined,
        keywords: ['incidentType:search'],
    });
});

test('openOperationalPeriod: validates inputs', async () => {
    const deps = { registry: fakeRegistry(), gateway: fakeGateway() };
    await assert.rejects(() => openOperationalPeriod(deps, { incidentName: ' ', channels: ['a'] }));
    await assert.rejects(() => openOperationalPeriod(deps, { incidentName: 'X', channels: [] }));
});

test('checkInSubscriber: promotes, refuses closed OP', async () => {
    const gateway = fakeGateway();
    const op: OpPeriodRegistryEntry = { opNumber: 1, name: 'X - OP1', guid: 'g1', status: 'open', channels: [] };
    await checkInSubscriber(gateway, op, { clientUid: 'c1', username: 'u1' });
    assert.deepEqual(gateway.calls[0], {
        method: 'setSubscriberRole',
        args: ['g1', { clientUid: 'c1', username: 'u1', role: 'MISSION_SUBSCRIBER' }],
    });
    await assert.rejects(() => checkInSubscriber(gateway, { ...op, status: 'closed' }, { clientUid: 'c1', username: 'u1' }));
});

test('recordDebrief: validates and appends', async () => {
    const store = fakeDebriefStore();
    const appended = store.records;
    await recordDebrief(store, { opNumber: 1, segmentUid: 's1', pod: 55 });
    assert.equal(appended.length, 1);
    await assert.rejects(() => recordDebrief(store, { opNumber: 1, segmentUid: '', pod: 55 }));
    await assert.rejects(() => recordDebrief(store, { opNumber: 1, segmentUid: 's1', pod: 120 }));
    await assert.rejects(() => recordDebrief(store, { opNumber: 1, segmentUid: 's1', pod: 50, coverage: 0 }));
});

test('publishAssignments: republishes polygons into the OP sync and records the list', async () => {
    const op: OpPeriodRegistryEntry = {
        opNumber: 2, name: 'X - OP2', guid: 'g2', status: 'open', channels: [],
    };
    const stored: OpAssignment[] = [];
    const published: { callsign: string; existingUid?: string }[] = [];
    const deps = {
        geometry: {
            async getPolygon(uid: string) {
                if (uid === 'missing') return null;
                return {
                    callsign: `Seg ${uid}`,
                    ring: [[0, 0], [0, 1], [1, 1], [0, 0]] as [number, number][],
                    center: [0.33, 0.66] as [number, number],
                    style: { stroke: '#ff9900' },
                };
            },
        },
        publisher: {
            async publishPolygon(_op: OpPeriodRegistryEntry, polygon: { callsign: string }, existingUid?: string) {
                published.push({ callsign: polygon.callsign, existingUid });
                return existingUid ?? `op-feat-${published.length}`;
            },
        },
        assignments: {
            async load() { return [...stored]; },
            async upsert(a: OpAssignment) {
                const i = stored.findIndex(
                    (s) => s.opNumber === a.opNumber && s.segmentUid === a.segmentUid,
                );
                if (i >= 0) stored[i] = a;
                else stored.push(a);
            },
        },
        now: NOW,
    };

    const result = await publishAssignments(deps, op, { segmentUids: ['s1', 's2'], team: 'Team 3' });
    assert.equal(result.length, 2);
    assert.deepEqual(published.map((p) => p.callsign), ['Seg s1', 'Seg s2']);
    assert.equal(result[0].opFeatureUid, 'op-feat-1');
    assert.equal(result[1].team, 'Team 3');
    assert.equal(stored.length, 2);

    // Republish of s1: reuses the prior feature uid (no duplicate polygon)
    // and replaces the list entry instead of appending.
    await publishAssignments(deps, op, { segmentUids: ['s1'], team: 'Team 5' });
    assert.equal(published.at(-1)?.existingUid, 'op-feat-1');
    assert.equal(stored.length, 2);
    assert.equal(stored.find((a) => a.segmentUid === 's1')?.team, 'Team 5');

    await assert.rejects(() => publishAssignments(deps, op, { segmentUids: [] }));
    await assert.rejects(() => publishAssignments(deps, op, { segmentUids: ['missing'] }));
    await assert.rejects(() => publishAssignments(deps, { ...op, status: 'closed' }, { segmentUids: ['s1'] }));
});

test('openOperationalPeriod: stands up the Track Logs folder, but a folder failure does not lose the OP', async () => {
    const gateway = fakeGateway();
    await openOperationalPeriod({ registry: fakeRegistry(), gateway, now: NOW }, {
        incidentName: 'X', channels: ['a'],
    });
    assert.deepEqual(
        gateway.calls.find((c) => c.method === 'ensureFolder'),
        { method: 'ensureFolder', args: ['guid-1', TRACK_LOG_FOLDER] },
    );

    const broken = fakeGateway();
    broken.ensureFolder = async () => { throw new Error('no token'); };
    const registry = fakeRegistry();
    const entry = await openOperationalPeriod({ registry, gateway: broken, now: NOW }, {
        incidentName: 'X', channels: ['a'],
    });
    assert.equal(entry.opNumber, 1);
    assert.equal(registry.entries.length, 1);
});

test('attachTrackLog: publishes into the folder, then records summary on the debrief', async () => {
    const op: OpPeriodRegistryEntry = {
        opNumber: 2, name: 'X - OP2', guid: 'g2', status: 'open', channels: [],
    };
    const record: DebriefRecord = {
        opNumber: 2, segmentUid: 's5', pod: 60, resource: 'Team 3',
        recordedAt: '2026-08-30T18:00:00.000Z',
    };
    const debriefs = fakeDebriefStore([record]);
    const gateway = fakeGateway();
    const published: { folderUid: string; callsign: string; points: number; remarks?: string }[] = [];
    const publisher = {
        async publishTrack(_op: OpPeriodRegistryEntry, folderUid: string, track: {
            callsign: string; coords: [number, number][]; uid?: string; remarks?: string;
        }) {
            published.push({
                folderUid, callsign: track.callsign, points: track.coords.length, remarks: track.remarks,
            });
            return track.uid ?? 'cot-1';
        },
    };

    const ref = await attachTrackLog({ gateway, publisher, debriefs, now: NOW }, op, record, {
        track: {
            name: 'garmin',
            coords: [[-105, 39], [-105, 39.01], [-105, 39.02]],
            times: ['2026-08-30T14:00:00Z', '2026-08-30T15:00:00Z', '2026-08-30T16:00:00Z'],
        },
        source: 'team3.gpx',
        segmentLabel: '05',
    });

    assert.equal(published.length, 1);
    assert.equal(published[0].folderUid, `layer-g2-${TRACK_LOG_FOLDER}`);
    // Resource wins over the file's own track name in the map callsign.
    assert.equal(published[0].callsign, 'TRK OP2 · 05 · Team 3');
    assert.match(published[0].remarks ?? '', /Source: team3\.gpx/);

    assert.equal(ref.uid, 'cot-1');
    assert.equal(ref.points, 3);
    assert.equal(ref.sourcePoints, undefined, 'no thinning, so no source count');
    assert.equal(ref.startedAt, '2026-08-30T14:00:00.000Z');
    assert.equal(ref.attachedAt, '2026-08-06T20:00:00.000Z');
    assert.ok(ref.lengthMi > 1 && ref.lengthMi < 2, `got ${ref.lengthMi}`);

    // The schema record now carries the reference.
    assert.equal(debriefs.records[0].tracks?.length, 1);
    assert.equal(debriefs.records[0].tracks?.[0].uid, 'cot-1');
});

test('attachTrackLog: a supplied callsign is used verbatim', async () => {
    const op: OpPeriodRegistryEntry = {
        opNumber: 2, name: 'X - OP2', guid: 'g2', status: 'open', channels: [],
    };
    const record: DebriefRecord = { opNumber: 2, segmentUid: 's5', pod: 60, resource: 'Team 3' };
    const debriefs = fakeDebriefStore([record]);
    let seen = '';
    const publisher = {
        async publishTrack(_o: OpPeriodRegistryEntry, _f: string, track: { callsign: string }) {
            seen = track.callsign;
            return 'cot-named';
        },
    };
    const track = { name: 'Track 001', coords: [[-105, 39], [-105, 39.01]] as [number, number][] };

    const ref = await attachTrackLog(
        { gateway: fakeGateway(), publisher, debriefs }, op, record,
        { track, source: 'garmin.gpx', segmentLabel: '05', callsign: 'Smith handheld' },
    );
    assert.equal(seen, 'Smith handheld', 'no prefix is bolted on');
    assert.equal(ref.name, 'Smith handheld');

    // Whitespace-only falls back to the derived name rather than publishing blank.
    await attachTrackLog(
        { gateway: fakeGateway(), publisher, debriefs }, op, record,
        { track, source: 'garmin.gpx', segmentLabel: '05', callsign: '   ' },
    );
    assert.equal(seen, 'TRK OP2 · 05 · Team 3');
});

test('attachTrackLog: thins an oversized track and records the original count', async () => {
    const op: OpPeriodRegistryEntry = {
        opNumber: 1, name: 'X - OP1', guid: 'g1', status: 'open', channels: [],
    };
    const record: DebriefRecord = { opNumber: 1, segmentUid: 's1', pod: 50 };
    const debriefs = fakeDebriefStore([record]);
    let publishedPoints = 0;
    const publisher = {
        async publishTrack(_o: OpPeriodRegistryEntry, _f: string, track: { coords: [number, number][] }) {
            publishedPoints = track.coords.length;
            return 'cot-big';
        },
    };

    const coords: [number, number][] = [];
    for (let i = 0; i < 6000; i++) coords.push([-105 + i * 0.0001, 39 + Math.sin(i / 30) * 0.01]);

    const ref = await attachTrackLog(
        { gateway: fakeGateway(), publisher, debriefs }, op, record,
        { track: { name: '', coords }, source: 'big.gpx' },
    );
    assert.ok(publishedPoints <= MAX_TRACK_POINTS, `published ${publishedPoints}`);
    assert.equal(ref.points, publishedPoints);
    assert.equal(ref.sourcePoints, 6000);
});

test('attachTrackLog: refuses a degenerate track and an unknown debrief', async () => {
    const op: OpPeriodRegistryEntry = {
        opNumber: 1, name: 'X - OP1', guid: 'g1', status: 'open', channels: [],
    };
    const record: DebriefRecord = { opNumber: 1, segmentUid: 's1', pod: 50 };
    const publisher = { async publishTrack() { return 'cot'; } };

    await assert.rejects(
        () => attachTrackLog(
            { gateway: fakeGateway(), publisher, debriefs: fakeDebriefStore([record]) },
            op, record, { track: { name: '', coords: [[-105, 39]] }, source: 'x.gpx' },
        ),
        /at least two points/,
    );

    // A debrief that is not in the store must fail loudly — otherwise the CoT
    // is published and nothing points at it.
    await assert.rejects(() => attachTrackLog(
        { gateway: fakeGateway(), publisher, debriefs: fakeDebriefStore([]) },
        op, record, { track: { name: '', coords: [[-105, 39], [-105, 39.1]] }, source: 'x.gpx' },
    ));
});

test('detachTrackLog: drops the reference and leaves the CoT alone', async () => {
    const record: DebriefRecord = {
        opNumber: 1, segmentUid: 's1', pod: 50,
        tracks: [
            { uid: 't1', name: 'a', source: 'f', points: 5, lengthMi: 1 },
            { uid: 't2', name: 'b', source: 'f', points: 5, lengthMi: 2 },
        ],
    };
    const debriefs = fakeDebriefStore([record]);
    const after = await detachTrackLog(debriefs, record, 't1');
    assert.deepEqual(after.tracks?.map((t) => t.uid), ['t2']);
    assert.deepEqual(debriefs.records[0].tracks?.map((t) => t.uid), ['t2']);
    assert.equal(debriefKey(after), debriefKey(record), 'detaching does not change identity');
});

test('closeOperationalPeriod: strips channels and closes registry (no demotion)', async () => {
    const op: OpPeriodRegistryEntry = {
        opNumber: 1, name: 'X - OP1', guid: 'g1', status: 'open',
        channels: ['CCSO Sworn', 'CCSO SarVol'],
    };
    const registry = fakeRegistry([op]);
    const gateway = fakeGateway([
        { clientUid: 'mgr', username: 'manager', role: 'MISSION_OWNER' },
        { clientUid: 'v1', username: 'vol1', role: 'MISSION_SUBSCRIBER' },
    ]);
    const closed = await closeOperationalPeriod({ registry, gateway, now: NOW }, op, {
        retainChannels: ['CCSO Sworn'],
    });
    // Enforcement is the channel strip alone — no per-user role changes
    const roleCalls = gateway.calls.filter((c) => c.method === 'setSubscriberRole');
    assert.equal(roleCalls.length, 0);
    assert.deepEqual(gateway.calls.at(-1), { method: 'setChannels', args: ['g1', ['CCSO Sworn']] });
    assert.equal(closed.status, 'closed');
    assert.equal(registry.entries[0].status, 'closed');
    assert.equal(registry.entries[0].closedAt, '2026-08-06T20:00:00.000Z');
    // closing an already-closed OP is a no-op
    const again = await closeOperationalPeriod({ registry, gateway }, closed, { retainChannels: ['CCSO Sworn'] });
    assert.equal(again, closed);
    await assert.rejects(() => closeOperationalPeriod({ registry, gateway }, op, { retainChannels: [] }));
});
