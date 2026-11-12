/**
 * Framing rules for printed maps (#28): the ICS-201 Map/Sketch takes the
 * current map view trimmed to the box; each ICS-204 map centres its segment
 * and reaches out far enough to show the segments touching it.
 *
 * Positions are MapLibre web-mercator: a world 512 px wide at zoom 0.
 */

export type LngLat = [number, number];

export interface PrintView {
    center: LngLat;
    zoom: number;
}

const TILE = 512;
const EARTH_CIRCUMFERENCE_M = 40075016.686;

// ── Geometry ───────────────────────────────────────────────────────────────

const isPos = (p: unknown): p is LngLat => Array.isArray(p)
    && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** Rings of a Polygon / MultiPolygon, the path of a LineString, a Point as one vertex. */
export function ringsOf(geometry: { type?: string; coordinates?: unknown } | null | undefined): LngLat[][] {
    const c = geometry?.coordinates;
    if (!Array.isArray(c)) return [];
    const clean = (ring: unknown): LngLat[] => (Array.isArray(ring) ? ring.filter(isPos).map((p) => [p[0], p[1]] as LngLat) : []);
    let rings: LngLat[][];
    switch (geometry?.type) {
        case 'Point': rings = isPos(c) ? [[[c[0], c[1]]]] : []; break;
        case 'LineString': rings = [clean(c)]; break;
        case 'MultiLineString':
        case 'Polygon': rings = c.map(clean); break;
        case 'MultiPolygon': rings = c.flatMap((poly) => (Array.isArray(poly) ? poly.map(clean) : [])); break;
        default: rings = [];
    }
    return rings.filter((r) => r.length);
}

export function mercX(lng: number): number {
    return (lng + 180) / 360;
}

export function mercY(lat: number): number {
    const s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

function lngOf(x: number): number {
    return x * 360 - 180;
}

function latOf(y: number): number {
    return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
}

/** Metres on the ground per CSS pixel at a latitude and zoom. */
export function metersPerPixel(lat: number, zoom: number): number {
    return EARTH_CIRCUMFERENCE_M * Math.cos(lat * Math.PI / 180) / (TILE * 2 ** zoom);
}

/** Flat metres around a reference latitude: good enough for "do these touch". */
function toMeters(p: LngLat, lat0: number): [number, number] {
    const k = EARTH_CIRCUMFERENCE_M / 360;
    return [p[0] * k * Math.cos(lat0 * Math.PI / 180), p[1] * k];
}

function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function insideRing(p: [number, number], ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function edgesOf(ring: [number, number][]): [[number, number], [number, number]][] {
    if (ring.length === 1) return [[ring[0], ring[0]]];
    const edges: [[number, number], [number, number]][] = [];
    for (let i = 1; i < ring.length; i++) edges.push([ring[i - 1], ring[i]]);
    return edges;
}

/** One shape's vertex lies on, near or inside the other. */
function reaches(a: [number, number][][], b: [number, number][][], tolM: number): boolean {
    const bEdges = b.flatMap(edgesOf);
    const bAreas = b.filter((r) => r.length >= 3);
    return a.some((ring) => ring.some((p) => bEdges.some(([s, e]) => distToSegment(p, s, e) <= tolM)
        || bAreas.some((r) => insideRing(p, r))));
}

/**
 * Two shapes touch when they share a border or corner (within `tolM`
 * metres, since hand-drawn segments rarely snap exactly) or overlap.
 */
export function shapesTouch(a: LngLat[][], b: LngLat[][], tolM = 30): boolean {
    const all = [...a, ...b].flat();
    if (!all.length || !a.length || !b.length) return false;
    const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
    const am = a.map((r) => r.map((p) => toMeters(p, lat0)));
    const bm = b.map((r) => r.map((p) => toMeters(p, lat0)));
    return reaches(am, bm, tolM) || reaches(bm, am, tolM);
}

export interface ShapeRef {
    id: string;
    rings: LngLat[][];
}

/** The candidates touching the target: "one more segment in any direction there is one". */
export function neighbours(target: LngLat[][], candidates: ShapeRef[], targetId = '', tolM = 30): ShapeRef[] {
    return candidates.filter((c) => c.id !== targetId && shapesTouch(target, c.rings, tolM));
}

// ── Framing ────────────────────────────────────────────────────────────────

interface MercBox { x0: number; y0: number; x1: number; y1: number }

function mercBox(shapes: LngLat[][][]): MercBox | null {
    const pts = shapes.flat(2);
    if (!pts.length) return null;
    const xs = pts.map((p) => mercX(p[0]));
    const ys = pts.map((p) => mercY(p[1]));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Smallest span a frame may have (≈ a few hundred metres), so a point or tiny segment isn't zoomed to the street. */
const MIN_HALF_SPAN = 1e-5;

/**
 * Half-extents of a frame centred on the target's middle that holds the
 * target and every neighbour, before fitting to a page shape.
 */
function halfSpans(target: LngLat[][], include: LngLat[][][]): { cx: number; cy: number; hx: number; hy: number } | null {
    const t = mercBox([target]);
    if (!t) return null;
    const cx = (t.x0 + t.x1) / 2;
    const cy = (t.y0 + t.y1) / 2;
    const all = mercBox([target, ...include]) as MercBox;
    const hx = Math.max(cx - all.x0, all.x1 - cx, MIN_HALF_SPAN);
    const hy = Math.max(cy - all.y0, all.y1 - cy, MIN_HALF_SPAN);
    return { cx, cy, hx, hy };
}

/** Width ÷ height of the centred frame, to choose portrait or landscape. */
export function naturalAspect(target: LngLat[][], include: LngLat[][][] = []): number {
    const s = halfSpans(target, include);
    return s ? s.hx / s.hy : 1;
}

/**
 * Centre on the target and zoom so the target and its neighbours fit an
 * output `widthPx × heightPx`, with `pad` (fraction) of breathing room.
 */
export function centredView(
    target: LngLat[][],
    include: LngLat[][][],
    widthPx: number,
    heightPx: number,
    pad = 0.08,
): PrintView | null {
    const s = halfSpans(target, include);
    if (!s || widthPx <= 0 || heightPx <= 0) return null;
    const hx = Math.max(s.hx, s.hy * (widthPx / heightPx)) * (1 + pad);
    const zoom = Math.log2(widthPx / (2 * hx * TILE));
    return { center: [lngOf(s.cx), latOf(s.cy)], zoom };
}

/**
 * The live view trimmed to an output shape: same centre, zoomed in just
 * enough that the output shows nothing outside what is on screen now.
 */
export function trimmedView(
    center: LngLat,
    liveZoom: number,
    liveWidthPx: number,
    liveHeightPx: number,
    widthPx: number,
    heightPx: number,
): PrintView {
    const grow = Math.max(widthPx / Math.max(1, liveWidthPx), heightPx / Math.max(1, liveHeightPx));
    return { center, zoom: liveZoom + Math.log2(grow) };
}

// ── Scale bar ──────────────────────────────────────────────────────────────

export interface ScaleBar {
    /** Bar length in the same unit as `maxLength`. */
    length: number;
    label: string;
}

const FEET = [50, 100, 200, 250, 500, 1000];
const MILES = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
const M_PER_FT = 0.3048;
const M_PER_MI = 1609.344;

/** The longest round US distance (ft below a quarter mile, else mi) that fits `maxLength`. */
export function scaleBar(metersPerUnit: number, maxLength: number): ScaleBar | null {
    if (!(metersPerUnit > 0) || !(maxLength > 0)) return null;
    const options = [
        ...FEET.map((ft) => ({ m: ft * M_PER_FT, label: `${ft.toLocaleString('en-US')} ft` })),
        ...MILES.map((mi) => ({ m: mi * M_PER_MI, label: `${mi} mi` })),
    ];
    const fit = options.filter((o) => o.m / metersPerUnit <= maxLength);
    const best = fit[fit.length - 1];
    return best ? { length: best.m / metersPerUnit, label: best.label } : null;
}

/** CSS pixels per PDF point: maps are laid out at screen size (96 dpi) on a 72 pt inch. */
export const PX_PER_PT = 96 / 72;
