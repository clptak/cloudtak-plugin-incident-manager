/**
 * DebriefStore adapter: POD/debrief records in the management sync's
 * mission_schema.json under `incident_response.debriefs`.
 * Appending re-loads the schema to minimize lost-update windows (same
 * last-writer-wins exposure as the rest of the schema file — small IMT).
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { DebriefRecord } from '../domain/entities.ts';
import type { DebriefStore } from '../domain/ports.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';

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
    };
}
