/**
 * Recenter the main map on a CoT feature by uuid, or on raw coordinates.
 *
 * Works from the popout window too: this module runs in the main window's JS
 * context, and COT.flyTo() posts Map_FlyTo / Map_FitBounds on
 * BroadcastChannel('cloudtak'), which the main map already listens to.
 */
import { useMapStore } from '../../../../src/stores/map.ts';
import { WorkerMessageType } from '../../../../src/utils/events.ts';

function focusMainWindow(opts: { focusMainWindow?: boolean } = {}): void {
    // `window` here is always the main window (module code runs in its context),
    // so this brings the map into view when triggered from the popout.
    if (opts.focusMainWindow !== false) window.focus();
}

/**
 * Fly the main map to the feature with the given CoT uuid.
 * Returns false when the feature is not in the live CoT database
 * (e.g. mission overlay not loaded yet).
 */
export async function flyToFeature(uid: string, opts: { focusMainWindow?: boolean } = {}): Promise<boolean> {
    const mapStore = useMapStore();
    const cot = await mapStore.worker.db.get(uid, { mission: true });
    if (!cot) return false;

    await cot.flyTo();
    focusMainWindow(opts);

    return true;
}

/**
 * Fly the main map to raw WGS84 coordinates (same Map_FlyTo path as COT.flyTo).
 */
export function flyToCoords(
    coords: { lat: number; lng: number },
    opts: { focusMainWindow?: boolean; zoom?: number } = {},
): void {
    const channel = new BroadcastChannel('cloudtak');
    channel.postMessage({
        type: WorkerMessageType.Map_FlyTo,
        body: {
            center: [coords.lng, coords.lat],
            zoom: opts.zoom ?? 16,
            speed: Infinity,
        },
    });
    channel.close();
    focusMainWindow(opts);
}
