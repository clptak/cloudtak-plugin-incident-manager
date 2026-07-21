/** Persist Complacency Model risk assessments in mission_schema.json (risk.complacency_assessments). */

import type { ActiveMission } from '../composables/useIncident.ts';
import {
    riskAssessmentsFromSchemaValue,
    type ComplacencyRiskEntry,
    type ComplacencyRiskMap,
} from './complacencyRisk.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';

export function riskAssessmentsFromSchema(schema: MissionSchema): ComplacencyRiskMap {
    const risk = schema.risk as Record<string, unknown> | undefined;
    return riskAssessmentsFromSchemaValue(risk?.complacency_assessments);
}

/** Lookup hook for the future assignment-layer popup: risk by CoT uid. */
export function riskAssessmentForUid(
    schema: MissionSchema,
    uid: string,
): ComplacencyRiskEntry | null {
    return riskAssessmentsFromSchema(schema)[uid] ?? null;
}

export function applyRiskAssessmentsToSchema(
    schema: MissionSchema,
    assessments: ComplacencyRiskMap,
): void {
    if (!schema.risk || typeof schema.risk !== 'object' || Array.isArray(schema.risk)) {
        schema.risk = {};
    }
    (schema.risk as Record<string, unknown>).complacency_assessments = assessments;
}

export async function loadRiskAssessmentsFromMission(
    mission: ActiveMission,
): Promise<{ assessments: ComplacencyRiskMap; contentHash?: string }> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        assessments: riskAssessmentsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveRiskAssessmentsToMission(
    mission: ActiveMission,
    assessments: ComplacencyRiskMap,
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyRiskAssessmentsToSchema(loaded.schema, assessments);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: subscriptionMissionToken(sub, mission),
    });

    return saved.contentHash;
}
