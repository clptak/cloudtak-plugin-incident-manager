import { markRaw } from 'vue';
import type { PluginAPI } from '../../../../plugin.ts';
import { useFloatStore } from '../../../../src/stores/float.ts';

export const PANE_UID = 'incident-manager';
export const BOTTOM_BAR_KEY = 'incident-manager';
export const RESOURCES_BOTTOM_BAR_KEY = 'incident-manager-resources';
export const ASSIGNMENTS_BOTTOM_BAR_KEY = 'incident-manager-assignments';
export const SEGMENTS_BOTTOM_BAR_KEY = 'incident-manager-segments';

type HostFloatComponent = Parameters<ReturnType<typeof useFloatStore>['add']>[0]['component'];
type BottomBarComponent = Parameters<PluginAPI['bottomBar']['add']>[0]['component'];

export type PaneGeometry = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export const DEFAULT_GEOMETRY: PaneGeometry = {
    width: 980,
    height: 640,
    x: 80,
    y: 60,
};

let api: PluginAPI | null = null;
let shellComponent: HostFloatComponent | null = null;
let restoreChipComponent: BottomBarComponent | null = null;
let resourcesChipComponent: BottomBarComponent | null = null;
let assignmentsChipComponent: BottomBarComponent | null = null;
let segmentsChipComponent: BottomBarComponent | null = null;
let savedGeometry: PaneGeometry | null = null;
let minimized = false;

export function bindFloatMinimize(opts: {
    api: PluginAPI;
    shell: HostFloatComponent;
    restoreChip: BottomBarComponent;
    resourcesChip?: BottomBarComponent;
    assignmentsChip?: BottomBarComponent;
    segmentsChip?: BottomBarComponent;
}): void {
    api = opts.api;
    shellComponent = opts.shell;
    restoreChipComponent = opts.restoreChip;
    resourcesChipComponent = opts.resourcesChip ?? null;
    assignmentsChipComponent = opts.assignmentsChip ?? null;
    segmentsChipComponent = opts.segmentsChip ?? null;
    ensureBottomBarChip();
}

export function isMinimized(): boolean {
    return minimized;
}

function requireApi(): PluginAPI {
    if (!api) throw new Error('floatMinimize not bound');
    return api;
}

function readGeometry(): PaneGeometry {
    const pluginApi = requireApi();
    const pane = useFloatStore(pluginApi.pinia).panes.get(PANE_UID);
    if (!pane) return { ...(savedGeometry ?? DEFAULT_GEOMETRY) };
    return {
        x: pane.x,
        y: pane.y,
        width: pane.width,
        height: pane.height,
    };
}

function showFloat(geometry: PaneGeometry): void {
    const pluginApi = requireApi();
    if (!shellComponent) {
        throw new Error('floatMinimize shell not configured');
    }
    // Use the float store directly (not api.float.add) so we can supply a custom
    // FloatingPane shell with IconTarget in the title — api.float always wraps FloatingGeneric.
    useFloatStore(pluginApi.pinia).add({
        uid: PANE_UID,
        name: 'Incident Manager',
        component: markRaw(shellComponent),
        width: geometry.width,
        height: geometry.height,
        x: geometry.x,
        y: geometry.y,
    });
}

function ensureBottomBarChip(): void {
    if (!restoreChipComponent || !api) return;
    try {
        api.bottomBar.add({
            key: BOTTOM_BAR_KEY,
            component: restoreChipComponent,
        });
        if (resourcesChipComponent) {
            api.bottomBar.add({
                key: RESOURCES_BOTTOM_BAR_KEY,
                component: resourcesChipComponent,
            });
        }
        if (assignmentsChipComponent) {
            api.bottomBar.add({
                key: ASSIGNMENTS_BOTTOM_BAR_KEY,
                component: assignmentsChipComponent,
            });
        }
        if (segmentsChipComponent) {
            api.bottomBar.add({
                key: SEGMENTS_BOTTOM_BAR_KEY,
                component: segmentsChipComponent,
            });
        }
    } catch {
        // Map / bottom bar may not be loaded yet — retry on open/minimize
    }
}

function clearBottomBarChip(): void {
    try {
        requireApi().bottomBar.remove(BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(RESOURCES_BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(ASSIGNMENTS_BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(SEGMENTS_BOTTOM_BAR_KEY);
    } catch {
        // Map / bottom bar may not be loaded during teardown
    }
}

/**
 * Open the desktop float, or restore it if currently minimized.
 * No-op if the float is already visible.
 */
export function openDesktopPane(): void {
    const pluginApi = requireApi();
    ensureBottomBarChip();
    if (minimized) {
        minimized = false;
        if (!pluginApi.float.has(PANE_UID)) {
            showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
        }
        return;
    }
    if (pluginApi.float.has(PANE_UID)) return;
    showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
}

export function minimizeDesktopPane(): void {
    const pluginApi = requireApi();
    ensureBottomBarChip();
    if (!pluginApi.float.has(PANE_UID) || minimized) return;

    savedGeometry = readGeometry();
    pluginApi.float.remove(PANE_UID);
    minimized = true;
}

export function restoreDesktopPane(): void {
    openDesktopPane();
}

export function cleanupFloatMinimize(): void {
    clearBottomBarChip();
    minimized = false;
    if (api?.float.has(PANE_UID)) {
        api.float.remove(PANE_UID);
    }
}
