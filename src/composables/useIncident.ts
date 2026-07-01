import { ref } from 'vue';
import { useMapStore } from '../../../../src/stores/map.ts';
import OverlayManager from '../../../../src/base/overlay.ts';

/**
 * Shared, app-wide state for the Incident Manager plugin.
 * Singleton (module-scope refs) plus sessionStorage so the active mission and
 * pane navigation survive closing the float pane (and page reloads in-tab).
 */

export interface ActiveMission {
    guid: string;
    name: string;
    token?: string;
}

export interface PaneNavState {
    activeKey: string;
    activeHTab: string;
}

export const SESSION_MISSION_KEY = 'incident-manager:active-mission';
export const SESSION_NAV_KEY = 'incident-manager:pane-nav';

function loadMissionFromSession(): ActiveMission | null {
    try {
        const raw = sessionStorage.getItem(SESSION_MISSION_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (
            parsed
            && typeof parsed === 'object'
            && typeof (parsed as ActiveMission).guid === 'string'
            && typeof (parsed as ActiveMission).name === 'string'
        ) {
            const m = parsed as ActiveMission;
            return {
                guid: m.guid,
                name: m.name,
                token: typeof m.token === 'string' ? m.token : undefined,
            };
        }
    } catch {
        // ignore corrupt session data
    }
    return null;
}

function saveMissionToSession(m: ActiveMission | null): void {
    try {
        if (m) {
            sessionStorage.setItem(SESSION_MISSION_KEY, JSON.stringify(m));
        } else {
            sessionStorage.removeItem(SESSION_MISSION_KEY);
        }
    } catch {
        // ignore quota / private-mode errors
    }
}

const activeMission = ref<ActiveMission | null>(loadMissionFromSession());

export function useIncident() {
    function setActiveMission(m: ActiveMission | null): void {
        activeMission.value = m;
        saveMissionToSession(m);
    }

    /** Re-attach map overlay + active mission after pane reopen or page reload. */
    async function restoreActiveMissionOnMap(): Promise<void> {
        const m = activeMission.value;
        if (!m) return;

        if (!OverlayManager.loadedByMode('mission', m.guid)) {
            await OverlayManager.createLoaded({
                name: m.name,
                url: `/mission/${encodeURIComponent(m.name)}`,
                type: 'geojson',
                mode: 'mission',
                mode_id: m.guid,
                token: m.token,
            });
        }

        const mapStore = useMapStore();
        const sub = await mapStore.loadMission(m.guid);
        if (sub) await mapStore.makeActiveMission(sub);

        if (sub?.token && sub.token !== m.token) {
            setActiveMission({ ...m, token: sub.token });
        }
    }

    return {
        activeMission,
        setActiveMission,
        restoreActiveMissionOnMap,
    };
}
