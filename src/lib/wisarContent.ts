/**
 * Reference text from WiSAR's /content endpoint (decision 14), made safe to
 * render with v-html. WiSAR already strips scripts and handlers, but the
 * server address is a user setting, so the plugin never trusts the HTML:
 * it keeps an allowlist of elements, drops event handlers and anything
 * that can load or run code, and allows only http(s)/mailto/# links.
 */

/** Elements kept (lower-case; SVG names as the HTML parser reports them). */
const ALLOWED = new Set([
    'div', 'p', 'span', 'b', 'strong', 'i', 'em', 'u', 'br', 'hr', 'small', 'sup', 'sub', 'code', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'a',
    'svg', 'g', 'path', 'line', 'rect', 'circle', 'ellipse', 'polyline', 'polygon', 'text', 'tspan',
    'defs', 'marker', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc', 'clippath',
]);

/** Elements removed together with their content. Anything else unknown is unwrapped (children kept). */
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'frame', 'object', 'embed', 'template', 'noscript', 'foreignobject',
    'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'img', 'video', 'audio',
    'source', 'image', 'use', 'animate', 'set', 'animatemotion', 'animatetransform', 'math',
]);

const SAFE_URL = /^(?:https?:|mailto:|#)/i;
const ATTR_NAME = /^[a-z][a-z0-9:_-]*$/i;

export function isSafeUrl(value: string): boolean {
    return SAFE_URL.test(value.trim());
}

/** Inline style without anything that loads a resource or runs code. */
export function cleanStyle(style: string): string {
    return style
        .split(';')
        .filter((decl) => decl.trim() && !/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding/i.test(decl))
        .join(';');
}

function cleanElement(el: Element): void {
    for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (!ATTR_NAME.test(name) || name.startsWith('on') || name === 'srcdoc' || name === 'formaction'
            || name === 'src' || name === 'id' || name === 'name') {
            el.removeAttribute(attr.name);
        } else if (name === 'href' || name === 'xlink:href') {
            if (!isSafeUrl(attr.value)) el.removeAttribute(attr.name);
        } else if (name === 'style') {
            const cleaned = cleanStyle(attr.value);
            if (cleaned) el.setAttribute('style', cleaned);
            else el.removeAttribute('style');
        }
    }
    if (el.tagName.toLowerCase() === 'a' && el.hasAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
    }
}

function walk(node: Node): void {
    for (const child of [...node.childNodes]) {
        if (child.nodeType === 8) { // comment
            child.remove();
            continue;
        }
        if (child.nodeType !== 1) continue;
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        if (DROP_WITH_CONTENT.has(tag)) {
            el.remove();
            continue;
        }
        walk(el);
        if (!ALLOWED.has(tag)) {
            el.replaceWith(...el.childNodes);
            continue;
        }
        cleanElement(el);
    }
}

/**
 * Sanitized copy of `html`. Uses the browser's DOMParser (inert: scripts in
 * the parsed document never run); pass one in for tests.
 */
export function sanitizeWisarHtml(html: string, parser: { parseFromString(s: string, type: 'text/html'): Document } = new DOMParser()): string {
    const doc = parser.parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
    walk(doc.body);
    return doc.body.innerHTML;
}

/** `{ '--text-primary': '#e8e9ec' }` → a style object, keeping only CSS custom properties with plain values. */
export function cssVariableStyle(vars: Record<string, string> | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars ?? {})) {
        if (/^--[a-z0-9-]+$/i.test(k) && /^[#a-z0-9(),.%\s-]+$/i.test(v) && !/url\s*\(/i.test(v)) out[k] = v;
    }
    return out;
}
