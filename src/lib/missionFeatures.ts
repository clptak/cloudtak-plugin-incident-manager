/**
 * Push GeoJSON features into a TAK mission (DataSync) the native CloudTAK way:
 * a `u-d-f` Feature with properties.dest = [{ 'mission-guid': guid }] sent as
 * CoT over the Atlas worker's WebSocket connection (mapStore.worker.conn.sendCOT).
 *
 * Mirrors the convention documented for SubscriptionFeature.update and the
 * feature shape produced by the host BufferInput.vue.
 */
import { useMapStore } from '../../../../src/stores/map.ts';
import { server } from '../../../../src/std.ts';
import type { Feature } from '../../../../src/types.ts';

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
    callsign: string;
    ring: [number, number][];
    center: [number, number];
    style?: RingStyle;
    id?: string;
}): Promise<string> {
    const mapStore = useMapStore();
    const now = new Date().toISOString();
    const id = opts.id ?? uuid();
    const style = opts.style ?? {};

    const feat: Feature = {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: 'u-d-f',
            how: 'h-g-i-g-o',
            callsign: opts.callsign,
            center: opts.center,
            time: now,
            start: now,
            stale: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
            stroke: style.stroke ?? '#ff9900',
            'stroke-opacity': 1,
            'stroke-width': 3,
            fill: style.fill ?? style.stroke ?? '#ff9900',
            'fill-opacity': style.fillOpacity ?? 0.15,
            dest: [{ 'mission-guid': opts.missionGuid }],
        },
        geometry: {
            type: 'Polygon',
            coordinates: [opts.ring],
        },
    } as unknown as Feature;

    await mapStore.worker.conn.sendCOT(feat);
    return id;
}

/**
 * Send a single point marker to a mission. `point` is [lng, lat]. Returns the
 * feature id sent. Pass `id` to update an existing marker in place.
 */
export async function pushPointToMission(opts: {
    missionGuid: string;
    callsign: string;
    point: [number, number];
    type?: string;
    icon?: string;
    id?: string;
}): Promise<string> {
    const mapStore = useMapStore();
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
            dest: [{ 'mission-guid': opts.missionGuid }],
        },
        geometry: {
            type: 'Point',
            coordinates: opts.point,
        },
    } as unknown as Feature;

    await mapStore.worker.conn.sendCOT(feat);
    return id;
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
