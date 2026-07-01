/**
 * Load, merge, and persist the incident mission JSON blob (mission_schema.json shape)
 * as a DataSync mission content file — not a mission log entry.
 */

import missionSchemaTemplate from '../data/mission_schema.json';
import type { CadIdentifiers, IncidentInfoForm, MissionLogLike } from './incidentInfo.ts';
import {
    assignmentDataFromKeywords,
    assignmentDataFromLogContent,
    datetimeLocalToIso,
    datetimeLocalToLocalIso,
    isoToDatetimeLocal,
    latestIncidentInfoFromLogs,
    mergeAssignmentFieldsIntoForm,
    nowDatetimeLocal,
} from './incidentInfo.ts';
import type { MpsRow } from './mpsParser.ts';
import { fetchMissionFileText, uploadMissionFile } from './missionUpload.ts';

/** Legacy log keyword from earlier builds; only used when migrating stored schema. */
export const MISSION_SCHEMA_KEYWORD = 'mission-schema';
export const MISSION_SCHEMA_FILENAME = 'mission_schema.json';

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
    assignment: {
        text: string;
        datetime: string;
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

interface ContentLike {
    hash?: string;
    name?: string;
    submissionTime?: string;
}

interface LoadedSubLike {
    guid: string;
    fetch?(): Promise<unknown>;
    log: {
        list(opts?: { refresh?: boolean }): Promise<SchemaLogLike[]>;
        delete?(logid: string): Promise<void>;
    };
    contents: {
        list(): Promise<ContentLike[]>;
        delete?(hash: string): Promise<void>;
    };
}

export interface LoadedMissionSchema {
    schema: MissionSchema;
    contentHash?: string;
    /** Present when an older build stored schema in the mission log. */
    legacyLogId?: string;
}

export interface SaveMissionSchemaOpts {
    contentHash?: string;
    legacyLogId?: string;
    missionToken?: string;
}

export interface SavedMissionSchema {
    contentHash?: string;
}

export function defaultMissionSchema(): MissionSchema {
    return JSON.parse(JSON.stringify(missionSchemaTemplate)) as MissionSchema;
}

export function incidentFormFromSchema(schema: MissionSchema): IncidentInfoForm {
    const conclusionIso = schema.incident_response.indicent_datetime || '';
    const assignment = schema.assignment ?? { text: '', datetime: '' };
    const assignmentIso = assignment.datetime || '';
    return {
        incidentName: schema.incident_response.incident_name || '',
        eventId: schema.event_id || schema.cad_data.activity_number || '',
        incidentId: schema.incident_id || schema.cad_data.report_number || schema.incident_response.incident_id || '',
        demaMission: schema.dema_mission_number || '',
        icCoordinator: schema.sar_coordinators || '',
        incidentConclusionTime: conclusionIso ? isoToDatetimeLocal(conclusionIso) : nowDatetimeLocal(),
        assignmentText: assignment.text || '',
        assignmentDateTime: assignmentIso ? isoToDatetimeLocal(assignmentIso) : nowDatetimeLocal(),
    };
}

function fillIfEmpty(current: string, fallback: string): string {
    return current.trim() ? current.trim() : fallback.trim();
}

/** Merge mission_schema.json with the latest initial-information log for display/export. */
export function resolveIncidentInfoForm(
    schema: MissionSchema,
    logs: MissionLogLike[],
): IncidentInfoForm {
    const form = incidentFormFromSchema(schema);
    const saved = latestIncidentInfoFromLogs(logs);
    if (saved) {
        const f = saved.fields;
        form.incidentName = fillIfEmpty(form.incidentName, f.incidentName);
        form.eventId = fillIfEmpty(form.eventId, f.eventId);
        form.incidentId = fillIfEmpty(form.incidentId, f.incidentId);
        form.demaMission = fillIfEmpty(form.demaMission, f.demaMission);
        form.icCoordinator = fillIfEmpty(form.icCoordinator, f.icCoordinator);
        if (!schema.incident_response.indicent_datetime) {
            form.incidentConclusionTime = f.incidentConclusionTime;
        }
    }
    const assignment = assignmentDataFromSchema(schema);
    mergeAssignmentFieldsIntoForm(form, {
        schemaText: assignment.text,
        schemaDatetime: assignment.datetime,
        logKeywords: saved?.keywords,
        logContent: saved?.content,
    });
    return form;
}

export interface AssignmentData {
    text: string;
    datetime: string;
}

export function assignmentDataFromSchema(schema: MissionSchema): AssignmentData {
    const assignment = schema.assignment;
    return {
        text: (assignment?.text || '').trim(),
        datetime: (assignment?.datetime || '').trim(),
    };
}

/** Prefer mission_schema.json; fill gaps from the latest initial-information log. */
export function resolveAssignmentData(
    schema: MissionSchema,
    logs?: SchemaLogLike[],
): AssignmentData | null {
    const fromSchema = assignmentDataFromSchema(schema);
    const saved = logs ? latestIncidentInfoFromLogs(logs) : null;
    const fromLog = assignmentDataFromKeywords(saved?.keywords);
    const fromContent = assignmentDataFromLogContent(saved?.content);
    const merged: AssignmentData = {
        text: fromSchema.text || fromLog.text || fromContent.text,
        datetime: fromSchema.datetime || fromLog.datetime || fromContent.datetime,
    };
    if (!merged.text && !merged.datetime) return null;
    return merged;
}

function hydrateAssignmentOnSchema(schema: MissionSchema, logs: SchemaLogLike[]): void {
    const merged = resolveAssignmentData(schema, logs);
    if (!merged) return;
    if (!schema.assignment) {
        schema.assignment = { text: '', datetime: '' };
    }
    if (merged.text) schema.assignment.text = merged.text;
    if (merged.datetime) schema.assignment.datetime = merged.datetime;
}

/** Backfill assignment form fields from log keywords/content when the schema file has none. */
export function mergeAssignmentIntoForm(
    form: IncidentInfoForm,
    schema: MissionSchema,
    logKeywords?: unknown,
    logContent?: string,
): void {
    const fromSchema = assignmentDataFromSchema(schema);
    mergeAssignmentFieldsIntoForm(form, {
        schemaText: fromSchema.text,
        schemaDatetime: fromSchema.datetime,
        logKeywords,
        logContent,
    });
}

export function applyIncidentFormToSchema(
    form: IncidentInfoForm,
    schema: MissionSchema,
    opts?: { preserveEmptyAssignment?: boolean },
): void {
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

    if (!schema.assignment) {
        schema.assignment = { text: '', datetime: '' };
    }
    const preserveAssignment = opts?.preserveEmptyAssignment && !form.assignmentText.trim();
    if (!preserveAssignment) {
        schema.assignment.text = form.assignmentText.trim();
        schema.assignment.datetime = datetimeLocalToLocalIso(form.assignmentDateTime);
    }
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

function isMissionSchemaContentName(name: string | undefined): boolean {
    if (!name) return false;
    return name === MISSION_SCHEMA_FILENAME
        || name.endsWith(`/${MISSION_SCHEMA_FILENAME}`)
        || name.endsWith(MISSION_SCHEMA_FILENAME);
}

function findLatestSchemaContent(contents: ContentLike[]): ContentLike | null {
    const matches = contents.filter(
        (c) => isMissionSchemaContentName(c.name) && c.hash,
    );
    if (!matches.length) return null;
    matches.sort(
        (a, b) => Date.parse(b.submissionTime || '') - Date.parse(a.submissionTime || ''),
    );
    return matches[0];
}

/** Legacy: schema was incorrectly stored as a mission log entry. */
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
    if (sub.fetch) await sub.fetch();

    const contents = await sub.contents.list();
    const content = findLatestSchemaContent(contents);
    const logs = await sub.log.list({ refresh: true });
    const legacy = findLatestSchemaLog(logs);

    if (content?.hash) {
        const text = await fetchMissionFileText(content.hash, content.name || MISSION_SCHEMA_FILENAME);
        const schema = JSON.parse(text) as MissionSchema;
        hydrateAssignmentOnSchema(schema, logs);
        return {
            schema,
            contentHash: content.hash,
            legacyLogId: legacy?.logId,
        };
    }

    if (legacy) {
        hydrateAssignmentOnSchema(legacy.schema, logs);
        return { schema: legacy.schema, legacyLogId: legacy.logId };
    }

    const schema = defaultMissionSchema();
    hydrateAssignmentOnSchema(schema, logs);
    return { schema };
}

async function waitForLatestSchemaContent(
    sub: LoadedSubLike,
    hashBeforeUpload?: string,
): Promise<ContentLike | null> {
    const attempts = 8;
    for (let i = 0; i < attempts; i++) {
        if (sub.fetch) await sub.fetch();
        const latest = findLatestSchemaContent(await sub.contents.list());
        if (latest?.hash && latest.hash !== hashBeforeUpload) {
            return latest;
        }
        if (i < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
        }
    }
    return findLatestSchemaContent(await sub.contents.list());
}

export async function saveMissionSchema(
    sub: LoadedSubLike,
    schema: MissionSchema,
    opts?: SaveMissionSchemaOpts,
): Promise<SavedMissionSchema> {
    const json = JSON.stringify(schema, null, 2);
    const bytes = new TextEncoder().encode(json);
    if (sub.fetch) await sub.fetch();
    const hashBeforeUpload = findLatestSchemaContent(await sub.contents.list())?.hash;

    const missionToken = opts?.missionToken;
    const uploadHash = await uploadMissionFile(sub.guid, MISSION_SCHEMA_FILENAME, bytes, {
        missionToken,
    });

    if (sub.fetch) await sub.fetch();

    let latest = uploadHash
        ? { hash: uploadHash, name: MISSION_SCHEMA_FILENAME }
        : await waitForLatestSchemaContent(sub, hashBeforeUpload);

    if (!latest?.hash) {
        latest = findLatestSchemaContent(await sub.contents.list());
    }

    if (!latest?.hash || !isMissionSchemaContentName(latest.name)) {
        throw new Error(
            'mission_schema.json upload did not appear in mission contents. '
            + 'Confirm you have MISSION_WRITE on this DataSync mission, then try again.',
        );
    }

    const revisionToDelete = hashBeforeUpload || opts?.contentHash;
    if (revisionToDelete && latest?.hash && latest.hash !== revisionToDelete && sub.contents.delete) {
        try {
            await sub.contents.delete(revisionToDelete);
        } catch {
            /* prior revision may already be detached */
        }
    }

    if (opts?.legacyLogId && sub.log.delete) {
        try {
            await sub.log.delete(opts.legacyLogId);
        } catch {
            /* legacy log may already be removed */
        }
    }

    return { contentHash: latest?.hash };
}
