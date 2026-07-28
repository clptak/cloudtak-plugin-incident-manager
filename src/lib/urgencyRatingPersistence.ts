/** Persist search urgency rating in mission_schema.json (incident_response.urgency_rating). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import {
    urgencyRatingFromSchemaValue,
    urgencyRatingToSchemaRecord,
    type UrgencyRating,
} from './urgencyRating.ts';

export function urgencyRatingFromSchema(schema: MissionSchema): UrgencyRating | null {
    const ir = schema.incident_response as Record<string, unknown> | undefined;
    return urgencyRatingFromSchemaValue(ir?.urgency_rating);
}

export function applyUrgencyRatingToSchema(
    schema: MissionSchema,
    rating: UrgencyRating,
): void {
    if (!schema.incident_response || typeof schema.incident_response !== 'object') {
        schema.incident_response = {
            incident_name: '',
            incident_id: '',
            indicent_datetime: '',
        };
    }
    (schema.incident_response as Record<string, unknown>).urgency_rating =
        urgencyRatingToSchemaRecord(rating);
}

export async function loadUrgencyRatingFromMission(
    mission: ActiveMission,
): Promise<{ rating: UrgencyRating | null; contentHash?: string }> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        rating: urgencyRatingFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveUrgencyRatingToMission(
    mission: ActiveMission,
    rating: UrgencyRating,
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyUrgencyRatingToSchema(loaded.schema, rating);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: subscriptionMissionToken(sub, mission),
    });

    return saved.contentHash;
}
