/**
 * Mission Properties backend for loadMissionSchema / saveMissionSchema.
 *
 * A mission uses this backend only once it carries the `meta.schema` key.
 * Missions without it - every existing incident, and every incident on a
 * TAK Server older than 5.9 - keep using mission_schema.json exactly as before.
 *
 * Saves are diffs: the backend remembers the encoded form of each schema
 * object it handed out, and on save writes only the keys that changed since
 * then. Two managers editing different sections (or different debriefs / OP
 * periods) therefore no longer overwrite each other.
 *
 * Two edits to the same key are refused rather than silently overwritten:
 * before writing, a save checks each key it is about to change against the
 * server. If another manager changed one of them since this copy was loaded,
 * the save throws SchemaConflictError and writes nothing.
 */

import { MissionPropertyError, type MissionPropertyClient } from './missionProperties.ts';
import { keyLabels } from './screenKeys.ts';
import type { MissionSchema } from './missionSchema.ts';
import { META_SCHEMA_KEY, SCHEMA_VERSION } from './propertyKeys.ts';
import { decodeSchema, diffEncoded, encodeSchema } from './schemaCodec.ts';

/** Another manager changed keys this save would overwrite. Nothing was written. */
export class SchemaConflictError extends Error {
    readonly keys: string[];

    constructor(keys: string[]) {
        const what = keyLabels(keys).join(', ');
        super(
            `Another manager changed ${what} after you opened this screen, so your save was stopped `
            + 'to avoid overwriting their change. Reload to see it, then make your edit again.',
        );
        this.name = 'SchemaConflictError';
        this.keys = keys;
    }
}

/**
 * Keys this save would change that someone else changed since `before` was
 * taken. A key already holding the value we are about to write is not a
 * conflict (the same edit made twice).
 */
export function findConflicts(
    touched: string[],
    before: Map<string, string>,
    after: Map<string, string>,
    current: Map<string, string>,
): string[] {
    return touched.filter((key) => {
        const now = current.get(key) ?? null;
        return now !== (before.get(key) ?? null) && now !== (after.get(key) ?? null);
    });
}

export type ClientFactory = (missionGuid: string, missionToken?: string) => MissionPropertyClient;

export type SchemaStorage = 'unsupported' | 'file' | 'keys';

export interface SchemaPropertyBackend {
    /**
     * Where this mission's schema lives: `keys` (has meta.schema), `file`
     * (server supports Mission Properties but the incident is not migrated) or
     * `unsupported` (TAK Server older than 5.9).
     */
    storage(missionGuid: string): Promise<SchemaStorage>;
    /** The schema from keys, or null when this mission is not on keys (use the file). */
    load(missionGuid: string): Promise<{ schema: MissionSchema; invalid: string[] } | null>;
    /** Saves via keys and returns true, or returns false when the mission is not on keys. */
    save(missionGuid: string, schema: MissionSchema, missionToken?: string): Promise<boolean>;
    /**
     * Copy a schema (normally loaded from mission_schema.json) onto keys.
     * `meta.schema` is written last, so other clients only switch to keys once
     * every other key is in place. Leaves mission_schema.json untouched.
     */
    migrate(missionGuid: string, schema: MissionSchema, missionToken?: string): Promise<{ written: number }>;
}

export function createSchemaPropertyBackend(clientFor: ClientFactory): SchemaPropertyBackend {
    /** Missions whose server has no Mission Properties - don't probe again. */
    const unsupported = new Set<string>();
    /** Encoded form of each schema object handed out, for diffing on save. */
    const snapshots = new WeakMap<object, Map<string, string>>();

    /** All keys, or null when the server has no Mission Properties. */
    async function readAll(missionGuid: string): Promise<Map<string, string> | null> {
        if (unsupported.has(missionGuid)) return null;
        try {
            const props = await clientFor(missionGuid).list();
            return new Map(props.map((p) => [p.key, p.value]));
        } catch (err) {
            // Permission problems are real errors, not a missing feature.
            if (err instanceof MissionPropertyError && (err.status === 401 || err.status === 403)) throw err;
            unsupported.add(missionGuid);
            return null;
        }
    }

    async function write(
        client: MissionPropertyClient,
        before: Map<string, string>,
        after: Map<string, string>,
    ): Promise<number> {
        const { set, remove } = diffEncoded(before, after);
        for (const [key, value] of set) await client.set(key, value);
        for (const key of remove) await client.delete(key);
        return set.length + remove.length;
    }

    return {
        async storage(missionGuid) {
            const props = await readAll(missionGuid);
            if (!props) return 'unsupported';
            return props.has(META_SCHEMA_KEY) ? 'keys' : 'file';
        },

        async load(missionGuid) {
            const props = await readAll(missionGuid);
            if (!props || !props.has(META_SCHEMA_KEY)) return null;
            const { schema, invalid } = decodeSchema(props);
            snapshots.set(schema, encodeSchema(schema));
            return { schema, invalid };
        },

        async save(missionGuid, schema, missionToken) {
            let before = snapshots.get(schema);
            const after = encodeSchema(schema);
            if (!before) {
                // A schema object this backend did not hand out (a fresh
                // default, or one loaded from the file): only save via keys if
                // the mission is already on keys, diffing against the server.
                const props = await readAll(missionGuid);
                if (!props || !props.has(META_SCHEMA_KEY)) return false;
                before = encodeSchema(decodeSchema(props).schema);
            } else {
                const { set, remove } = diffEncoded(before, after);
                const touched = [...set.map(([key]) => key), ...remove];
                if (touched.length) {
                    const current = await readAll(missionGuid);
                    if (current) {
                        const conflicts = findConflicts(touched, before, after, current);
                        if (conflicts.length) throw new SchemaConflictError(conflicts);
                    }
                }
            }
            await write(clientFor(missionGuid, missionToken), before, after);
            snapshots.set(schema, after);
            return true;
        },

        async migrate(missionGuid, schema, missionToken) {
            const client = clientFor(missionGuid, missionToken);
            if ((await client.get(META_SCHEMA_KEY)) !== null) {
                throw new Error('This incident is already stored as mission properties - not migrating again');
            }
            const encoded = encodeSchema(schema);
            let written = 0;
            for (const [key, value] of encoded) {
                if (key === META_SCHEMA_KEY) continue;
                await client.set(key, value);
                written++;
            }
            await client.set(META_SCHEMA_KEY, SCHEMA_VERSION);
            unsupported.delete(missionGuid);
            return { written: written + 1 };
        },
    };
}
