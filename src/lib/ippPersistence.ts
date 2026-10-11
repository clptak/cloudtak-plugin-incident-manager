/** Persist the incident IPP in mission_schema.json (incident_response.ipp_*). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';

export type IppType = 'LKP' | 'PLS';

export interface SchemaIpp {
    lat: number;
    lng: number;
    type: IppType;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
}

function parseIppType(value: unknown): IppType {
    return typeof value === 'string' && value.trim().toUpperCase() === 'PLS' ? 'PLS' : 'LKP';
}

export function readIppFromSchema(schema: MissionSchema): SchemaIpp | null {
    const ir = asRecord(schema.incident_response);
    if (!ir) return null;
    const coords = asRecord(ir.ipp_coordinates);
    if (!coords) return null;
    const lat = finiteNumber(coords.lat);
    const lng = finiteNumber(coords.lng) ?? finiteNumber(coords.lon);
    if (lat === null || lng === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng, type: parseIppType(ir.ipp_type) };
}

export function applyIppToSchema(schema: MissionSchema, ipp: SchemaIpp): void {
    if (!schema.incident_response || typeof schema.incident_response !== 'object') {
        schema.incident_response = {
            incident_name: '',
            incident_id: '',
            incident_datetime: '',
        };
    }
    const ir = schema.incident_response as Record<string, unknown>;
    ir.ipp_coordinates = { lat: ipp.lat, lng: ipp.lng };
    ir.ipp_type = ipp.type;
}

export async function writeIppToSchema(
    mission: ActiveMission,
    ipp: SchemaIpp,
): Promise<void> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    applyIppToSchema(loaded.schema, ipp);
    applyMissionContextToSchema(loaded.schema, mission.name);
    await saveMissionSchema(sub, loaded.schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}
