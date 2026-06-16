import Subscription from '../../../../src/base/subscription.ts';
import type { Feature } from '../../../../src/types.ts';
import { parseCoordinates } from './coords.ts';

const SEARCH_AREA_KEYWORD = 'search-area';
const IPP_AREA_KEY = 'ipp';

function kwValue(keywords: string[] | undefined, prefix: string): string {
    const tag = keywords?.find((k) => k.startsWith(prefix));
    return tag ? tag.slice(prefix.length) : '';
}

function formatLatLng(lat: number, lng: number): string {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function pointCoords(f: Feature): [number, number] | null {
    const geom = f.geometry as { type?: string; coordinates?: number[] } | undefined;
    if (geom?.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        return [geom.coordinates[0], geom.coordinates[1]];
    }
    return null;
}

/**
 * Resolve incident location from the mission IPP on DataSync:
 * search-area IPP marker, any IPP-* point feature, then mission coords: keyword.
 */
export async function resolveMissionIppLocation(
    missionGuid: string,
    missionToken?: string,
): Promise<string> {
    const sub = await Subscription.load(missionGuid, {
        token: missionToken ?? '',
    });

    const feats = await sub.feature.list({ refresh: true });
    const logs = await sub.log.list({ refresh: true });

    let ippUid = '';
    for (const log of logs) {
        if (!log.keywords?.includes(SEARCH_AREA_KEYWORD)) continue;
        if (kwValue(log.keywords, 'area:') !== IPP_AREA_KEY) continue;
        const uid = kwValue(log.keywords, 'uid:');
        if (uid) ippUid = uid;
    }

    if (ippUid) {
        const feat = feats.find((f: Feature) => String(f.id) === ippUid);
        const coords = feat ? pointCoords(feat) : null;
        if (coords) return formatLatLng(coords[1], coords[0]);
    }

    for (const f of feats) {
        const props = (f.properties ?? {}) as { callsign?: string };
        const callsign = props.callsign || '';
        if (!/^IPP-/i.test(callsign)) continue;
        const coords = pointCoords(f);
        if (coords) return formatLatLng(coords[1], coords[0]);
    }

    const coordsKw = sub.meta.keywords?.find((k) => k.startsWith('coords:'));
    if (coordsKw) {
        const parsed = parseCoordinates(coordsKw.slice('coords:'.length));
        if (parsed) return formatLatLng(parsed.lat, parsed.lng);
    }

    return '';
}
