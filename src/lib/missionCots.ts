import type { Feature } from '../../../../src/types.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, loadSchemaSubscription } from './incidentSubscription.ts';

export interface MissionCotRef {
    uid: string;
    callsign: string;
    geometryType?: string;
}

export async function listMissionCots(mission: ActiveMission): Promise<MissionCotRef[]> {
    const sub = await loadIncidentSubscription(mission);
    const feats = await sub.feature.list({ refresh: true }) as Feature[];
    return feats
        .map((f) => {
            const props = (f.properties ?? {}) as { callsign?: string };
            const geom = (f.geometry ?? {}) as { type?: string };
            return {
                uid: String(f.id),
                callsign: String(props.callsign || f.id),
                geometryType: geom.type,
            };
        })
        .sort((a, b) => a.callsign.localeCompare(b.callsign, undefined, { sensitivity: 'base' }));
}

export interface MissionMarker {
    uid: string;
    callsign: string;
    lat: number;
    lng: number;
    /** Which sync it is on: 'common map' or 'MGMT'. */
    source: string;
}

/**
 * Point markers on the incident's common map and MGMT sync, for picking a
 * location (e.g. the incident event's, #39). Newest list wins on duplicates.
 */
export async function listMissionMarkers(mission: ActiveMission): Promise<MissionMarker[]> {
    const out = new Map<string, MissionMarker>();
    const collect = (feats: Feature[], source: string) => {
        for (const f of feats) {
            const geom = (f.geometry ?? {}) as { type?: string; coordinates?: unknown };
            if (geom.type !== 'Point' || !Array.isArray(geom.coordinates)) continue;
            const lng = Number(geom.coordinates[0]);
            const lat = Number(geom.coordinates[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const props = (f.properties ?? {}) as { callsign?: string };
            const uid = String(f.id);
            if (!out.has(uid)) out.set(uid, { uid, callsign: String(props.callsign || uid), lat, lng, source });
        }
    };
    try {
        collect(await (await loadIncidentSubscription(mission)).feature.list({ refresh: true }) as Feature[], 'common map');
    } catch { /* common map unreachable: MGMT may still list markers */ }
    if (mission.mgmt) {
        try {
            collect(await (await loadSchemaSubscription(mission)).feature.list({ refresh: true }) as Feature[], 'MGMT');
        } catch { /* MGMT unreachable */ }
    }
    return [...out.values()].sort((a, b) => a.callsign.localeCompare(b.callsign, undefined, { sensitivity: 'base' }));
}
