/**
 * RegistryStore adapter: persists the OP-sync registry (domain/registry.ts)
 * in the management sync's mission_schema.json `tak_missions[]`.
 * Interface-adapter layer: implements a domain port over existing lib plumbing.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import type { RegistryStore } from '../domain/ports.ts';
import { registryFromSchemaValue } from '../domain/registry.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema } from './missionSchema.ts';

export function createRegistryStore(mission: ActiveMission): RegistryStore {
    return {
        async load(): Promise<OpPeriodRegistryEntry[]> {
            const sub = await loadSchemaSubscription(mission);
            const { schema } = await loadMissionSchema(sub);
            return registryFromSchemaValue(schema.tak_missions);
        },

        async save(entries: OpPeriodRegistryEntry[]): Promise<void> {
            const sub = await loadSchemaSubscription(mission);
            const loaded = await loadMissionSchema(sub);
            loaded.schema.tak_missions = entries;
            await saveMissionSchema(sub, loaded.schema, {
                contentHash: loaded.contentHash,
                legacyLogId: loaded.legacyLogId,
                missionToken: schemaMissionToken(sub, mission),
            });
        },
    };
}
