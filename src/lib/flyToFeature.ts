/**
 * Recenter the main map on a CoT feature by uuid.
 *
 * Works from the popout window too: this module runs in the main window's JS
 * context, and COT.flyTo() posts Map_FlyTo / Map_FitBounds on
 * BroadcastChannel('cloudtak'), which the main map already listens to.
 */
import { useMapStore } from '../../../../src/stores/map.ts';

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

    // `window` here is always the main window (module code runs in its context),
    // so this brings the map into view when triggered from the popout.
    if (opts.focusMainWindow !== false) window.focus();

    return true;
}
