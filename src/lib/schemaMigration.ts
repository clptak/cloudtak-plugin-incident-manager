/**
 * Move an existing incident's planning data from mission_schema.json onto
 * Mission Properties (TAK Server 5.9+), on the Sworn-only management sync.
 *
 * mission_schema.json is left in place as a backup. After migration every
 * client reads and writes the keys; the file is no longer updated.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, schemaPropertyBackend } from './missionSchema.ts';
import type { SchemaStorage } from './schemaPropertyBackend.ts';
import { encodeSchema } from './schemaCodec.ts';

/**
 * Where this incident's planning data lives. Single-sync incidents (no
 * management sync) report `unsupported`: their schema sits on a mission the
 * field channels can see, so it is never moved onto keys.
 */
export async function incidentSchemaStorage(mission: ActiveMission): Promise<SchemaStorage> {
    if (!mission.mgmt) return 'unsupported';
    return schemaPropertyBackend.storage(mission.mgmt.guid);
}

export interface MigrationResult {
    keys: number;
}

export async function migrateIncidentSchema(mission: ActiveMission): Promise<MigrationResult> {
    if (!mission.mgmt) {
        throw new Error('This incident has no management sync - planning data cannot be moved to Mission Properties.');
    }
    if (await incidentSchemaStorage(mission) !== 'file') {
        throw new Error('This incident is not eligible: it is already migrated or the server does not support Mission Properties.');
    }

    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);
    const { written } = await schemaPropertyBackend.migrate(sub.guid, schema, schemaMissionToken(sub, mission));

    // Read it back through the same path every client will now use.
    const fromKeys = await schemaPropertyBackend.load(sub.guid);
    if (!fromKeys) throw new Error('Migration finished but the incident did not switch to Mission Properties.');
    const expected = encodeSchema(schema);
    const actual = encodeSchema(fromKeys.schema);
    const mismatched = [...expected.keys()].filter((k) => expected.get(k) !== actual.get(k));
    if (mismatched.length || fromKeys.invalid.length) {
        throw new Error(
            `Migration wrote ${written} keys but ${mismatched.length + fromKeys.invalid.length} did not read back `
            + `correctly (${[...mismatched, ...fromKeys.invalid].slice(0, 5).join(', ')}). `
            + 'mission_schema.json is unchanged.',
        );
    }
    return { keys: written };
}
