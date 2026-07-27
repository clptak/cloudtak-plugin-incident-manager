/** Persist shared tactic risk assessments in mission_schema.json (risk.tactic_assessments). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import {
    mergeLegacyComplacencyAssessments,
    tacticAssessmentsFromSchemaValue,
    tacticEntryToSchemaRecord,
    type TacticRiskEntry,
    type TacticRiskMap,
} from './tacticRisk.ts';

export function tacticAssessmentsFromSchema(schema: MissionSchema): TacticRiskMap {
    const risk = schema.risk as Record<string, unknown> | undefined;
    let map = tacticAssessmentsFromSchemaValue(risk?.tactic_assessments);
    if (risk?.complacency_assessments) {
        map = mergeLegacyComplacencyAssessments(map, risk.complacency_assessments);
    }
    return map;
}

/** Lookup hook for the future assignment-layer popup: shared tactic risk by CoT uid. */
export function riskAssessmentForUid(
    schema: MissionSchema,
    uid: string,
): TacticRiskEntry | null {
    return tacticAssessmentsFromSchema(schema)[uid] ?? null;
}

export function applyTacticAssessmentsToSchema(
    schema: MissionSchema,
    assessments: TacticRiskMap,
): void {
    if (!schema.risk || typeof schema.risk !== 'object' || Array.isArray(schema.risk)) {
        schema.risk = {};
    }
    const risk = schema.risk as Record<string, unknown>;
    const records: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(assessments)) {
        records[key] = tacticEntryToSchemaRecord(entry);
    }
    risk.tactic_assessments = records;
    // One source of truth — drop legacy key on write.
    delete risk.complacency_assessments;
}

export async function loadTacticAssessmentsFromMission(
    mission: ActiveMission,
): Promise<{ assessments: TacticRiskMap; contentHash?: string }> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        assessments: tacticAssessmentsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveTacticAssessmentsToMission(
    mission: ActiveMission,
    assessments: TacticRiskMap,
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyTacticAssessmentsToSchema(loaded.schema, assessments);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: subscriptionMissionToken(sub, mission),
    });

    return saved.contentHash;
}
