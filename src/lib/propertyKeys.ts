/**
 * Mission Properties key layout for the management (meta) sync - the single
 * place keys are built and recognised, so stores, the read bridge and the
 * v1 -> v2 migration cannot drift apart.
 *
 * Keys are dot-separated and may only contain [A-Za-z0-9.:-] (see
 * missionProperties.ts assertValidKey). Values are JSON text unless noted.
 */

export const META_SCHEMA_KEY = 'meta.schema';
export const SCHEMA_VERSION = '2';

/** 32-bit FNV-1a as 8 hex chars - stable across browser and Node. */
export function shortHash(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * A uid as one key segment. UUIDs pass through unchanged so keys stay readable;
 * anything else (dots, underscores, spaces - non-search CoT uids can contain
 * them) becomes `h` + hash. The original uid is always kept in the value.
 */
export function uidSegment(uid: string): string {
    return /^[A-Za-z0-9-]+$/.test(uid) ? uid : `h${shortHash(uid)}`;
}

// --- Operational periods -------------------------------------------------

export const OP_PREFIX = 'op.';

export function opMissionKey(opNumber: number): string {
    return `op.${opNumber}.mission`;
}

const OP_MISSION_RE = /^op\.(\d+)\.mission$/;

/** The op number when `key` is an `op.<n>.mission` key, otherwise null. */
export function opNumberFromMissionKey(key: string): number | null {
    const m = OP_MISSION_RE.exec(key);
    return m ? Number(m[1]) : null;
}

// --- Debriefs --------------------------------------------------------------

/** All debriefs (`op.`), one op's (`op.<n>.debrief.`), or one segment's. */
export function debriefPrefix(opNumber?: number, segmentUid?: string): string {
    if (opNumber === undefined) return OP_PREFIX;
    if (segmentUid === undefined) return `op.${opNumber}.debrief.`;
    return `op.${opNumber}.debrief.${uidSegment(segmentUid)}.`;
}

/**
 * One key per debrief. A segment can be debriefed more than once in an OP
 * (several resources, or a re-search), so the key ends in a hash of the
 * record's identity (resource + recordedAt, as in domain/trackLog debriefKey).
 */
export function debriefPropertyKey(record: {
    opNumber: number;
    segmentUid: string;
    resource?: string;
    recordedAt?: string;
}): string {
    const id = shortHash(`${record.resource ?? ''}|${record.recordedAt ?? ''}`);
    return `op.${record.opNumber}.debrief.${uidSegment(record.segmentUid)}.${id}`;
}

const DEBRIEF_RE = /^op\.\d+\.debrief\./;

export function isDebriefKey(key: string): boolean {
    return DEBRIEF_RE.test(key);
}
