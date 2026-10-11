/**
 * Normalize one stored debrief (POD) record. Shared by the mission_schema.json
 * adapter and the Mission Properties adapter so both read records identically.
 */

import type { DebriefRecord } from './entities.ts';
import { trackLogRefsFromValue } from './trackLog.ts';

export function debriefRecordFromValue(value: unknown): DebriefRecord | null {
    if (!value || typeof value !== 'object') return null;
    const rec = value as Record<string, unknown>;
    const segmentUid = typeof rec.segmentUid === 'string' ? rec.segmentUid.trim() : '';
    const opNumber = Number(rec.opNumber);
    if (!segmentUid || !Number.isInteger(opNumber)) return null;
    const record: DebriefRecord = { opNumber, segmentUid };
    // POD is search-only and absent on other incident types — a record
    // without one is valid, not corrupt, and must not be dropped here.
    if (rec.pod !== undefined && rec.pod !== null && rec.pod !== '') {
        const pod = Number(rec.pod);
        if (Number.isFinite(pod)) record.pod = pod;
    }
    if (typeof rec.label === 'string' && rec.label.trim()) record.label = rec.label.trim();
    if (typeof rec.coverage === 'number' && Number.isFinite(rec.coverage)) record.coverage = rec.coverage;
    if (typeof rec.resource === 'string' && rec.resource.trim()) record.resource = rec.resource.trim();
    if (typeof rec.notes === 'string' && rec.notes.trim()) record.notes = rec.notes.trim();
    if (typeof rec.recordedAt === 'string' && rec.recordedAt.trim()) record.recordedAt = rec.recordedAt;
    if (typeof rec.correctedAt === 'string' && rec.correctedAt.trim()) record.correctedAt = rec.correctedAt;
    const tracks = trackLogRefsFromValue(rec.tracks);
    if (tracks.length) record.tracks = tracks;
    return record;
}

function resourceId(record: DebriefRecord): string {
    return (record.resource ?? '').trim().toLowerCase();
}

/**
 * Earlier debriefs by the same resource on the same segment in the same OP,
 * newest first. Each debrief counts as an independent search in the POD
 * rollup, so a second entry meant as a correction would double-count.
 * Records without a resource never match - there is nothing to compare.
 */
export function sameResourceDebriefs(records: DebriefRecord[], record: DebriefRecord): DebriefRecord[] {
    const id = resourceId(record);
    if (!id) return [];
    return records
        .filter((r) => r.opNumber === record.opNumber
            && r.segmentUid === record.segmentUid
            && resourceId(r) === id)
        .sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''));
}

/**
 * Apply a correction to an existing debrief. OP, segment and recordedAt stay
 * (they identify the record); attached tracks stay; the reported values -
 * POD, coverage, resource, notes, label - come from `update`. Fields absent
 * from `update` are cleared, matching what the form shows.
 */
export function correctedDebrief(existing: DebriefRecord, update: DebriefRecord, correctedAt: string): DebriefRecord {
    const next: DebriefRecord = {
        opNumber: existing.opNumber,
        segmentUid: existing.segmentUid,
    };
    const label = update.label ?? existing.label;
    if (label) next.label = label;
    if (update.pod !== undefined) next.pod = update.pod;
    if (update.coverage !== undefined) next.coverage = update.coverage;
    if (update.resource) next.resource = update.resource;
    if (update.notes) next.notes = update.notes;
    if (existing.tracks?.length) next.tracks = existing.tracks;
    if (existing.recordedAt) next.recordedAt = existing.recordedAt;
    next.correctedAt = correctedAt;
    return next;
}
