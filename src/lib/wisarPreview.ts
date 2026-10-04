/**
 * Temporary map preview of WiSAR contours (decision 12): one GeoJSON source
 * with a fill and an outline layer, styled from each contour's simplestyle
 * properties. Nothing is written to the mission. Takes any MapLibre-like map
 * so it can be tested without CloudTAK.
 *
 * Each results panel passes its own source id (previewSourceId), so the
 * Physical – WiSAR card and the WiSAR Tools pane keep separate previews and
 * one panel's Show / Hide never touches the other's (Paul, 2026-10-04).
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

let nextPreview = 0;

/** A new, unique preview source id for one results panel. */
export function previewSourceId(): string {
    nextPreview += 1;
    return `${PREVIEW_SOURCE}-${nextPreview}`;
}

function layerIds(source: string): { fill: string; line: string } {
    return { fill: `${source}-fill`, line: `${source}-line` };
}

export function clearPreview(map: PreviewMap, source = PREVIEW_SOURCE): void {
    const ids = layerIds(source);
    for (const id of [ids.line, ids.fill]) {
        if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(source)) map.removeSource(source);
}

export function showPreview(map: PreviewMap, fc: ContourCollection, opts: { fit?: boolean; source?: string } = {}): void {
    const source = opts.source ?? PREVIEW_SOURCE;
    const ids = layerIds(source);
    clearPreview(map, source);
    map.addSource(source, { type: 'geojson', data: fc });
    map.addLayer({
        id: ids.fill,
        type: 'fill',
        source,
        paint: {
            'fill-color': ['coalesce', ['get', 'fill'], ['get', 'color'], '#00bcd4'],
            'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.1],
        },
    });
    map.addLayer({
        id: ids.line,
        type: 'line',
        source,
        paint: {
            'line-color': ['coalesce', ['get', 'stroke'], ['get', 'color'], '#00bcd4'],
            'line-width': ['coalesce', ['get', 'stroke-width'], 3],
        },
    });
    const b = opts.fit === false ? null : contourBounds(fc);
    if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 600 });
}
