/**
 * Minimal, dependency-free XML reader.
 *
 * Clean Architecture inner layer: NO imports from src/lib, CloudTAK, or Vue —
 * and deliberately no `DOMParser`, which does not exist under Node's test
 * runner. GPX and KML are simple enough (elements, attributes, text, CDATA)
 * that a ~150-line scanner covers them, and keeping it here means the track-log
 * parsers are unit-testable without a browser.
 *
 * This is NOT a conforming XML parser: it ignores namespaces beyond stripping
 * the prefix, does not resolve DTD entities, and does not validate. That is
 * appropriate for reading GPS exports and wrong for anything else.
 *
 * NOTE: keep this file erasable-TypeScript only (no enums/namespaces) so the
 * unit tests run under Node's native type stripping (`npm test`).
 */

export interface XmlNode {
    /** Local name with any namespace prefix stripped (`gx:coord` → `coord`). */
    name: string;
    attrs: Record<string, string>;
    children: XmlNode[];
    /** Direct text content of this element (not descendants'). */
    text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

export function decodeEntities(value: string): string {
    if (!value.includes('&')) return value;
    return value.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
        if (entity[0] === '#') {
            const hex = entity[1] === 'x' || entity[1] === 'X';
            const code = hex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
            try {
                return String.fromCodePoint(code);
            } catch {
                return match;
            }
        }
        return NAMED_ENTITIES[entity] ?? match;
    });
}

/** `gx:coord` → `coord`; `LineString` → `LineString`. */
function localName(raw: string): string {
    const colon = raw.indexOf(':');
    return colon === -1 ? raw : raw.slice(colon + 1);
}

const ATTR_RE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function parseAttributes(source: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    ATTR_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTR_RE.exec(source)) !== null) {
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        attrs[localName(match[1])] = decodeEntities(value);
    }
    return attrs;
}

function node(name: string, attrs: Record<string, string> = {}): XmlNode {
    return { name, attrs, children: [], text: '' };
}

/**
 * Parse a document into a synthetic `#document` root whose children are the
 * top-level elements. Malformed input degrades (unclosed tags are closed at
 * EOF) rather than throwing — a truncated GPS export should still yield the
 * points it does contain.
 */
export function parseXml(source: string): XmlNode {
    const root = node('#document');
    const stack: XmlNode[] = [root];
    let i = 0;

    const current = (): XmlNode => stack[stack.length - 1];

    while (i < source.length) {
        const lt = source.indexOf('<', i);
        if (lt === -1) {
            current().text += decodeEntities(source.slice(i));
            break;
        }
        if (lt > i) current().text += decodeEntities(source.slice(i, lt));

        if (source.startsWith('<!--', lt)) {
            const end = source.indexOf('-->', lt + 4);
            i = end === -1 ? source.length : end + 3;
            continue;
        }
        if (source.startsWith('<![CDATA[', lt)) {
            const end = source.indexOf(']]>', lt + 9);
            const stop = end === -1 ? source.length : end;
            current().text += source.slice(lt + 9, stop);
            i = end === -1 ? source.length : end + 3;
            continue;
        }
        if (source.startsWith('<?', lt)) {
            const end = source.indexOf('?>', lt + 2);
            i = end === -1 ? source.length : end + 2;
            continue;
        }
        if (source.startsWith('<!', lt)) {
            // DOCTYPE and friends — skipped wholesale.
            const end = source.indexOf('>', lt + 2);
            i = end === -1 ? source.length : end + 1;
            continue;
        }

        const gt = source.indexOf('>', lt + 1);
        if (gt === -1) break;
        const inner = source.slice(lt + 1, gt);
        i = gt + 1;

        if (inner.startsWith('/')) {
            const name = localName(inner.slice(1).trim());
            // Pop to the nearest matching open element; ignore strays.
            for (let depth = stack.length - 1; depth > 0; depth--) {
                if (stack[depth].name === name) {
                    stack.length = depth;
                    break;
                }
            }
            continue;
        }

        const selfClosing = inner.endsWith('/');
        const body = selfClosing ? inner.slice(0, -1) : inner;
        const space = body.search(/\s/);
        const rawName = space === -1 ? body : body.slice(0, space);
        if (!rawName) continue;

        const el = node(localName(rawName), space === -1 ? {} : parseAttributes(body.slice(space)));
        current().children.push(el);
        if (!selfClosing) stack.push(el);
    }

    return root;
}

/** Every descendant (and self) whose local name matches, case-insensitively. */
export function findAll(root: XmlNode, name: string): XmlNode[] {
    const wanted = name.toLowerCase();
    const out: XmlNode[] = [];
    const walk = (n: XmlNode): void => {
        if (n.name.toLowerCase() === wanted) out.push(n);
        for (const child of n.children) walk(child);
    };
    walk(root);
    return out;
}

/** First descendant matching `name`, depth-first. */
export function findFirst(root: XmlNode, name: string): XmlNode | undefined {
    return findAll(root, name)[0];
}

/** Direct children matching `name` (does not descend). */
export function childrenNamed(node_: XmlNode, name: string): XmlNode[] {
    const wanted = name.toLowerCase();
    return node_.children.filter((c) => c.name.toLowerCase() === wanted);
}

/** All text in the subtree, trimmed. */
export function textOf(node_: XmlNode | undefined): string {
    if (!node_) return '';
    let out = node_.text;
    for (const child of node_.children) out += textOf(child);
    return out.trim();
}
