/**
 * Geocode an address with CloudTAK's configured search provider (#50):
 * `/api/search/suggest` for the best candidate, then `/api/search/forward`
 * with its magicKey for the point - the same two calls the map's search box
 * makes. Biased toward the current map center when the map is loaded.
 */

import { server } from '../../../../src/std.ts';
import { useMapStore } from '../../../../src/stores/map.ts';
import { pickForwardMatch, type ForwardItem, type GeocodeMatch } from './cadGeocode.ts';

function mapCenter(): { longitude: number; latitude: number } | Record<string, never> {
    try {
        const map = useMapStore().map as unknown as { getCenter(): { lng: number; lat: number } } | undefined;
        const c = map?.getCenter();
        return c ? { longitude: c.lng, latitude: c.lat } : {};
    } catch {
        return {};
    }
}

/** The best match for `address`, or null when there is none. Throws on a failed request. */
export async function geocodeAddress(address: string): Promise<GeocodeMatch | null> {
    const query = address.trim();
    if (!query) return null;
    const near = mapCenter();

    // With no provider set up the search just returns nothing; say why instead.
    const cfg = await server.GET('/api/search', {});
    if (cfg.error) throw new Error(`Address search failed: ${String(cfg.error.message ?? cfg.error)}`);
    if (!cfg.data?.forward?.enabled) {
        throw new Error('CloudTAK has no address search set up (Admin → Search: ArcGIS or OpenStreetMap), so the address could not be placed.');
    }

    const suggest = await server.GET('/api/search/suggest', {
        params: { query: { query, limit: 1, ...near } },
    });
    if (suggest.error) throw new Error(`Address search failed: ${String(suggest.error.message ?? suggest.error)}`);
    const best = suggest.data?.items?.[0];
    if (!best) return null;

    const forward = await server.GET('/api/search/forward', {
        params: { query: { query: best.text, magicKey: best.magicKey, ...near } },
    });
    if (forward.error) throw new Error(`Address search failed: ${String(forward.error.message ?? forward.error)}`);
    return pickForwardMatch(forward.data?.items as ForwardItem[] | undefined, best.text);
}
