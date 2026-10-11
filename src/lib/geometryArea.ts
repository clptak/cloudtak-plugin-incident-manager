/**
 * Polygon area helpers. CloudTAK core computes CoT area on demand with
 * @turf/area (m², see core PolygonArea.vue); this converts to square miles.
 */
import { area } from '@turf/area';

const SQ_METERS_PER_SQ_MILE = 2_589_988.110336;

/**
 * Area of a Polygon / MultiPolygon geometry in square miles.
 * Returns undefined for other geometry types (points, lines).
 */
export function areaSqMi(geometry: unknown): number | undefined {
    const geom = geometry as { type?: string } | null | undefined;
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return undefined;
    try {
        return area(geom as Parameters<typeof area>[0]) / SQ_METERS_PER_SQ_MILE;
    } catch {
        return undefined;
    }
}

/** Format a square-mile value: 2 decimals, 3 for small areas so they don't show as 0.00. */
export function formatSqMi(value: number | undefined): string {
    if (value === undefined || !Number.isFinite(value)) return '—';
    return value < 0.1 ? value.toFixed(3) : value.toFixed(2);
}
