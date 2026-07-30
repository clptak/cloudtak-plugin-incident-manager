/**
 * DataSync mission-folder helpers (see docs/mission-folders.md).
 *
 * Mission "folders" are UID-typed MissionLayers (CloudTAK Mission → Layers).
 *
 * Filing into a folder has two complementary approaches:
 * 1. CoT dest `path` = layer UID at send time (atomic; same as CloudTAK ETL)
 * 2. `attachFeatures` after the CoT is in the mission (races if called too soon)
 */
import type Subscription from '../../../../src/base/subscription.ts';
import type { Feature, MissionLayer } from '../../../../src/types.ts';

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find a top-level mission layer by exact name.
 */
export function findLayerByName(
    layers: MissionLayer[],
    name: string
): MissionLayer | undefined {
    return layers.find((l) => l.name === name);
}

/**
 * Build a mission dest that files the CoT into a UID layer on ingest.
 * `path` here is the **layer UID**, not a filesystem path.
 */
export function missionFolderDest(
    missionGuid: string,
    folderUid: string
): Array<{ 'mission-guid': string; path: string; after: string }> {
    return [{
        'mission-guid': missionGuid,
        path: folderUid,
        after: ''
    }];
}

/**
 * Clone a feature with dest set so TAK files it under the folder on ingest.
 */
export function withMissionFolderDest(
    feat: Feature,
    missionGuid: string,
    folderUid: string
): Feature {
    const wire = JSON.parse(JSON.stringify(feat)) as Feature;
    wire.properties.dest = missionFolderDest(missionGuid, folderUid);
    return wire;
}

/**
 * Ensure a root-level UID layer with the given name exists on the mission.
 * Reuses an existing layer with that name; creates one if missing.
 * Re-lists after create so we always return a fully hydrated layer uid
 * (create response is TAKItem-wrapped and not relied upon).
 */
export async function ensureMissionFolder(
    sub: Subscription,
    name: string
): Promise<MissionLayer> {
    let layers = await sub.layer.list({ refresh: true });
    const existing = findLayerByName(layers, name);
    if (existing) return existing;

    await sub.layer.create({
        name,
        type: 'UID'
    });

    // create() already refreshes; list from local store
    layers = await sub.layer.list();
    const created = findLayerByName(layers, name);
    if (!created) {
        throw new Error(`Failed to create "${name}" mission folder`);
    }

    return created;
}

/**
 * File existing mission CoT UIDs under a folder.
 *
 * Must run only after TAK has ingested the CoTs (websocket publish is async).
 * Attaches one UID at a time (matches CloudTAK Layers UI) with retries.
 */
export async function attachFeaturesToFolder(
    sub: Subscription,
    folderUid: string,
    uids: string[],
    opts?: {
        initialDelayMs?: number;
        attempts?: number;
    }
): Promise<void> {
    if (!uids.length) return;

    const initialDelayMs = opts?.initialDelayMs ?? 800;
    const attempts = opts?.attempts ?? 6;

    await sleep(initialDelayMs);

    const failed: string[] = [];

    for (const uid of uids) {
        let ok = false;
        let lastErr: unknown;

        for (let i = 0; i < attempts; i++) {
            try {
                await sub.layer.attachFeatures(folderUid, [uid]);
                ok = true;
                break;
            } catch (err) {
                lastErr = err;
                await sleep(300 * (i + 1));
            }
        }

        if (!ok) {
            failed.push(uid);
            console.warn('Failed to attach feature to mission folder', uid, lastErr);
        }
    }

    if (failed.length) {
        throw new Error(
            `Posted to mission but could not file ${failed.length}/${uids.length} `
            + 'into the mission folder (they may still be at mission root)'
        );
    }
}
