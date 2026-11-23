/**
 * Address geocoding for CAD calls with no Address LL(...) (#50): the pure
 * parts, kept apart from the API calls so they can be tested.
 */

import type { LatLng } from './coords.ts';

/** A geocoded address: where it is and what the search matched. */
export interface GeocodeMatch extends LatLng {
    /** The address as the search provider matched it. */
    matched: string;
}

/**
 * The text to geocode from a CAD call's labelled fields: the Address line
 * (without any LL(...) prefix or leading "EST"), else the cross streets.
 * Empty when the call has neither.
 */
export function cadGeocodeQuery(fields: Record<string, string>): string {
    const address = (fields.Address ?? '').split('\n')[0]
        .replace(/^LL\s*\([^)]*\)\s*:?\s*/i, '')
        .replace(/^EST\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (address) return address;
    const x1 = (fields['Xstreet 1'] ?? '').trim();
    const x2 = (fields['Xstreet 2'] ?? '').trim();
    if (x1 && x2) return `${x1} & ${x2}`;
    return x1 || x2;
}

/** One `/api/search/forward` result, as far as this module reads it. */
export interface ForwardItem {
    address?: string;
    location?: { x?: number; y?: number };
    attributes?: { LongLabel?: string; ShortLabel?: string };
}

/** The first forward result with usable coordinates, or null. */
export function pickForwardMatch(items: ForwardItem[] | undefined, fallbackLabel: string): GeocodeMatch | null {
    for (const item of items ?? []) {
        const lng = item.location?.x;
        const lat = item.location?.y;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
        const matched = item.attributes?.LongLabel || item.address || item.attributes?.ShortLabel || fallbackLabel;
        return { lat, lng, matched };
    }
    return null;
}

/** "lat, lng" to 5 places, the form the Create Mission coordinates field takes. */
export function formatMatchCoords(match: LatLng): string {
    return `${match.lat.toFixed(5)}, ${match.lng.toFixed(5)}`;
}
