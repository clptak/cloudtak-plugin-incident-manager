/**
 * Application use cases for the OP lifecycle (Phase 3).
 * Pure orchestration over ports — no I/O, no framework imports.
 * Naming per docs-archive/multi-op-datasync-architecture.md §4.3.
 */

import type {
    DebriefRecord,
    OpAssignment,
    OpPeriodRegistryEntry,
    TrackLogRef,
} from './entities.ts';
import type {
    AssignmentStore,
    DebriefStore,
    OpFeaturePublisher,
    OpPeriodGateway,
    RegistryStore,
    SegmentGeometrySource,
    TrackLogPublisher,
} from './ports.ts';
import { closeRegistryEntry, nextOpNumber, upsertRegistryEntry } from './registry.ts';
import {
    debriefKey,
    MAX_TRACK_POINTS,
    simplifyTrack,
    trackLogCallsign,
    trackMetrics,
    withoutTrack,
    withTrack,
    type ParsedTrack,
} from './trackLog.ts';

/**
 * Mission folder every OP sync carries for GPS breadcrumb trails. Created with
 * the OP so it is already there when the first team debriefs.
 */
export const TRACK_LOG_FOLDER = 'Track Logs';

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
        keywords?: string[];
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
        keywords: input.keywords,
    });

    const registered: OpPeriodRegistryEntry = {
        ...entry,
        status: 'open',
        openedAt: (deps.now?.() ?? new Date()).toISOString(),
    };

    // Stand the Track Logs folder up now, while we hold the fresh owner token,
    // so attaching a track at debrief time is one click rather than a create.
    // A folder failure must not lose the OP: the sync exists and is registered
    // either way, and ensureTrackLogFolder() re-tries on demand.
    try {
        await deps.gateway.ensureFolder(registered, TRACK_LOG_FOLDER);
    } catch {
        // Non-fatal — created lazily on first attach.
    }

    await deps.registry.save(upsertRegistryEntry(entries, registered));
    return registered;
}

/**
 * Get the OP's Track Logs folder, creating it if the OP predates this feature
 * or the create-time attempt failed.
 */
export async function ensureTrackLogFolder(
    gateway: OpPeriodGateway,
    op: OpPeriodRegistryEntry,
): Promise<string> {
    return gateway.ensureFolder(op, TRACK_LOG_FOLDER);
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

    const existing = await deps.assignments.load();
    const published: OpAssignment[] = [];
    for (const segmentUid of input.segmentUids) {
        const feature = await deps.geometry.getFeature(segmentUid);
        if (!feature) {
            throw new Error(`publishAssignments: no feature found for ${segmentUid}`);
        }
        // Republish reuses the prior feature uid — TAK updates in place instead
        // of duplicating features on subscriber maps.
        const prior = existing.find(
            (a) => a.opNumber === op.opNumber && a.segmentUid === segmentUid,
        );
        const opFeatureUid = await deps.publisher.publishFeature(op, feature, prior?.opFeatureUid);
        const assignment: OpAssignment = {
            opNumber: op.opNumber,
            segmentUid,
            opFeatureUid,
            label: feature.callsign || segmentUid,
            createdAt: prior?.createdAt ?? (deps.now?.() ?? new Date()).toISOString(),
        };
        if (input.team?.trim()) assignment.team = input.team.trim();
        if (input.notes?.trim()) assignment.notes = input.notes.trim();
        await deps.assignments.upsert(assignment);
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
    // POD is search-only. Absent is legal (non-search incidents report what was
    // worked, not how thoroughly); present-but-nonsense is not.
    if (record.pod !== undefined
        && (!Number.isFinite(record.pod) || record.pod < 0 || record.pod > 100)) {
        throw new Error('recordDebrief: POD must be 0–100');
    }
    if (record.coverage !== undefined
        && (!Number.isFinite(record.coverage) || record.coverage <= 0 || record.coverage > 1)) {
        throw new Error('recordDebrief: coverage must be in (0, 1]');
    }
    await store.append(record);
}

export interface TrackLogDeps {
    gateway: OpPeriodGateway;
    publisher: TrackLogPublisher;
    debriefs: DebriefStore;
    now?: () => Date;
}

/**
 * Attach a GPS track log to a completed search assignment.
 *
 * Order matters: publish into the OP sync FIRST, record in the schema SECOND.
 * The reverse would let a schema write succeed against a CoT that never landed,
 * leaving the case file claiming evidence that does not exist. A published CoT
 * with no schema reference is the recoverable failure — it is visible on the
 * map and can be re-attached from the picker.
 */
export async function attachTrackLog(
    deps: TrackLogDeps,
    op: OpPeriodRegistryEntry,
    record: DebriefRecord,
    input: {
        track: ParsedTrack;
        /** Filename, or 'map' when the line was picked off the map. */
        source: string;
        segmentLabel?: string;
        /**
         * Map callsign, used verbatim. Omit to derive one from OP, segment and
         * resource. Handheld GPS exports carry generic track names ("Track
         * 001"), so a single-track file is worth naming by hand — and one
         * assignment often has several tracks (one per person carrying a unit)
         * that need telling apart.
         */
        callsign?: string;
        /** Reuse this CoT uid — set when re-filing a line already on the map. */
        existingUid?: string;
        /** 1-based position when one file yielded several tracks. */
        index?: number;
        total?: number;
    },
): Promise<TrackLogRef> {
    if (input.track.coords.length < 2) {
        throw new Error('attachTrackLog: a track needs at least two points');
    }

    const folderUid = await ensureTrackLogFolder(deps.gateway, op);
    const metrics = trackMetrics(input.track);
    const coords = simplifyTrack(input.track.coords, MAX_TRACK_POINTS);
    const callsign = input.callsign?.trim() || trackLogCallsign({
        opNumber: op.opNumber,
        segmentLabel: input.segmentLabel,
        resource: record.resource,
        sourceName: input.track.name,
        index: input.index,
        total: input.total,
    });

    const remarks = [
        `Track log · OP${op.opNumber}`,
        input.segmentLabel ? `Segment ${input.segmentLabel}` : '',
        record.resource ? `Resource ${record.resource}` : '',
        `${metrics.lengthMi} mi · ${metrics.points} fixes`,
        metrics.startedAt ? `${metrics.startedAt} → ${metrics.endedAt}` : '',
        `Source: ${input.source}`,
    ].filter(Boolean).join('\n');

    const uid = await deps.publisher.publishTrack(op, folderUid, {
        callsign,
        coords,
        uid: input.existingUid,
        remarks,
    });

    const ref: TrackLogRef = {
        uid,
        name: callsign,
        source: input.source,
        points: coords.length,
        lengthMi: metrics.lengthMi,
        attachedAt: (deps.now?.() ?? new Date()).toISOString(),
    };
    if (coords.length !== metrics.points) ref.sourcePoints = metrics.points;
    if (metrics.startedAt) ref.startedAt = metrics.startedAt;
    if (metrics.endedAt) ref.endedAt = metrics.endedAt;

    const updated = withTrack(record, ref);
    await deps.debriefs.setTracks(debriefKey(record), updated.tracks ?? []);
    return ref;
}

/**
 * Drop a track reference from a completed assignment.
 *
 * The CoT is left in the OP sync's Track Logs folder on purpose: a track is a
 * record of where people actually went, and deleting it from a live mission on
 * a mis-click is not recoverable. Detaching returns it to the picker so it can
 * be filed against the right assignment.
 */
export async function detachTrackLog(
    store: DebriefStore,
    record: DebriefRecord,
    uid: string,
): Promise<DebriefRecord> {
    const updated = withoutTrack(record, uid);
    await store.setTracks(debriefKey(record), updated.tracks ?? []);
    return updated;
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
