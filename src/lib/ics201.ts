/** ICS 201 Incident Briefing form model, mission-log persistence, and auto-fill. */

import Subscription from '../../../../src/base/subscription.ts';
import {
    blankObjectiveRows,
    ensureStrategy,
    ensureTactic,
    formatStrategiesForPdf,
    formatTacticsForPdf,
    hasPostKeyword,
    MAX_OBJECTIVES,
    rowHasContent,
    type ObjectiveRow,
} from './incidentPost.ts';
import {
    latestIncidentInfoFromLogs,
    normalizeLogKeywords,
    type MissionLogLike,
} from './incidentInfo.ts';
import {
    formatIppAsUtm,
    nowBriefingDate,
    nowBriefingTime,
    resolveIppLatLng,
} from './irBriefing.ts';

export const ICS201_KEYWORD = 'ics-201';
export const RESOURCES_KEYWORD = 'resources';
export const PLANNED_KEYWORD = 'planned';
export const CURRENT_KEYWORD = 'current';
/** Mission-log keyword for ICS 201 §8 Current/Planned Actions rows. */
export const ACTION_201_KEYWORD = '201';

export const MAX_ACTION_ROWS = 22;
export const MAX_RESOURCE_ROWS = 17;

export interface Ics201ActionRow {
    time: string;
    actions: string;
}

export interface Ics201ResourceRow {
    resource: string;
    identifier: string;
    dateTimeOrdered: string;
    eta: string;
    arrived: boolean;
    notes: string;
}

export interface Ics201Form {
    incidentName: string;
    incidentNumber: string;
    date: string;
    time: string;
    initialPlanningPoint: string;
    weatherSummary: string;
    adamRepeatedChannel: string;
    carToCarChannel: string;
    alternateChannel: string;
    situationSummary: string;
    preparedByName: string;
    positionTitle: string;
    signature: string;
    preparedDateTime: string;
    objectives: string;
    actions: Ics201ActionRow[];
    incidentCommanders: string;
    liaisonOfficer: string;
    safetyOfficer: string;
    publicInformationOfficer: string;
    planningSectionChief: string;
    operationsSectionChief: string;
    financeSectionChief: string;
    logisticsSectionChief: string;
    organizationNotes: string;
    resources: Ics201ResourceRow[];
    logId?: string;
}

export interface Ics201Sources {
    ippLatLng: { lat: number; lng: number } | null;
    missionName: string;
    missionGuid: string;
}

function blankActionRow(): Ics201ActionRow {
    return { time: '', actions: '' };
}

function blankResourceRow(): Ics201ResourceRow {
    return {
        resource: '',
        identifier: '',
        dateTimeOrdered: '',
        eta: '',
        arrived: false,
        notes: '',
    };
}

export function blankIcs201Form(): Ics201Form {
    return {
        incidentName: '',
        incidentNumber: '',
        date: nowBriefingDate(),
        time: nowBriefingTime(),
        initialPlanningPoint: '',
        weatherSummary: '',
        adamRepeatedChannel: '',
        carToCarChannel: '',
        alternateChannel: '',
        situationSummary: '',
        preparedByName: '',
        positionTitle: '',
        signature: '',
        preparedDateTime: `${nowBriefingDate()} ${nowBriefingTime()}`,
        objectives: '',
        actions: Array.from({ length: MAX_ACTION_ROWS }, blankActionRow),
        incidentCommanders: '',
        liaisonOfficer: '',
        safetyOfficer: '',
        publicInformationOfficer: '',
        planningSectionChief: '',
        operationsSectionChief: '',
        financeSectionChief: '',
        logisticsSectionChief: '',
        organizationNotes: '',
        resources: Array.from({ length: MAX_RESOURCE_ROWS }, blankResourceRow),
    };
}

/** Map/Sketch text block: TAK mission, IPP, weather, comms. */
export function buildMapSketchText(
    form: Ics201Form,
    sources: Pick<Ics201Sources, 'missionName' | 'missionGuid'>,
): string {
    const lines: string[] = [];
    const missionLabel = sources.missionName.trim() || '—';
    const guid = sources.missionGuid.trim();
    lines.push(guid ? `TAK MISSION: ${missionLabel} (${guid})` : `TAK MISSION: ${missionLabel}`);
    if (form.initialPlanningPoint.trim()) {
        lines.push(`IPP: ${form.initialPlanningPoint.trim()}`);
    }
    if (form.weatherSummary.trim()) {
        lines.push('');
        lines.push('Weather:');
        lines.push(form.weatherSummary.trim());
    }
    const comms = [
        form.adamRepeatedChannel.trim() && `Repeated: ${form.adamRepeatedChannel.trim()}`,
        form.carToCarChannel.trim() && `Car to Car: ${form.carToCarChannel.trim()}`,
        form.alternateChannel.trim() && `Alternate: ${form.alternateChannel.trim()}`,
    ].filter(Boolean);
    if (comms.length) {
        lines.push('');
        lines.push('Comms:');
        lines.push(...comms);
    }
    return lines.join('\n');
}

export function buildIcs201Content(form: Ics201Form): string {
    const parts: string[] = ['ICS 201 Incident Briefing'];
    if (form.incidentName.trim()) parts.push(`Incident: ${form.incidentName.trim()}`);
    if (form.incidentNumber.trim()) parts.push(`Number: ${form.incidentNumber.trim()}`);
    if (form.date.trim() || form.time.trim()) {
        parts.push(`Date/Time: ${form.date.trim()} ${form.time.trim()}`.trim());
    }
    return parts.join('; ');
}

export function buildIcs201Keywords(form: Ics201Form): string[] {
    const kws = [ICS201_KEYWORD];
    if (form.incidentName.trim()) kws.push(`incidentName:${form.incidentName.trim()}`);
    if (form.incidentNumber.trim()) kws.push(`incidentNumber:${form.incidentNumber.trim()}`);
    return kws;
}

/** Serialize full form for mission-log content (JSON payload after a human-readable line). */
export function serializeIcs201Form(form: Ics201Form): string {
    const payload: Omit<Ics201Form, 'logId'> & { logId?: string } = { ...form };
    delete payload.logId;
    return `${buildIcs201Content(form)}\n---ics201-json---\n${JSON.stringify(payload)}`;
}

export function parseIcs201FormFromContent(content: string): Partial<Ics201Form> | null {
    const marker = '---ics201-json---';
    const idx = content.indexOf(marker);
    if (idx < 0) return null;
    const json = content.slice(idx + marker.length).trim();
    try {
        const parsed = JSON.parse(json) as Partial<Ics201Form>;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function padActions(rows: Ics201ActionRow[] | undefined): Ics201ActionRow[] {
    const out = Array.from({ length: MAX_ACTION_ROWS }, blankActionRow);
    if (!rows?.length) return out;
    for (let i = 0; i < Math.min(rows.length, MAX_ACTION_ROWS); i++) {
        out[i] = {
            time: String(rows[i]?.time ?? ''),
            actions: String(rows[i]?.actions ?? ''),
        };
    }
    return out;
}

function padResources(rows: Ics201ResourceRow[] | undefined): Ics201ResourceRow[] {
    const out = Array.from({ length: MAX_RESOURCE_ROWS }, blankResourceRow);
    if (!rows?.length) return out;
    for (let i = 0; i < Math.min(rows.length, MAX_RESOURCE_ROWS); i++) {
        const r = rows[i];
        out[i] = {
            resource: String(r?.resource ?? ''),
            identifier: String(r?.identifier ?? ''),
            dateTimeOrdered: String(r?.dateTimeOrdered ?? ''),
            eta: String(r?.eta ?? ''),
            arrived: Boolean(r?.arrived),
            notes: String(r?.notes ?? ''),
        };
    }
    return out;
}

export function applyPartialIcs201Form(base: Ics201Form, partial: Partial<Ics201Form>): Ics201Form {
    return {
        ...base,
        ...partial,
        actions: padActions(partial.actions ?? base.actions),
        resources: padResources(partial.resources ?? base.resources),
        logId: partial.logId ?? base.logId,
    };
}

export function latestIcs201FromLogs(logs: MissionLogLike[]): {
    form: Partial<Ics201Form>;
    logId: string;
} | null {
    let best: { form: Partial<Ics201Form>; logId: string; created: string } | null = null;
    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ICS201_KEYWORD)) continue;
        const content = log.content ?? '';
        const parsed = parseIcs201FormFromContent(content);
        if (!parsed) continue;
        const created = log.created || log.dtg || '';
        const logId = String(log.id ?? '');
        if (!logId) continue;
        if (!best || created > best.created) {
            best = { form: { ...parsed, logId }, logId, created };
        }
    }
    return best ? { form: best.form, logId: best.logId } : null;
}

function stripQuotes(value: string): string {
    const t = value.trim();
    if (
        (t.startsWith('"') && t.endsWith('"'))
        || (t.startsWith("'") && t.endsWith("'"))
    ) {
        return t.slice(1, -1).trim();
    }
    return t;
}

function parseArrivedFlag(raw: string): boolean {
    const v = stripQuotes(raw).toLowerCase();
    return v === 'y' || v === 'yes' || v === 'true' || v === '1';
}

/** Format ISO / datetime-local ordered times for the ICS 201 cell. */
export function formatResourceOrdered(raw: string): string {
    const value = stripQuotes(raw);
    if (!value) return '';
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return value;
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hasResourcesKeyword(keywords: string[]): boolean {
    return keywords.some((k) => k.toLowerCase() === RESOURCES_KEYWORD);
}

/**
 * Parse one DataSync resource log body.
 *
 * Preferred key/value form (one resource per log):
 * ```
 * ETA: "1800"
 * Notes: Ground team to access and stabilize
 * Agency: YCSO
 * Status: Current
 * Arrived: false
 * Date / Time Ordered: 2026-06-27T23:00:00Z
 * Resource Identifier: YCSO GROUND TEAM 1
 * ```
 *
 * Also accepts pipe lines:
 * `Resource | Identifier | Ordered | ETA | Arrived(Y/N) | Notes`
 */
export function parseResourcesLogContent(content: string): Ics201ResourceRow[] {
    const text = (content ?? '').trim();
    if (!text) return [];

    const fields = new Map<string, string>();
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colon = trimmed.indexOf(':');
        if (colon <= 0) continue;
        const key = trimmed.slice(0, colon).trim().toLowerCase().replace(/\s+/g, ' ');
        const value = stripQuotes(trimmed.slice(colon + 1));
        if (key) fields.set(key, value);
    }

    const agency = fields.get('agency') ?? fields.get('resource') ?? '';
    const identifier = fields.get('resource identifier')
        ?? fields.get('identifier')
        ?? fields.get('resource id')
        ?? '';
    const ordered = fields.get('date / time ordered')
        ?? fields.get('date/time ordered')
        ?? fields.get('datetime ordered')
        ?? fields.get('ordered')
        ?? '';
    const eta = fields.get('eta') ?? '';
    const arrivedRaw = fields.get('arrived') ?? '';
    const notes = fields.get('notes') ?? '';
    const status = fields.get('status') ?? '';

    if (agency || identifier || ordered || eta || notes || arrivedRaw) {
        const noteParts = [notes, status && status.toLowerCase() !== 'current' ? `Status: ${status}` : '']
            .map((p) => p.trim())
            .filter(Boolean);
        return [{
            resource: agency,
            identifier,
            dateTimeOrdered: formatResourceOrdered(ordered),
            eta,
            arrived: parseArrivedFlag(arrivedRaw),
            notes: noteParts.join('; '),
        }];
    }

    // Fallback: pipe-delimited rows (legacy / manual).
    const rows: Ics201ResourceRow[] = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('|')) continue;
        const parts = trimmed.split('|').map((p) => stripQuotes(p));
        if (parts.length < 2) continue;
        rows.push({
            resource: parts[0] ?? '',
            identifier: parts[1] ?? '',
            dateTimeOrdered: formatResourceOrdered(parts[2] ?? ''),
            eta: parts[3] ?? '',
            arrived: parseArrivedFlag(parts[4] ?? ''),
            notes: parts[5] ?? '',
        });
        if (rows.length >= MAX_RESOURCE_ROWS) break;
    }
    return rows;
}

/** One ICS 201 resource row per mission log tagged `resources` / `RESOURCES` (oldest first). */
export function resourcesFromLogs(logs: MissionLogLike[]): Ics201ResourceRow[] {
    const entries: { created: string; row: Ics201ResourceRow }[] = [];
    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!hasResourcesKeyword(keywords)) continue;
        const parsed = parseResourcesLogContent(log.content ?? '');
        if (!parsed.length) continue;
        const created = log.created || log.dtg || '';
        for (const row of parsed) {
            entries.push({ created, row });
        }
    }
    if (!entries.length) return padResources([]);
    entries.sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
    return padResources(entries.slice(0, MAX_RESOURCE_ROWS).map((e) => e.row));
}

function hasExactKeyword(keywords: string[], keyword: string): boolean {
    const target = keyword.toLowerCase();
    return keywords.some((k) => k.toLowerCase() === target);
}

/** Time cell for §8: date + time from log dtg/created. */
export function logActionTimeLabel(log: MissionLogLike): string {
    const raw = log.dtg || log.created || '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.trim();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Collapse line breaks / runs of whitespace so §8 actions fit single-line row cells. */
export function collapseActionText(text: string): string {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function logRemarks(log: MissionLogLike): string {
    return collapseActionText(log.content ?? '');
}

function sortLogsByTime(logs: MissionLogLike[]): MissionLogLike[] {
    return [...logs].sort((a, b) => {
        const ac = a.dtg || a.created || '';
        const bc = b.dtg || b.created || '';
        return ac < bc ? -1 : ac > bc ? 1 : 0;
    });
}

/**
 * Actions for ICS 201 §8:
 * 1. Mission logs tagged exactly `201` (time = date/timestamp, actions = remarks/content)
 * 2. Logs tagged `planned` / `current`
 * 3. Risk Assessment strategies/tactics
 */
export function actionsFromLogsAndPost(
    logs: MissionLogLike[],
    objectiveRows: ObjectiveRow[],
): Ics201ActionRow[] {
    const rows: Ics201ActionRow[] = [];
    const seen = new Set<string>();

    const pushLogRow = (log: MissionLogLike, actionsText: string): boolean => {
        const text = actionsText.trim();
        if (!text) return false;
        const key = `${log.dtg || log.created || ''}|${text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        rows.push({ time: logActionTimeLabel(log), actions: text });
        return rows.length >= MAX_ACTION_ROWS;
    };

    // Primary: keyword `201` → Time from log timestamp, Actions from remarks (content).
    for (const log of sortLogsByTime(logs)) {
        const kws = normalizeLogKeywords(log.keywords);
        if (!hasExactKeyword(kws, ACTION_201_KEYWORD)) continue;
        if (pushLogRow(log, logRemarks(log))) return padActions(rows);
    }

    for (const log of sortLogsByTime(logs)) {
        const kws = normalizeLogKeywords(log.keywords);
        // Exact match only — do not treat `ics-201` as `201`.
        if (hasExactKeyword(kws, ACTION_201_KEYWORD)) continue;
        if (!hasExactKeyword(kws, PLANNED_KEYWORD) && !hasExactKeyword(kws, CURRENT_KEYWORD)) {
            continue;
        }
        const tags: string[] = [];
        if (hasExactKeyword(kws, CURRENT_KEYWORD)) tags.push('Current');
        if (hasExactKeyword(kws, PLANNED_KEYWORD)) tags.push('Planned');
        const prefix = tags.length ? `[${tags.join('/')}] ` : '';
        if (pushLogRow(log, `${prefix}${logRemarks(log)}`)) return padActions(rows);
    }

    for (const row of objectiveRows) {
        if (!rowHasContent(row)) continue;
        const strategies = formatStrategiesForPdf(row.strategies).trim();
        const tactics = formatTacticsForPdf(row.strategies).trim();
        const parts = [
            row.objective.trim() && `Objective: ${row.objective.trim()}`,
            strategies && `Strategies: ${strategies.replace(/\n/g, '; ')}`,
            tactics && `Tactics: ${tactics.replace(/\n/g, '; ')}`,
        ].filter(Boolean);
        if (!parts.length) continue;
        rows.push({ time: '', actions: collapseActionText(parts.join(' — ')) });
        if (rows.length >= MAX_ACTION_ROWS) break;
    }

    return padActions(rows);
}

function objectivesFromPost(objectiveRows: ObjectiveRow[]): string {
    const lines: string[] = [];
    for (const row of objectiveRows) {
        if (!rowHasContent(row)) continue;
        const obj = row.objective.trim();
        if (obj) lines.push(obj);
    }
    return lines.join('\n');
}

function situationFromIrBriefingLogs(logs: MissionLogLike[]): string {
    // IR Briefing is session-only; no dedicated log. Prefer initial-info assignment text.
    const incident = latestIncidentInfoFromLogs(logs);
    return incident?.fields.assignmentText.trim() ?? '';
}

function loadObjectiveRowsFromLogs(logs: MissionLogLike[]): ObjectiveRow[] {
    const fresh = blankObjectiveRows();
    // blankObjectiveRows seeds a default safety objective; only keep log-backed content.
    fresh[0].objective = '';
    const seenAt: Record<string, number> = {};

    for (const log of logs) {
        const kws = normalizeLogKeywords(log.keywords);
        if (!hasPostKeyword(kws)) continue;
        const tag = kws.find((k) => /^(objective|strategy|tactic):/.test(k));
        if (!tag) continue;
        const parsed = parsePostTag(tag);
        if (!parsed || parsed.obj < 1 || parsed.obj > MAX_OBJECTIVES) continue;
        const created = Date.parse(log.created || log.dtg || '') || 0;
        if (seenAt[tag] !== undefined && created < seenAt[tag]) continue;
        seenAt[tag] = created;

        const row = fresh[parsed.obj - 1];
        const content = (log.content ?? '').replace(/^(Objective|Strategy|Tactic):\s*/i, '').trim();
        if (parsed.kind === 'objective') {
            row.objective = content;
        } else if (parsed.kind === 'strategy' && parsed.strat) {
            ensureStrategy(row, parsed.strat - 1).text = content;
        } else if (parsed.kind === 'tactic' && parsed.strat && parsed.tac) {
            const strategy = ensureStrategy(row, parsed.strat - 1);
            ensureTactic(strategy, parsed.tac - 1).text = content;
        }
    }
    return fresh;
}

function parsePostTag(tag: string): {
    kind: 'objective' | 'strategy' | 'tactic';
    obj: number;
    strat?: number;
    tac?: number;
} | null {
    const objectiveMatch = tag.match(/^objective:(\d+)$/);
    if (objectiveMatch) {
        return { kind: 'objective', obj: Number(objectiveMatch[1]) };
    }
    const strategyMatch = tag.match(/^strategy:(\d+)-(\d+)$/);
    if (strategyMatch) {
        return {
            kind: 'strategy',
            obj: Number(strategyMatch[1]),
            strat: Number(strategyMatch[2]),
        };
    }
    const tacticMatch = tag.match(/^tactic:(\d+)-(\d+)-(\d+)$/);
    if (tacticMatch) {
        return {
            kind: 'tactic',
            obj: Number(tacticMatch[1]),
            strat: Number(tacticMatch[2]),
            tac: Number(tacticMatch[3]),
        };
    }
    return null;
}

export interface LoadedIcs201 {
    form: Ics201Form;
    sources: Ics201Sources;
}

/** Load auto-filled + persisted ICS 201 values from mission logs and metadata. */
export async function loadIcs201FromMission(
    missionGuid: string,
    missionToken?: string,
    missionName?: string,
): Promise<LoadedIcs201> {
    const form = blankIcs201Form();
    const sources: Ics201Sources = {
        ippLatLng: null,
        missionName: missionName ?? '',
        missionGuid,
    };

    const sub = await Subscription.load(missionGuid, { token: missionToken ?? '' });
    const logs = await sub.log.list({ refresh: true });

    const incident = latestIncidentInfoFromLogs(logs);
    if (incident) {
        form.incidentName = incident.fields.incidentName.trim();
        form.incidentNumber = incident.fields.incidentId.trim()
            || incident.fields.eventId.trim();
        form.preparedByName = incident.fields.icCoordinator.trim();
        form.incidentCommanders = incident.fields.icCoordinator.trim();
        if (!form.situationSummary.trim()) {
            form.situationSummary = incident.fields.assignmentText.trim();
        }
    }
    if (!form.incidentName && missionName) form.incidentName = missionName;

    const ippLatLng = await resolveIppLatLng(missionGuid, missionToken);
    sources.ippLatLng = ippLatLng;
    if (ippLatLng) {
        form.initialPlanningPoint = formatIppAsUtm(ippLatLng.lat, ippLatLng.lng);
    }

    const objectiveRows = loadObjectiveRowsFromLogs(logs);
    const postObjectives = objectivesFromPost(objectiveRows);
    if (postObjectives) form.objectives = postObjectives;

    form.actions = actionsFromLogsAndPost(logs, objectiveRows);
    form.resources = resourcesFromLogs(logs);

    if (!form.situationSummary.trim()) {
        form.situationSummary = situationFromIrBriefingLogs(logs);
    }

    const saved = latestIcs201FromLogs(logs);
    if (saved) {
        Object.assign(form, applyPartialIcs201Form(form, saved.form));
        form.logId = saved.logId;
        // Re-apply auto sources that should always refresh from mission
        if (incident) {
            if (incident.fields.incidentName.trim()) {
                form.incidentName = incident.fields.incidentName.trim();
            }
            const number = incident.fields.incidentId.trim() || incident.fields.eventId.trim();
            if (number) form.incidentNumber = number;
        }
        if (ippLatLng) {
            form.initialPlanningPoint = formatIppAsUtm(ippLatLng.lat, ippLatLng.lng);
        }
    }

    return { form, sources };
}

/** Refresh auto-filled sources while preserving user-edited fields. */
export function mergeIcs201Sources(current: Ics201Form, loaded: Ics201Form): Ics201Form {
    return {
        ...current,
        incidentName: loaded.incidentName || current.incidentName,
        incidentNumber: loaded.incidentNumber || current.incidentNumber,
        initialPlanningPoint: loaded.initialPlanningPoint || current.initialPlanningPoint,
        preparedByName: current.preparedByName.trim()
            ? current.preparedByName
            : loaded.preparedByName,
        incidentCommanders: current.incidentCommanders.trim()
            ? current.incidentCommanders
            : loaded.incidentCommanders,
        situationSummary: current.situationSummary.trim()
            ? current.situationSummary
            : loaded.situationSummary,
        objectives: current.objectives.trim() ? current.objectives : loaded.objectives,
        actions: actionRowsHaveContent(current.actions) ? current.actions : loaded.actions,
        resources: resourceRowsHaveContent(current.resources) ? current.resources : loaded.resources,
        logId: current.logId ?? loaded.logId,
    };
}

function actionRowsHaveContent(rows: Ics201ActionRow[]): boolean {
    return rows.some((r) => r.time.trim() || r.actions.trim());
}

function resourceRowsHaveContent(rows: Ics201ResourceRow[]): boolean {
    return rows.some((r) => (
        r.resource.trim()
        || r.identifier.trim()
        || r.dateTimeOrdered.trim()
        || r.eta.trim()
        || r.arrived
        || r.notes.trim()
    ));
}

export async function saveIcs201ToMission(
    missionGuid: string,
    form: Ics201Form,
    missionToken?: string,
): Promise<string> {
    const sub = await Subscription.load(missionGuid, { token: missionToken ?? '' });
    const body = {
        dtg: new Date().toISOString(),
        content: serializeIcs201Form(form),
        keywords: buildIcs201Keywords(form),
    };
    if (form.logId) {
        await sub.log.update(form.logId, body);
        return form.logId;
    }
    const created = await sub.log.create(body);
    return String(created.id);
}
