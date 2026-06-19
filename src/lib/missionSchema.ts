/**
 * Load, merge, and persist the incident mission JSON blob (mission_schema.json shape)
 * as a single DataSync mission log entry.
 */

import missionSchemaTemplate from '../data/mission_schema.json';
import type { CadIdentifiers, IncidentInfoForm } from './incidentInfo.ts';
import {
    datetimeLocalToIso,
    isoToDatetimeLocal,
    nowDatetimeLocal,
} from './incidentInfo.ts';
import type { MpsRow } from './mpsParser.ts';

export const MISSION_SCHEMA_KEYWORD = 'mission-schema';

export interface MissionLogEntry {
    source: string;
    mission_name: string;
    dtg: string;
    servertime: string;
    uid: string;
    'msg-content-remark': string;
    keywords: string;
    lat: string | number;
    lon: string | number;
}

export interface MissionSchema {
    event_id: string;
    incident_id: string;
    tak_mission: string;
    dema_mission_number: string;
    coordinates: [number, number];
    sar_coordinators: string;
    assisting_agencies: string;
    subject_located: Record<string, unknown>;
    tak_missions: unknown[];
    caltopo_maps: unknown[];
    cad_data: {
        activity_number: string;
        report_number: string;
        call_type: { primary: string; sub: string; priority: string };
        caller_info: {
            caller_name: string;
            caller_number: string;
            caller_address: string;
            caller_source: string;
        };
        call_location: Record<string, unknown>;
        call_timestamps: {
            call_created: string;
            call_dispatched: string;
            call_cleared: string;
        };
        call_unit_status: Array<Record<string, string>>;
        call_remarks: MissionLogEntry[][];
    };
    tak_server: {
        mission_logs: MissionLogEntry[];
        mission_uids: MissionLogEntry[];
        mission_name: string;
        mission_subscribers: Record<string, { callsign: string; username: string }>;
    };
    incident_response: {
        incident_name: string;
        incident_id: string;
        indicent_datetime: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface SchemaLogLike {
    id?: string | number;
    content?: string;
    keywords?: string[];
    created?: string;
    dtg?: string;
}

interface LoadedSubLike {
    log: {
        list(opts?: { refresh?: boolean }): Promise<SchemaLogLike[]>;
        create(body: { content: string; keywords?: string[]; dtg?: string }): Promise<{ id: string | number }>;
        update(logid: string, body: { content: string; keywords?: string[]; dtg?: string }): Promise<{ id: string | number }>;
    };
}

export interface LoadedMissionSchema {
    schema: MissionSchema;
    logId?: string;
}

export function defaultMissionSchema(): MissionSchema {
    return JSON.parse(JSON.stringify(missionSchemaTemplate)) as MissionSchema;
}

export function incidentFormFromSchema(schema: MissionSchema): IncidentInfoForm {
    const conclusionIso = schema.incident_response.indicent_datetime || '';
    return {
        incidentName: schema.incident_response.incident_name || '',
        eventId: schema.event_id || schema.cad_data.activity_number || '',
        incidentId: schema.incident_id || schema.cad_data.report_number || schema.incident_response.incident_id || '',
        demaMission: schema.dema_mission_number || '',
        icCoordinator: schema.sar_coordinators || '',
        incidentConclusionTime: conclusionIso ? isoToDatetimeLocal(conclusionIso) : nowDatetimeLocal(),
    };
}

export function applyIncidentFormToSchema(form: IncidentInfoForm, schema: MissionSchema): void {
    const activity = form.eventId.trim();
    const report = form.incidentId.trim();
    const conclusion = datetimeLocalToIso(form.incidentConclusionTime);

    schema.event_id = activity;
    schema.incident_id = report;
    schema.dema_mission_number = form.demaMission.trim();
    schema.sar_coordinators = form.icCoordinator.trim();
    schema.cad_data.activity_number = activity;
    schema.cad_data.report_number = report;
    schema.incident_response.incident_name = form.incidentName.trim();
    schema.incident_response.incident_id = report;
    schema.incident_response.indicent_datetime = conclusion;
}

export function applyMissionContextToSchema(
    schema: MissionSchema,
    missionName: string,
): void {
    schema.tak_mission = missionName;
    schema.tak_server.mission_name = missionName;
}

export function applyCadIdsToSchema(schema: MissionSchema, parsed: CadIdentifiers): void {
    if (parsed.activityNumber) {
        schema.event_id = parsed.activityNumber;
        schema.cad_data.activity_number = parsed.activityNumber;
    }
    if (parsed.reportNumber) {
        schema.incident_id = parsed.reportNumber;
        schema.cad_data.report_number = parsed.reportNumber;
        schema.incident_response.incident_id = parsed.reportNumber;
    }
}

function mpsRowToLogEntry(row: MpsRow, missionName: string): MissionLogEntry {
    return {
        source: row.source,
        mission_name: missionName || row.missionName,
        dtg: row.dtg,
        servertime: '',
        uid: row.uid,
        'msg-content-remark': row.remark,
        keywords: 'source:CAD',
        lat: row.lat === '' ? '' : row.lat,
        lon: row.lon === '' ? '' : row.lon,
    };
}

function isBlankRemark(entry: MissionLogEntry): boolean {
    return !entry.dtg && !entry.uid && !entry['msg-content-remark'];
}

/** Replace CAD remark blocks with freshly parsed rows. */
export function replaceMpsRowsInSchema(
    schema: MissionSchema,
    rows: MpsRow[],
    missionName: string,
): void {
    if (!rows.length) return;
    const entries = rows.map((row) => mpsRowToLogEntry(row, missionName));
    schema.cad_data.call_remarks = entries.map((entry) => [entry]);
    schema.tak_server.mission_logs = entries;
}

/** Append parsed CAD remark rows into cad_data.call_remarks and tak_server.mission_logs. */
export function appendMpsRowsToSchema(
    schema: MissionSchema,
    rows: MpsRow[],
    missionName: string,
): void {
    if (!rows.length) return;

    const logs = schema.tak_server.mission_logs ?? [];
    if (logs.length === 1 && isBlankRemark(logs[0])) {
        schema.tak_server.mission_logs = [];
    }

    const remarks = schema.cad_data.call_remarks ?? [];
    if (remarks.length === 1 && remarks[0].length === 1 && isBlankRemark(remarks[0][0])) {
        schema.cad_data.call_remarks = [];
    }

    for (const row of rows) {
        const entry = mpsRowToLogEntry(row, missionName);
        schema.cad_data.call_remarks.push([entry]);
        schema.tak_server.mission_logs.push(entry);
    }
}

export function findLatestSchemaLog(logs: SchemaLogLike[]): { logId: string; schema: MissionSchema } | null {
    let best: { logId: string; schema: MissionSchema; created: string } | null = null;
    for (const log of logs) {
        if (!log.keywords?.includes(MISSION_SCHEMA_KEYWORD) || !log.content?.trim()) continue;
        const logId = String(log.id ?? '');
        if (!logId) continue;
        try {
            const schema = JSON.parse(log.content) as MissionSchema;
            const created = log.created || log.dtg || '';
            if (!best || Date.parse(created) >= Date.parse(best.created)) {
                best = { logId, schema, created };
            }
        } catch {
            /* skip malformed entries */
        }
    }
    return best ? { logId: best.logId, schema: best.schema } : null;
}

export async function loadMissionSchema(sub: LoadedSubLike): Promise<LoadedMissionSchema> {
    const logs = await sub.log.list({ refresh: true });
    const saved = findLatestSchemaLog(logs);
    if (saved) return { schema: saved.schema, logId: saved.logId };
    return { schema: defaultMissionSchema() };
}

export async function saveMissionSchema(
    sub: LoadedSubLike,
    schema: MissionSchema,
    logId?: string,
): Promise<string> {
    const body = {
        dtg: new Date().toISOString(),
        content: JSON.stringify(schema, null, 2),
        keywords: [MISSION_SCHEMA_KEYWORD],
    };
    if (logId) {
        await sub.log.update(logId, body);
        return logId;
    }
    const created = await sub.log.create(body);
    return String(created.id);
}
