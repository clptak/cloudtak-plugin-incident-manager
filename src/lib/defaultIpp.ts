/**
 * Default Initial Planning Point for IR Briefing and ICS 201.
 * Order: typed subject IPP, DataSync subject marker, Search Area schema IPP, map marker.
 */
import { parseCoordinates } from './coords.ts';
import { parseSubjectsFromLogs, type SubjectForm, type SubjectLogInput } from './subjectInfo.ts';

export interface IppLatLng {
    lat: number;
    lng: number;
}

export interface DefaultIpp {
    text: string;
    /** Coordinates of `text` itself; null when the text is not coordinates. */
    latLng: IppLatLng | null;
    /**
     * Coordinates for the weather lookup. Same as `latLng` when the text
     * parses; otherwise the best other point we have (the subject's DataSync
     * marker, then the Search Area IPP, then the map marker), so typing UTM or
     * a description does not switch weather off.
     */
    weatherLatLng: IppLatLng | null;
    source: string;
}

export interface IppSchema {
    incident_response?: {
        subjects?: unknown;
        ipp_coordinates?: unknown;
    } | null;
}

type IppSubject = Pick<SubjectForm, 'subjectCaseID' | 'subjectIpp' | 'subjectIppFromTak'>;

/** Typed coordinates win. The DataSync value is used only when the typed field is blank. */
export function subjectIppRaw(subject: Pick<SubjectForm, 'subjectIpp' | 'subjectIppFromTak'>): string {
    const typed = subject.subjectIpp.trim();
    if (typed) return typed;
    const fromTak = subject.subjectIppFromTak.trim();
    if (!fromTak) return '';
    const semi = fromTak.indexOf(';');
    return (semi >= 0 ? fromTak.slice(0, semi) : fromTak).trim();
}

/** Coordinates of the subject's DataSync marker, if one was picked. */
export function subjectMarkerLatLng(subject: Pick<SubjectForm, 'subjectIppFromTak'>): IppLatLng | null {
    const fromTak = subject.subjectIppFromTak.trim();
    if (!fromTak) return null;
    const semi = fromTak.indexOf(';');
    return parseCoordinates((semi >= 0 ? fromTak.slice(0, semi) : fromTak).trim());
}

/** Subject numbers sort numerically; anything non-numeric goes last. */
function caseOrder(id: string): number {
    const n = Number.parseInt(id, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Lowest subject number that has an IPP. */
export function ippFromSubjects(
    subjects: IppSubject[],
): { text: string; number: string; markerLatLng: IppLatLng | null } | null {
    const ordered = [...subjects].sort((a, b) => caseOrder(a.subjectCaseID) - caseOrder(b.subjectCaseID));
    for (const subject of ordered) {
        const text = subjectIppRaw(subject);
        if (text) return { text, number: subject.subjectCaseID, markerLatLng: subjectMarkerLatLng(subject) };
    }
    return null;
}

/** Coordinate text becomes "<formatter>". Anything else is returned as typed. */
export function toIppField(
    text: string,
    formatUtm: (lat: number, lng: number) => string,
): { text: string; latLng: IppLatLng | null } {
    const trimmed = text.trim();
    const parsed = parseCoordinates(trimmed);
    if (!parsed) return { text: trimmed, latLng: null };
    return { text: formatUtm(parsed.lat, parsed.lng), latLng: parsed };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
}

/** Same lat/lng read as readIppFromSchema, without pulling the schema loader. */
export function schemaIppLatLng(schema: IppSchema): IppLatLng | null {
    const ir = asRecord(schema.incident_response);
    if (!ir) return null;
    const coords = asRecord(ir.ipp_coordinates);
    if (!coords) return null;
    const lat = finiteNumber(coords.lat);
    const lng = finiteNumber(coords.lng) ?? finiteNumber(coords.lon);
    if (lat === null || lng === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

/**
 * Subjects as Subject Information stores them. Mirrors subjectsFromSchema()
 * in subjectsPersistence.ts (not imported: it pulls in CloudTAK browser
 * modules): a record without a case number is subject '01', and a later
 * record for the same number replaces an earlier one.
 */
export function subjectsOnSchema(schema: IppSchema): IppSubject[] {
    const ir = asRecord(schema.incident_response);
    const raw = ir?.subjects;
    if (!Array.isArray(raw)) return [];
    const byNumber = new Map<string, IppSubject>();
    for (const entry of raw) {
        const rec = asRecord(entry);
        const info = asRecord(rec?.initial_information);
        if (!info) continue;
        const id = typeof info.subjectCaseID === 'string' && info.subjectCaseID ? info.subjectCaseID : '01';
        byNumber.set(id, {
            subjectCaseID: id,
            subjectIpp: typeof info.subjectIpp === 'string' ? info.subjectIpp : '',
            subjectIppFromTak: typeof info.subjectIppFromTak === 'string' ? info.subjectIppFromTak : '',
        });
    }
    return [...byNumber.values()];
}

export async function resolveDefaultIpp(opts: {
    schema: IppSchema;
    logs?: SubjectLogInput[];
    formatUtm: (lat: number, lng: number) => string;
    markerLookup?: () => Promise<IppLatLng | null>;
}): Promise<DefaultIpp | null> {
    const stored = subjectsOnSchema(opts.schema);
    const subjects = stored.length ? stored : parseSubjectsFromLogs(opts.logs ?? []);
    const fromSubject = ippFromSubjects(subjects);
    const area = schemaIppLatLng(opts.schema);
    const lookupMarker = async () => (opts.markerLookup ? await opts.markerLookup() : null);

    if (fromSubject) {
        const field = toIppField(fromSubject.text, opts.formatUtm);
        const weatherLatLng = field.latLng
            ?? fromSubject.markerLatLng
            ?? area
            ?? await lookupMarker();
        return { ...field, weatherLatLng, source: `Subject ${fromSubject.number}` };
    }

    if (area) {
        return {
            text: opts.formatUtm(area.lat, area.lng),
            latLng: area,
            weatherLatLng: area,
            source: 'Search Area IPP',
        };
    }

    const marker = await lookupMarker();
    if (!marker) return null;
    return {
        text: opts.formatUtm(marker.lat, marker.lng),
        latLng: marker,
        weatherLatLng: marker,
        source: 'Map marker',
    };
}

/** Refresh keeps a value the user typed. Otherwise the newly loaded default wins. */
export function resolveDisplayedIpp(current: string, loaded: string, edited: boolean): string {
    if (edited) return current;
    return loaded.trim() ? loaded : current;
}

/** A saved ICS 201 IPP is kept. The resolver fills the field only when that save is blank. */
export function ippAfterSavedForm(saved: string, resolved: string): string {
    return saved.trim() ? saved : resolved;
}
