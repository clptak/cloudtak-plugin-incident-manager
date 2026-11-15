/**
 * CloudTAK Core Event Timeline entries for incidents. Pure: builds
 * entries and picks the event; src/lib/eventTimeline.ts does the I/O.
 *
 * Every entry carries an `external_id`, so writing it again (a retry, an
 * edited log, a re-sent phase) updates the same timeline row in place.
 *
 *   wa:<id>:created|started|completed   work assignment lifecycle
 *   ra:<id>:added|<status>              resource added / status change
 *   log:<DataSync log id>               a narrative DataSync log
 */

/** CloudTAK's timeline entry types (api/common/enums.ts CoreEntityTimeline_Type). */
export type TimelineType = 'comment' | 'status' | 'unit' | 'location' | 'attachment' | 'external';

/** Timeline routes shipped in CloudTAK 13.122.0. */
export const TIMELINE_MIN_VERSION = '13.122.0';

/** `metadata.source` on every entry this plugin writes. */
export const TIMELINE_SOURCE = 'incident-manager';

export interface TimelineEntry {
    type: TimelineType;
    occurred?: string;
    author: string;
    body: string;
    metadata: Record<string, unknown>;
    external_id: string;
}

/** Whether a CloudTAK version ("v13.122.8", "13.122.0-rc1") has the timeline routes. */
export function supportsTimeline(version: string | undefined | null, min = TIMELINE_MIN_VERSION): boolean {
    const parse = (v: string) => (/(\d+)\.(\d+)\.(\d+)/.exec(v) ?? []).slice(1).map(Number);
    const have = parse(version ?? '');
    const need = parse(min);
    if (have.length !== 3) return false;
    for (let i = 0; i < 3; i++) {
        if (have[i] !== need[i]) return have[i] > need[i];
    }
    return true;
}

/** An ISO time or nothing: the API rejects anything that is not date-time. */
function isoOrUndefined(value: string | undefined): string | undefined {
    if (!value?.trim()) return undefined;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function meta(kind: string, extra: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { source: TIMELINE_SOURCE, kind };
    for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== '' && v !== null) out[k] = v;
    }
    return out;
}

// ── which event ─────────────────────────────────────────────────────────

export interface TimelineOp {
    guid: string;
    opNumber: number;
    fieldEventId?: string;
}

export interface TimelineTargetInput {
    /** The incident's MGMT event (`schema.core_event.id`). */
    mgmtEventId?: string | null;
    ops: TimelineOp[];
    /** DataSync the log was written to, when there is one. */
    syncGuid?: string;
    /** Operational period the item belongs to, when known. */
    opNumber?: number | null;
}

/**
 * The OP's field event when the item belongs to an OP that has one (by the
 * sync it was logged on, else by OP number); otherwise the MGMT event.
 */
export function pickTimelineEvent(input: TimelineTargetInput): string | null {
    const bySync = input.syncGuid ? input.ops.find((op) => op.guid === input.syncGuid) : undefined;
    if (bySync?.fieldEventId) return bySync.fieldEventId;
    if (!bySync && typeof input.opNumber === 'number') {
        const byNumber = input.ops.find((op) => op.opNumber === input.opNumber);
        if (byNumber?.fieldEventId) return byNumber.fieldEventId;
    }
    return input.mgmtEventId || null;
}

// ── work assignments ────────────────────────────────────────────────────

export type WorkAssignmentTimelinePhase = 'created' | 'started' | 'completed';

export interface WorkAssignmentTimelineInput {
    id: string;
    assignmentNumber: number;
    teamLabel?: string;
    assignmentCallsign?: string;
    assignmentUid?: string;
    instructions?: string;
    /** ISO time of the phase; omitted means now. */
    occurred?: string;
    /** DataSync log the phase was written to (started / completed). */
    logId?: string;
}

const PHASE_LABEL: Record<WorkAssignmentTimelinePhase, string> = {
    created: 'Created',
    started: 'Started',
    completed: 'Completed',
};

export function workAssignmentTimelineEntry(
    a: WorkAssignmentTimelineInput,
    phase: WorkAssignmentTimelinePhase,
    author = '',
): TimelineEntry {
    const lines = [
        `**Assignment ${a.assignmentNumber} ${PHASE_LABEL[phase].toLowerCase()}**`,
        a.teamLabel?.trim() ? `Team: ${a.teamLabel.trim()}` : '',
        a.assignmentCallsign?.trim() ? `Map object: ${a.assignmentCallsign.trim()}` : '',
        phase !== 'completed' && a.instructions?.trim() ? `Instructions: ${a.instructions.trim()}` : '',
    ].filter(Boolean);
    return {
        type: 'status',
        occurred: isoOrUndefined(a.occurred),
        author,
        body: lines.join('\n'),
        metadata: meta('work-assignment', {
            phase,
            assignmentId: a.id,
            assignmentNumber: a.assignmentNumber,
            assignmentUid: a.assignmentUid,
            logId: a.logId,
        }),
        external_id: `wa:${a.id}:${phase}`,
    };
}

// ── resource assignments ────────────────────────────────────────────────

export interface ResourceTimelineInput {
    id: string;
    resourceIdentifier: string;
    resource?: string;
    agency?: string;
    status: string;
    statusLabel: string;
    opNumber?: number | null;
    /** ISO time of the change; omitted means now. */
    occurred?: string;
}

/**
 * A resource added (`added`), or moved to a new status. One entry per status,
 * so going Requested -> Have -> Demobilized leaves three rows.
 */
export function resourceTimelineEntry(
    r: ResourceTimelineInput,
    change: 'added' | 'status',
    author = '',
): TimelineEntry {
    const name = [r.resourceIdentifier.trim(), r.resource?.trim()].filter(Boolean).join(' - ') || 'Resource';
    const heading = change === 'added'
        ? `**Resource added: ${name}** (${r.statusLabel})`
        : `**Resource ${name}: ${r.statusLabel}**`;
    const lines = [
        heading,
        r.agency?.trim() ? `Agency: ${r.agency.trim()}` : '',
        typeof r.opNumber === 'number' ? `OP ${r.opNumber}` : '',
    ].filter(Boolean);
    return {
        type: 'unit',
        occurred: isoOrUndefined(r.occurred),
        author,
        body: lines.join('\n'),
        metadata: meta('resource', {
            change,
            resourceId: r.id,
            resourceIdentifier: r.resourceIdentifier.trim(),
            status: r.status,
            opNumber: r.opNumber ?? undefined,
        }),
        external_id: `ra:${r.id}:${change === 'added' ? 'added' : r.status}`,
    };
}

/** Whether a resource change is worth a timeline row: only status changes. */
export function resourceStatusChanged(before: { status: string }, after: { status: string }): boolean {
    return before.status !== after.status;
}

// ── DataSync logs ───────────────────────────────────────────────────────

export interface LogTimelineInput {
    logId: string;
    content: string;
    /** Bold first line, e.g. "Search Urgency"; omitted for self-describing logs. */
    title?: string;
    dtg?: string;
    type?: TimelineType;
    /** Sync the log was written to (name shown under the entry). */
    syncName?: string;
    keywords?: string[];
}

/** A narrative DataSync log as a timeline entry, keyed by its log id. */
export function logTimelineEntry(log: LogTimelineInput, author = ''): TimelineEntry | null {
    const content = log.content.trim();
    if (!log.logId || !content) return null;
    const body = [
        log.title?.trim() ? `**${log.title.trim()}**` : '',
        content,
        log.syncName?.trim() ? `_DataSync: ${log.syncName.trim()}_` : '',
    ].filter(Boolean).join('\n');
    return {
        type: log.type ?? 'comment',
        occurred: isoOrUndefined(log.dtg),
        author,
        body,
        metadata: meta('datasync-log', {
            logId: log.logId,
            syncName: log.syncName,
            keywords: log.keywords?.length ? log.keywords : undefined,
        }),
        external_id: `log:${log.logId}`,
    };
}
