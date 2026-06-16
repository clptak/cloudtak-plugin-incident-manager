/**
 * Push GeoJSON features into a TAK mission (DataSync) via SubscriptionFeature.update
 * (same path as CloudTAK draw/buffer). Raw sendCOT can silently no-op when the
 * Atlas websocket is closed and does not refresh the mission overlay cache.
 */
import { Preferences } from '@capacitor/preferences';
import COT, { OriginMode } from '../../../../src/base/cot.ts';
import Subscription from '../../../../src/base/subscription.ts';
import { useMapStore } from '../../../../src/stores/map.ts';
import { server } from '../../../../src/std.ts';
import type { Feature } from '../../../../src/types.ts';
import type Atlas from '../../../../src/workers/atlas.ts';

export interface RingStyle {
    stroke?: string;
    fill?: string;
    fillOpacity?: number;
}

function uuid(): string {
    return (globalThis.crypto && 'randomUUID' in globalThis.crypto)
        ? globalThis.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
}

/** Strip Vue reactive proxies before IndexedDB / Comlink structured clone. */
function toPlainFeature(feat: Feature): Feature {
    return JSON.parse(JSON.stringify(feat)) as Feature;
}

function plainRing(ring: [number, number][]): [number, number][] {
    return ring.map(([lng, lat]) => [lng, lat] as [number, number]);
}

function plainCenter(center: [number, number]): [number, number] {
    return [center[0], center[1]];
}

async function sessionToken(): Promise<string> {
    const { value } = await Preferences.get({ key: 'token' });
    return value || '';
}

async function ensureConnOpen(worker: ReturnType<typeof useMapStore>['worker']): Promise<void> {
    if (await worker.conn.isOpen) return;
    await worker.conn.reconnect(await worker.username);
    if (!(await worker.conn.isOpen)) {
        throw new Error('TAK connection is not open. Connect to the map and try again.');
    }
}

async function pushFeatureToMission(
    missionGuid: string,
    feat: Feature,
    missionToken?: string,
): Promise<string> {
    const mapStore = useMapStore();
    await ensureConnOpen(mapStore.worker);

    const sub = await Subscription.load(missionGuid, {
        token: await sessionToken(),
        missiontoken: missionToken,
        subscribed: true,
    });

    const cot = await COT.load(toPlainFeature(feat), {
        mode: OriginMode.MISSION,
        mode_id: missionGuid,
    }, { skipSave: true });

    await sub.feature.update(mapStore.worker as unknown as Atlas, cot);
    return String(feat.id);
}

/**
 * Send a single closed polygon ring to a mission. `ring` is a closed array of
 * [lng, lat] (first == last). Returns the feature id sent.
 *
 * Pass `id` to reuse an existing CoT uuid: TAK treats a repeat uid as an update,
 * so the polygon is replaced in place rather than duplicated. Omit it for a new
 * ring (a uuid is generated and returned).
 */
export async function pushPolygonToMission(opts: {
    missionGuid: string;
    missionToken?: string;
    callsign: string;
    ring: [number, number][];
    center: [number, number];
    style?: RingStyle;
    id?: string;
}): Promise<string> {
    const now = new Date().toISOString();
    const id = opts.id ?? uuid();
    const style = opts.style ?? {};

    const center = plainCenter(opts.center);
    const ring = plainRing(opts.ring);

    const feat: Feature = {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: 'u-d-f',
            how: 'h-g-i-g-o',
            callsign: opts.callsign,
            center,
            time: now,
            start: now,
            stale: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
            stroke: style.stroke ?? '#ff9900',
            'stroke-opacity': 1,
            'stroke-width': 3,
            fill: style.fill ?? style.stroke ?? '#ff9900',
            'fill-opacity': style.fillOpacity ?? 0.15,
        },
        geometry: {
            type: 'Polygon',
            coordinates: [ring],
        },
    } as unknown as Feature;

    return pushFeatureToMission(opts.missionGuid, feat, opts.missionToken);
}

/**
 * Send a single point marker to a mission. `point` is [lng, lat]. Returns the
 * feature id sent. Pass `id` to update an existing marker in place.
 */
export async function pushPointToMission(opts: {
    missionGuid: string;
    missionToken?: string;
    callsign: string;
    point: [number, number];
    type?: string;
    icon?: string;
    id?: string;
}): Promise<string> {
    const now = new Date().toISOString();
    const id = opts.id ?? uuid();

    const feat: Feature = {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: opts.type ?? 'a-f-G',
            how: 'h-g-i-g-o',
            callsign: opts.callsign,
            icon: opts.icon,
            time: now,
            start: now,
            stale: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
        },
        geometry: {
            type: 'Point',
            coordinates: plainCenter(opts.point),
        },
    } as unknown as Feature;

    return pushFeatureToMission(opts.missionGuid, feat, opts.missionToken);
}

/**
 * Delete a feature from a mission by its CoT uuid via the REST endpoint
 * (DELETE /api/marti/missions/:guid/cot/:uid). Used to drop a ring polygon when
 * its search-area log entry is removed.
 */
export async function deletePolygonFromMission(opts: {
    missionGuid: string;
    uid: string;
    missiontoken?: string;
}): Promise<void> {
    const headers: Record<string, string> = {};
    if (opts.missiontoken) headers.MissionAuthorization = opts.missiontoken;

    const { error } = await server.DELETE('/api/marti/missions/{:guid}/cot/{:uid}', {
        params: { path: { ':guid': opts.missionGuid, ':uid': opts.uid } },
        headers,
    });

    if (error) throw new Error('Failed to delete mission feature');
}
