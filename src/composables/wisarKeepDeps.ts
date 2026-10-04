import { std, stdurl } from '../../../../src/std.ts';
import OverlayManager from '../../../../src/base/overlay.ts';
import type { KeepDeps } from '../lib/wisarKeep.ts';

/**
 * The CloudTAK calls behind Keep (lib/wisarKeep.ts): the same endpoints as
 * Files -> Upload and Files -> Create Overlay, with this session's token.
 */
export function cloudTakKeepDeps(): KeepDeps {
    return {
        async upload(file, fileName) {
            const form = new FormData();
            form.append('file', file, fileName);
            const res = await std('/api/import', { method: 'PUT', body: form, timeout: 120_000 }) as {
                imports?: { uid: string }[];
            };
            const uid = res.imports?.[0]?.uid;
            if (!uid) throw new Error('CloudTAK did not accept the upload.');
            return uid;
        },
        async getImport(uid) {
            return await std(`/api/import/${encodeURIComponent(uid)}`) as Awaited<ReturnType<KeepDeps['getImport']>>;
        },
        async tileJSON(assetId) {
            return await std(`/api/profile/asset/${encodeURIComponent(assetId)}.pmtiles/tile`) as { tiles: string[] };
        },
        async createOverlay(assetId, overlayName, assetName) {
            await OverlayManager.createLoaded({
                url: stdurl(`/api/profile/asset/${encodeURIComponent(assetId)}.pmtiles/tile`).toString(),
                name: overlayName,
                mode: 'profile',
                mode_id: assetName,
                type: 'raster',
            });
        },
        sleep(ms, signal) {
            return new Promise((resolve, reject) => {
                const t = setTimeout(resolve, ms);
                signal?.addEventListener('abort', () => {
                    clearTimeout(t);
                    reject(new DOMException('Keep cancelled', 'AbortError'));
                }, { once: true });
            });
        },
    };
}
