/**
 * Push GeoJSON features into a TAK mission (DataSync) the native CloudTAK way:
 * a `u-d-f` Feature with properties.dest = [{ 'mission-guid': guid }] sent as
 * CoT over the Atlas worker's WebSocket connection (mapStore.worker.conn.sendCOT).
 *
 * Mirrors the convention documented for SubscriptionFeature.update and the
 * feature shape produced by the host BufferInput.vue.
 */
import { useMapStore } from '@/stores/map.ts';
import type { Feature } from '@/types.ts';

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
 */
export async function pushPolygonToMission(opts: {
    missionGuid: string;
    callsign: string;
    ring: [number, number][];
    center: [number, number];
    style?: RingStyle;
}): Promise<string> {
    const mapStore = useMapStore();
    const now = new Date().toISOString();
    const id = uuid();
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
