/**
 * Pure IPP display / parse helpers — no CloudTAK host imports.
 */

export type IppKind = 'LKP' | 'PLS';

export const SEARCH_AREA_KEYWORD = 'search-area';
export const IPP_AREA_KEY = 'ipp';
export const IPP_ICON = '83198b4872a8c34eb9c549da8a4de5a28f07821185b39a2277948f66c24ac17a/Wildfire/Fire Origin.png';
export const IPP_TYPE_OPTIONS = ['LKP — Last Known Position', 'PLS — Point Last Seen'];

export function ippTypeFromLabel(label: string): IppKind {
    return label === IPP_TYPE_OPTIONS[1] ? 'PLS' : 'LKP';
}

export function ippTypeToLabel(type: IppKind): string {
    return type === 'PLS' ? IPP_TYPE_OPTIONS[1] : IPP_TYPE_OPTIONS[0];
}

export function pointCoordsFromFeature(f: { geometry?: unknown; properties?: unknown }): [number, number] | undefined {
    const geom = (f.geometry ?? {}) as { type?: string; coordinates?: unknown };
    if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        const lng = Number(geom.coordinates[0]);
        const lat = Number(geom.coordinates[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    const center = (f.properties as { center?: unknown } | undefined)?.center;
    if (Array.isArray(center) && center.length >= 2) {
        const lng = Number(center[0]);
        const lat = Number(center[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    return undefined;
}

/** `coords` is [lng, lat]. */
export function formatIppSummary(coords: [number, number], type: IppKind): string {
    return `Plotting around IPP (${type}) at ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}.`;
}
