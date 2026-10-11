/**
 * Domain-port adapters over TAK Server 5.9 Mission Properties on the
 * management sync. Same interfaces as registryPersistence.ts and
 * debriefPersistence.ts, but each record is its own key, so concurrent
 * writers of different records no longer overwrite each other.
 *
 * Not wired in yet: callers still use the mission_schema.json stores until the
 * read bridge (schema assembled from keys) lands, so the two never diverge.
 */

import type { DebriefRecord, OpPeriodRegistryEntry, TrackLogRef } from '../domain/entities.ts';
import type { DebriefStore, RegistryStore } from '../domain/ports.ts';
import { debriefRecordFromValue } from '../domain/debrief.ts';
import { registryEntryFromValue } from '../domain/registry.ts';
import { debriefKey } from '../domain/trackLog.ts';
import type { MissionPropertyClient } from './missionProperties.ts';
import {
    debriefPrefix,
    debriefPropertyKey,
    isDebriefKey,
    opMissionKey,
    opNumberFromMissionKey,
    OP_PREFIX,
} from './propertyKeys.ts';

/**
 * Registry: one `op.<n>.mission` key per operational period.
 *
 * `save()` receives the whole list (that is the port), so on its own it could
 * not tell which periods the caller actually changed. The store remembers what
 * it last loaded or saved and writes only the periods that differ from that
 * snapshot - so a manager holding a stale list does not overwrite another
 * manager's change to a different OP.
 */
export function createPropertyRegistryStore(client: MissionPropertyClient): RegistryStore {
    let snapshot: Map<number, string> | null = null;

    async function loadRaw(): Promise<Map<number, string>> {
        const raw = new Map<number, string>();
        for (const prop of await client.list(OP_PREFIX)) {
            const op = opNumberFromMissionKey(prop.key);
            if (op !== null) raw.set(op, prop.value);
        }
        return raw;
    }

    function parse(raw: Map<number, string>): OpPeriodRegistryEntry[] {
        const entries: OpPeriodRegistryEntry[] = [];
        for (const value of raw.values()) {
            let parsed: unknown;
            try {
                parsed = JSON.parse(value);
            } catch {
                continue;
            }
            const entry = registryEntryFromValue(parsed);
            if (entry) entries.push(entry);
        }
        return entries.sort((a, b) => a.opNumber - b.opNumber);
    }

    return {
        async load(): Promise<OpPeriodRegistryEntry[]> {
            const raw = await loadRaw();
            const entries = parse(raw);
            snapshot = new Map(entries.map((e) => [e.opNumber, JSON.stringify(e)]));
            return entries;
        },

        async save(entries: OpPeriodRegistryEntry[]): Promise<void> {
            const next = new Map<number, string>();
            for (const e of entries) {
                if (next.has(e.opNumber)) {
                    throw new Error(`Two operational periods are numbered ${e.opNumber} - not saving`);
                }
                next.set(e.opNumber, JSON.stringify(e));
            }

            // Without a prior load, diff against the server as it is now.
            const base = snapshot ?? new Map(parse(await loadRaw()).map((e) => [e.opNumber, JSON.stringify(e)]));

            for (const [op, value] of next) {
                if (base.get(op) !== value) await client.set(opMissionKey(op), value);
            }
            for (const op of base.keys()) {
                if (!next.has(op)) await client.delete(opMissionKey(op));
            }
            snapshot = next;
        },
    };
}

/** Debriefs: one key per record, `op.<n>.debrief.<segment>.<id>`. */
export function createPropertyDebriefStore(
    client: MissionPropertyClient,
    now: () => string = () => new Date().toISOString(),
): DebriefStore {
    async function loadWithKeys(prefix: string): Promise<Array<{ key: string; record: DebriefRecord }>> {
        const out: Array<{ key: string; record: DebriefRecord }> = [];
        for (const prop of await client.list(prefix)) {
            if (!isDebriefKey(prop.key)) continue;
            let parsed: unknown;
            try {
                parsed = JSON.parse(prop.value);
            } catch {
                continue;
            }
            const record = debriefRecordFromValue(parsed);
            if (record) out.push({ key: prop.key, record });
        }
        return out;
    }

    return {
        async load(): Promise<DebriefRecord[]> {
            return (await loadWithKeys(debriefPrefix())).map((r) => r.record);
        },

        /** A single key write - no load/modify/save of other debriefs. */
        async append(record: DebriefRecord): Promise<void> {
            const stored = { ...record, recordedAt: record.recordedAt ?? now() };
            await client.setJson(debriefPropertyKey(stored), stored);
        },

        /**
         * Rewrites just the matching record's `tracks`. Throws when the record
         * is gone - the caller has already published a CoT and must know it is
         * unreferenced (same contract as the mission_schema.json store).
         */
        async setTracks(key: string, tracks: TrackLogRef[]): Promise<void> {
            const opNumber = Number(key.split('|')[0]);
            const prefix = Number.isInteger(opNumber) ? debriefPrefix(opNumber) : debriefPrefix();
            const match = (await loadWithKeys(prefix)).find((r) => debriefKey(r.record) === key);
            if (!match) {
                throw new Error(
                    'That completed assignment is no longer in the incident record — '
                    + 'refresh and attach the track again.',
                );
            }
            const next: DebriefRecord = { ...match.record };
            if (tracks.length) next.tracks = tracks;
            else delete next.tracks;
            await client.setJson(match.key, next);
        },
    };
}
