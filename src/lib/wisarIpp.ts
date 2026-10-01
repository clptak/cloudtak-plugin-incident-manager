/**
 * Pure helpers for the WiSAR IPP picker (decision 11): a drop-down of point
 * markers in the active DataSync, with the incident's stored IPP preselected.
 * No CloudTAK host imports, so node:test can run it.
 */

/** A point marker from the incident's DataSync (common map + planning). */
export interface IppMarker {
    uid: string;
    callsign: string;
    /** [lng, lat] */
    coords?: [number, number];
}

/** The incident IPP stored in mission_schema.json (incident_response.ipp_*). */
export interface StoredIpp {
    lat: number;
    lng: number;
    type: 'LKP' | 'PLS';
}

/** One entry in the picker; `lat`/`lon` are what the WiSAR job receives. */
export interface WisarIppOption {
    uid: string;
    label: string;
    lat: number;
    lon: number;
    source: 'marker' | 'stored';
}

/**
 * Option id for the stored IPP when no marker sits on it (e.g. the IPP marker
 * was deleted). Keeps the stored IPP selectable without typed coordinates.
 */
export const STORED_IPP_ID = '__incident-ipp__';

/** Markers this close to the stored IPP are treated as the IPP marker. */
export const SAME_POINT_M = 2;

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371008.8;
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLon = (b.lon - a.lon) * toRad;
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Markers with usable coordinates, plus the stored IPP when no marker is on it. */
export function ippOptions(markers: readonly IppMarker[], stored: StoredIpp | null): WisarIppOption[] {
    const options: WisarIppOption[] = [];
    for (const m of markers) {
        if (!m.coords) continue;
        const [lon, lat] = m.coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
        options.push({ uid: m.uid, label: m.callsign || m.uid, lat, lon, source: 'marker' });
    }
    if (stored && !options.some((o) => distanceM(o, { lat: stored.lat, lon: stored.lng }) <= SAME_POINT_M)) {
        options.push({
            uid: STORED_IPP_ID,
            label: `Incident IPP (${stored.type}, no marker)`,
            lat: stored.lat,
            lon: stored.lng,
            source: 'stored',
        });
    }
    return options;
}

/**
 * The option to preselect: the marker on the stored IPP (an `IPP-` callsign
 * wins a tie), else the stored-IPP entry. Nothing when no IPP is stored.
 */
export function defaultIppUid(options: readonly WisarIppOption[], stored: StoredIpp | null): string {
    if (!stored) return '';
    const at = { lat: stored.lat, lon: stored.lng };
    const onIpp = options
        .filter((o) => o.source === 'marker' && distanceM(o, at) <= SAME_POINT_M)
        .sort((a, b) => Number(/^IPP-/i.test(b.label)) - Number(/^IPP-/i.test(a.label))
            || distanceM(a, at) - distanceM(b, at));
    if (onIpp.length) return onIpp[0].uid;
    return options.some((o) => o.uid === STORED_IPP_ID) ? STORED_IPP_ID : '';
}

export function formatLatLon(o: { lat: number; lon: number }): string {
    return `${o.lat.toFixed(5)}, ${o.lon.toFixed(5)}`;
}
