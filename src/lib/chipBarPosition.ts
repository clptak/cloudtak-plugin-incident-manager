export const CHIP_BAR_POS_KEY = 'incident-manager:chip-bar-pos';
export const DOCK_GAP = 8;
export const PANE_HEIGHT = 60;
export const ZOOM_STACK_WIDTH = 40;
export const ZOOM_STACK_TOP = 76;
export const DESKTOP_MIN_PX = 768;
export const TOP_RIGHT_GUTTER_PX = 288;
export const CHIP_BAR_ROOT_ID = 'incident-manager-chip-bar-root';

export type Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

export type Point = {
    x: number;
    y: number;
};

export type Size = {
    width: number;
    height: number;
};

export function parseSavedPos(raw: string | null): Point | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as { x?: unknown; y?: unknown };
        if (typeof value.x === 'number' && typeof value.y === 'number'
            && Number.isFinite(value.x) && Number.isFinite(value.y)) {
            return { x: value.x, y: value.y };
        }
    } catch {
        // Ignore malformed storage
    }
    return null;
}

export function loadSavedPos(): Point | null {
    try {
        return parseSavedPos(localStorage.getItem(CHIP_BAR_POS_KEY));
    } catch {
        return null;
    }
}

export function savePos(pos: Point): void {
    try {
        localStorage.setItem(CHIP_BAR_POS_KEY, JSON.stringify(pos));
    } catch {
        // Quota / private mode
    }
}

export function clearSavedPos(): void {
    try {
        localStorage.removeItem(CHIP_BAR_POS_KEY);
    } catch {
        // Ignore
    }
}

export function isDesktopWidth(width: number): boolean {
    return width >= DESKTOP_MIN_PX;
}

export function dockedPosition(opts: {
    shell: Rect;
    activeMission: Rect | null;
    leftControls: Rect | null;
    navActive: boolean;
    isDesktop: boolean;
}): Point {
    if (opts.navActive && opts.isDesktop) {
        if (opts.leftControls) {
            return {
                x: opts.leftControls.right - opts.shell.left + DOCK_GAP,
                y: opts.leftControls.top - opts.shell.top,
            };
        }
        return {
            x: DOCK_GAP + ZOOM_STACK_WIDTH + DOCK_GAP,
            y: ZOOM_STACK_TOP,
        };
    }

    if (opts.activeMission) {
        return {
            x: opts.activeMission.right - opts.shell.left + DOCK_GAP,
            y: opts.activeMission.top - opts.shell.top,
        };
    }

    return { x: DOCK_GAP, y: DOCK_GAP };
}

export function dockedMaxWidth(pos: Point, shellWidth: number, topRow: boolean): number {
    const gutter = topRow ? TOP_RIGHT_GUTTER_PX : DOCK_GAP;
    return Math.max(120, shellWidth - pos.x - gutter);
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function paneViewportRect(pos: Point, pane: Size, shell: Rect): Rect {
    return {
        left: shell.left + pos.x,
        top: shell.top + pos.y,
        right: shell.left + pos.x + pane.width,
        bottom: shell.top + pos.y + pane.height,
        width: pane.width,
        height: pane.height,
    };
}

export function clampToShell(pos: Point, pane: Size, shell: Size): Point {
    return {
        x: Math.min(Math.max(0, pos.x), Math.max(0, shell.width - pane.width)),
        y: Math.min(Math.max(0, pos.y), Math.max(0, shell.height - pane.height)),
    };
}

export function clampOutFromNav(pos: Point, pane: Size, nav: Rect | null, shell: Rect): Point {
    if (!nav) return pos;
    if (!rectsIntersect(paneViewportRect(pos, pane, shell), nav)) return pos;
    return {
        x: pos.x,
        y: nav.bottom - shell.top + DOCK_GAP,
    };
}

export function toRect(el: Element | null): Rect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
    };
}

/** DataSync control: patched CloudTAK marker, else the top-left 60px panel. */
export function queryActiveMission(shell: Element): Element | null {
    const marked = document.querySelector('[data-cloudtak-active-mission]');
    if (marked) return marked;

    const shellRect = shell.getBoundingClientRect();
    for (const el of shell.querySelectorAll('.cloudtak-panel')) {
        if (el.closest(`#${CHIP_BAR_ROOT_ID}`)) continue;
        if (el.classList.contains('cloudtak-navigating')) continue;
        if (el.querySelector('.cloudtak-ctrl-group, .cloudtak-ctrl-btn')) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 48 || r.height > 72) continue;
        if (r.left - shellRect.left > 24) continue;
        if (r.top - shellRect.top > 90) continue;
        return el;
    }
    return null;
}

export function queryLeftControls(shell: Element): Element | null {
    const marked = document.querySelector('[data-cloudtak-left-controls]');
    if (marked) return marked;
    return shell.querySelector('.cloudtak-ctrl-group');
}

export function queryNavBanner(): Element | null {
    return document.querySelector('[data-cloudtak-navigating]')
        ?? document.querySelector('.cloudtak-navigating');
}
