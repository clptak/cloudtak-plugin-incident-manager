/**
 * Open the "WiSAR Tools" floating pane (decision 10): a draggable CloudTAK
 * pane over the map, separate from the Incident Manager pane. Uses the float
 * store directly, like floatMinimize.ts, so the pane gets its own titled shell.
 */
import { defineAsyncComponent, markRaw } from 'vue';
import { useFloatStore } from '../../../../src/stores/float.ts';

export const WISAR_TOOLS_UID = 'incident-manager-wisar-tools';

const WisarToolsFloatShell = defineAsyncComponent(() => import('../components/wisar/WisarToolsFloatShell.vue'));

type HostFloatComponent = Parameters<ReturnType<typeof useFloatStore>['add']>[0]['component'];

export function openWisarTools(): void {
    const store = useFloatStore();
    if (store.panes.has(WISAR_TOOLS_UID)) return;
    const width = 560;
    const height = Math.min(760, Math.max(420, (globalThis.innerHeight ?? 800) - 120));
    const x = Math.max(60, (globalThis.innerWidth ?? 1400) - width - 90);
    store.add({
        uid: WISAR_TOOLS_UID,
        name: 'WiSAR Tools',
        component: markRaw(WisarToolsFloatShell as unknown as HostFloatComponent),
        width,
        height,
        x,
        y: 70,
    });
}
