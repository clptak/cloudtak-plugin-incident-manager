/**
 * Runtime integration contract with the separate `caltopo-sync` plugin.
 *
 * CloudTAK plugins load independently (Vite import.meta.glob) and there is no
 * host event bus, so two plugin repos cannot import each other cleanly. Instead
 * we use a loose runtime registry on `window`: the caltopo-sync plugin is
 * expected to publish a provider, and this plugin calls it if present.
 *
 * caltopo-sync should, in its enable(), do something like:
 *
 *   window.__cloudtakCaltopo = {
 *     async createMap(req) { ... returns { mapId, url } ... }
 *   };
 *
 * If the provider is absent (plugin not installed / not enabled), createCaltopoMap
 * resolves to null and the caller treats Caltopo creation as skipped.
 */

export interface CaltopoCreateRequest {
    /** TAK mission name (DataSync) this map is paired with */
    missionName: string;
    /** TAK mission GUID, for back-reference / pairing storage */
    missionGuid: string;
    /** Optional human title for the Caltopo map (defaults to missionName) */
    title?: string;
    /** Optional center, decimal degrees */
    lat?: number;
    lng?: number;
}

export interface CaltopoCreateResult {
    mapId: string;
    url?: string;
}

export interface CaltopoProvider {
    createMap(req: CaltopoCreateRequest): Promise<CaltopoCreateResult>;
}

declare global {
    interface Window {
        __cloudtakCaltopo?: CaltopoProvider;
    }
}

export function caltopoAvailable(): boolean {
    return typeof window !== 'undefined'
        && !!window.__cloudtakCaltopo
        && typeof window.__cloudtakCaltopo.createMap === 'function';
}

/**
 * Ask the caltopo-sync plugin to create a map. Returns null if no provider is
 * registered (so the DataSync create still succeeds on its own).
 */
export async function createCaltopoMap(
    req: CaltopoCreateRequest
): Promise<CaltopoCreateResult | null> {
    if (!caltopoAvailable()) return null;
    return await window.__cloudtakCaltopo!.createMap(req);
}
