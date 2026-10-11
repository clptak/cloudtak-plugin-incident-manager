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
    const tracks = trackLogRefsFromValue(rec.tracks);
    if (tracks.length) record.tracks = tracks;
    return record;
}
