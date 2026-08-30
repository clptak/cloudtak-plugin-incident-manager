/**
 * DebriefStore adapter: POD/debrief records in the management sync's
 * mission_schema.json under `incident_response.debriefs`.
 * Appending re-loads the schema to minimize lost-update windows (same
 * last-writer-wins exposure as the rest of the schema file — small IMT).
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { DebriefRecord, TrackLogRef } from '../domain/entities.ts';
import type { DebriefStore } from '../domain/ports.ts';
import { debriefKey } from '../domain/trackLog.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';

/**
 * GPS track references attached to a completed assignment. Reference + summary
 * only — the polyline itself stays a CoT in the OP sync's Track Logs folder
 * (see domain/entities.ts `TrackLogRef`).
 */
function tracksFromValue(raw: unknown): TrackLogRef[] {
    if (!Array.isArray(raw)) return [];
    const tracks: TrackLogRef[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        const uid = typeof rec.uid === 'string' ? rec.uid.trim() : '';
        if (!uid) continue;
        const track: TrackLogRef = {
            uid,
            name: typeof rec.name === 'string' ? rec.name : uid,
            source: typeof rec.source === 'string' ? rec.source : '',
            points: Number.isFinite(Number(rec.points)) ? Number(rec.points) : 0,
            lengthMi: Number.isFinite(Number(rec.lengthMi)) ? Number(rec.lengthMi) : 0,
        };
        if (Number.isFinite(Number(rec.sourcePoints))) track.sourcePoints = Number(rec.sourcePoints);
        if (typeof rec.startedAt === 'string' && rec.startedAt) track.startedAt = rec.startedAt;
        if (typeof rec.endedAt === 'string' && rec.endedAt) track.endedAt = rec.endedAt;
        if (typeof rec.attachedAt === 'string' && rec.attachedAt) track.attachedAt = rec.attachedAt;
        tracks.push(track);
    }
    return tracks;
}

export function debriefsFromSchema(schema: MissionSchema): DebriefRecord[] {
    const raw = (schema.incident_response as Record<string, unknown>).debriefs;
    if (!Array.isArray(raw)) return [];
    const records: DebriefRecord[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        const segmentUid = typeof rec.segmentUid === 'string' ? rec.segmentUid.trim() : '';
        const pod = Number(rec.pod);
        const opNumber = Number(rec.opNumber);
        if (!segmentUid || !Number.isFinite(pod) || !Number.isInteger(opNumber)) continue;
        const record: DebriefRecord = { opNumber, segmentUid, pod };
        if (typeof rec.coverage === 'number' && Number.isFinite(rec.coverage)) record.coverage = rec.coverage;
        if (typeof rec.resource === 'string' && rec.resource.trim()) record.resource = rec.resource.trim();
        if (typeof rec.notes === 'string' && rec.notes.trim()) record.notes = rec.notes.trim();
        if (typeof rec.recordedAt === 'string' && rec.recordedAt.trim()) record.recordedAt = rec.recordedAt;
        const tracks = tracksFromValue(rec.tracks);
        if (tracks.length) record.tracks = tracks;
        records.push(record);
    }
    return records;
}

export function createDebriefStore(mission: ActiveMission): DebriefStore {
    return {
        async load(): Promise<DebriefRecord[]> {
            const sub = await loadSchemaSubscription(mission);
            const { schema } = await loadMissionSchema(sub);
            return debriefsFromSchema(schema);
        },

        async append(record: DebriefRecord): Promise<void> {
            const sub = await loadSchemaSubscription(mission);
            const loaded = await loadMissionSchema(sub);
            const existing = debriefsFromSchema(loaded.schema);
            (loaded.schema.incident_response as Record<string, unknown>).debriefs = [
                ...existing,
                { ...record, recordedAt: record.recordedAt ?? new Date().toISOString() },
            ];
            await saveMissionSchema(sub, loaded.schema, {
                contentHash: loaded.contentHash,
                legacyLogId: loaded.legacyLogId,
                missionToken: schemaMissionToken(sub, mission),
            });
        },

        /**
         * Re-reads the schema and rewrites just the matching record's `tracks`,
         * so an attach made while someone else was editing does not clobber
         * their debrief. Throws when the record is gone — the caller has
         * already published a CoT and needs to know it is unreferenced.
         */
        async setTracks(key: string, tracks: TrackLogRef[]): Promise<void> {
            const sub = await loadSchemaSubscription(mission);
            const loaded = await loadMissionSchema(sub);
            const existing = debriefsFromSchema(loaded.schema);
            const index = existing.findIndex((r) => debriefKey(r) === key);
            if (index === -1) {
                throw new Error(
                    'That completed assignment is no longer in the incident record — '
                    + 'refresh and attach the track again.',
                );
            }
            const next = { ...existing[index] };
            if (tracks.length) next.tracks = tracks;
            else delete next.tracks;
            existing[index] = next;

            (loaded.schema.incident_response as Record<string, unknown>).debriefs = existing;
            await saveMissionSchema(sub, loaded.schema, {
                contentHash: loaded.contentHash,
                legacyLogId: loaded.legacyLogId,
                missionToken: schemaMissionToken(sub, mission),
            });
        },
    };
}
