/**
 * Where LPB rings are centred (#13). The planner picks the Search Area IPP,
 * a subject's estimated location, any DataSync marker, or typed coordinates,
 * so different locations can be tried. Plotting never sets the IPP: that is
 * done in Search Area at Search Transition (#12).
 *
 * Pure: no CloudTAK host imports.
 */

import { parseCoordinates } from './coords.ts';
import { schemaIppLatLng, subjectIppRaw, subjectMarkerLatLng, subjectsOnSchema, type IppSchema } from './defaultIpp.ts';

export interface LpbCenterChoice {
    /** Select value: 'ipp', 'subject:<n>' or 'marker:<uid>'. */
    value: string;
    label: string;
    /** [lng, lat] */
    coords: [number, number];
}

export interface LpbMarker {
    uid: string;
    callsign: string;
    coords?: [number, number];
}

function fmt(coords: [number, number]): string {
    return `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
}

/** IPP first, then subjects' estimated locations, then DataSync markers. */
export function lpbCenterChoices(opts: {
    schema: IppSchema | null;
    ippType?: string;
    markers: LpbMarker[];
}): LpbCenterChoice[] {
    const out: LpbCenterChoice[] = [];
    if (opts.schema) {
        const ipp = schemaIppLatLng(opts.schema);
        if (ipp) {
            const coords: [number, number] = [ipp.lng, ipp.lat];
            out.push({ value: 'ipp', label: `IPP${opts.ippType ? ` (${opts.ippType})` : ''} — ${fmt(coords)}`, coords });
        }
        for (const s of subjectsOnSchema(opts.schema)) {
            const ll = parseCoordinates(subjectIppRaw(s)) ?? subjectMarkerLatLng(s);
            if (!ll) continue;
            const coords: [number, number] = [ll.lng, ll.lat];
            out.push({
                value: `subject:${s.subjectCaseID}`,
                label: `Subject ${s.subjectCaseID} estimated location — ${fmt(coords)}`,
                coords,
            });
        }
    }
    for (const m of opts.markers) {
        if (!m.coords) continue;
        out.push({ value: `marker:${m.uid}`, label: m.callsign || m.uid, coords: m.coords });
    }
    return out;
}

/** The text shown in the plot dialog for the chosen centre. */
export function lpbCenterSummary(label: string, coords: [number, number]): string {
    return label.includes(' — ') ? `Plotting around ${label}.` : `Plotting around ${label} at ${fmt(coords)}.`;
}
