/**
 * Frame a print map on the live map (#28 follow-up): a fixed-shape
 * rectangle over the map, in the print box's proportions. The map pans and
 * zooms freely under it and the frame can be dragged by its title bar, so
 * what is inside the frame is exactly what prints.
 *
 * The frame is plain DOM inside the map container (the plugin pane is
 * minimized meanwhile, which unmounts it), and the chosen view is kept per
 * key in this browser so the reopened pane picks it up.
 */

import { reactive } from 'vue';
import { useMapStore } from '../../../../src/stores/map.ts';
import {
    fitFrame,
    paperScale,
    paperScaleLabel,
    PX_PER_PT,
    zoomForFrame,
    type PrintView,
    type ScreenRect,
} from './printMapFrame.ts';

interface FramingMap {
    getContainer(): HTMLElement;
    getZoom(): number;
    getBearing(): number;
    getPitch(): number;
    unproject(point: [number, number]): { lng: number; lat: number };
    jumpTo(options: { bearing?: number; pitch?: number }): void;
    on(event: string, cb: () => void): void;
    off(event: string, cb: () => void): void;
}

export interface SavedFrame {
    view: PrintView;
    /** Paper scale denominator at the time it was framed. */
    scale: number;
    /** When it was framed (ms since epoch). */
    at: number;
}

const STORE_PREFIX = 'incident-manager:map-frame:';
const frames = reactive(new Map<string, SavedFrame | null>());

function readFrame(key: string): SavedFrame | null {
    try {
        const raw = JSON.parse(localStorage.getItem(STORE_PREFIX + key) ?? 'null') as SavedFrame | null;
        const c = raw?.view?.center;
        if (raw && Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Number.isFinite(raw.view.zoom)) return raw;
    } catch { /* nothing usable */ }
    return null;
}

/** The frame saved under `key`, or null. Reactive. */
export function savedFrame(key: string): SavedFrame | null {
    if (!frames.has(key)) frames.set(key, readFrame(key));
    return frames.get(key) ?? null;
}

function storeFrame(key: string, frame: SavedFrame | null): void {
    frames.set(key, frame);
    try {
        if (frame) localStorage.setItem(STORE_PREFIX + key, JSON.stringify(frame));
        else localStorage.removeItem(STORE_PREFIX + key);
    } catch { /* kept for this session only */ }
}

export function clearFrame(key: string): void {
    storeFrame(key, null);
}

export interface FramingOptions {
    /** Where the chosen view is saved. */
    key: string;
    /** The print box, in PDF points. */
    widthPt: number;
    heightPt: number;
    title: string;
    /** Called once the frame closes; `saved` when the user chose a view. */
    onClose?: (saved: boolean) => void;
}

let cancelActive: (() => void) | null = null;

/** Show the frame. Throws when the map isn't loaded. Starting again replaces an open frame. */
export function startMapFraming(opts: FramingOptions): void {
    cancelActive?.();
    const map = useMapStore().map as unknown as FramingMap | undefined;
    if (!map) throw new Error('The map is not loaded yet.');

    // Prints are flat and north-up: frame on a map that is too.
    if (map.getBearing() || map.getPitch()) map.jumpTo({ bearing: 0, pitch: 0 });

    const container = map.getContainer();
    const doc = container.ownerDocument;
    const aspect = opts.widthPt / opts.heightPt;
    let rect: ScreenRect = fitFrame(container.clientWidth, container.clientHeight, aspect);

    const root = doc.createElement('div');
    Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '4' });

    const frame = doc.createElement('div');
    Object.assign(frame.style, {
        position: 'absolute',
        border: '2px solid #fff',
        // Dim everything outside the frame without blocking the map.
        boxShadow: '0 0 0 1px rgba(0,0,0,0.7), 0 0 0 100vmax rgba(0,0,0,0.35)',
        pointerEvents: 'none',
    });

    const bar = doc.createElement('div');
    Object.assign(bar.style, {
        position: 'absolute', left: '-2px', right: '-2px', bottom: '100%',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '6px 8px', background: 'rgba(29,39,59,0.95)', color: '#fff',
        font: '13px/1.3 system-ui, sans-serif', borderRadius: '4px 4px 0 0',
        pointerEvents: 'auto', cursor: 'move', userSelect: 'none',
    });
    const label = doc.createElement('span');
    label.style.flex = '1 1 auto';
    label.style.minWidth = '0';
    const title = doc.createElement('strong');
    title.textContent = opts.title;
    const hint = doc.createElement('span');
    hint.style.opacity = '0.75';
    hint.textContent = ' · pan and zoom the map, drag this bar to move the frame';
    const scale = doc.createElement('span');
    scale.style.marginLeft = '6px';
    label.append(title, hint, scale);

    const button = (text: string, primary: boolean): HTMLButtonElement => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.textContent = text;
        Object.assign(b.style, {
            cursor: 'pointer', padding: '3px 10px', borderRadius: '4px', font: 'inherit',
            border: primary ? '1px solid #206bc4' : '1px solid rgba(255,255,255,0.5)',
            background: primary ? '#206bc4' : 'transparent', color: '#fff',
        });
        return b;
    };
    const use = button('Use this frame', true);
    const cancel = button('Cancel', false);
    bar.append(label, use, cancel);
    frame.append(bar);
    root.append(frame);
    container.append(root);

    const place = () => {
        Object.assign(frame.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    };

    const currentView = (): PrintView => {
        const c = map.unproject([rect.x + rect.w / 2, rect.y + rect.h / 2]);
        return { center: [c.lng, c.lat], zoom: zoomForFrame(map.getZoom(), rect.w, opts.widthPt * PX_PER_PT) };
    };

    const showScale = () => {
        const v = currentView();
        scale.textContent = `· ${paperScaleLabel(paperScale(v.center[1], v.zoom))} on paper`;
    };

    // Drag by the title bar, kept inside the map.
    let drag: { px: number; py: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        drag = { px: e.clientX, py: e.clientY, x: rect.x, y: rect.y };
        e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
        if (!drag) return;
        const barH = bar.offsetHeight;
        rect = {
            ...rect,
            x: Math.max(0, Math.min(container.clientWidth - rect.w, drag.x + e.clientX - drag.px)),
            y: Math.max(barH, Math.min(container.clientHeight - rect.h, drag.y + e.clientY - drag.py)),
        };
        place();
        showScale();
    };
    const onUp = () => { drag = null; };
    const onResize = () => {
        rect = fitFrame(container.clientWidth, container.clientHeight, aspect);
        place();
        showScale();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };

    const close = (saved: boolean) => {
        if (saved) {
            const view = currentView();
            storeFrame(opts.key, { view, scale: paperScale(view.center[1], view.zoom), at: Date.now() });
        }
        map.off('move', showScale);
        doc.removeEventListener('pointermove', onMove);
        doc.removeEventListener('pointerup', onUp);
        doc.removeEventListener('keydown', onKey);
        doc.defaultView?.removeEventListener('resize', onResize);
        root.remove();
        cancelActive = null;
        opts.onClose?.(saved);
    };

    bar.addEventListener('pointerdown', onDown);
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('keydown', onKey);
    doc.defaultView?.addEventListener('resize', onResize);
    map.on('move', showScale);
    use.addEventListener('click', () => close(true));
    cancel.addEventListener('click', () => close(false));

    cancelActive = () => close(false);
    place();
    showScale();
}
