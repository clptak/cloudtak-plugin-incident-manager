import { ref } from 'vue';

/**
 * Shared, app-wide state for the Incident Manager plugin.
 * Singleton (module-scope refs) so every pane sees the same active mission.
 */

export interface ActiveMission {
    guid: string;
    name: string;
    token?: string;
}

const activeMission = ref<ActiveMission | null>(null);

export function useIncident() {
    function setActiveMission(m: ActiveMission | null): void {
        activeMission.value = m;
    }

    return {
        activeMission,
        setActiveMission,
    };
}
