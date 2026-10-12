/**
 * POA lock keys and client-level read/write (no browser imports, so they
 * are unit-tested). See poaLockPersistence.ts for the mission wiring.
 */

import { poaLockFromValue, type PoaLock } from '../domain/poaLock.ts';
import type { MissionPropertyClient } from './missionProperties.ts';

export function poaLockPrefix(opNumber: number): string {
    return `op.${opNumber}.poa.`;
}

/** `2026-10-11T22:00:00.000Z` -> `20261011T220000000Z` (key-safe, sorts by time). */
export function poaLockKey(lock: Pick<PoaLock, 'opNumber' | 'lockedAt'>): string {
    return `${poaLockPrefix(lock.opNumber)}${lock.lockedAt.replace(/[-:.]/g, '')}`;
}

/** Locks for one OP, oldest first. */
export async function listPoaLocksWith(client: MissionPropertyClient, opNumber: number): Promise<PoaLock[]> {
    const { items } = await client.listJson<unknown>(poaLockPrefix(opNumber));
    return items
        .map(({ value }) => poaLockFromValue(value))
        .filter((lock): lock is PoaLock => lock !== null && lock.opNumber === opNumber)
        .sort((a, b) => (a.lockedAt < b.lockedAt ? -1 : a.lockedAt > b.lockedAt ? 1 : 0));
}

export async function savePoaLockWith(client: MissionPropertyClient, lock: PoaLock): Promise<void> {
    await client.setJson(poaLockKey(lock), lock);
}
