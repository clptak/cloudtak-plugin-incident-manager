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
export async function loadIncidentSubscription(
    mission: ActiveMission,
    opts?: {
        onMissionToken?: (missionToken: string) => void;
    },
): Promise<Subscription> {
    const sub = await Subscription.load(mission.guid, {
        token: await sessionToken(),
        missiontoken: missionAuthToken(mission),
        subscribed: true,
    });
    if (sub.missiontoken && sub.missiontoken !== missionAuthToken(mission)) {
        opts?.onMissionToken?.(sub.missiontoken);
    }
    return sub;
}

/** Mission token for writes: subscription DB first, then active-mission state. */
export function subscriptionMissionToken(
    sub: Subscription,
    mission: ActiveMission,
): string | undefined {
    return sub.missiontoken || missionAuthToken(mission);
}
