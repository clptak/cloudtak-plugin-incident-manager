/**
 * Subscribe a screen to changes other managers make to the active incident.
 *
 * Only incidents stored as Mission Properties are watched; on
 * mission_schema.json there is nothing to diff, and nothing happens. The
 * handler receives changes made by others only - this tab's own saves are
 * filtered out. Unsubscribes when the screen unmounts or the incident changes.
 */

import { onBeforeUnmount, watch } from 'vue';
import { incidentWatcher } from '../lib/liveIncident.ts';
import { schemaPropertyBackend } from '../lib/missionSchema.ts';
import type { PropertyChange } from '../lib/propertyWatch.ts';
import { useIncident } from './useIncident.ts';

export function useIncidentChanges(handler: (changes: PropertyChange[]) => void): void {
    const { activeMission } = useIncident();
    let off: (() => void) | null = null;
    let generation = 0;

    async function attach(guid: string | undefined): Promise<void> {
        off?.();
        off = null;
        const mine = ++generation;
        if (!guid) return;
        let storage: string;
        try {
            storage = await schemaPropertyBackend.storage(guid);
        } catch {
            return;
        }
        if (mine !== generation || storage !== 'keys') return;
        off = incidentWatcher(guid).subscribe((changes) => {
            const others = changes.filter((c) => !c.own);
            if (others.length) handler(others);
        });
    }

    watch(() => activeMission.value?.mgmt?.guid, (guid) => void attach(guid), { immediate: true });
    onBeforeUnmount(() => {
        generation++;
        off?.();
        off = null;
    });
}
