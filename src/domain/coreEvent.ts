/**
 * CloudTAK Core Events for incidents (ADR-004). Pure: builds request bodies
 * and makes decisions; src/lib/coreEvents.ts does the I/O.
 *
 * Two kinds of event:
 *   MGMT  - one per incident, on the management channels. Holds the MGMT
 *           sync, the common map and every OP sync. Full CAD detail.
 *   field - one per operational period, on that OP's field channels, created
 *           when the OP is activated and ended when it is closed. Operational
 *           detail only (no CAD Type, remarks or caller information).
 * `metadata.role` tells them apart; a field event never carries the CAD ID.
 */

export const DEFAULT_EVENT_TYPE = '13061000001418000000';
export const DEFAULT_MARKER_COLOR = '#FFFFFF';
/** CAD times are local to the dispatch centre; Arizona does not observe DST. */
export const DEFAULT_CAD_UTC_OFFSET = '-07:00';

export type EventPriority = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type EventRole = 'mgmt' | 'field';

export interface EventMission {
    guid: string;
    name: string;
}

export interface EventStyle {
    type: string;
    icon: string;
    'marker-color': string;
}

/**
 * Optional per-deployment symbol map (deployment/<eventIconsFile>):
 *   { "default": { type?, icon?, "marker-color"? },
 *     "byCode":  { "<CAD Type code>": { type?, icon?, "marker-color"? } } }
 * See docs/event-icons.md.
 */
export interface EventIconMap {
    default: Partial<EventStyle>;
    byCode: Record<string, Partial<EventStyle>>;
}

export const EMPTY_ICON_MAP: EventIconMap = { default: {}, byCode: {} };

function pickStyle(value: unknown): Partial<EventStyle> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const v = value as Record<string, unknown>;
    const out: Partial<EventStyle> = {};
    if (typeof v.type === 'string' && v.type.trim()) out.type = v.type.trim();
    if (typeof v.icon === 'string') out.icon = v.icon.trim();
    if (typeof v['marker-color'] === 'string' && v['marker-color'].trim()) out['marker-color'] = v['marker-color'].trim();
    return out;
}

/** Parse the icon map file; anything unusable is ignored, never thrown. */
export function eventIconMapFromValue(value: unknown): EventIconMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_ICON_MAP;
    const v = value as Record<string, unknown>;
    const byCode: Record<string, Partial<EventStyle>> = {};
    if (v.byCode && typeof v.byCode === 'object' && !Array.isArray(v.byCode)) {
        for (const [code, style] of Object.entries(v.byCode as Record<string, unknown>)) {
            if (code.trim()) byCode[code.trim().toUpperCase()] = pickStyle(style);
        }
    }
    return { default: pickStyle(v.default), byCode };
}

/** "SUICIDAL SUBJECT STAGE MEDICS (SUICEMS)" -> "SUICEMS"; no code -> the whole line. */
export function cadTypeCode(type: string): string {
    const trimmed = type.trim();
    const m = /\(([^()]+)\)\s*$/.exec(trimmed);
    return (m ? m[1] : trimmed).trim().toUpperCase();
}

/** Symbol and colour for an event: byCode entry, then default, then built-in. */
export function eventStyleFor(map: EventIconMap, cadType: string | null): EventStyle {
    const entry = cadType ? map.byCode[cadTypeCode(cadType)] ?? {} : {};
    return {
        type: entry.type ?? map.default.type ?? DEFAULT_EVENT_TYPE,
        icon: entry.icon ?? map.default.icon ?? '',
        'marker-color': entry['marker-color'] ?? map.default['marker-color'] ?? DEFAULT_MARKER_COLOR,
    };
}

/** CAD Priority 1-5 -> event priority (1 critical, 2 high, 3 medium, 4-5 low). */
export function priorityFromCad(value: string | undefined): EventPriority {
    const n = Number.parseInt((value ?? '').trim(), 10);
    if (n === 1) return 'critical';
    if (n === 2) return 'high';
    if (n === 3) return 'medium';
    if (n === 4 || n === 5) return 'low';
    return 'none';
}

/**
 * "{Xstreet 1} and {Xstreet 2}"; one street when only one is filled;
 * otherwise the address text after "LL(...):".
 */
export function locationFromCad(fields: Record<string, string>): string {
    const x1 = (fields['Xstreet 1'] ?? '').trim();
    const x2 = (fields['Xstreet 2'] ?? '').trim();
    if (x1 && x2) return `${x1} and ${x2}`;
    if (x1 || x2) return x1 || x2;
    const address = (fields.Address ?? '').split('\n')[0].trim();
    return address.replace(/^LL\s*\([^)]*\)\s*:?\s*/i, '').trim();
}

/** CAD "HH:MM:SS  MM/DD/YY" -> ISO 8601 with the dispatch centre's offset. */
export function cadTimeToIso(value: string | undefined, utcOffset = DEFAULT_CAD_UTC_OFFSET): string | null {
    const m = /(\d{1,2}):(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{2})/.exec(value ?? '');
    if (!m) return null;
    const [, hh, mi, ss, mo, dd, yy] = m;
    return `20${yy}-${mo}-${dd}T${hh.padStart(2, '0')}:${mi}:${ss}${utcOffset}`;
}

/** Case Number when present, else Event ID - names the incident everywhere. */
export function incidentIdFor(ids: { caseNumber?: string | null; cadId?: string | null }): string {
    return (ids.caseNumber || ids.cadId || '').trim();
}

export interface MgmtEventInput {
    fields: Record<string, string>;
    cadId: string | null;
    caseNumber: string | null;
    lat: number;
    lng: number;
    subjectProfile?: string;
    channels: number[];
    missions?: EventMission[];
    iconMap?: EventIconMap;
    utcOffset?: string;
}

export interface MgmtEventPlan {
    body: {
        type: string;
        name: string;
        editable: boolean;
        remarks: string;
        metadata: Record<string, unknown>;
        links: { name: string; url: string }[];
        style: { icon?: string; 'marker-color'?: string };
        geometry: { type: 'Point'; coordinates: [number, number] };
        started?: string;
        priority: EventPriority;
        location: string;
        missions: EventMission[];
        channels: number[];
        external_id?: { system: string; value: string };
    };
    /** IDs set after create, one update each (the API takes one per request). */
    laterExternalIds: { system: string; value: string }[];
}

/** The MGMT event for a pasted CAD call. */
export function buildMgmtEvent(input: MgmtEventInput): MgmtEventPlan {
    if (!input.channels.length) throw new Error('The incident event needs at least one management channel.');
    const type = (input.fields.Type ?? '').trim();
    const id = incidentIdFor({ caseNumber: input.caseNumber, cadId: input.cadId });
    const title = [id, type].filter(Boolean).join(' - ') || 'Incident';
    const style = eventStyleFor(input.iconMap ?? EMPTY_ICON_MAP, type || null);
    const started = cadTimeToIso(input.fields.Dispatched, input.utcOffset)
        ?? cadTimeToIso(input.fields.Created, input.utcOffset);
    const metadata: Record<string, unknown> = { role: 'mgmt' satisfies EventRole };
    if (input.subjectProfile) metadata.subjectProfile = input.subjectProfile;

    const body: MgmtEventPlan['body'] = {
        type: style.type,
        name: title,
        editable: true,
        remarks: title,
        metadata,
        links: [],
        style: { ...(style.icon ? { icon: style.icon } : {}), 'marker-color': style['marker-color'] },
        geometry: { type: 'Point', coordinates: [input.lng, input.lat] },
        priority: priorityFromCad(input.fields.Priority),
        location: locationFromCad(input.fields),
        missions: input.missions ?? [],
        channels: [...new Set(input.channels)],
    };
    if (started) body.started = started;
    if (input.cadId) body.external_id = { system: 'CAD', value: input.cadId };

    const laterExternalIds = input.caseNumber ? [{ system: 'Case_Number', value: input.caseNumber }] : [];
    return { body, laterExternalIds };
}

export interface FieldEventInput {
    incidentId: string;
    opNumber: number;
    opMission: EventMission;
    mgmtEventId: string;
    lat: number;
    lng: number;
    location: string;
    priority: EventPriority;
    channels: number[];
    started: string;
    iconMap?: EventIconMap;
}

/**
 * The field event for an activated OP. Operational detail only: the CAD Type
 * stays off the name, remarks and symbol (the default symbol is used).
 */
export function buildFieldEvent(input: FieldEventInput) {
    if (!input.channels.length) throw new Error(`OP${input.opNumber} has no field channels to share its event with.`);
    const style = eventStyleFor(input.iconMap ?? EMPTY_ICON_MAP, null);
    const name = `${input.incidentId || 'Incident'} - OP${input.opNumber}`;
    return {
        type: style.type,
        name,
        editable: true,
        remarks: '',
        metadata: { role: 'field' satisfies EventRole, incidentEvent: input.mgmtEventId, opNumber: input.opNumber },
        links: [],
        style: { ...(style.icon ? { icon: style.icon } : {}), 'marker-color': style['marker-color'] },
        geometry: { type: 'Point' as const, coordinates: [input.lng, input.lat] as [number, number] },
        started: input.started,
        priority: input.priority,
        location: input.location,
        missions: [input.opMission],
        channels: [...new Set(input.channels)],
        external_id: { system: 'OP', value: input.opMission.guid },
    };
}

export interface EventSummary {
    id: string;
    name: string;
    active: boolean;
    started?: string;
    ended?: string | null;
    external_ids?: Record<string, string>;
    metadata?: Record<string, unknown>;
    missions?: EventMission[];
    geometry?: { coordinates: [number, number] | number[] };
    boards?: { id: string; channel: number; column: string | null; columns: { id: string; type: string }[] }[];
}

/** An incident (MGMT) event: anything not marked as a field event. */
export function isMgmtEvent(event: EventSummary): boolean {
    return event.metadata?.role !== 'field';
}

/** Active MGMT events, newest first - the Create Mission picker. */
export function pickableEvents(events: EventSummary[]): EventSummary[] {
    return events
        .filter((e) => e.active && !e.ended && isMgmtEvent(e))
        .sort((a, b) => (b.started ?? '').localeCompare(a.started ?? ''));
}

/** The active MGMT event already created for this CAD call, if any. */
export function findEventForCad(events: EventSummary[], cadId: string | null): EventSummary | null {
    if (!cadId) return null;
    return pickableEvents(events).find((e) => e.external_ids?.CAD === cadId) ?? null;
}

/** Add missions by guid; existing entries are kept as they are. */
export function mergeMissions(existing: EventMission[], add: EventMission[]): EventMission[] {
    const out = [...existing];
    for (const m of add) {
        if (m.guid && !out.some((e) => e.guid === m.guid)) out.push({ guid: m.guid, name: m.name });
    }
    return out;
}

/** Nominated column of every board the event is not yet placed on. */
export function columnsToNominate(event: EventSummary): string[] {
    const out: string[] = [];
    for (const board of event.boards ?? []) {
        if (board.column) continue;
        const nominated = board.columns.find((c) => c.type === 'nominated');
        if (nominated) out.push(nominated.id);
    }
    return out;
}

/** Create Mission fields from a picked event (Case Number, else CAD ID; date; point). */
export function createFormFromEvent(event: EventSummary): {
    activityNumber: string | null;
    date: string | null;
    coords: string | null;
} {
    const id = incidentIdFor({ caseNumber: event.external_ids?.Case_Number, cadId: event.external_ids?.CAD });
    const date = event.started && /^\d{4}-\d{2}-\d{2}/.test(event.started) ? event.started.slice(0, 10) : null;
    const c = event.geometry?.coordinates;
    const coords = Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])
        ? `${Number(c[1]).toFixed(5)}, ${Number(c[0]).toFixed(5)}`
        : null;
    return { activityNumber: id || null, date, coords };
}

/** External-ID changes needed to bring an event in line with Initial Information. */
export function externalIdChanges(
    current: Record<string, string> | undefined,
    wanted: { Case_Number?: string; DEMA?: string },
): { system: string; value: string }[] {
    const out: { system: string; value: string }[] = [];
    for (const system of ['Case_Number', 'DEMA'] as const) {
        const want = (wanted[system] ?? '').trim();
        const have = (current?.[system] ?? '').trim();
        if (want !== have) out.push({ system, value: want });
    }
    return out;
}
