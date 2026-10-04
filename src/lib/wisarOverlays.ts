/**
 * Temporary map preview of WiSAR's colored overlays (item 5, Paul
 * 2026-10-04): a PNG from the job (overlay-*.png, fetched with the CloudTAK
 * token) drawn as a MapLibre image source over the overlay's bounds, at the
 * web tool's 60% opacity. Nothing is written to the mission or the profile.
 * Takes any MapLibre-like map so it can be tested without CloudTAK.
 */
import type { Bounds } from './wisar.ts';

/** The web tool's L.imageOverlay opacity for its raster layers. */
export const OVERLAY_OPACITY = 0.6;

export interface OverlayMap {
    getSource(id: string): unknown;
    addSource(id: string, source: Record<string, unknown>): unknown;
    removeSource(id: string): unknown;
    getLayer(id: string): unknown;
    addLayer(layer: Record<string, unknown>, beforeId?: string): unknown;
    removeLayer(id: string): unknown;
}

/** One map source per results panel and overlay. */
export function overlaySourceId(panelSource: string, overlayId: string): string {
    return `${panelSource}-overlay-${overlayId}`;
}

/** Corners in MapLibre image-source order: top-left, top-right, bottom-right, bottom-left. */
export function imageCoordinates(b: Bounds): [number, number][] {
    return [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
}

export function clearOverlay(map: OverlayMap, source: string): void {
    const layer = `${source}-raster`;
    if (map.getLayer(layer)) map.removeLayer(layer);
    if (map.getSource(source)) map.removeSource(source);
}

/**
 * Draw `url` (a PNG; a blob: URL from the authenticated download) over
 * `bounds`. Placed under `beforeId` when that layer exists, so the panel's
 * contour preview stays on top of the raster.
 */
export function showOverlay(
    map: OverlayMap,
    source: string,
    url: string,
    bounds: Bounds,
    opts: { opacity?: number; beforeId?: string } = {},
): void {
    clearOverlay(map, source);
    map.addSource(source, { type: 'image', url, coordinates: imageCoordinates(bounds) });
    const before = opts.beforeId && map.getLayer(opts.beforeId) ? opts.beforeId : undefined;
    map.addLayer({
        id: `${source}-raster`,
        type: 'raster',
        source,
        paint: { 'raster-opacity': opts.opacity ?? OVERLAY_OPACITY, 'raster-fade-duration': 0 },
    }, before);
}
