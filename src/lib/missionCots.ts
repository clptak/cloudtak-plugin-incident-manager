import type { Feature } from '../../../../src/types.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription } from './incidentSubscription.ts';

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
