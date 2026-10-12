/**
 * POA locks on the management sync's Mission Properties (ADR-003):
 * one key per lock, `op.<n>.poa.<lockedAt>`, never overwritten - each
 * re-lock is a new key, so the keys are the record of what planning used
 * (Mission Properties keep no history of their own).
 *
 * Only incidents stored as Mission Properties can hold locks.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { PoaLock } from '../domain/poaLock.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { recordingClient } from './liveIncident.ts';
import { createMissionPropertyClient, type MissionPropertyClient } from './missionProperties.ts';
import { cloudtakPropertyTransport } from './missionPropertiesTransport.ts';
import { schemaPropertyBackend } from './missionSchema.ts';
import { listPoaLocksWith, savePoaLockWith } from './poaLockKeys.ts';

async function clientFor(mission: ActiveMission): Promise<MissionPropertyClient | null> {
    if (!mission.mgmt) return null;
    if (await schemaPropertyBackend.storage(mission.mgmt.guid) !== 'keys') return null;
    const sub = await loadSchemaSubscription(mission);
    return recordingClient(mission.mgmt.guid, createMissionPropertyClient({
        missionGuid: mission.mgmt.guid,
        missionToken: schemaMissionToken(sub, mission),
        transport: cloudtakPropertyTransport,
    }));
}

/** False when this incident cannot hold POA locks (not on Mission Properties). */
export async function poaLocksSupported(mission: ActiveMission): Promise<boolean> {
    return (await clientFor(mission)) !== null;
}

export async function listPoaLocks(mission: ActiveMission, opNumber: number): Promise<PoaLock[]> {
    const client = await clientFor(mission);
    return client ? listPoaLocksWith(client, opNumber) : [];
}

export async function savePoaLock(mission: ActiveMission, lock: PoaLock): Promise<void> {
    const client = await clientFor(mission);
    if (!client) {
        throw new Error('POA locks need the incident stored as Mission Properties (Dashboard → Move to Mission Properties).');
    }
    await savePoaLockWith(client, lock);
}
