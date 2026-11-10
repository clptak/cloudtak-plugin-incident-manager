/**
 * ICS 204A Team Assignment Debriefing (#17): what fills in automatically when
 * a debrief is started from an assignment. Everything stays editable.
 */

import { priorPlanFor } from '../domain/iap.ts';
import type { DebriefRecord, Ics204aDetails, OpAssignment } from '../domain/entities.ts';
import type { Ics204aPdfData } from './ics204aPdf.ts';
import type { IapAssignmentPlan } from './iapPlanPersistence.ts';

/**
 * Task name from the assignment's ICS 204 work assignment, debriefed-by from
 * the signed-in callsign, and completed now. Team leader is left blank: the
 * 204 leader column starts out as the agency name, and the team leader signs
 * the 204A as "/S/ <name>", so the name has to be typed in.
 */
export function prefillIcs204a(
    assignment: OpAssignment,
    plans: IapAssignmentPlan[],
    callsign: string,
    now: string,
): Ics204aDetails {
    const out: Ics204aDetails = { completedAt: now };
    const plan = priorPlanFor(plans, assignment);
    const taskName = plan?.workAssignment.trim() || assignment.notes?.trim();
    if (taskName) out.taskName = taskName;
    if (callsign.trim()) out.debriefedBy = callsign.trim();
    return out;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** ISO timestamp → the local "YYYY-MM-DDTHH:mm" a datetime-local input shows. */
export function toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value (local time) → ISO timestamp; '' when unreadable. */
export function fromLocalInput(local: string): string {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

// ---- Marker / area picker (#17 phase 2) -----------------------------------

/** A marker or area on the OP's FIELD DataSync that a 204A line can name. */
export interface Ics204aMapItem {
    uid: string;
    callsign: string;
    kind: 'marker' | 'area';
    /** The marker's position, or the middle of the area. */
    lat: number;
    lon: number;
    /** When the feature was made (CoT time), if known. */
    time?: string;
}

/** The three 204A boxes the picker can add a line to. */
export type Ics204aPickTarget = 'clues' | 'hazards' | 'gaps';

interface FeatureLike {
    id?: string | number;
    properties?: { callsign?: string; time?: string; start?: string };
    geometry?: { type?: string; coordinates?: unknown };
}

function outerRing(geometry: FeatureLike['geometry']): number[][] | null {
    const c = geometry?.coordinates;
    if (geometry?.type === 'Polygon' && Array.isArray(c)) return (c[0] as number[][]) ?? null;
    if (geometry?.type === 'MultiPolygon' && Array.isArray(c)) return ((c[0] as number[][][])?.[0]) ?? null;
    return null;
}

/**
 * Named markers and areas from an OP sync, newest first. Leaves out the
 * features listed in `exclude` (the assignment polygon copies and attached
 * GPS tracks), unnamed features, lines and anything without usable
 * coordinates.
 */
export function ics204aMapItems(features: FeatureLike[], exclude: Set<string>): Ics204aMapItem[] {
    const out: Ics204aMapItem[] = [];
    for (const f of features) {
        const uid = String(f.id ?? '');
        const callsign = f.properties?.callsign?.trim() ?? '';
        if (!uid || !callsign || exclude.has(uid)) continue;
        const time = f.properties?.time || f.properties?.start || undefined;
        if (f.geometry?.type === 'Point') {
            const [lon, lat] = (f.geometry.coordinates as number[]) ?? [];
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            out.push({ uid, callsign, kind: 'marker', lat, lon, ...(time ? { time } : {}) });
            continue;
        }
        const ring = outerRing(f.geometry)?.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]));
        if (!ring?.length) continue;
        // A closed ring repeats its first point; leave it out of the average.
        const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
            ? ring.slice(0, -1)
            : ring;
        const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        out.push({ uid, callsign, kind: 'area', lat, lon, ...(time ? { time } : {}) });
    }
    return out.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? '') || a.callsign.localeCompare(b.callsign));
}

/**
 * One 204A line for a picked item: name, time, location (lat, lon to 5
 * places, about 1 m), then the note. `timeLabel` is the item's time already
 * formatted for the reader, or '' to leave it out.
 */
export function ics204aLine(item: Ics204aMapItem, timeLabel: string, note: string): string {
    const where = `${item.kind === 'area' ? 'area centred ' : ''}${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}`;
    const parts = [item.callsign, timeLabel.trim() ? `${timeLabel.trim()}` : '', where].filter(Boolean);
    const head = parts.join(' · ');
    return note.trim() ? `${head} — ${note.trim()}` : head;
}

/** Add a line to the end of a 204A text box. */
export function appendIcs204aLine(text: string, line: string): string {
    return text.trim() ? `${text.trimEnd()}\n${line}` : line;
}

// ---- PDF (#17 phase 3) ----------------------------------------------------

function pct(n: number | undefined): string {
    return n === undefined ? '' : `${n}%`;
}

/**
 * What the drawn ICS 204A prints for one debrief. OP, assignment # (the
 * segment label), team name (the resource) and Estimated POD come from the
 * debrief; Map attached is Y when a GPS track is attached; a partial search
 * shows how much was completed next to the POD.
 */
export function ics204aPdfData(record: DebriefRecord, incidentName: string, segmentLabel: string): Ics204aPdfData {
    const d = record.ics204a ?? {};
    const local = d.completedAt ? toLocalInput(d.completedAt) : '';
    const [dateCompleted = '', timeCompleted = ''] = local ? local.split('T') : [];
    const partial = record.coverage !== undefined && record.coverage < 1
        ? ` (${Math.round(record.coverage * 100)}% of segment completed)`
        : '';
    return {
        incidentName,
        opNumber: String(record.opNumber),
        taskNumber: d.taskNumber ?? '',
        assignmentNumber: record.label || segmentLabel,
        taskName: d.taskName ?? '',
        dateCompleted,
        timeCompleted,
        teamName: record.resource ?? '',
        teamLeader: d.teamLeader ?? '',
        teamLeaderSignature: d.teamLeaderSignedAt && d.teamLeader ? `/S/ ${d.teamLeader}` : '',
        debriefedBy: d.debriefedBy ?? '',
        actions: d.actions ?? '',
        mapAttached: Boolean(record.tracks?.length),
        estimatedPod: record.pod !== undefined ? `${pct(record.pod)}${partial}` : '',
        podResponsive: pct(d.podResponsive),
        podUnresponsive: pct(d.podUnresponsive),
        clues: d.clues ?? '',
        clueStatus: d.clueStatus ?? '',
        gaps: d.gaps ?? '',
        hazards: d.hazards ?? '',
        suggestions: d.suggestions ?? '',
    };
}

/** e.g. ICS-204A_OP1_01_CCSO-SAR-01.pdf (one file per debrief). */
export function ics204aFilename(record: DebriefRecord, segmentLabel: string): string {
    const safe = (s: string): string => s.trim().replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const parts = ['ICS-204A', `OP${record.opNumber}`, safe(record.label || segmentLabel), safe(record.resource ?? '')];
    const stamp = (record.recordedAt ?? '').replace(/[^0-9]/g, '').slice(0, 12);
    if (stamp) parts.push(stamp);
    return `${parts.filter(Boolean).join('_')}.pdf`;
}
