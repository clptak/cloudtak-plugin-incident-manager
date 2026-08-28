/**
 * DataSync mission-folder helpers (see docs-archive/mission-folders.md).
 *
 * Mission "folders" are UID-typed MissionLayers (CloudTAK Mission → Layers).
 *
 * Filing into a folder has two complementary approaches:
 * 1. CoT dest `path` = layer UID at send time (atomic; same as CloudTAK ETL)
 * 2. `attachFeatures` after the CoT is in the mission (races if called too soon)
 */
import type Subscription from '../../../../src/base/subscription.ts';
import { db } from '../../../../src/database.ts';
import { server } from '../../../../src/std.ts';
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

function missionLayerHeaders(sub: Subscription): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = sub.missiontoken || sub.layer.missiontoken;
    if (token) headers.MissionAuthorization = token;
    return headers;
}

/**
 * Unwrap TAK / CloudTAK create payloads into a MissionLayer.
 * Responses may be the layer, `{ data: layer }`, or a deeper TAKItem wrap.
 */
function unwrapMissionLayer(data: unknown): MissionLayer | undefined {
    let cur: unknown = data;
    for (let i = 0; i < 3; i++) {
        if (!cur || typeof cur !== 'object') return undefined;
        const obj = cur as Record<string, unknown>;
        if (typeof obj.uid === 'string') return obj as unknown as MissionLayer;
        if ('data' in obj) {
            cur = obj.data;
            continue;
        }
        return undefined;
    }
    return undefined;
}

async function persistLocalLayer(missionGuid: string, layer: MissionLayer): Promise<void> {
    await db.subscription_layer.put({
        uid: layer.uid,
        mission: missionGuid,
        layer,
    });
}

/**
 * Ensure a root-level UID layer with the given name exists on the mission.
 * Reuses an existing layer with that name; creates one if missing.
 *
 * Avoids `SubscriptionLayer.create()` because that always calls `refresh()`,
 * which throws "Failed to fetch mission layers" when the mission token cannot
 * list layers — even after a successful create POST.
 */
export async function ensureMissionFolder(
    sub: Subscription,
    name: string
): Promise<MissionLayer> {
    // Prefer local Dexie cache (Subscription.load uses reload:false).
    let layers = await sub.layer.list();
    let existing = findLayerByName(layers, name);
    if (existing) return existing;

    // Best-effort refresh; ignore auth/stale-token failures.
    try {
        layers = await sub.layer.list({ refresh: true });
        existing = findLayerByName(layers, name);
        if (existing) return existing;
    } catch {
        // continue — create via POST without a post-create refresh
    }

    const { data, error } = await server.POST('/api/marti/missions/{:guid}/layer', {
        params: {
            path: { ':guid': sub.guid },
        },
        headers: missionLayerHeaders(sub),
        body: {
            name,
            type: 'UID',
        },
    });

    if (error || !data) {
        throw new Error(`Failed to create "${name}" mission folder`);
    }

    let created = unwrapMissionLayer(data);

    // If the create body was TAKItem-wrapped oddly, try one more local/server list.
    if (!created?.uid) {
        try {
            layers = await sub.layer.list({ refresh: true });
        } catch {
            layers = await sub.layer.list();
        }
        created = findLayerByName(layers, name);
    }

    if (!created?.uid) {
        throw new Error(`Failed to create "${name}" mission folder`);
    }

    const layer = {
        ...created,
        name: created.name || name,
        type: created.type || 'UID',
    } as MissionLayer;

    await persistLocalLayer(sub.guid, layer);
    return layer;
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
