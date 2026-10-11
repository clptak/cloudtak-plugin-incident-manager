/** Persist ROW (Rest of the World) polygons in mission_schema.json (top-level row_segments map). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
    type SegmentRecord,
} from './missionSchema.ts';
import type { SegmentMap } from './segmentsPersistence.ts';

export function rowSegmentsFromSchema(schema: MissionSchema): SegmentMap {
    const raw = schema.row_segments;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: SegmentMap = {};
    for (const [uid, value] of Object.entries(raw)) {
        if (!uid || !value || typeof value !== 'object' || Array.isArray(value)) continue;
        const rec = value as Record<string, unknown>;
        out[uid] = {
            ...rec,
            callsign: typeof rec.callsign === 'string' ? rec.callsign : uid,
            created: typeof rec.created === 'string' ? rec.created : '',
        };
    }
    return out;
}

export function applyRowSegmentsToSchema(schema: MissionSchema, segments: SegmentMap): void {
    const records: Record<string, SegmentRecord> = {};
    for (const [uid, entry] of Object.entries(segments)) {
        if (!uid) continue;
        records[uid] = {
            ...entry,
            callsign: entry.callsign || uid,
            created: entry.created || new Date().toISOString(),
        };
    }
    schema.row_segments = records;
}

export async function loadRowSegmentsFromMission(
    mission: ActiveMission,
): Promise<{ segments: SegmentMap; contentHash?: string }> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        segments: rowSegmentsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveRowSegmentsToMission(
    mission: ActiveMission,
    segments: SegmentMap,
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyRowSegmentsToSchema(loaded.schema, segments);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });

    return saved.contentHash;
}
