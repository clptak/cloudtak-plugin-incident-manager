/**
 * Import a pasted CAD call (CFS) into an incident: the one path used by
 * Initial Information's "Parse" and by Create Mission. Reads and writes the
 * incident only through loadMissionSchema / saveMissionSchema (the MGMT
 * sync), so it works for mission_schema.json and Mission Properties alike.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import { datetimeLocalToIso, datetimeLocalToLocalIso } from './incidentInfo.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import {
    applyCadIdsToSchema,
    applyCfsTimestampsToSchema,
    applyMissionContextToSchema,
    loadMissionSchema,
    replaceMpsRowsInSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import { parseCadImport, type CadImport } from './mpsParser.ts';

/**
 * Write what a CAD call provides into the schema:
 *   Event ID -> Activity Number; Case Number -> Department Report Number;
 *   Created / Dispatched -> CAD call timestamps; Dispatched -> Assignment
 *   Date/Time; Closed -> Incident Conclusion Time; Remarks -> CAD notes.
 * Fields the call leaves blank are not touched.
 */
export function applyCadToSchema(schema: MissionSchema, cad: CadImport, missionName: string): void {
    applyCadIdsToSchema(schema, { activityNumber: cad.activityNumber, reportNumber: cad.reportNumber });
    applyCfsTimestampsToSchema(schema, {
        callCreated: cad.header.callCreated,
        callDispatched: cad.header.assignmentDateTime,
    });
    if (cad.header.assignmentDateTime) {
        // Saved even when the Assignment text is empty, so it survives a reload.
        if (!schema.assignment) schema.assignment = { text: '', datetime: '' };
        schema.assignment.datetime = datetimeLocalToLocalIso(cad.header.assignmentDateTime);
    }
    if (cad.header.closed) {
        schema.incident_response.incident_datetime = datetimeLocalToIso(cad.header.closed);
    }
    if (cad.rows.length) replaceMpsRowsInSchema(schema, cad.rows, missionName);
}

/** Parse `cadText` and save it into `mission`'s incident record. */
export async function importCadText(mission: ActiveMission, cadText: string): Promise<CadImport> {
    const cad = parseCadImport(cadText);
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    applyCadToSchema(loaded.schema, cad, mission.name);
    applyMissionContextToSchema(loaded.schema, mission.name);
    await saveMissionSchema(sub, loaded.schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
    return cad;
}

/** Hand-off of the pasted text from Create Mission to Initial Information's CFS box (this tab only). */
export function pendingCadTextKey(missionGuid: string): string {
    return `incident-manager:cad-text:${missionGuid}`;
}

export function rememberCadText(missionGuid: string, cadText: string): void {
    try {
        sessionStorage.setItem(pendingCadTextKey(missionGuid), cadText);
    } catch {
        // Storage blocked: the CFS box just starts empty.
    }
}

export function takeCadText(missionGuid: string): string {
    try {
        const key = pendingCadTextKey(missionGuid);
        const text = sessionStorage.getItem(key) ?? '';
        sessionStorage.removeItem(key);
        return text;
    } catch {
        return '';
    }
}
