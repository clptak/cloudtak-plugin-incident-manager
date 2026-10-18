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
    latLng: IppLatLng | null;
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

/** Lowest subject number that has an IPP. */
export function ippFromSubjects(subjects: IppSubject[]): { text: string; number: string } | null {
    const ordered = [...subjects].sort(
        (a, b) => Number.parseInt(a.subjectCaseID, 10) - Number.parseInt(b.subjectCaseID, 10),
    );
    for (const subject of ordered) {
        const text = subjectIppRaw(subject);
        if (text) return { text, number: subject.subjectCaseID };
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

function subjectsOnSchema(schema: IppSchema): IppSubject[] {
    const ir = asRecord(schema.incident_response);
    const raw = ir?.subjects;
    if (!Array.isArray(raw)) return [];
    const subjects: IppSubject[] = [];
    for (const entry of raw) {
        const rec = asRecord(entry);
        const info = asRecord(rec?.initial_information);
        if (!info) continue;
        const id = typeof info.subjectCaseID === 'string' ? info.subjectCaseID : '';
        if (!id) continue;
        subjects.push({
            subjectCaseID: id,
            subjectIpp: typeof info.subjectIpp === 'string' ? info.subjectIpp : '',
            subjectIppFromTak: typeof info.subjectIppFromTak === 'string' ? info.subjectIppFromTak : '',
        });
    }
    return subjects;
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
    if (fromSubject) {
        const field = toIppField(fromSubject.text, opts.formatUtm);
        return { ...field, source: `Subject ${fromSubject.number}` };
    }

    const area = schemaIppLatLng(opts.schema);
    if (area) {
        return {
            text: opts.formatUtm(area.lat, area.lng),
            latLng: area,
            source: 'Search Area IPP',
        };
    }

    const marker = opts.markerLookup ? await opts.markerLookup() : null;
    if (!marker) return null;
    return {
        text: opts.formatUtm(marker.lat, marker.lng),
        latLng: marker,
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
