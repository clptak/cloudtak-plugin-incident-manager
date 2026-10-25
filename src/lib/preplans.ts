/**
 * Runtime integration contract with the separate `preplans` plugin
 * (cloudtak-plugin-preplans), same pattern as caltopo.ts.
 *
 * The preplans plugin publishes `window.__cloudtakPreplans` while enabled:
 * `list()` returns the preplan files in every "Preplan Library" DataSync the
 * user can see, and `load()` copies one into a mission as fresh CoTs (new
 * UIDs) filed under a "Preplan - <name>" folder.
 *
 * If the provider is absent, Create Mission hides the preplan picker.
 */

export interface PreplanSummary {
    name: string;
    filename: string;
    hash: string;
    /** Library DataSync the file is attached to */
    library: string;
}

export interface PreplanLoadRequest {
    name: string;
    filename: string;
    hash: string;
    missionGuid: string;
    missionToken?: string;
    /** Folder to file under; defaults to "Preplan - <name>", false for mission root */
    folder?: string | false;
}

export interface PreplanLoadResult {
    count: number;
    skipped: number;
    folder?: string;
    warning?: string;
}

export interface PreplansProvider {
    list(): Promise<PreplanSummary[]>;
    load(req: PreplanLoadRequest): Promise<PreplanLoadResult>;
}

declare global {
    interface Window {
        __cloudtakPreplans?: PreplansProvider;
    }
}

export function preplansAvailable(): boolean {
    return typeof window !== 'undefined'
        && !!window.__cloudtakPreplans
        && typeof window.__cloudtakPreplans.list === 'function'
        && typeof window.__cloudtakPreplans.load === 'function';
}

export async function listPreplans(): Promise<PreplanSummary[]> {
    if (!preplansAvailable()) return [];
    return await window.__cloudtakPreplans!.list();
}

export async function loadPreplan(req: PreplanLoadRequest): Promise<PreplanLoadResult | null> {
    if (!preplansAvailable()) return null;
    return await window.__cloudtakPreplans!.load(req);
}
