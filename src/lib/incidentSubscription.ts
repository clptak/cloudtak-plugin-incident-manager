import { Preferences } from '@capacitor/preferences';
import Subscription from '../../../../src/base/subscription.ts';
import type { ActiveMission } from '../composables/useIncident.ts';

/** CloudTAK session bearer token (not the mission password/token). */
export async function sessionToken(): Promise<string> {
    const { value } = await Preferences.get({ key: 'token' });
    return value || '';
}

/** Mission password/token for the MissionAuthorization header. */
export function missionAuthToken(mission: ActiveMission): string | undefined {
    return mission.missionToken ?? mission.token;
}

/** Load a mission subscription with correct CloudTAK + mission auth headers. */
export async function loadIncidentSubscription(mission: ActiveMission): Promise<Subscription> {
    return Subscription.load(mission.guid, {
        token: await sessionToken(),
        missiontoken: missionAuthToken(mission),
        subscribed: true,
    });
}
