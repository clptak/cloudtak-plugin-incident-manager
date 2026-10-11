/**
 * Incident POST (ICS 234-CG Work Analysis Matrix) schema persistence:
 * objective rows snapshotted in mission_schema.json under
 * `incident_response.incident_post.objectives` (MGMT sync).
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import type { ObjectiveRow, ObjectiveStatus, StrategyCell } from './incidentPost.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';

function sanitizeStrategies(raw: unknown): StrategyCell[] {
    if (!Array.isArray(raw)) return [];
    const out: StrategyCell[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        const tactics = Array.isArray(rec.tactics)
            ? (rec.tactics as unknown[])
                .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
                .map((t) => ({
                    text: typeof t.text === 'string' ? t.text : '',
                    id: typeof t.id === 'string' ? t.id : undefined,
                }))
            : [];
        out.push({
            text: typeof rec.text === 'string' ? rec.text : '',
            id: typeof rec.id === 'string' ? rec.id : undefined,
            tactics,
        });
    }
    return out;
}

export function incidentPostFromSchema(schema: MissionSchema): ObjectiveRow[] {
    const post = (schema.incident_response as Record<string, unknown>).incident_post;
    if (!post || typeof post !== 'object' || Array.isArray(post)) return [];
    const raw = (post as Record<string, unknown>).objectives;
    if (!Array.isArray(raw)) return [];
    const rows: ObjectiveRow[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        rows.push({
            objective: typeof rec.objective === 'string' ? rec.objective : '',
            objectiveId: typeof rec.objectiveId === 'string' ? rec.objectiveId : undefined,
            strategies: sanitizeStrategies(rec.strategies),
            legacy: rec.legacy === true,
            status: rec.status === 'planned' ? 'planned' as ObjectiveStatus : 'current' as ObjectiveStatus,
            plannedDate: typeof rec.plannedDate === 'string' ? rec.plannedDate : '',
        });
    }
    return rows;
}

export function applyIncidentPostToSchema(schema: MissionSchema, rows: ObjectiveRow[]): void {
    const ir = schema.incident_response as Record<string, unknown>;
    const post = (ir.incident_post && typeof ir.incident_post === 'object' && !Array.isArray(ir.incident_post))
        ? ir.incident_post as Record<string, unknown>
        : {};
    post.objectives = rows;
    post.updated = new Date().toISOString();
    ir.incident_post = post;
}

export async function saveIncidentPostToMission(
    mission: ActiveMission,
    rows: ObjectiveRow[],
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    applyIncidentPostToSchema(loaded.schema, rows);
    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
    return saved.contentHash;
}
