/** Persist resource assignments in mission_schema.json (incident_response.resource_assignments). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import {
    resourceAssignmentsFromSchemaValue,
    resourceAssignmentToSchemaRecord,
    type ResourceAssignment,
} from './resourceAssignments.ts';

export function resourceAssignmentsFromSchema(schema: MissionSchema): ResourceAssignment[] {
    const ir = schema.incident_response as Record<string, unknown> | undefined;
    return resourceAssignmentsFromSchemaValue(ir?.resource_assignments);
}

export function applyResourceAssignmentsToSchema(
    schema: MissionSchema,
    assignments: ResourceAssignment[],
): void {
    if (!schema.incident_response || typeof schema.incident_response !== 'object') {
        schema.incident_response = {
            incident_name: '',
            incident_id: '',
            indicent_datetime: '',
        };
    }
    (schema.incident_response as Record<string, unknown>).resource_assignments = assignments.map(
        resourceAssignmentToSchemaRecord,
    );
}

export async function loadResourceAssignmentsFromMission(
    mission: ActiveMission,
): Promise<{ assignments: ResourceAssignment[]; contentHash?: string }> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        assignments: resourceAssignmentsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveResourceAssignmentsToMission(
    mission: ActiveMission,
    assignments: ResourceAssignment[],
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyResourceAssignmentsToSchema(loaded.schema, assignments);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: subscriptionMissionToken(sub, mission),
    });

    return saved.contentHash;
}
