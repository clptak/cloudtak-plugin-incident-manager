/**
 * Keep a previewed WiSAR overlay (item 5d, Paul 2026-10-04): send its RGBA
 * GeoTIFF through CloudTAK's own Imports and, once CloudTAK has tiled it,
 * add it to the user's Overlays - the same steps as Files -> Upload, then
 * Files -> Create Overlay (MenuFiles.vue createOverlay):
 *
 *   PUT /api/import (multipart, field "file")  -> { imports: [{ uid }] }
 *   GET /api/import/:uid until Success | Fail  -> results [{ type: 'Asset', type_id }]
 *   GET /api/profile/asset/:id.pmtiles/tile    -> TileJSON (raster, not .mvt)
 *   OverlayManager.createLoaded({ type: 'raster', mode: 'profile', ... })
 *
 * Only that user sees it; nothing goes to the TAK Server or a DataSync.
 * The CloudTAK calls are passed in, so this runs under node:test.
 */
import type { Job } from './wisar.ts';
import { TT_FOLDER_NAME, tarrFolderName } from './wisarResults.ts';

export interface KeepDeps {
    /** PUT /api/import with one file; returns the import uid. */
    upload(file: Blob, fileName: string): Promise<string>;
    /** GET /api/import/:uid */
    getImport(uid: string): Promise<{ status: string; error?: string | null; results?: { type: string; type_id: string; name?: string }[] }>;
    /** GET /api/profile/asset/:id.pmtiles/tile; throws until the PMTiles exist. */
    tileJSON(assetId: string): Promise<{ tiles: string[] }>;
    /** OverlayManager.createLoaded for a raster profile overlay (assetName = the file name, as Files uses). */
    createOverlay(assetId: string, overlayName: string, assetName: string): Promise<void>;
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export type KeepPhase = 'uploading' | 'converting' | 'adding' | 'done';

export interface KeepOptions {
    signal?: AbortSignal;
    onPhase?: (phase: KeepPhase) => void;
    /** Poll interval and limit for the conversion (default 2 s, 5 min). */
    pollMs?: number;
    timeoutMs?: number;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/**
 * "AZ LPB Search-Hiker WiSAR - Terrain Attractor Priority - 10-04 14:32"
 * (Paul, 2026-10-04): the DataSync folder name, the layer, and the run's
 * local finish time so repeat runs differ. Slashes are replaced so the name
 * is a safe file name.
 */
export function keptLayerName(job: Pick<Job, 'type' | 'request' | 'finished_at' | 'created_at'>, title: string): string {
    const folder = job.type === 'tarr' ? tarrFolderName(job) : TT_FOLDER_NAME;
    const at = new Date(job.finished_at || job.created_at);
    const when = Number.isNaN(at.getTime())
        ? ''
        : ` - ${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
    return `${folder} - ${title}${when}`.replace(/[\\/]+/g, '-');
}

/** Upload, wait for CloudTAK to tile it, add it to Overlays. Returns the overlay name. */
export async function keepOverlay(deps: KeepDeps, file: Blob, name: string, opts: KeepOptions = {}): Promise<string> {
    const pollMs = opts.pollMs ?? 2000;
    const deadline = Date.now() + (opts.timeoutMs ?? 5 * 60 * 1000);
    const aborted = (): boolean => !!opts.signal?.aborted;

    opts.onPhase?.('uploading');
    const uid = await deps.upload(file, `${name}.tif`);

    opts.onPhase?.('converting');
    let assetId: string;
    for (;;) {
        if (aborted()) throw new DOMException('Keep cancelled', 'AbortError');
        const imp = await deps.getImport(uid);
        if (imp.status === 'Fail') throw new Error(`CloudTAK could not import the layer${imp.error ? `: ${imp.error}` : '.'}`);
        if (imp.status === 'Success') {
            assetId = imp.results?.find((r) => r.type === 'Asset')?.type_id ?? '';
            if (!assetId) throw new Error('CloudTAK imported the layer but returned no file for it.');
            break;
        }
        if (Date.now() > deadline) {
            throw new Error('CloudTAK is still converting the layer. It will appear in your Files; add it from there with Create Overlay.');
        }
        await deps.sleep(pollMs, opts.signal);
    }

    // The import can report Success a moment before the tiles are readable
    for (;;) {
        if (aborted()) throw new DOMException('Keep cancelled', 'AbortError');
        try {
            const tj = await deps.tileJSON(assetId);
            if (!tj.tiles.length) throw new Error('no tiles yet');
            if (new URL(tj.tiles[0], 'http://x').pathname.endsWith('.mvt')) {
                throw new Error('CloudTAK tiled the layer as vector data, not an image.');
            }
            break;
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('CloudTAK tiled')) throw err;
            if (Date.now() > deadline) {
                throw new Error('The layer is in your Files but its tiles are not ready yet; add it from Files with Create Overlay.', { cause: err });
            }
            await deps.sleep(pollMs, opts.signal);
        }
    }

    opts.onPhase?.('adding');
    await deps.createOverlay(assetId, name, `${name}.tif`);
    opts.onPhase?.('done');
    return name;
}
