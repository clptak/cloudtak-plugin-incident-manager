/**
 * Core Event Timeline writes: the I/O around src/domain/eventTimeline.ts.
 *
 * Work assignment and resource changes, and narrative DataSync logs, are
 * mirrored onto the incident's Core Event timeline: the OP's field event
 * when the item belongs to an OP that has one, else the MGMT event.
 *
 * Like the events themselves (ADR-004) the timeline is a convenience beside
 * the incident: every call here runs in the background, never throws and
 * never fails the operation that triggered it. Incidents with no linked
 * event, and CloudTAK cores older than 13.122.0, are skipped silently.
 */

import { server } from '../../../../src/std.ts';
import ProfileConfig from '../../../../src/base/profile.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import {
    logTimelineEntry,
    pickTimelineEvent,
    resourceTimelineEntry,
    supportsTimeline,
    workAssignmentTimelineEntry,
    type TimelineEntry,
    type TimelineOp,
    type TimelineType,
    type WorkAssignmentTimelinePhase,
} from '../domain/eventTimeline.ts';
import { registryFromSchemaValue } from '../domain/registry.ts';
import { datetimeLocalToIso } from './incidentInfo.ts';
import { loadSchemaSubscription } from './incidentSubscription.ts';
import { loadMissionSchema } from './missionSchema.ts';
import { resourceStatusLabel, type ResourceAssignment } from './resourceAssignments.ts';
import type { WorkAssignment } from './workAssignments.ts';

const TARGET_TTL_MS = 60_000;

interface IncidentTargets {
    at: number;
    mgmtEventId: string | null;
    ops: (TimelineOp & { name: string })[];
}

let supported: Promise<boolean> | null = null;
let author: Promise<string> | null = null;
const targets = new Map<string, Promise<IncidentTargets>>();

function warn(what: string, err: unknown): void {
    console.warn(`[incident-manager] timeline: ${what}:`, err instanceof Error ? err.message : err);
}

/** Whether this CloudTAK has the timeline routes; a failed check is retried next time. */
function timelineSupported(): Promise<boolean> {
    if (!supported) {
        supported = server.GET('/api/server').then((res) => {
            if (res.error) throw new Error(res.error.message);
            return supportsTimeline((res.data as { version?: string }).version);
        }).catch((err) => {
            supported = null;
            warn('could not read the CloudTAK version', err);
            return false;
        });
    }
    return supported;
}

/** The user's TAK callsign; empty lets CloudTAK record the username. */
function timelineAuthor(): Promise<string> {
    if (!author) {
        author = ProfileConfig.fetch()
            .then((p) => (p as { tak_callsign?: string }).tak_callsign?.trim() ?? '')
            .catch(() => {
                author = null;
                return '';
            });
    }
    return author;
}

function incidentKey(mission: ActiveMission): string {
    return mission.mgmt?.guid ?? mission.guid;
}

/** The MGMT event and the OPs' field events, from the schema (cached briefly). */
function incidentTargets(mission: ActiveMission): Promise<IncidentTargets> {
    const key = incidentKey(mission);
    const cached = targets.get(key);
    if (cached) return cached;

    const loading = (async (): Promise<IncidentTargets> => {
        const sub = await loadSchemaSubscription(mission);
        const { schema } = await loadMissionSchema(sub);
        const link = schema.core_event as { id?: unknown } | undefined;
        return {
            at: Date.now(),
            mgmtEventId: typeof link?.id === 'string' && link.id ? link.id : null,
            ops: registryFromSchemaValue(schema.tak_missions).map((op) => ({
                guid: op.guid,
                name: op.name,
                opNumber: op.opNumber,
                fieldEventId: op.fieldEventId,
            })),
        };
    })();
    targets.set(key, loading);
    loading.then(
        (t) => setTimeout(() => { if (targets.get(key) === loading) targets.delete(key); }, Math.max(0, t.at + TARGET_TTL_MS - Date.now())),
        () => targets.delete(key),
    );
    return loading;
}

/** Forget the cached event links, e.g. after an event is linked or an OP activated. */
export function forgetTimelineTargets(mission?: ActiveMission): void {
    if (mission) targets.delete(incidentKey(mission));
    else targets.clear();
}

function syncName(mission: ActiveMission, t: IncidentTargets, guid: string): string {
    if (mission.mgmt && guid === mission.mgmt.guid) return mission.mgmt.name;
    return t.ops.find((op) => op.guid === guid)?.name ?? (guid === mission.guid ? mission.name : '');
}

async function upsert(eventId: string, entries: TimelineEntry[]): Promise<void> {
    const res = await server.PUT('/api/core/entity/{:entity}/timeline', {
        params: { path: { ':entity': eventId } },
        body: { entries } as never,
    });
    if (res.error) throw new Error(res.error.message ?? 'request failed');
}

/**
 * Resolve the event and write. Resolves true when written, false when
 * skipped or failed; never rejects.
 */
async function write(
    mission: ActiveMission | null | undefined,
    what: string,
    where: { syncGuid?: string; opNumber?: number | null },
    build: (author: string, t: IncidentTargets) => TimelineEntry | null,
): Promise<boolean> {
    if (!mission) return false;
    try {
        if (!await timelineSupported()) return false;
        const t = await incidentTargets(mission);
        const eventId = pickTimelineEvent({ mgmtEventId: t.mgmtEventId, ops: t.ops, ...where });
        if (!eventId) return false;
        const entry = build(await timelineAuthor(), t);
        if (!entry) return false;
        await upsert(eventId, [entry]);
        return true;
    } catch (err) {
        warn(what, err);
        return false;
    }
}

// ── public ──────────────────────────────────────────────────────────────

/** A work assignment created, started or completed (started / completed carry their log id). */
export function timelineWorkAssignment(
    mission: ActiveMission | null | undefined,
    a: WorkAssignment,
    phase: WorkAssignmentTimelinePhase,
): Promise<boolean> {
    const local = phase === 'started' ? a.started : phase === 'completed' ? a.completed : '';
    const logId = phase === 'started' ? a.startedLogId : phase === 'completed' ? a.completedLogId : undefined;
    // Phase logs go to the FIELD DataSync (the active OP's sync).
    return write(mission, `assignment ${a.assignmentNumber} ${phase}`, { syncGuid: mission?.guid }, (by) =>
        workAssignmentTimelineEntry({
            id: a.id,
            assignmentNumber: a.assignmentNumber,
            teamLabel: a.teamLabel,
            assignmentCallsign: a.assignmentCallsign,
            assignmentUid: a.assignmentUid,
            instructions: a.instructions,
            occurred: datetimeLocalToIso(local) || undefined,
            logId,
        }, phase, by));
}

/** A resource added, or moved to a new status. */
export function timelineResource(
    mission: ActiveMission | null | undefined,
    r: ResourceAssignment,
    change: 'added' | 'status',
): Promise<boolean> {
    const occurred = r.status === 'demobilized' && r.timeDemobilized
        ? datetimeLocalToIso(r.timeDemobilized) || undefined
        : undefined;
    return write(mission, `resource ${r.resourceIdentifier} ${change}`, { opNumber: r.opNumber }, (by) =>
        resourceTimelineEntry({
            id: r.id,
            resourceIdentifier: r.resourceIdentifier,
            resource: r.resource,
            agency: r.agency,
            status: r.status,
            statusLabel: resourceStatusLabel(r.status),
            opNumber: r.opNumber,
            occurred,
        }, change, by));
}

export interface TimelineLogInput {
    /** The DataSync log id returned by create (or the id that was updated). */
    id: string | number | undefined | null;
    content: string;
    dtg?: string;
    keywords?: string[];
}

/**
 * A narrative DataSync log written on `syncGuid`. Call after create and after
 * update: the entry is keyed by log id, so an update rewrites the same row.
 */
export function timelineLog(
    mission: ActiveMission | null | undefined,
    syncGuid: string,
    log: TimelineLogInput,
    opts: { title?: string; type?: TimelineType } = {},
): Promise<boolean> {
    const logId = log.id === undefined || log.id === null ? '' : String(log.id);
    if (!logId) return Promise.resolve(false);
    return write(mission, `log ${logId}`, { syncGuid }, (by, t) => logTimelineEntry({
        logId,
        content: log.content,
        title: opts.title,
        type: opts.type,
        dtg: log.dtg,
        keywords: log.keywords,
        syncName: mission ? syncName(mission, t, syncGuid) : '',
    }, by));
}
