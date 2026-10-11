/**
 * Pop the Incident Manager out into a separate browser window (video-wall style).
 *
 * Unlike CloudTAK's video wall (a dedicated `video.html` app entry in core), this
 * opens a blank same-origin child window and mounts a Vue app into it *from the
 * main window's JS context*. The popout therefore shares module singletons
 * (useIncident, assignment composables) and the host Pinia instance, so state is
 * live in both windows with no syncing code and no CloudTAK core changes.
 *
 * Trade-off: the popout lives and dies with the main CloudTAK tab — it is closed
 * automatically when the main tab unloads.
 */
import { createApp } from 'vue';
import type { App as VueApp } from 'vue';
import type { PluginAPI } from '../../../../plugin.ts';

export const POPOUT_WINDOW_NAME = 'incident-manager-popout';
const POPOUT_ROOT_ID = 'incident-manager-popout-root';
const POPOUT_FEATURES = 'width=1150,height=760,resizable=yes';

let api: PluginAPI | null = null;
let popoutWindow: Window | null = null;
let popoutApp: VueApp | null = null;
let styleObserver: MutationObserver | null = null;
/** Source node in the main document head -> its clone in the popout head. */
let styleClones = new Map<Node, Node>();
let mainUnloadHandler: (() => void) | null = null;

export function bindPopout(pluginApi: PluginAPI): void {
    api = pluginApi;
}

export function isPopoutOpen(): boolean {
    return Boolean(popoutWindow && !popoutWindow.closed);
}

export function focusPopout(): void {
    if (isPopoutOpen()) popoutWindow!.focus();
}

export function closePopout(): void {
    const win = popoutWindow;
    cleanup();
    if (win && !win.closed) win.close();
}

/**
 * Open (or focus) the popout window. Must be called from a user gesture so the
 * browser's popup blocker allows the window. Returns false if the window could
 * not be opened.
 */
export async function openPopout(): Promise<boolean> {
    if (!api) throw new Error('popout not bound');
    if (isPopoutOpen()) {
        focusPopout();
        return true;
    }

    // window.open must run synchronously within the user gesture — before any await.
    const win = window.open('', POPOUT_WINDOW_NAME, POPOUT_FEATURES);
    if (!win) return false;

    cleanup();
    popoutWindow = win;

    writeSkeleton(win);
    copyStyles(win);
    watchStyles(win);

    win.addEventListener('pagehide', onPopoutClosed);
    mainUnloadHandler = () => closePopout();
    window.addEventListener('pagehide', mainUnloadHandler);

    const { default: PopoutRoot } = await import('../components/popout/PopoutRoot.vue');
    if (popoutWindow !== win || win.closed) return false;

    const root = win.document.getElementById(POPOUT_ROOT_ID);
    if (!root) return false;

    const app = createApp(PopoutRoot);
    app.use(api.pinia);
    app.mount(root);
    popoutApp = app;
    win.focus();
    return true;
}

function writeSkeleton(win: Window): void {
    const doc = win.document;
    doc.open();
    doc.write(
        '<!DOCTYPE html><html><head>'
        + '<meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">'
        + `<base href="${document.baseURI}">`
        + '<title>Incident Manager — CloudTAK</title>'
        + `</head><body><div id="${POPOUT_ROOT_ID}" style="height: 100vh;"></div></body></html>`
    );
    doc.close();

    // Mirror theme attributes (e.g. data-bs-theme, classes) so Tabler styling applies.
    for (const attr of Array.from(document.documentElement.attributes)) {
        doc.documentElement.setAttribute(attr.name, attr.value);
    }
    for (const attr of Array.from(document.body.attributes)) {
        doc.body.setAttribute(attr.name, attr.value);
    }
}

function cloneStyleNode(node: Node, doc: Document): Node | null {
    if (node instanceof HTMLLinkElement) {
        if (node.rel !== 'stylesheet') return null;
        const clone = doc.createElement('link');
        clone.rel = 'stylesheet';
        // Use the resolved absolute URL so it loads regardless of the popout's base.
        clone.href = node.href;
        if (node.media) clone.media = node.media;
        return clone;
    }
    if (node instanceof HTMLStyleElement) {
        return doc.importNode(node, true);
    }
    return null;
}

function addStyleClone(node: Node, win: Window): void {
    if (styleClones.has(node)) return;
    const clone = cloneStyleNode(node, win.document);
    if (!clone) return;
    win.document.head.appendChild(clone);
    styleClones.set(node, clone);
}

function removeStyleClone(node: Node): void {
    const clone = styleClones.get(node);
    if (!clone) return;
    (clone as Element).remove();
    styleClones.delete(node);
}

function copyStyles(win: Window): void {
    for (const node of Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
        addStyleClone(node, win);
    }
}

/**
 * Keep popout styles in sync with the main document head. Vite injects <style>
 * tags lazily when async chunks (pane components) load, and replaces them on HMR.
 */
function watchStyles(win: Window): void {
    styleObserver = new MutationObserver((mutations) => {
        if (!isPopoutOpen()) return;
        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                const owner = mutation.target.parentElement;
                if (owner instanceof HTMLStyleElement && styleClones.has(owner)) {
                    (styleClones.get(owner) as HTMLStyleElement).textContent = owner.textContent;
                }
                continue;
            }
            mutation.addedNodes.forEach((node) => addStyleClone(node, win));
            mutation.removedNodes.forEach((node) => removeStyleClone(node));
        }
    });
    styleObserver.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
    });
}

function onPopoutClosed(): void {
    cleanup();
}

function cleanup(): void {
    if (styleObserver) {
        styleObserver.disconnect();
        styleObserver = null;
    }
    styleClones = new Map();
    if (mainUnloadHandler) {
        window.removeEventListener('pagehide', mainUnloadHandler);
        mainUnloadHandler = null;
    }
    if (popoutApp) {
        try {
            popoutApp.unmount();
        } catch {
            // Window may already be gone; nothing to unmount into.
        }
        popoutApp = null;
    }
    if (popoutWindow) {
        try {
            popoutWindow.removeEventListener('pagehide', onPopoutClosed);
        } catch {
            // Cross-window access can throw after close.
        }
        popoutWindow = null;
    }
}
