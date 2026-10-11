import { createApp, markRaw, type App } from 'vue';
import type { PluginAPI } from '../../../../plugin.ts';
import { useFloatStore } from '../../../../src/stores/float.ts';
import { useAppStore } from '../../../../src/stores/app.ts';
import { isPopoutOpen, focusPopout } from './popout.ts';
import { CHIP_BAR_ROOT_ID } from './chipBarPosition.ts';
import IncidentManagerChipBar from '../components/IncidentManagerChipBar.vue';

export const PANE_UID = 'incident-manager';
export const BOTTOM_BAR_KEY = 'incident-manager';
export const RESOURCES_BOTTOM_BAR_KEY = 'incident-manager-resources';
export const ASSIGNMENTS_BOTTOM_BAR_KEY = 'incident-manager-assignments';
export const SEGMENTS_BOTTOM_BAR_KEY = 'incident-manager-segments';
const CLUES_BOTTOM_BAR_KEY = 'incident-manager-clues';

type HostFloatComponent = Parameters<ReturnType<typeof useFloatStore>['add']>[0]['component'];

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
let savedGeometry: PaneGeometry | null = null;
let minimized = false;
let chipApp: App | null = null;
let chipEl: HTMLElement | null = null;
let chipRetry: ReturnType<typeof setInterval> | null = null;

export function bindFloatMinimize(opts: {
    api: PluginAPI;
    shell: HostFloatComponent;
}): void {
    api = opts.api;
    shellComponent = opts.shell;
    ensureChipBar();
}

export function isMinimized(): boolean {
    return minimized;
}

function requireApi(): PluginAPI {
    if (!api) throw new Error('floatMinimize not bound');
    return api;
}

function isMobile(): boolean {
    try {
        return Boolean(useAppStore(requireApi().pinia).isMobileDetected);
    } catch {
        return false;
    }
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

function mountChipBar(shell: Element): void {
    if (chipApp && chipEl && shell.contains(chipEl)) return;
    unmountChipBar();
    chipEl = document.createElement('div');
    chipEl.id = CHIP_BAR_ROOT_ID;
    shell.appendChild(chipEl);
    chipApp = createApp(IncidentManagerChipBar);
    chipApp.use(requireApi().pinia);
    chipApp.mount(chipEl);
}

function unmountChipBar(): void {
    if (chipApp) {
        chipApp.unmount();
        chipApp = null;
    }
    chipEl?.remove();
    chipEl = null;
}

function ensureChipBar(): void {
    if (!api || isMobile()) return;
    const shell = document.querySelector('.map-shell');
    if (shell) {
        mountChipBar(shell);
        if (chipRetry) {
            clearInterval(chipRetry);
            chipRetry = null;
        }
        return;
    }
    if (!chipRetry) {
        chipRetry = setInterval(() => {
            ensureChipBar();
        }, 500);
    }
}

function clearChipBar(): void {
    if (chipRetry) {
        clearInterval(chipRetry);
        chipRetry = null;
    }
    unmountChipBar();
    // Leave no leftover host bottom-bar chips if an older build registered them.
    try {
        requireApi().bottomBar.remove(BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(RESOURCES_BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(ASSIGNMENTS_BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(SEGMENTS_BOTTOM_BAR_KEY);
        requireApi().bottomBar.remove(CLUES_BOTTOM_BAR_KEY);
    } catch {
        // Map may not be loaded during teardown
    }
}

/**
 * Open the desktop float, or restore it if currently minimized.
 * No-op if the float is already visible.
 * When the popout window is open, focus it instead — chips then act as
 * "bring popout to front + navigate" (nav state is shared across windows).
 */
export function openDesktopPane(): void {
    const pluginApi = requireApi();
    ensureChipBar();
    if (isPopoutOpen()) {
        focusPopout();
        return;
    }
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
    ensureChipBar();
    if (!pluginApi.float.has(PANE_UID) || minimized) return;

    savedGeometry = readGeometry();
    pluginApi.float.remove(PANE_UID);
    minimized = true;
}

export function restoreDesktopPane(): void {
    openDesktopPane();
}

export function cleanupFloatMinimize(): void {
    clearChipBar();
    minimized = false;
    if (api?.float.has(PANE_UID)) {
        api.float.remove(PANE_UID);
    }
}
