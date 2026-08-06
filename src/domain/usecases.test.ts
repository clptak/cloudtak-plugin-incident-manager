import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DebriefRecord, OpPeriodRegistryEntry } from './entities.ts';
import type { DebriefStore, OpPeriodGateway, RegistryStore } from './ports.ts';
import {
    checkInSubscriber,
    closeOperationalPeriod,
    openOperationalPeriod,
    publishAssignments,
    recordDebrief,
} from './usecases.ts';

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
    };
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
    const appended: DebriefRecord[] = [];
    const store: DebriefStore = {
        async load() { return appended; },
        async append(r) { appended.push(r); },
    };
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
    const stored: unknown[] = [];
    const published: string[] = [];
    const deps = {
        geometry: {
            async getPolygon(uid: string) {
                if (uid === 'missing') return null;
                return {
                    callsign: `Seg ${uid}`,
                    ring: [[0, 0], [0, 1], [1, 1], [0, 0]] as [number, number][],
                    center: [0.33, 0.66] as [number, number],
                };
            },
        },
        publisher: {
            async publishPolygon(_op: OpPeriodRegistryEntry, polygon: { callsign: string }) {
                published.push(polygon.callsign);
                return `op-feat-${published.length}`;
            },
        },
        assignments: {
            async load() { return []; },
            async append(a: unknown) { stored.push(a); },
        },
        now: NOW,
    };

    const result = await publishAssignments(deps, op, { segmentUids: ['s1', 's2'], team: 'Team 3' });
    assert.equal(result.length, 2);
    assert.deepEqual(published, ['Seg s1', 'Seg s2']);
    assert.equal(result[0].opFeatureUid, 'op-feat-1');
    assert.equal(result[1].team, 'Team 3');
    assert.equal(stored.length, 2);

    await assert.rejects(() => publishAssignments(deps, op, { segmentUids: [] }));
    await assert.rejects(() => publishAssignments(deps, op, { segmentUids: ['missing'] }));
    await assert.rejects(() => publishAssignments(deps, { ...op, status: 'closed' }, { segmentUids: ['s1'] }));
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
