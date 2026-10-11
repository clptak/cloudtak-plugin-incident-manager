/**
 * Per-record keys for the schema's busy collections (layout v3).
 *
 * In layout v2 each schema field was one key, so two managers adding
 * different segments, resources or CAD notes at the same moment wrote the
 * same key and one of them had to redo theirs. Here each record of these
 * collections gets its own key, so they no longer meet:
 *
 *   c.segments.<uid>              schema.segments[uid]                 (map)
 *   c.row-segments.<uid>          schema.row_segments[uid]             (map)
 *   c.resources.<id>              incident_response.resource_assignments[]
 *   c.work-assignments.<id>       incident_response.work_assignments[]
 *   c.op-assignments.<op>-<seg>   incident_response.op_assignments[]
 *   c.clues.<op>-<hash>           incident_response.clues[]
 *   c.iap.<op>.<field>            incident_response.iap_plans[op][field] (one key per IAP field)
 *   c.cad-remarks.<hash>          cad_data.call_remarks[]
 *   c.cad-logs.<hash>             tak_server.mission_logs[]
 *
 * Values are JSON wrappers: `{ k, v }` for maps (k = the original map key,
 * since the key segment may be a hash), `{ n, v }` for arrays (n = position,
 * used to rebuild the order when the collection has no natural sort field).
 *
 * Anything that cannot get a safe, unique key - a record without an id, two
 * records with the same id - stays where it was in the schema and is encoded
 * with its field's ordinary `s.` key, so nothing is ever dropped.
 */

import { shortHash, uidSegment } from './propertyKeys.ts';

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** One key segment: kept when already key-safe and short, else hashed. */
function seg(id: string): string {
    return id.length <= 64 ? uidSegment(id) : `h${shortHash(id)}`;
}

interface ArraySpec {
    kind: 'array';
    name: string;
    path: string[];
    /** Key id for a record, or null when it has none (record stays in place). */
    id(record: unknown): string | null;
    /** Sort key when the collection has a natural order; otherwise position is stored. */
    order?(record: unknown): string;
}

interface MapSpec {
    kind: 'map';
    name: string;
    path: string[];
}

/** A map of objects whose fields each get a key (IAP plans by OP). */
interface FieldMapSpec {
    kind: 'fieldmap';
    name: string;
    path: string[];
}

type Spec = ArraySpec | MapSpec | FieldMapSpec;

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const SPECS: Spec[] = [
    { kind: 'map', name: 'segments', path: ['segments'] },
    { kind: 'map', name: 'row-segments', path: ['row_segments'] },
    {
        kind: 'array',
        name: 'resources',
        path: ['incident_response', 'resource_assignments'],
        id: (r) => (isRecord(r) && str(r.id).trim() ? seg(str(r.id).trim()) : null),
    },
    {
        kind: 'array',
        name: 'work-assignments',
        path: ['incident_response', 'work_assignments'],
        id: (r) => (isRecord(r) && str(r.id).trim() ? seg(str(r.id).trim()) : null),
    },
    {
        kind: 'array',
        name: 'op-assignments',
        path: ['incident_response', 'op_assignments'],
        // Upserted by (OP, segment), so that pair is the identity.
        id: (r) => (isRecord(r) && Number.isInteger(Number(r.opNumber)) && str(r.segmentUid).trim()
            ? `${Number(r.opNumber)}-${seg(str(r.segmentUid).trim())}`
            : null),
        // Upsert moves a record to the end; ordering by creation keeps other keys still.
        order: (r) => (isRecord(r) ? `${str(r.createdAt)}|${String(r.opNumber).padStart(6, '0')}` : ''),
    },
    {
        kind: 'array',
        name: 'clues',
        path: ['incident_response', 'clues'],
        id: (r) => (isRecord(r) && Number.isInteger(Number(r.opNumber)) && str(r.recordedAt)
            ? `${Number(r.opNumber)}-${shortHash(str(r.recordedAt))}`
            : null),
        order: (r) => (isRecord(r) ? str(r.recordedAt) : ''),
    },
    { kind: 'fieldmap', name: 'iap', path: ['incident_response', 'iap_plans'] },
    {
        kind: 'array',
        name: 'cad-remarks',
        path: ['cad_data', 'call_remarks'],
        id: (r) => shortHash(JSON.stringify(r)),
    },
    {
        kind: 'array',
        name: 'cad-logs',
        path: ['tak_server', 'mission_logs'],
        id: (r) => shortHash(JSON.stringify(r)),
    },
];

export const COLLECTION_PREFIX = 'c.';

/** Field names that can be a key segment and come back unchanged. */
const FIELD_RE = /^[A-Za-z0-9][A-Za-z0-9_]*$/;
const fieldToSeg = (f: string) => f.replace(/_/g, '-');
const segToField = (s: string) => s.replace(/-/g, '_');

/** Keys whose value changes on every save (timestamps) - never a real conflict. */
export function isVolatileKey(key: string): boolean {
    return /^c\.iap\.[^.]+\.updated$/.test(key);
}

function parent(root: Rec, path: string[]): Rec | null {
    let node: unknown = root;
    for (const part of path.slice(0, -1)) {
        if (!isRecord(node)) return null;
        node = node[part];
    }
    return isRecord(node) ? node : null;
}

function ensureParent(root: Rec, path: string[]): Rec {
    let node = root;
    for (const part of path.slice(0, -1)) {
        if (!isRecord(node[part])) node[part] = {};
        node = node[part] as Rec;
    }
    return node;
}

/**
 * Move collection records out of `schema` (a private copy - it is mutated)
 * into keys. What cannot be keyed is left in place for the ordinary encoder.
 */
export function extractCollections(schema: Rec): Map<string, string> {
    const out = new Map<string, string>();
    for (const spec of SPECS) {
        const container = parent(schema, spec.path);
        if (!container) continue;
        const field = spec.path[spec.path.length - 1];
        const raw = container[field];
        const prefix = `${COLLECTION_PREFIX}${spec.name}.`;

        if (spec.kind === 'array') {
            if (!Array.isArray(raw)) continue;
            const leftovers: unknown[] = [];
            raw.forEach((record, n) => {
                const id = spec.id(record);
                const key = id ? `${prefix}${id}` : null;
                if (!key || out.has(key)) {
                    leftovers.push(record);
                    return;
                }
                out.set(key, JSON.stringify(spec.order ? { v: record } : { n, v: record }));
            });
            container[field] = leftovers;
        } else if (spec.kind === 'map') {
            if (!isRecord(raw)) continue;
            const leftovers: Rec = {};
            for (const [k, v] of Object.entries(raw)) {
                const key = `${prefix}${seg(k)}`;
                if (v === undefined) continue;
                if (out.has(key)) leftovers[k] = v;
                else out.set(key, JSON.stringify({ k, v }));
            }
            container[field] = leftovers;
        } else {
            if (!isRecord(raw)) continue;
            const leftovers: Rec = {};
            for (const [k, plan] of Object.entries(raw)) {
                // Only plain keys (OP numbers) whose fields are all key-safe.
                if (!/^[A-Za-z0-9-]{1,32}$/.test(k) || !isRecord(plan)
                    || Object.keys(plan).some((f) => !FIELD_RE.test(f))) {
                    leftovers[k] = plan;
                    continue;
                }
                for (const [f, v] of Object.entries(plan)) {
                    if (v === undefined) continue;
                    out.set(`${prefix}${k}.${fieldToSeg(f)}`, JSON.stringify(v));
                }
                // An empty plan still exists: mark it so decode recreates it.
                if (!Object.keys(plan).length) out.set(`${prefix}${k}`, '{}');
            }
            container[field] = leftovers;
        }
    }
    return out;
}

export function isCollectionKey(key: string): boolean {
    return key.startsWith(COLLECTION_PREFIX);
}

/**
 * Put collection keys back into a decoded schema (mutated). Records the
 * ordinary decoder already placed (leftovers) are kept after the keyed ones.
 * Unparseable values are reported in `invalid`.
 */
export function mergeCollections(schema: Rec, props: Iterable<[string, string]>, invalid: string[]): void {
    const byPrefix = new Map<string, Array<[string, unknown]>>();
    for (const [key, raw] of props) {
        if (!isCollectionKey(key)) continue;
        const name = key.slice(COLLECTION_PREFIX.length).split('.')[0];
        let value: unknown;
        try {
            value = JSON.parse(raw);
        } catch {
            invalid.push(key);
            continue;
        }
        const list = byPrefix.get(name) ?? [];
        list.push([key, value]);
        byPrefix.set(name, list);
    }

    for (const spec of SPECS) {
        const entries = byPrefix.get(spec.name);
        if (!entries?.length) continue;
        const container = ensureParent(schema, spec.path);
        const field = spec.path[spec.path.length - 1];
        const prefix = `${COLLECTION_PREFIX}${spec.name}.`;

        if (spec.kind === 'array') {
            const keyed = entries
                .filter(([, w]) => isRecord(w) && 'v' in w)
                .map(([key, w]) => ({ key, w: w as { n?: unknown; v: unknown } }));
            keyed.sort((a, b) => {
                const ka = spec.order ? spec.order(a.w.v) : '';
                const kb = spec.order ? spec.order(b.w.v) : '';
                if (ka !== kb) return ka < kb ? -1 : 1;
                const na = Number(a.w.n ?? 0);
                const nb = Number(b.w.n ?? 0);
                if (na !== nb) return na - nb;
                return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
            });
            const leftovers = Array.isArray(container[field]) ? container[field] as unknown[] : [];
            container[field] = [...keyed.map((e) => e.w.v), ...leftovers];
        } else if (spec.kind === 'map') {
            const map: Rec = {};
            // Keys carry no order; segments and ROW polygons are listed in
            // creation order, so rebuild that (key as the tie-break).
            const created = (w: Rec) => (isRecord(w.v) ? str(w.v.created) : '');
            const sorted = entries
                .filter(([, w]) => isRecord(w) && typeof w.k === 'string' && 'v' in w)
                .map(([key, w]) => ({ key, w: w as Rec }))
                .sort((a, b) => {
                    const ca = created(a.w);
                    const cb = created(b.w);
                    if (ca !== cb) return ca < cb ? -1 : 1;
                    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
                });
            for (const { w } of sorted) map[w.k as string] = w.v;
            const leftovers = isRecord(container[field]) ? container[field] as Rec : {};
            container[field] = { ...map, ...leftovers };
        } else {
            const plans: Rec = {};
            for (const [key, value] of entries) {
                const rest = key.slice(prefix.length);
                const dot = rest.indexOf('.');
                const op = dot === -1 ? rest : rest.slice(0, dot);
                const plan = (isRecord(plans[op]) ? plans[op] : (plans[op] = {})) as Rec;
                if (dot !== -1) plan[segToField(rest.slice(dot + 1))] = value;
            }
            const leftovers = isRecord(container[field]) ? container[field] as Rec : {};
            container[field] = { ...plans, ...leftovers };
        }
    }
}
