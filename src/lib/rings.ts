/**
 * Geodesic circle/ring helpers for LPB search-area generation.
 * Pure functions — no host dependency.
 */

export const MILES_TO_METERS = 1609.344;

export function milesToMeters(mi: number): number {
    return mi * MILES_TO_METERS;
}

/**
 * Generate a closed ring of [lng, lat] points approximating a circle of the
 * given radius (meters) around a center, using the spherical destination-point
 * formula. Returns steps+1 points (first == last).
 */
export function circleRing(
    centerLng: number,
    centerLat: number,
    radiusMeters: number,
    steps = 64
): [number, number][] {
    const R = 6371000; // mean earth radius, meters
    const lat = (centerLat * Math.PI) / 180;
    const lng = (centerLng * Math.PI) / 180;
    const d = radiusMeters / R; // angular distance

    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
        const brng = (i / steps) * 2 * Math.PI;
        const lat2 = Math.asin(
            Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(brng)
        );
        const lng2 = lng + Math.atan2(
            Math.sin(brng) * Math.sin(d) * Math.cos(lat),
            Math.cos(d) - Math.sin(lat) * Math.sin(lat2)
        );
        coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
    }
    return coords;
}
