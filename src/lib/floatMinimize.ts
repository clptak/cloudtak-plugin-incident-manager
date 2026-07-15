import type { PluginAPI } from '../../../../plugin.ts';
import { useFloatStore } from '../../../../src/stores/float.ts';

export const PANE_UID = 'incident-manager';
export const BOTTOM_BAR_KEY = 'incident-manager-minimized';

type FloatAddOpts = Parameters<PluginAPI['float']['add']>[0];
type HostComponent = FloatAddOpts['component'];
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
let paneComponent: HostComponent | null = null;
let actionsComponent: HostComponent | null = null;
let restoreChipComponent: BottomBarComponent | null = null;
let savedGeometry: PaneGeometry | null = null;
let minimized = false;

export function bindFloatMinimize(opts: {
    api: PluginAPI;
    pane: HostComponent;
    actions: HostComponent;
    restoreChip: BottomBarComponent;
}): void {
    api = opts.api;
    paneComponent = opts.pane;
    actionsComponent = opts.actions;
    restoreChipComponent = opts.restoreChip;
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
    if (!paneComponent || !actionsComponent) {
        throw new Error('floatMinimize pane/actions not configured');
    }
    pluginApi.float.add({
        uid: PANE_UID,
        name: 'Incident Manager',
        component: paneComponent,
        actions: actionsComponent,
        width: geometry.width,
        height: geometry.height,
        x: geometry.x,
        y: geometry.y,
    });
}

function clearBottomBarChip(): void {
    try {
        requireApi().bottomBar.remove(BOTTOM_BAR_KEY);
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
    if (minimized) {
        restoreDesktopPane();
        return;
    }
    if (pluginApi.float.has(PANE_UID)) return;
    showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
}

export function minimizeDesktopPane(): void {
    const pluginApi = requireApi();
    if (!pluginApi.float.has(PANE_UID) || minimized) return;
    if (!restoreChipComponent) {
        throw new Error('floatMinimize restore chip not configured');
    }

    savedGeometry = readGeometry();
    pluginApi.float.remove(PANE_UID);
    minimized = true;
    pluginApi.bottomBar.add({
        key: BOTTOM_BAR_KEY,
        component: restoreChipComponent,
    });
}

export function restoreDesktopPane(): void {
    const pluginApi = requireApi();
    clearBottomBarChip();
    minimized = false;
    if (pluginApi.float.has(PANE_UID)) return;
    showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
}

export function cleanupFloatMinimize(): void {
    clearBottomBarChip();
    minimized = false;
    if (api?.float.has(PANE_UID)) {
        api.float.remove(PANE_UID);
    }
}
