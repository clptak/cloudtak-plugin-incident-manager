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

export function fieldsFromLog(keywords?: string[]): IncidentInfoForm {
    const conclusionIso = kwValue(keywords, 'conclusionTime:');
    const assignmentIso = kwValue(keywords, 'assignmentDateTime:');
    return {
        incidentName: kwValue(keywords, 'incidentName:'),
        eventId: kwValue(keywords, 'eventId:'),
        incidentId: kwValue(keywords, 'incidentId:'),
        demaMission: kwValue(keywords, 'demaMission:'),
        icCoordinator: kwValue(keywords, 'icCoordinator:'),
        incidentConclusionTime: conclusionIso ? isoToDatetimeLocal(conclusionIso) : nowDatetimeLocal(),
        assignmentText: kwValue(keywords, 'assignmentText:'),
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

export function assignmentDataFromKeywords(keywords?: string[]): { text: string; datetime: string } {
    return {
        text: kwValue(keywords, 'assignmentText:').trim(),
        datetime: kwValue(keywords, 'assignmentDateTime:').trim(),
    };
}

/** Most recent saved initial-information log entry, if any. */
export function latestIncidentInfoFromLogs(
    logs: MissionLogLike[],
): { fields: IncidentInfoForm; logId: string; keywords: string[] } | null {
    let best: { fields: IncidentInfoForm; logId: string; created: string; keywords: string[] } | null = null;
    for (const log of logs) {
        if (!log.keywords?.includes(INITIAL_INFO_KEYWORD)) continue;
        const created = log.created || log.dtg || '';
        const logId = String(log.id ?? '');
        if (!logId) continue;
        const fields = fieldsFromLog(log.keywords);
        const keywords = Array.isArray(log.keywords) ? log.keywords : [];
        if (!best || Date.parse(created) >= Date.parse(best.created)) {
            best = { fields, logId, created, keywords };
        }
    }
    return best ? { fields: best.fields, logId: best.logId, keywords: best.keywords } : null;
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
