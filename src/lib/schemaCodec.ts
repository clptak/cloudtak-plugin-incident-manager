/**
 * Lossless mapping between the mission_schema.json object and Mission
 * Properties keys, used by the properties backend of load/saveMissionSchema.
 *
 * Layout (see propertyKeys.ts):
 *   meta.schema                         "2" - marks a mission as using keys
 *   op.<n>.mission                      one tak_missions[] entry each
 *   op.<n>.debrief.<segment>.<id>       one incident_response.debriefs[] entry each
 *   s.<field>                           every other top-level field, as JSON
 *   s.incident-response.<field>         every other incident_response field, as JSON
 *   c.<collection>.<id>                 one record of a busy collection (schemaCollections.ts)
 *
 * Section keys use the schema's own field names with "_" written as "-" (an
 * underscore is a wildcard in the server's prefix filter). Every field gets
 * its own key, so writers of different sections never overwrite each other;
 * the two per-record arrays go further, so writers of different records don't.
 *
 * Anything the codec cannot place safely - a field name that already contains
 * "-" or other key-unsafe characters - is kept whole in `s.rest`, so nothing
 * is ever dropped.
 */

import type { MissionSchema } from './missionSchema.ts';
import {
    debriefPropertyKey,
    isDebriefKey,
    META_SCHEMA_KEY,
    opMissionKey,
    opNumberFromMissionKey,
    SCHEMA_VERSION,
} from './propertyKeys.ts';
import { extractCollections, isCollectionKey, mergeCollections } from './schemaCollections.ts';

const SECTION = 's.';
const IR_FIELD = 'incident_response';
const IR_SECTION = `${SECTION}incident-response.`;
const REST_KEY = `${SECTION}rest`;

/** Field names the codec can turn into a key segment and back unchanged. */
const FIELD_RE = /^[A-Za-z0-9_]+$/;

function fieldToSegment(field: string): string | null {
    return FIELD_RE.test(field) && /[A-Za-z0-9]/.test(field[0]) ? field.replace(/_/g, '-') : null;
}

function segmentToField(segment: string): string {
    return segment.replace(/-/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * `layout: 2` writes the previous layout (no per-record `c.*` keys); it exists
 * so tests can build an incident as older builds stored it.
 */
export function encodeSchema(input: MissionSchema, opts: { layout?: 2 | 3 } = {}): Map<string, string> {
    const out = new Map<string, string>();
    const rest: Record<string, unknown> = {};
    const layout = opts.layout ?? 3;
    out.set(META_SCHEMA_KEY, layout === 2 ? '2' : SCHEMA_VERSION);

    // Per-record keys first, on a private copy; what they could not place is
    // left in the copy and encoded below with its field.
    const schema = structuredClone(input) as Record<string, unknown>;
    if (layout === 3) {
        for (const [key, value] of extractCollections(schema)) out.set(key, value);
    }

    for (const [field, value] of Object.entries(schema)) {
        if (value === undefined) continue;

        if (field === 'tak_missions' && Array.isArray(value)) {
            const unplaced: unknown[] = [];
            for (const entry of value) {
                const op = isRecord(entry) ? Number(entry.opNumber) : NaN;
                const key = Number.isInteger(op) && op >= 0 ? opMissionKey(op) : null;
                if (key && !out.has(key)) out.set(key, JSON.stringify(entry));
                else unplaced.push(entry);
            }
            if (unplaced.length) rest.tak_missions = unplaced;
            continue;
        }

        if (field === IR_FIELD && isRecord(value)) {
            const irRest: Record<string, unknown> = {};
            for (const [irField, irValue] of Object.entries(value)) {
                if (irValue === undefined) continue;
                if (irField === 'debriefs' && Array.isArray(irValue)) {
                    const unplaced: unknown[] = [];
                    for (const rec of irValue) {
                        const ok = isRecord(rec)
                            && typeof rec.segmentUid === 'string' && rec.segmentUid.trim()
                            && Number.isInteger(Number(rec.opNumber));
                        const key = ok ? debriefPropertyKey({
                            opNumber: Number(rec.opNumber),
                            segmentUid: String(rec.segmentUid).trim(),
                            resource: typeof rec.resource === 'string' ? rec.resource.trim() || undefined : undefined,
                            recordedAt: typeof rec.recordedAt === 'string' ? rec.recordedAt : undefined,
                        }) : null;
                        if (key && !out.has(key)) out.set(key, JSON.stringify(rec));
                        else unplaced.push(rec);
                    }
                    if (unplaced.length) irRest.debriefs = unplaced;
                    continue;
                }
                const seg = fieldToSegment(irField);
                if (seg) out.set(`${IR_SECTION}${seg}`, JSON.stringify(irValue));
                else irRest[irField] = irValue;
            }
            if (Object.keys(irRest).length) rest[IR_FIELD] = irRest;
            continue;
        }

        const seg = fieldToSegment(field);
        if (seg && field !== 'rest') out.set(`${SECTION}${seg}`, JSON.stringify(value));
        else rest[field] = value;
    }

    if (Object.keys(rest).length) out.set(REST_KEY, JSON.stringify(rest));
    return out;
}

/** Order of the per-record arrays when rebuilt (keys carry no order). */
function byOpNumber(a: unknown, b: unknown): number {
    return Number((a as { opNumber?: unknown }).opNumber) - Number((b as { opNumber?: unknown }).opNumber);
}

function byRecordedAt(a: unknown, b: unknown): number {
    const ta = String((a as { recordedAt?: unknown }).recordedAt ?? '');
    const tb = String((b as { recordedAt?: unknown }).recordedAt ?? '');
    return ta < tb ? -1 : ta > tb ? 1 : 0;
}

export interface DecodeResult {
    schema: MissionSchema;
    /** Keys whose value could not be parsed; reported, never thrown. */
    invalid: string[];
}

export function decodeSchema(props: Iterable<[string, string]>): DecodeResult {
    const schema: Record<string, unknown> = {};
    const ir: Record<string, unknown> = {};
    const ops: unknown[] = [];
    const debriefs: unknown[] = [];
    const invalid: string[] = [];
    let rest: Record<string, unknown> = {};
    const collectionProps: Array<[string, string]> = [];

    for (const [key, raw] of props) {
        if (key === META_SCHEMA_KEY) continue;
        if (isCollectionKey(key)) {
            collectionProps.push([key, raw]);
            continue;
        }
        let value: unknown;
        try {
            value = JSON.parse(raw);
        } catch {
            invalid.push(key);
            continue;
        }

        if (opNumberFromMissionKey(key) !== null) ops.push(value);
        else if (isDebriefKey(key)) debriefs.push(value);
        else if (key === REST_KEY) rest = isRecord(value) ? value : {};
        else if (key.startsWith(IR_SECTION)) ir[segmentToField(key.slice(IR_SECTION.length))] = value;
        else if (key.startsWith(SECTION)) schema[segmentToField(key.slice(SECTION.length))] = value;
        // Keys outside this layout belong to other features (cad.published.*,
        // plan.*, ...) and are not part of the schema object.
    }

    const restOps = Array.isArray(rest.tak_missions) ? rest.tak_missions : [];
    schema.tak_missions = [...ops.sort(byOpNumber), ...restOps];

    const restIr = isRecord(rest[IR_FIELD]) ? rest[IR_FIELD] : {};
    const restDebriefs = Array.isArray(restIr.debriefs) ? restIr.debriefs : [];
    const allDebriefs = [...debriefs.sort(byRecordedAt), ...restDebriefs];
    if (allDebriefs.length) ir.debriefs = allDebriefs;
    for (const [k, v] of Object.entries(restIr)) if (k !== 'debriefs') ir[k] = v;
    schema[IR_FIELD] = ir;

    for (const [k, v] of Object.entries(rest)) {
        if (k !== 'tak_missions' && k !== IR_FIELD) schema[k] = v;
    }

    mergeCollections(schema, collectionProps, invalid);
    return { schema: schema as MissionSchema, invalid };
}

/** Keys this codec owns (everything decodeSchema reads). */
export function isSchemaKey(key: string): boolean {
    return key === META_SCHEMA_KEY
        || key.startsWith(SECTION)
        || isCollectionKey(key)
        || opNumberFromMissionKey(key) !== null
        || isDebriefKey(key);
}

/** Keys to write and delete to move the server from `before` to `after`. */
export function diffEncoded(before: Map<string, string>, after: Map<string, string>): {
    set: Array<[string, string]>;
    remove: string[];
} {
    const set: Array<[string, string]> = [];
    for (const [k, v] of after) if (before.get(k) !== v) set.push([k, v]);
    const remove = [...before.keys()].filter((k) => !after.has(k));
    return { set, remove };
}
