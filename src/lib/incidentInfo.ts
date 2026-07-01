/** Initial / incident information log keyword and field parsing. */

import { kwValue } from './subjectInfo.ts';

export const INITIAL_INFO_KEYWORD = 'initial-information';

/** Activity number — e.g. A22012345 */
export const ACTIVITY_NUMBER_RE = /A\d\d0\d\d\d\d\d/g;
/** Department report number — e.g. S2201234 */
export const REPORT_NUMBER_RE = /S\d\d0\d\d\d\d/g;
/** DEMA mission number — e.g. 2025-12345 */
export const DEMA_MISSION_RE = /^20\d\d-\d\d\d\d\d$/;

export interface IncidentInfoForm {
    incidentName: string;
    eventId: string;
    incidentId: string;
    demaMission: string;
    icCoordinator: string;
    /** datetime-local value for the form control */
    incidentConclusionTime: string;
    assignmentText: string;
    /** datetime-local value for assignment */
    assignmentDateTime: string;
    logId?: string;
}

export interface CadIdentifiers {
    activityNumber: string | null;
    reportNumber: string | null;
}

export interface MissionLogLike {
    id?: string | number;
    keywords?: string[];
    created?: string;
    dtg?: string;
    content?: string;
}

export function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** Current local date/time formatted for `<input type="datetime-local">`. */
export function nowDatetimeLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function datetimeLocalToIso(local: string): string {
    if (!local.trim()) return '';
    const ms = Date.parse(local);
    return Number.isNaN(ms) ? '' : new Date(ms).toISOString();
}

/** Local date/time as ISO 8601 with timezone offset (not UTC). */
export function datetimeLocalToLocalIso(local: string): string {
    if (!local.trim()) return '';
    const ms = Date.parse(local);
    if (Number.isNaN(ms)) return '';
    const d = new Date(ms);
    const tzOffset = -d.getTimezoneOffset();
    const sign = tzOffset >= 0 ? '+' : '-';
    const absOffset = Math.abs(tzOffset);
    const hours = pad2(Math.floor(absOffset / 60));
    const mins = pad2(absOffset % 60);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${sign}${hours}:${mins}`;
}

export function isoToDatetimeLocal(iso: string): string {
    if (!iso.trim()) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function lastNameFromFullName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '';
    if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1] ?? '';
}

export function suggestIncidentName(subjectNames: string[]): string {
    for (const name of subjectNames) {
        const last = lastNameFromFullName(name);
        if (last) return `${last} Search`;
    }
    return '';
}

/** Extract activity and department report numbers from raw CFS / call notes text. */
export function parseCadIdentifiers(cadText: string): CadIdentifiers {
    ACTIVITY_NUMBER_RE.lastIndex = 0;
    REPORT_NUMBER_RE.lastIndex = 0;
    const activity = cadText.match(ACTIVITY_NUMBER_RE)?.[0] ?? null;
    const report = cadText.match(REPORT_NUMBER_RE)?.[0] ?? null;
    return { activityNumber: activity, reportNumber: report };
}

export function isValidDemaMission(value: string): boolean {
    const v = value.trim();
    return v === '' || DEMA_MISSION_RE.test(v);
}

export function blankIncidentInfoForm(): IncidentInfoForm {
    return {
        incidentName: '',
        eventId: '',
        incidentId: '',
        demaMission: '',
        icCoordinator: '',
        incidentConclusionTime: nowDatetimeLocal(),
        assignmentText: '',
        assignmentDateTime: nowDatetimeLocal(),
    };
}

export function fieldsFromLog(keywords?: unknown): IncidentInfoForm {
    const normalized = normalizeLogKeywords(keywords);
    const conclusionIso = kwValue(normalized, 'conclusionTime:');
    const assignmentIso = kwValue(normalized, 'assignmentDateTime:');
    return {
        incidentName: kwValue(normalized, 'incidentName:'),
        eventId: kwValue(normalized, 'eventId:'),
        incidentId: kwValue(normalized, 'incidentId:'),
        demaMission: kwValue(normalized, 'demaMission:'),
        icCoordinator: kwValue(normalized, 'icCoordinator:'),
        incidentConclusionTime: conclusionIso ? isoToDatetimeLocal(conclusionIso) : nowDatetimeLocal(),
        assignmentText: kwValue(normalized, 'assignmentText:'),
        assignmentDateTime: assignmentIso ? isoToDatetimeLocal(assignmentIso) : nowDatetimeLocal(),
    };
}

export function buildIncidentInfoContent(f: IncidentInfoForm): string {
    const parts: string[] = [];
    if (f.incidentName.trim()) parts.push(`Incident: ${f.incidentName.trim()}`);
    if (f.eventId.trim()) parts.push(`Activity: ${f.eventId.trim()}`);
    if (f.incidentId.trim()) parts.push(`Report: ${f.incidentId.trim()}`);
    if (f.demaMission.trim()) parts.push(`DEMA: ${f.demaMission.trim()}`);
    if (f.icCoordinator.trim()) parts.push(`IC Coordinator: ${f.icCoordinator.trim()}`);
    const conclusion = datetimeLocalToIso(f.incidentConclusionTime);
    if (conclusion) parts.push(`Conclusion: ${conclusion}`);
    if (f.assignmentText.trim()) parts.push(`Assignment: ${f.assignmentText.trim()}`);
    const assignmentDt = datetimeLocalToLocalIso(f.assignmentDateTime);
    if (assignmentDt) parts.push(`Assignment time: ${assignmentDt}`);
    return parts.length ? parts.join('; ') : 'Initial incident information';
}

export function buildIncidentInfoKeywords(f: IncidentInfoForm): string[] {
    const kws = [INITIAL_INFO_KEYWORD];
    if (f.incidentName.trim()) kws.push(`incidentName:${f.incidentName.trim()}`);
    if (f.eventId.trim()) kws.push(`eventId:${f.eventId.trim()}`);
    if (f.incidentId.trim()) kws.push(`incidentId:${f.incidentId.trim()}`);
    if (f.demaMission.trim()) kws.push(`demaMission:${f.demaMission.trim()}`);
    if (f.icCoordinator.trim()) kws.push(`icCoordinator:${f.icCoordinator.trim()}`);
    const conclusion = datetimeLocalToIso(f.incidentConclusionTime);
    if (conclusion) kws.push(`conclusionTime:${conclusion}`);
    if (f.assignmentText.trim()) kws.push(`assignmentText:${f.assignmentText.trim()}`);
    const assignmentDt = datetimeLocalToLocalIso(f.assignmentDateTime);
    if (assignmentDt) kws.push(`assignmentDateTime:${assignmentDt}`);
    return kws;
}

/** DataSync may return keywords as a string array or a comma-separated string. */
export function normalizeLogKeywords(keywords: unknown): string[] {
    if (Array.isArray(keywords)) {
        return keywords.filter((k): k is string => typeof k === 'string');
    }
    if (typeof keywords === 'string' && keywords.trim()) {
        return keywords.split(',').map((k) => k.trim()).filter(Boolean);
    }
    return [];
}

export function assignmentDataFromKeywords(keywords?: unknown): { text: string; datetime: string } {
    const normalized = normalizeLogKeywords(keywords);
    return {
        text: kwValue(normalized, 'assignmentText:').trim(),
        datetime: kwValue(normalized, 'assignmentDateTime:').trim(),
    };
}

export function assignmentDataFromLogContent(content?: string): { text: string; datetime: string } {
    if (!content?.trim()) return { text: '', datetime: '' };

    const textPrefix = 'Assignment:';
    const timePrefix = 'Assignment time:';
    const textIdx = content.indexOf(textPrefix);
    const timeIdx = content.indexOf(timePrefix);

    let text = '';
    if (textIdx >= 0) {
        const valueStart = textIdx + textPrefix.length;
        const valueEnd = timeIdx > textIdx ? timeIdx : content.length;
        text = content.slice(valueStart, valueEnd).replace(/^;\s*/, '').replace(/\s*;?\s*$/, '').trim();
    }

    let datetime = '';
    if (timeIdx >= 0) {
        const valueStart = timeIdx + timePrefix.length;
        datetime = content.slice(valueStart).split(';')[0].trim();
    }

    return { text, datetime };
}

export function mergeAssignmentFieldsIntoForm(
    form: IncidentInfoForm,
    opts?: {
        schemaText?: string;
        schemaDatetime?: string;
        logKeywords?: unknown;
        logContent?: string;
    },
): void {
    const fromLog = assignmentDataFromKeywords(opts?.logKeywords);
    const fromContent = assignmentDataFromLogContent(opts?.logContent);
    const schemaText = (opts?.schemaText || '').trim();
    const schemaDatetime = (opts?.schemaDatetime || '').trim();

    form.assignmentText = schemaText || fromLog.text || fromContent.text;
    const datetimeIso = schemaDatetime || fromLog.datetime || fromContent.datetime;
    form.assignmentDateTime = datetimeIso ? isoToDatetimeLocal(datetimeIso) : nowDatetimeLocal();
}

/** Most recent saved initial-information log entry, if any. */
export function latestIncidentInfoFromLogs(
    logs: MissionLogLike[],
): { fields: IncidentInfoForm; logId: string; keywords: string[]; content: string } | null {
    let best: {
        fields: IncidentInfoForm;
        logId: string;
        created: string;
        keywords: string[];
        content: string;
    } | null = null;
    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(INITIAL_INFO_KEYWORD)) continue;
        const created = log.created || log.dtg || '';
        const logId = String(log.id ?? '');
        if (!logId) continue;
        const fields = fieldsFromLog(keywords);
        if (!best || Date.parse(created) >= Date.parse(best.created)) {
            best = {
                fields,
                logId,
                created,
                keywords,
                content: log.content || '',
            };
        }
    }
    return best
        ? { fields: best.fields, logId: best.logId, keywords: best.keywords, content: best.content }
        : null;
}

export interface IncidentDetailRow {
    label: string;
    value: string;
}

function hasDisplayValue(value: string): boolean {
    return !!value?.trim();
}

function formatIncidentDatetime(value: string): string {
    if (!value.trim()) return '';
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return value.trim();
    return new Date(ms).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

/** Labeled rows for Dashboard / PDF (non-empty initial-information fields only). */
export function initialInfoDetailRows(form: IncidentInfoForm): IncidentDetailRow[] {
    const rows: IncidentDetailRow[] = [];
    if (hasDisplayValue(form.incidentName)) {
        rows.push({ label: 'Incident Name', value: form.incidentName.trim() });
    }
    if (hasDisplayValue(form.eventId)) {
        rows.push({ label: 'Activity Number', value: form.eventId.trim() });
    }
    if (hasDisplayValue(form.incidentId)) {
        rows.push({ label: 'Department Report Number', value: form.incidentId.trim() });
    }
    if (hasDisplayValue(form.demaMission)) {
        rows.push({ label: 'DEMA Mission Number', value: form.demaMission.trim() });
    }
    if (hasDisplayValue(form.icCoordinator)) {
        rows.push({ label: 'IC Coordinator', value: form.icCoordinator.trim() });
    }
    if (hasDisplayValue(form.incidentConclusionTime)) {
        rows.push({
            label: 'Incident Conclusion Time',
            value: formatIncidentDatetime(form.incidentConclusionTime),
        });
    }
    if (hasDisplayValue(form.assignmentText)) {
        rows.push({ label: 'Assignment', value: form.assignmentText.trim() });
    }
    if (hasDisplayValue(form.assignmentDateTime)) {
        rows.push({
            label: 'Assignment Date/Time',
            value: formatIncidentDatetime(form.assignmentDateTime),
        });
    }
    return rows;
}

/** Fill empty activity / report fields from parsed CFS identifiers. */
export function applyParsedCadToForm(
    form: IncidentInfoForm,
    parsed: CadIdentifiers,
): void {
    if (!form.eventId.trim() && parsed.activityNumber) {
        form.eventId = parsed.activityNumber;
    }
    if (!form.incidentId.trim() && parsed.reportNumber) {
        form.incidentId = parsed.reportNumber;
    }
}
