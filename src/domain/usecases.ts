/**
 * Application use cases for the OP lifecycle (Phase 3).
 * Pure orchestration over ports — no I/O, no framework imports.
 * Naming per docs/multi-op-datasync-architecture.md §4.3.
 */

import type { DebriefRecord, OpAssignment, OpPeriodRegistryEntry } from './entities.ts';
import type {
    AssignmentStore,
    DebriefStore,
    OpFeaturePublisher,
    OpPeriodGateway,
    RegistryStore,
    SegmentGeometrySource,
} from './ports.ts';
import { closeRegistryEntry, nextOpNumber, upsertRegistryEntry } from './registry.ts';

export interface OpLifecycleDeps {
    registry: RegistryStore;
    gateway: OpPeriodGateway;
    now?: () => Date;
}

/**
 * Open the next operational period: create the dual-channel, role-enabled OP
 * sync (suffix naming: `<incident> - OP<n>`) and register it Sworn-side.
 */
export async function openOperationalPeriod(
    deps: OpLifecycleDeps,
    input: {
        incidentName: string;
        /** Channels for the OP sync — field + management (decision 3). */
        channels: string[];
        description?: string;
    },
): Promise<OpPeriodRegistryEntry> {
    const incidentName = input.incidentName.trim();
    if (!incidentName) throw new Error('openOperationalPeriod: incident name required');
    if (!input.channels.length) throw new Error('openOperationalPeriod: at least one channel required');

    const entries = await deps.registry.load();
    const opNumber = nextOpNumber(entries);

    const entry = await deps.gateway.create({
        name: `${incidentName} - OP${opNumber}`,
        opNumber,
        channels: input.channels,
        description: input.description,
    });

    const registered: OpPeriodRegistryEntry = {
        ...entry,
        status: 'open',
        openedAt: (deps.now?.() ?? new Date()).toISOString(),
    };
    await deps.registry.save(upsertRegistryEntry(entries, registered));
    return registered;
}

/**
 * Publish segments to an OP sync as assignments (IAP work assignments).
 * For each segment: read its polygon from wherever the segment features live,
 * re-publish a copy INTO the OP sync (manager authority — channel
 * restrictions don't block this, and volunteers receive it via the OP sync's
 * field channel), and append to the running assignment list Sworn-side.
 */
export async function publishAssignments(
    deps: {
        geometry: SegmentGeometrySource;
        publisher: OpFeaturePublisher;
        assignments: AssignmentStore;
        now?: () => Date;
    },
    op: OpPeriodRegistryEntry,
    input: {
        segmentUids: string[];
        team?: string;
        notes?: string;
    },
): Promise<OpAssignment[]> {
    if (op.status === 'closed') throw new Error('publishAssignments: OP is closed');
    if (!input.segmentUids.length) throw new Error('publishAssignments: no segments selected');

    const published: OpAssignment[] = [];
    for (const segmentUid of input.segmentUids) {
        const polygon = await deps.geometry.getPolygon(segmentUid);
        if (!polygon) {
            throw new Error(`publishAssignments: no polygon found for segment ${segmentUid}`);
        }
        const opFeatureUid = await deps.publisher.publishPolygon(op, polygon);
        const assignment: OpAssignment = {
            opNumber: op.opNumber,
            segmentUid,
            opFeatureUid,
            label: polygon.callsign || segmentUid,
            createdAt: (deps.now?.() ?? new Date()).toISOString(),
        };
        if (input.team?.trim()) assignment.team = input.team.trim();
        if (input.notes?.trim()) assignment.notes = input.notes.trim();
        await deps.assignments.append(assignment);
        published.push(assignment);
    }
    return published;
}

/** Sign-in-roster check-in: grant a volunteer write access for this OP. */
export async function checkInSubscriber(
    gateway: OpPeriodGateway,
    op: OpPeriodRegistryEntry,
    subscriber: { clientUid: string; username: string },
): Promise<void> {
    if (op.status === 'closed') throw new Error('checkInSubscriber: OP is closed');
    await gateway.setSubscriberRole(op, { ...subscriber, role: 'MISSION_SUBSCRIBER' });
}

/** Record a debrief POD for (part of) a segment. */
export async function recordDebrief(
    store: DebriefStore,
    record: DebriefRecord,
): Promise<void> {
    if (!record.segmentUid.trim()) throw new Error('recordDebrief: segmentUid required');
    if (!Number.isFinite(record.pod) || record.pod < 0 || record.pod > 100) {
        throw new Error('recordDebrief: POD must be 0–100');
    }
    if (record.coverage !== undefined
        && (!Number.isFinite(record.coverage) || record.coverage <= 0 || record.coverage > 1)) {
        throw new Error('recordDebrief: coverage must be in (0, 1]');
    }
    await store.append(record);
}

/**
 * Close an operational period:
 * 1. strip field channels — the OP sync keeps only `retainChannels`
 *    (management), so volunteers lose the mission entirely (access AND
 *    visibility). This is the sole enforcement: OP syncs are writable by
 *    default (field must post markers/logs immediately), and demotion below
 *    defaultRole is illegal on password-less missions anyway
 *    (MissionServiceDefaultImpl.java:4219).
 * 2. mark the registry entry closed.
 * Revocation is eventually-consistent (TAK list cache) — callers should not
 * promise instant disappearance.
 */
export async function closeOperationalPeriod(
    deps: OpLifecycleDeps,
    op: OpPeriodRegistryEntry,
    input: { retainChannels: string[] },
): Promise<OpPeriodRegistryEntry> {
    if (op.status === 'closed') return op;
    if (!input.retainChannels.length) {
        throw new Error('closeOperationalPeriod: retainChannels must keep management access');
    }

    await deps.gateway.setChannels(op, input.retainChannels);

    const closedAt = (deps.now?.() ?? new Date()).toISOString();
    const entries = await deps.registry.load();
    await deps.registry.save(closeRegistryEntry(entries, op.guid, closedAt));
    return { ...op, status: 'closed', closedAt, channels: input.retainChannels };
}
