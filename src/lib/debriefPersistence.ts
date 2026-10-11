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

function findOrThrow(records: DebriefRecord[], key: string): number {
    const index = records.findIndex((r) => debriefKey(r) === key);
    if (index === -1) {
        throw new Error(
            'That completed assignment is no longer in the incident record — '
            + 'refresh and try again.',
        );
    }
    return index;
}

export function createDebriefStore(mission: ActiveMission): DebriefStore {
    /**
     * Re-read the schema, let `change` produce the new debrief list (or null
     * for "nothing to do"), and save. On Mission Properties the save is a diff,
     * so only the debrief keys that actually changed are written.
     */
    async function rewrite(change: (records: DebriefRecord[]) => DebriefRecord[] | null): Promise<void> {
        const sub = await loadSchemaSubscription(mission);
        const loaded = await loadMissionSchema(sub);
        const next = change(debriefsFromSchema(loaded.schema));
        if (!next) return;
        (loaded.schema.incident_response as Record<string, unknown>).debriefs = next;
        await saveMissionSchema(sub, loaded.schema, {
            contentHash: loaded.contentHash,
            legacyLogId: loaded.legacyLogId,
            missionToken: schemaMissionToken(sub, mission),
        });
    }

    return {
        async load(): Promise<DebriefRecord[]> {
            const sub = await loadSchemaSubscription(mission);
            const { schema } = await loadMissionSchema(sub);
            return debriefsFromSchema(schema);
        },

        async append(record: DebriefRecord): Promise<void> {
            await rewrite((existing) => [
                ...existing,
                { ...record, recordedAt: record.recordedAt ?? new Date().toISOString() },
            ]);
        },

        /**
         * Re-reads the schema and rewrites just the matching record's `tracks`,
         * so an attach made while someone else was editing does not clobber
         * their debrief. Throws when the record is gone — the caller has
         * already published a CoT and needs to know it is unreferenced.
         */
        async setTracks(key: string, tracks: TrackLogRef[]): Promise<void> {
            await rewrite((existing) => {
                const index = findOrThrow(existing, key);
                const next = { ...existing[index] };
                if (tracks.length) next.tracks = tracks;
                else delete next.tracks;
                existing[index] = next;
                return existing;
            });
        },

        async replace(key: string, record: DebriefRecord): Promise<void> {
            await rewrite((existing) => {
                existing[findOrThrow(existing, key)] = record;
                return existing;
            });
        },

        async remove(key: string): Promise<void> {
            await rewrite((existing) => {
                const kept = existing.filter((r) => debriefKey(r) !== key);
                return kept.length === existing.length ? null : kept;
            });
        },
    };
}
