/**
 * DebriefStore adapter: POD/debrief records in the management sync's
 * mission_schema.json under `incident_response.debriefs`.
 * Appending re-loads the schema to minimize lost-update windows (same
 * last-writer-wins exposure as the rest of the schema file — small IMT).
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { DebriefRecord, TrackLogRef } from '../domain/entities.ts';
import type { DebriefStore } from '../domain/ports.ts';
import { debriefRecordFromValue } from '../domain/debrief.ts';
import { debriefKey } from '../domain/trackLog.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';

export function debriefsFromSchema(schema: MissionSchema): DebriefRecord[] {
    const raw = (schema.incident_response as Record<string, unknown>).debriefs;
    if (!Array.isArray(raw)) return [];
    return raw.map(debriefRecordFromValue).filter((r): r is DebriefRecord => r !== null);
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
