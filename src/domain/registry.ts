/**
 * Incident OP-sync registry: the `tak_missions[]` array in the management
 * sync's mission_schema.json. Pure parse/update helpers — persistence lives
 * in the adapter (src/lib/registryPersistence.ts).
 */

import type { OpPeriodRegistryEntry, OpStatus } from './entities.ts';

const STATUSES: OpStatus[] = ['open', 'debriefing', 'closed'];

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

/** Parse one raw registry value; null when the shape is unusable. */
export function registryEntryFromValue(raw: unknown): OpPeriodRegistryEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;

    const guid = asString(rec.guid).trim();
    const name = asString(rec.name).trim();
    if (!guid || !name) return null;

    const opNumber = Number(rec.opNumber);
    if (!Number.isInteger(opNumber) || opNumber < 0) return null;

    const status = STATUSES.includes(rec.status as OpStatus)
        ? (rec.status as OpStatus)
        : 'open';

    const channels = Array.isArray(rec.channels)
        ? rec.channels.filter((c): c is string => typeof c === 'string')
        : [];

    const entry: OpPeriodRegistryEntry = { opNumber, name, guid, status, channels };
    const ownerToken = asString(rec.ownerToken).trim();
    if (ownerToken) entry.ownerToken = ownerToken;
    const openedAt = asString(rec.openedAt).trim();
    if (openedAt) entry.openedAt = openedAt;
    const closedAt = asString(rec.closedAt).trim();
    if (closedAt) entry.closedAt = closedAt;
    return entry;
}

/**
 * Parse the schema's `tak_missions` value. Tolerates legacy content (strings,
 * malformed objects) by skipping it — the array historically held free-form
 * mission names.
 */
export function registryFromSchemaValue(value: unknown): OpPeriodRegistryEntry[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(registryEntryFromValue)
        .filter((e): e is OpPeriodRegistryEntry => e !== null)
        .sort((a, b) => a.opNumber - b.opNumber);
}

/** Insert or replace (by guid) an entry; returns a new sorted array. */
export function upsertRegistryEntry(
    entries: OpPeriodRegistryEntry[],
    entry: OpPeriodRegistryEntry,
): OpPeriodRegistryEntry[] {
    const rest = entries.filter((e) => e.guid !== entry.guid);
    return [...rest, entry].sort((a, b) => a.opNumber - b.opNumber);
}

/** Mark an entry closed (by guid); returns a new array. No-op when absent. */
export function closeRegistryEntry(
    entries: OpPeriodRegistryEntry[],
    guid: string,
    closedAt: string,
): OpPeriodRegistryEntry[] {
    return entries.map((e) => (
        e.guid === guid ? { ...e, status: 'closed' as OpStatus, closedAt } : e
    ));
}

/** Next OP number: one past the highest registered (minimum 1). */
export function nextOpNumber(entries: OpPeriodRegistryEntry[]): number {
    const max = entries.reduce((acc, e) => Math.max(acc, e.opNumber), 0);
    return max + 1;
}

/** The single open (or debriefing) OP with the highest number, if any. */
export function currentOpPeriod(
    entries: OpPeriodRegistryEntry[],
): OpPeriodRegistryEntry | null {
    const active = entries.filter((e) => e.status !== 'closed');
    if (!active.length) return null;
    return active.reduce((best, e) => (e.opNumber > best.opNumber ? e : best));
}
