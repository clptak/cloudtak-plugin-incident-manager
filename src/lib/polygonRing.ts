/**
 * Outer-ring helpers for Polygon / MultiPolygon CoT geometries (search segments, ROW).
 */

/** Extract the outer ring from a Polygon or MultiPolygon geometry. */
export function ringFromGeometry(geometry: unknown): [number, number][] | null {
    const geom = geometry as { type?: string; coordinates?: unknown };
    const coords = geom?.type === 'Polygon' ? geom.coordinates
        : geom?.type === 'MultiPolygon' && Array.isArray(geom.coordinates) ? (geom.coordinates as unknown[])[0]
            : null;
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
    const ring: [number, number][] = [];
    for (const point of coords[0] as unknown[]) {
        if (!Array.isArray(point) || point.length < 2) return null;
        ring.push([Number(point[0]), Number(point[1])]);
    }
    return ring.length >= 4 ? ring : null;
}

export function ringCentroid(ring: [number, number][]): [number, number] {
    let lon = 0; let lat = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return [lon / ring.length, lat / ring.length];
}
