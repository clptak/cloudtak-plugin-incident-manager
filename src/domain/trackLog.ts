/**
 * GPS track logs: parsing, measuring, and thinning.
 *
 * A track log is the breadcrumb trail a search resource actually walked. In
 * ISM/ASARCA practice it is the evidence behind a reported POD — "we say 60%
 * because this is where we went" — so it belongs with the completed search
 * assignment that reports the POD, not loose on the map.
 *
 * Clean Architecture inner layer: NO imports from src/lib, CloudTAK, or Vue.
 * All I/O (reading the file, publishing the CoT, writing the schema) lives in
 * adapters; this module only turns text into coordinates and coordinates into
 * numbers.
 *
 * NOTE: keep this file erasable-TypeScript only (no enums/namespaces) so the
 * unit tests run under Node's native type stripping (`npm test`).
 */

import { childrenNamed, findAll, parseXml, textOf, type XmlNode } from './xml.ts';
import type { DebriefRecord, TrackLogRef } from './entities.ts';

/** A single continuous line of travel pulled out of a source file. */
export interface ParsedTrack {
    /** Name carried by the source (track/placemark/feature name), if any. */
    name: string;
    /** [lng, lat] pairs in order. */
    coords: [number, number][];
    /**
     * ISO timestamps parallel to `coords`, when the source recorded them.
     * Sparse sources are dropped entirely rather than half-filled.
     */
    times?: string[];
}

export interface TrackMetrics {
    points: number;
    /** Track length in statute miles. */
    lengthMi: number;
    startedAt?: string;
    endedAt?: string;
}

/** Extensions we accept on the upload control. */
export const TRACK_FILE_EXTENSIONS = ['.json', '.geojson', '.kml', '.gpx'];

/**
 * Vertex cap for the published CoT. A full-shift handheld GPS track is
 * routinely 3,000–10,000 fixes; TAK ships every CoT to every subscriber on
 * every mission change, so publishing raw tracks would flood field radios for
 * no visual gain. Douglas-Peucker to this cap keeps the drawn line
 * indistinguishable at map scale. The ORIGINAL point count is still recorded.
 */
export const MAX_TRACK_POINTS = 1500;

const EARTH_RADIUS_MI = 3958.7613;

function toRadians(deg: number): number {
    return (deg * Math.PI) / 180;
}

/** Great-circle distance between two [lng, lat] points, in statute miles. */
export function haversineMiles(a: [number, number], b: [number, number]): number {
    const dLat = toRadians(b[1] - a[1]);
    const dLon = toRadians(b[0] - a[0]);
    const lat1 = toRadians(a[1]);
    const lat2 = toRadians(b[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total path length in statute miles. */
export function trackLengthMiles(coords: [number, number][]): number {
    let total = 0;
    for (let i = 1; i < coords.length; i++) total += haversineMiles(coords[i - 1], coords[i]);
    return total;
}

export function trackMetrics(track: ParsedTrack): TrackMetrics {
    const metrics: TrackMetrics = {
        points: track.coords.length,
        lengthMi: Math.round(trackLengthMiles(track.coords) * 100) / 100,
    };
    // Times are normalized here as well as in the parsers: a track can also
    // arrive from a caller that assembled it by hand, and a window reported in
    // mixed formats would sort as text rather than as time.
    const stamps = (track.times ?? [])
        .map((t) => Date.parse(t))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
    if (stamps.length) {
        metrics.startedAt = new Date(stamps[0]).toISOString();
        metrics.endedAt = new Date(stamps[stamps.length - 1]).toISOString();
    }
    return metrics;
}

// ── Simplification ───────────────────────────────────────────────────────────

/**
 * Perpendicular distance from `p` to segment `a`–`b`, in an equirectangular
 * approximation around the segment's latitude. Degrees, not miles — the
 * tolerance search below is scale-free, so units only need to be consistent.
 */
function perpendicular(p: [number, number], a: [number, number], b: [number, number]): number {
    const scale = Math.cos(toRadians((a[1] + b[1]) / 2)) || 1;
    const px = p[0] * scale; const py = p[1];
    const ax = a[0] * scale; const ay = a[1];
    const bx = b[0] * scale; const by = b[1];
    const dx = bx - ax; const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Iterative Douglas-Peucker (no recursion — tracks can be very long). */
export function douglasPeucker(
    coords: [number, number][],
    tolerance: number,
): [number, number][] {
    if (coords.length < 3 || tolerance <= 0) return coords;
    const keep = new Array<boolean>(coords.length).fill(false);
    keep[0] = true;
    keep[coords.length - 1] = true;

    const stack: [number, number][] = [[0, coords.length - 1]];
    while (stack.length) {
        const [start, end] = stack.pop() as [number, number];
        let worst = 0;
        let index = -1;
        for (let i = start + 1; i < end; i++) {
            const d = perpendicular(coords[i], coords[start], coords[end]);
            if (d > worst) { worst = d; index = i; }
        }
        if (index !== -1 && worst > tolerance) {
            keep[index] = true;
            stack.push([start, index], [index, end]);
        }
    }

    return coords.filter((_, i) => keep[i]);
}

/**
 * Thin a track to at most `maxPoints` vertices by binary-searching the
 * Douglas-Peucker tolerance. Returns the input untouched when it already fits.
 */
export function simplifyTrack(
    coords: [number, number][],
    maxPoints = MAX_TRACK_POINTS,
): [number, number][] {
    if (coords.length <= maxPoints) return coords;
    let low = 0;
    let high = 1; // ~69 miles of latitude — far beyond any survivable tolerance
    let best = douglasPeucker(coords, high);
    for (let i = 0; i < 24 && best.length !== maxPoints; i++) {
        const mid = (low + high) / 2;
        const candidate = douglasPeucker(coords, mid);
        if (candidate.length > maxPoints) {
            low = mid;
        } else {
            high = mid;
            best = candidate;
        }
    }
    return best.length <= maxPoints ? best : douglasPeucker(coords, high);
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function isFiniteCoord(lng: number, lat: number): boolean {
    return Number.isFinite(lng) && Number.isFinite(lat)
        && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeTime(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

/** Drop empty tracks and times arrays that don't line up with the coordinates. */
function finalize(tracks: ParsedTrack[]): ParsedTrack[] {
    const out: ParsedTrack[] = [];
    for (const track of tracks) {
        if (track.coords.length < 2) continue;
        const clean: ParsedTrack = { name: track.name.trim(), coords: track.coords };
        if (track.times && track.times.length === track.coords.length
            && track.times.some((t) => t)) {
            clean.times = track.times;
        }
        out.push(clean);
    }
    return out;
}

// GPX ────────────────────────────────────────────────────────────────────────

function gpxPoints(parent: XmlNode, tag: string): { coords: [number, number][]; times: string[] } {
    const coords: [number, number][] = [];
    const times: string[] = [];
    for (const pt of findAll(parent, tag)) {
        const lat = Number(pt.attrs.lat);
        const lng = Number(pt.attrs.lon ?? pt.attrs.long);
        if (!isFiniteCoord(lng, lat)) continue;
        coords.push([lng, lat]);
        times.push(normalizeTime(textOf(childrenNamed(pt, 'time')[0])));
    }
    return { coords, times };
}

export function parseGpxTracks(source: string): ParsedTrack[] {
    const doc = parseXml(source);
    const tracks: ParsedTrack[] = [];

    for (const trk of findAll(doc, 'trk')) {
        const name = textOf(childrenNamed(trk, 'name')[0]);
        const segments = findAll(trk, 'trkseg');
        // Segments of one <trk> are one logical track (GPS pause/resume splits
        // a single walk into several <trkseg>), so they are concatenated.
        const coords: [number, number][] = [];
        const times: string[] = [];
        for (const seg of segments.length ? segments : [trk]) {
            const pts = gpxPoints(seg, 'trkpt');
            coords.push(...pts.coords);
            times.push(...pts.times);
        }
        tracks.push({ name, coords, times });
    }

    // Routes are a planned line rather than a walked one, but SAR handhelds
    // export them interchangeably — accept them when no <trk> is present.
    if (!tracks.length) {
        for (const rte of findAll(doc, 'rte')) {
            const pts = gpxPoints(rte, 'rtept');
            tracks.push({
                name: textOf(childrenNamed(rte, 'name')[0]),
                coords: pts.coords,
                times: pts.times,
            });
        }
    }

    return finalize(tracks);
}

// KML ────────────────────────────────────────────────────────────────────────

/** `lon,lat[,ele]` tuples separated by whitespace. */
function kmlCoordinates(text: string): [number, number][] {
    const coords: [number, number][] = [];
    for (const token of text.trim().split(/\s+/)) {
        if (!token) continue;
        const parts = token.split(',');
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        if (isFiniteCoord(lng, lat)) coords.push([lng, lat]);
    }
    return coords;
}

export function parseKmlTracks(source: string): ParsedTrack[] {
    const doc = parseXml(source);
    const tracks: ParsedTrack[] = [];

    for (const placemark of findAll(doc, 'Placemark')) {
        const name = textOf(childrenNamed(placemark, 'name')[0]);

        // gx:Track — Google Earth's timestamped format: parallel <when> and
        // <gx:coord> ("lon lat ele", space-separated) children.
        const gxTracks = findAll(placemark, 'Track');
        for (const gx of gxTracks) {
            const whens = findAll(gx, 'when').map((n) => normalizeTime(textOf(n)));
            const coords: [number, number][] = [];
            for (const coord of findAll(gx, 'coord')) {
                const parts = textOf(coord).split(/\s+/);
                const lng = Number(parts[0]);
                const lat = Number(parts[1]);
                if (isFiniteCoord(lng, lat)) coords.push([lng, lat]);
            }
            tracks.push({ name, coords, times: whens });
        }

        const lines = findAll(placemark, 'LineString');
        lines.forEach((line, index) => {
            const coords = kmlCoordinates(textOf(childrenNamed(line, 'coordinates')[0]));
            tracks.push({
                name: lines.length > 1 && name ? `${name} (${index + 1})` : name,
                coords,
            });
        });
    }

    // Bare <LineString> outside any Placemark (some exporters do this).
    if (!tracks.length) {
        for (const line of findAll(doc, 'LineString')) {
            tracks.push({
                name: '',
                coords: kmlCoordinates(textOf(childrenNamed(line, 'coordinates')[0])),
            });
        }
    }

    return finalize(tracks);
}

// GeoJSON ────────────────────────────────────────────────────────────────────

function coordsFromArray(raw: unknown): [number, number][] {
    if (!Array.isArray(raw)) return [];
    const coords: [number, number][] = [];
    for (const point of raw) {
        if (!Array.isArray(point) || point.length < 2) continue;
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (isFiniteCoord(lng, lat)) coords.push([lng, lat]);
    }
    return coords;
}

function geoJsonName(props: Record<string, unknown> | undefined): string {
    for (const key of ['callsign', 'name', 'title', 'Name']) {
        const value = props?.[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

/**
 * `coordTimes` is the @tmcw/togeojson convention for GPX-derived timestamps and
 * is what CalTopo, Gaia, and most converters emit; `times` is accepted too.
 */
function geoJsonTimes(props: Record<string, unknown> | undefined): string[] | undefined {
    for (const key of ['coordTimes', 'times', 'timestamps']) {
        const value = props?.[key];
        if (Array.isArray(value)) return value.map((t) => normalizeTime(String(t)));
    }
    return undefined;
}

export function parseGeoJsonTracks(source: string): ParsedTrack[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        throw new Error('Not valid JSON');
    }

    const tracks: ParsedTrack[] = [];

    const addGeometry = (
        geometry: unknown,
        name: string,
        times: string[] | undefined,
    ): void => {
        if (!geometry || typeof geometry !== 'object') return;
        const geo = geometry as { type?: string; coordinates?: unknown; geometries?: unknown };
        if (geo.type === 'LineString') {
            const coords = coordsFromArray(geo.coordinates);
            tracks.push(times ? { name, coords, times } : { name, coords });
        } else if (geo.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
            geo.coordinates.forEach((line, index) => {
                tracks.push({
                    name: name && geo.coordinates && (geo.coordinates as unknown[]).length > 1
                        ? `${name} (${index + 1})`
                        : name,
                    coords: coordsFromArray(line),
                });
            });
        } else if (geo.type === 'GeometryCollection' && Array.isArray(geo.geometries)) {
            for (const inner of geo.geometries) addGeometry(inner, name, undefined);
        }
    };

    const addFeature = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        const feat = value as {
            type?: string;
            properties?: Record<string, unknown>;
            geometry?: unknown;
            features?: unknown;
        };
        if (feat.type === 'FeatureCollection' && Array.isArray(feat.features)) {
            for (const child of feat.features) addFeature(child);
            return;
        }
        if (feat.type === 'Feature') {
            addGeometry(feat.geometry, geoJsonName(feat.properties), geoJsonTimes(feat.properties));
            return;
        }
        addGeometry(feat, '', undefined);
    };

    addFeature(parsed);
    return finalize(tracks);
}

/**
 * Parse any accepted track file. Format is chosen by extension when it is
 * recognized and by sniffing the content otherwise, so a mislabelled export
 * (a `.json` holding KML, say) still loads.
 */
export function parseTrackFile(source: string, filename = ''): ParsedTrack[] {
    const lower = filename.toLowerCase();
    const head = source.slice(0, 4096).trimStart();

    if (lower.endsWith('.gpx') || /<gpx[\s>]/i.test(head)) return parseGpxTracks(source);
    if (lower.endsWith('.kml') || /<kml[\s>]/i.test(head)) return parseKmlTracks(source);
    if (lower.endsWith('.geojson') || lower.endsWith('.json') || head.startsWith('{') || head.startsWith('[')) {
        return parseGeoJsonTracks(source);
    }
    if (head.startsWith('<')) {
        // Unknown XML — try both readers before giving up.
        const gpx = parseGpxTracks(source);
        return gpx.length ? gpx : parseKmlTracks(source);
    }
    throw new Error('Unrecognized track file — expected GPX, KML, or GeoJSON');
}

// ── Naming and identity ──────────────────────────────────────────────────────

/**
 * Display name for the published CoT. The map shows the callsign, so it has to
 * say who walked it and where without opening anything:
 * `TRK OP2 · 05 · Team 3`, falling back to the source's own name.
 */
export function trackLogCallsign(input: {
    opNumber: number;
    segmentLabel?: string;
    resource?: string;
    sourceName?: string;
    /** 1-based index when one file yields several tracks. */
    index?: number;
    total?: number;
}): string {
    const parts = [`TRK OP${input.opNumber}`];
    if (input.segmentLabel?.trim()) parts.push(input.segmentLabel.trim());
    const who = input.resource?.trim() || input.sourceName?.trim();
    if (who) parts.push(who);
    let name = parts.join(' · ');
    if ((input.total ?? 1) > 1) name += ` (${input.index ?? 1})`;
    return name;
}

/**
 * Stable identity for a debrief record within the schema array.
 *
 * DebriefRecords have never carried an id, and adding one would not help the
 * records already written on live incidents — so the key is derived from the
 * fields that together identify one completed assignment. Two identical
 * debriefs (same OP, segment, resource, and timestamp) are indistinguishable,
 * which is correct: they would be the same search.
 */
export function debriefKey(record: DebriefRecord): string {
    return [
        record.opNumber,
        record.segmentUid,
        record.resource ?? '',
        record.recordedAt ?? '',
    ].join('|');
}

/** Append a track to a record's list, replacing any entry with the same uid. */
export function withTrack(record: DebriefRecord, track: TrackLogRef): DebriefRecord {
    const existing = (record.tracks ?? []).filter((t) => t.uid !== track.uid);
    return { ...record, tracks: [...existing, track] };
}

/** Remove a track by uid. Drops the key entirely when none remain. */
export function withoutTrack(record: DebriefRecord, uid: string): DebriefRecord {
    const remaining = (record.tracks ?? []).filter((t) => t.uid !== uid);
    const next = { ...record };
    if (remaining.length) next.tracks = remaining;
    else delete next.tracks;
    return next;
}

/** Every track uid referenced by any debrief — used to hide already-filed lines. */
export function referencedTrackUids(records: DebriefRecord[]): Set<string> {
    const uids = new Set<string>();
    for (const record of records) {
        for (const track of record.tracks ?? []) uids.add(track.uid);
    }
    return uids;
}

/** Total miles walked in an OP, across every attached track. */
export function trackMilesForOp(records: DebriefRecord[], opNumber: number): number {
    let total = 0;
    for (const record of records) {
        if (record.opNumber !== opNumber) continue;
        for (const track of record.tracks ?? []) total += track.lengthMi || 0;
    }
    return Math.round(total * 100) / 100;
}
