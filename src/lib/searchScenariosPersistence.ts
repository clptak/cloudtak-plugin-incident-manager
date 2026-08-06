/** Persist search scenarios in mission_schema.json (incident_response.scenarios). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import {
    searchScenariosFromSchemaValue,
    searchScenariosToSchemaRecords,
    type SearchScenario,
} from './searchScenarios.ts';

export function searchScenariosFromSchema(schema: MissionSchema): SearchScenario[] {
    const ir = schema.incident_response as Record<string, unknown> | undefined;
    return searchScenariosFromSchemaValue(ir?.scenarios);
}

export function applySearchScenariosToSchema(
    schema: MissionSchema,
    scenarios: SearchScenario[],
): void {
    if (!schema.incident_response || typeof schema.incident_response !== 'object') {
        schema.incident_response = {
            incident_name: '',
            incident_id: '',
            incident_datetime: '',
        };
    }
    (schema.incident_response as Record<string, unknown>).scenarios =
        searchScenariosToSchemaRecords(scenarios);
}

export async function loadSearchScenariosFromMission(
    mission: ActiveMission,
): Promise<{ scenarios: SearchScenario[]; contentHash?: string }> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        scenarios: searchScenariosFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveSearchScenariosToMission(
    mission: ActiveMission,
    scenarios: SearchScenario[],
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applySearchScenariosToSchema(loaded.schema, scenarios);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });

    return saved.contentHash;
}
