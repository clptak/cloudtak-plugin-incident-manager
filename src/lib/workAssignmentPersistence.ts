/** Persist work assignments in mission_schema.json (incident_response.work_assignments). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import {
    workAssignmentsFromSchemaValue,
    workAssignmentToSchemaRecord,
    type WorkAssignment,
} from './workAssignments.ts';

export function workAssignmentsFromSchema(schema: MissionSchema): WorkAssignment[] {
    const ir = schema.incident_response as Record<string, unknown> | undefined;
    return workAssignmentsFromSchemaValue(ir?.work_assignments);
}

export function applyWorkAssignmentsToSchema(
    schema: MissionSchema,
    assignments: WorkAssignment[],
): void {
    if (!schema.incident_response || typeof schema.incident_response !== 'object') {
        schema.incident_response = {
            incident_name: '',
            incident_id: '',
            indicent_datetime: '',
        };
    }
    (schema.incident_response as Record<string, unknown>).work_assignments = assignments.map(
        workAssignmentToSchemaRecord,
    );
}

export async function loadWorkAssignmentsFromMission(
    mission: ActiveMission,
): Promise<{ assignments: WorkAssignment[]; contentHash?: string }> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        assignments: workAssignmentsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveWorkAssignmentsToMission(
    mission: ActiveMission,
    assignments: WorkAssignment[],
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyWorkAssignmentsToSchema(loaded.schema, assignments);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: subscriptionMissionToken(sub, mission),
    });

    return saved.contentHash;
}
