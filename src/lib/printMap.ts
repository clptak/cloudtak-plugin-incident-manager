/**
 * Draw the live CloudTAK map at print resolution (#28) on a hidden MapLibre
 * map: same style, layers and icons as the screen, framed to a PDF box,
 * north-up, read back as a JPEG. The user's own map is never moved.
 */

import { useMapStore } from '../../../../src/stores/map.ts';
import {
    metersPerPixel,
    PX_PER_PT,
    trimmedView,
    type LngLat,
    type PrintView,
} from './printMapFrame.ts';

/** Just the parts of a MapLibre map this module touches. */
interface ImageData {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;
}
interface StyleImage {
    data: ImageData;
    pixelRatio?: number;
    sdf?: boolean;
}
interface StyleSpec {
    sources?: Record<string, { type?: string; data?: unknown }>;
    projection?: unknown;
    terrain?: unknown;
    sky?: unknown;
    [key: string]: unknown;
}
interface MapLike {
    getStyle(): StyleSpec;
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
    getCanvas(): HTMLCanvasElement;
    getSource(id: string): { getData?: () => Promise<unknown>; setData?: (data: unknown) => void } | undefined;
    getImage?(id: string): StyleImage | null | undefined;
    hasImage(id: string): boolean;
    addImage(id: string, image: ImageData, opts?: { pixelRatio?: number; sdf?: boolean }): void;
    addSource(id: string, source: unknown): void;
    addLayer(layer: unknown): void;
    loaded(): boolean;
    once(event: string, cb: () => void): void;
    on(event: string, cb: (e: { id?: string }) => void): void;
    remove(): void;
}
type MapCtor = new (options: Record<string, unknown>) => MapLike;

export interface PrintMapImage {
    jpeg: Uint8Array;
    widthPt: number;
    heightPt: number;
    /** Ground metres per PDF point, for the scale bar. */
    metersPerPt: number;
}

export interface PrintMapOptions {
    widthPt: number;
    heightPt: number;
    view: PrintView;
    /** Outline drawn over the map (the 204's assigned segment). */
    highlight?: LngLat[][];
    /** Device pixels per CSS pixel: 3 ≈ 288 dpi. */
    pixelRatio?: number;
    timeoutMs?: number;
}

function liveMap(): MapLike {
    const map = useMapStore().map as unknown as MapLike | undefined;
    if (!map) throw new Error('The map is not loaded yet.');
    return map;
}

/** The live view trimmed to a `widthPt × heightPt` box. */
export function currentPrintView(widthPt: number, heightPt: number): PrintView {
    const map = liveMap();
    const canvas = map.getCanvas();
    const c = map.getCenter();
    return trimmedView(
        [c.lng, c.lat],
        map.getZoom(),
        canvas.clientWidth,
        canvas.clientHeight,
        widthPt * PX_PER_PT,
        heightPt * PX_PER_PT,
    );
}

/**
 * The live style with each GeoJSON source's current data. CloudTAK feeds
 * markers by `updateData` diffs, which `getStyle()` alone can miss.
 */
async function snapshotStyle(map: MapLike): Promise<StyleSpec> {
    const style = map.getStyle();
    for (const [id, source] of Object.entries(style.sources ?? {})) {
        if (source.type !== 'geojson') continue;
        try {
            const data = await map.getSource(id)?.getData?.();
            if (data) source.data = data;
        } catch { /* keep what getStyle() had */ }
    }
    // Print flat and north-up, whatever the screen is doing.
    style.projection = { type: 'mercator' };
    delete style.terrain;
    delete style.sky;
    return style;
}

const HIGHLIGHT = 'im-print-highlight';

function addHighlight(map: MapLike, rings: LngLat[][]): void {
    map.addSource(HIGHLIGHT, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: rings } },
    });
    map.addLayer({ id: `${HIGHLIGHT}-casing`, type: 'line', source: HIGHLIGHT, paint: { 'line-color': '#ffffff', 'line-width': 7 } });
    map.addLayer({ id: HIGHLIGHT, type: 'line', source: HIGHLIGHT, paint: { 'line-color': '#e0187a', 'line-width': 3.5 } });
}

async function refreshGeoJson(map: MapLike, style: StyleSpec): Promise<void> {
    for (const [id, source] of Object.entries(style.sources ?? {})) {
        if (source.type !== 'geojson') continue;
        const live = map.getSource(id);
        try {
            const data = await live?.getData?.();
            if (data) live?.setData?.(data);
        } catch { /* leave it as drawn */ }
    }
}

function waitIdle(map: MapLike, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        map.once('idle', () => { clearTimeout(timer); resolve(); });
    });
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Could not read the map image.')); return; }
            void blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
        }, 'image/jpeg', 0.9);
    });
}

/** Render a print map. Throws when the map isn't ready or the browser can't draw it. */
export async function renderPrintMap(opts: PrintMapOptions): Promise<PrintMapImage> {
    const live = liveMap();
    const Ctor = live.constructor as unknown as MapCtor;
    const widthPx = Math.round(opts.widthPt * PX_PER_PT);
    const heightPx = Math.round(opts.heightPt * PX_PER_PT);

    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed', left: '-20000px', top: '0',
        width: `${widthPx}px`, height: `${heightPx}px`,
        pointerEvents: 'none',
    });
    document.body.appendChild(container);

    let map: MapLike | undefined;
    try {
        const style = await snapshotStyle(live);
        map = new Ctor({
            container,
            style,
            center: opts.view.center,
            zoom: opts.view.zoom,
            bearing: 0,
            pitch: 0,
            interactive: false,
            attributionControl: false,
            fadeDuration: 0,
            pixelRatio: opts.pixelRatio ?? 3,
            canvasContextAttributes: { preserveDrawingBuffer: true },
            preserveDrawingBuffer: true,
        });
        const printMap = map;
        let lateIcons = 0;
        // Icons CloudTAK added at runtime are not in the style: copy them over.
        printMap.on('styleimagemissing', (e) => {
            const id = e.id;
            if (!id || printMap.hasImage(id)) return;
            const img = live.getImage?.(id);
            if (!img?.data) return;
            // A plain copy: handing over the live map's own image object is silently ignored.
            const { width, height, data } = img.data;
            printMap.addImage(id, { width, height, data: new Uint8Array(data) }, { pixelRatio: img.pixelRatio, sdf: img.sdf });
            lateIcons++;
        });
        await new Promise<void>((resolve, reject) => {
            if (printMap.loaded()) { resolve(); return; }
            const timer = setTimeout(() => reject(new Error('The map took too long to load for printing.')), opts.timeoutMs ?? 25000);
            printMap.once('load', () => { clearTimeout(timer); resolve(); });
        });
        if (opts.highlight?.length) addHighlight(printMap, opts.highlight);
        await waitIdle(printMap, opts.timeoutMs ?? 25000);
        // Tiles laid out before a copied icon arrived leave its markers out;
        // feeding the GeoJSON again lays them out with the icon in place.
        for (let pass = 0; pass < 2 && lateIcons; pass++) {
            lateIcons = 0;
            await refreshGeoJson(printMap, style);
            await waitIdle(printMap, opts.timeoutMs ?? 25000);
        }

        const jpeg = await canvasJpeg(printMap.getCanvas());
        return {
            jpeg,
            widthPt: opts.widthPt,
            heightPt: opts.heightPt,
            metersPerPt: metersPerPixel(opts.view.center[1], opts.view.zoom) * PX_PER_PT,
        };
    } finally {
        map?.remove();
        container.remove();
    }
}
