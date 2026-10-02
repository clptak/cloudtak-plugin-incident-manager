/**
 * Pure helpers for WiSAR results: DataSync naming (decision 5), contour →
 * single TAK ring, preview bounds, raw-data labels. No CloudTAK imports.
 */
import type { ContourCollection, ContourFeature, Job, OutputName } from './wisar.ts';

export type Ring = [number, number][];

/** Area-log key prefixes for rings posted from WiSAR jobs. */
export const TT_AREA_PREFIX = 'wisar-tt';
export const TARR_AREA_PREFIX = 'wisar-tarr';

/** Raw-data download labels, in display order (as in the web tool). */
export const OUTPUT_LABELS: readonly { name: OutputName; label: string }[] = [
    { name: 'contours.geojson', label: 'Contours (GeoJSON)' },
    { name: 'contours.kml', label: 'Contours (KML)' },
    { name: 'cost-distance.tif', label: 'Cost-Distance GeoTIFF' },
    { name: 'cost-surface.tif', label: 'Cost Surface GeoTIFF' },
    { name: 'attractor-score.tif', label: 'Terrain Attractor Score GeoTIFF' },
    { name: 'probability.tif', label: 'Probability GeoTIFF' },
];

/** DataSync folder for posted Travel Time rings (Paul, 2026-10-01); repeats get " (2)", " (3)"… */
export const TT_FOLDER_NAME = 'WiSAR Distance Traveled';

/** Where "Add to DataSync" posts: the incident's active DataSync, or its MGMT (planning) DataSync. */
export type DataSyncTarget = 'active' | 'mgmt';

function trimNumber(n: number): string {
    return String(Math.round(n * 100) / 100);
}

/**
 * Category and source label for a TARR job, read back from the request the
 * TARR form built: a listed subject is Koester; custom names end in
 * "(AZ)", "(AZ, edited)" or "(edited)" (Koester values edited).
 */
export function tarrNaming(job: Pick<Job, 'request'>): { category: string; source: 'AZ' | 'Koester' } {
    const subject = (job.request as { subject?: { kind?: string; category?: string; name?: string } }).subject;
    if (subject?.kind === 'listed') return { category: subject.category ?? 'TARR', source: 'Koester' };
    const name = subject?.name ?? 'TARR';
    const m = /^(.*?)\s*\((AZ(?:, edited)?|edited)\)$/.exec(name);
    if (!m) return { category: name, source: 'AZ' };
    return { category: m[1], source: m[2].startsWith('AZ') ? 'AZ' : 'Koester' };
}

/** "AZ LPB Search-Hiker WiSAR" (Paul, 2026-10-01); Koester profiles: "Koester LPB Hiker WiSAR". */
export function tarrFolderName(job: Pick<Job, 'request'>): string {
    const n = tarrNaming(job);
    return `${n.source} LPB ${n.category} WiSAR`;
}

export const METERS_PER_MILE = 1609.344;

/**
 * "25% - 0.80mi - Search-Hiker" (Paul, 2026-10-01): the ring's applied
 * (calibrated) distance in miles, 2 decimals. To label with the table/profile
 * distance instead, see wisar-tarr-ring-labels.md at the repo root.
 */
export function tarrCallsign(percentile: string, thresholdM: number, category: string): string {
    return `${percentile} - ${(thresholdM / METERS_PER_MILE).toFixed(2)}mi - ${category}`;
}

/** Short label for a contour in the results key: "25%" or "2h". */
export function contourLabel(f: ContourFeature): string {
    return f.properties.percentile ?? f.properties.label ?? f.properties.callsign;
}

/** Folder base name, ring name and log prefix for one contour of a job. */
export function ringNaming(job: Pick<Job, 'type' | 'request'>, f: ContourFeature): { folder: string; callsign: string; areaPrefix: string; areaId: string } {
    if (job.type === 'tarr') {
        const pct = f.properties.percentile ?? '';
        return {
            folder: tarrFolderName(job),
            callsign: tarrCallsign(pct, f.properties.threshold_m, tarrNaming(job).category),
            areaPrefix: TARR_AREA_PREFIX,
            areaId: pct.replace('%', ''),
        };
    }
    const hours = f.properties.hours ?? 0;
    return { folder: TT_FOLDER_NAME, callsign: travelTimeCallsign(hours), areaPrefix: TT_AREA_PREFIX, areaId: String(hours) };
}

/** "2h Travel Time" */
export function travelTimeCallsign(hours: number): string {
    return `${trimNumber(hours)}h Travel Time`;
}

/** Next free name: base, base (2), base (3), … (same rule as the LPB folders). */
export function uniqueName(base: string, taken: Iterable<string>): string {
    const names = taken instanceof Set ? taken : new Set(taken);
    if (!names.has(base)) return base;
    let n = 2;
    while (names.has(`${base} (${n})`)) n += 1;
    return `${base} (${n})`;
}

function ringArea(ring: Ring): number {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return Math.abs(a / 2);
}

/**
 * The contour's main outline: the outer ring of its largest polygon. A TAK
 * shape is one outline, so holes and detached islands are not carried over.
 * Returns null for anything that isn't a usable Polygon/MultiPolygon.
 */
export function mainOutline(geometry: ContourFeature['geometry']): { ring: Ring; parts: number; holes: number } | null {
    const polys: Ring[][] = geometry.type === 'Polygon'
        ? [geometry.coordinates as Ring[]]
        : geometry.type === 'MultiPolygon' ? geometry.coordinates as Ring[][] : [];
    let best: Ring | null = null;
    let bestArea = -1;
    let holes = 0;
    for (const poly of polys) {
        if (!Array.isArray(poly) || !poly.length) continue;
        holes += Math.max(0, poly.length - 1);
        const outer = poly[0];
        if (!Array.isArray(outer) || outer.length < 4) continue;
        const area = ringArea(outer);
        if (area > bestArea) {
            best = outer;
            bestArea = area;
        }
    }
    return best ? { ring: best.map(([x, y]) => [x, y] as [number, number]), parts: polys.length, holes } : null;
}

function perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function dp(points: Ring, tol: number): Ring {
    if (points.length < 3) return points.slice();
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length) {
        const [s, e] = stack.pop() as [number, number];
        let idx = -1;
        let max = tol;
        for (let i = s + 1; i < e; i++) {
            const d = perpDist(points[i], points[s], points[e]);
            if (d > max) {
                max = d;
                idx = i;
            }
        }
        if (idx > 0) {
            keep[idx] = 1;
            stack.push([s, idx], [idx, e]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

/**
 * Douglas-Peucker on a closed ring (tolerance in degrees). Removes the
 * raster stair-steps without visibly changing the line. Always returns a
 * closed ring of at least 4 points.
 */
export function simplifyRing(ring: Ring, tolDeg = 0.00005): Ring {
    if (ring.length <= 4) return ring.slice();
    const open = ring.slice(0, -1);
    // Split at the point farthest from the first so both halves are open polylines.
    let far = 1;
    let farD = -1;
    for (let i = 1; i < open.length; i++) {
        const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
        if (d > farD) {
            farD = d;
            far = i;
        }
    }
    const a = dp(open.slice(0, far + 1), tolDeg);
    const b = dp([...open.slice(far), open[0]], tolDeg);
    const out = [...a, ...b.slice(1)];
    return out.length >= 4 ? out : ring.slice();
}

/** [west, south, east, north] of every contour, or null. */
export function contourBounds(fc: ContourCollection): [number, number, number, number] | null {
    let w = Infinity;
    let s = Infinity;
    let e = -Infinity;
    let n = -Infinity;
    const visit = (c: unknown): void => {
        if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
            w = Math.min(w, c[0]); e = Math.max(e, c[0]);
            s = Math.min(s, c[1]); n = Math.max(n, c[1]);
        } else if (Array.isArray(c)) {
            c.forEach(visit);
        }
    };
    for (const f of fc.features) visit(f.geometry?.coordinates);
    return Number.isFinite(w) ? [w, s, e, n] : null;
}

/** Stable id for a contour within one job: its hours (travel time) or threshold. */
export function contourKey(f: ContourFeature): string {
    return String(f.properties.hours ?? f.properties.threshold_m);
}

/** The collection limited to the chosen contours. */
export function selectContours(fc: ContourCollection, keys: ReadonlySet<string>): ContourCollection {
    return { type: 'FeatureCollection', features: fc.features.filter((f) => keys.has(contourKey(f))) };
}

/** Contours sorted by time (or threshold), inner first. */
export function sortedContours(fc: ContourCollection): ContourFeature[] {
    return [...fc.features].sort((a, b) => (a.properties.hours ?? a.properties.threshold_m)
        - (b.properties.hours ?? b.properties.threshold_m));
}
