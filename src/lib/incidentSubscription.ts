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
        reload?: boolean;
    },
): Promise<Subscription> {
    const sub = await Subscription.load(mission.guid, {
        missiontoken: missionAuthToken(mission),
        subscribed: true,
        // Default false: full refresh pulls mission layers and throws
        // "Failed to fetch mission layers" when the stored token is stale.
        reload: opts?.reload ?? false,
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

/**
 * Resolve the DataSync that holds mission_schema.json and planning products.
 * Dual-sync incidents (Phase 1+) keep planning data on the Sworn-only
 * management sync (`mission.mgmt`); older single-sync incidents fall back to
 * the mission itself, preserving pre-Phase-1 behavior.
 */
export function schemaMission(mission: ActiveMission): ActiveMission {
    if (mission.mgmt) {
        return {
            guid: mission.mgmt.guid,
            name: mission.mgmt.name,
            missionToken: mission.mgmt.missionToken,
        };
    }
    return mission;
}

/** Load the subscription for schema/planning I/O (management sync when present). */
export async function loadSchemaSubscription(
    mission: ActiveMission,
    opts?: {
        onMissionToken?: (missionToken: string) => void;
        reload?: boolean;
    },
): Promise<Subscription> {
    return loadIncidentSubscription(schemaMission(mission), opts);
}

/** Mission token for schema/planning writes (management sync when present). */
export function schemaMissionToken(
    sub: Subscription,
    mission: ActiveMission,
): string | undefined {
    return subscriptionMissionToken(sub, schemaMission(mission));
}

type IncidentLogs = Awaited<ReturnType<Subscription['log']['list']>>;

/**
 * All logs for an incident: main-sync logs plus, on dual-sync incidents,
 * management-sync logs (planning entries — scenarios, urgency, objectives,
 * ICS-201). De-duplicated by id. Volunteers lack channel access to the mgmt
 * sync, so for them this quietly returns main-sync logs only.
 */
export async function listAllIncidentLogs(mission: ActiveMission): Promise<IncidentLogs> {
    const sub = await loadIncidentSubscription(mission);
    const logs = await sub.log.list({ refresh: true });
    if (!mission.mgmt) return logs;
    try {
        const schemaSub = await loadSchemaSubscription(mission);
        const mgmtLogs = await schemaSub.log.list({ refresh: true });
        const seen = new Set(logs.map((l) => String(l.id)));
        return [...logs, ...mgmtLogs.filter((l) => !seen.has(String(l.id)))];
    } catch {
        return logs;
    }
}
