/**
 * Temporary map preview of WiSAR contours (decision 12): one GeoJSON source
 * with a fill and an outline layer, styled from each contour's simplestyle
 * properties. Nothing is written to the mission. Takes any MapLibre-like map
 * so it can be tested without CloudTAK.
 */
import type { ContourCollection } from './wisar.ts';
import { contourBounds } from './wisarResults.ts';

export const PREVIEW_SOURCE = 'im-wisar-preview';
export const PREVIEW_FILL = `${PREVIEW_SOURCE}-fill`;
export const PREVIEW_LINE = `${PREVIEW_SOURCE}-line`;

export interface PreviewMap {
    getSource(id: string): unknown;
    addSource(id: string, source: Record<string, unknown>): unknown;
    removeSource(id: string): unknown;
    getLayer(id: string): unknown;
    addLayer(layer: Record<string, unknown>): unknown;
    removeLayer(id: string): unknown;
    fitBounds(bounds: [[number, number], [number, number]], opts?: Record<string, unknown>): unknown;
}

export function clearPreview(map: PreviewMap): void {
    for (const id of [PREVIEW_LINE, PREVIEW_FILL]) {
        if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(PREVIEW_SOURCE)) map.removeSource(PREVIEW_SOURCE);
}

export function showPreview(map: PreviewMap, fc: ContourCollection, opts: { fit?: boolean } = {}): void {
    clearPreview(map);
    map.addSource(PREVIEW_SOURCE, { type: 'geojson', data: fc });
    map.addLayer({
        id: PREVIEW_FILL,
        type: 'fill',
        source: PREVIEW_SOURCE,
        paint: {
            'fill-color': ['coalesce', ['get', 'fill'], ['get', 'color'], '#00bcd4'],
            'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.1],
        },
    });
    map.addLayer({
        id: PREVIEW_LINE,
        type: 'line',
        source: PREVIEW_SOURCE,
        paint: {
            'line-color': ['coalesce', ['get', 'stroke'], ['get', 'color'], '#00bcd4'],
            'line-width': ['coalesce', ['get', 'stroke-width'], 3],
        },
    });
    const b = opts.fit === false ? null : contourBounds(fc);
    if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 600 });
}
