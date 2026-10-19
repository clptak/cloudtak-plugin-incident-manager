/**
 * CloudTAK Core Events for incidents (ADR-004): the I/O around
 * src/domain/coreEvent.ts.
 *
 *   MGMT event   one per incident, linked from the schema (`core_event`,
 *                key s.core-event). Holds the MGMT sync, the common map and
 *                every OP sync. Created from a pasted CAD call.
 *   field event  one per OP, linked from its registry entry (`fieldEventId`).
 *                Created at activation on the OP's field channels; ended at close.
 *
 * Events are a convenience beside the incident, never part of it: callers
 * treat every failure here as a warning, not as a failed operation.
 */

import { server } from '../../../../src/std.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import {
    DEFAULT_CAD_UTC_OFFSET,
    buildFieldEvent,
    buildMgmtEvent,
    columnsToNominate,
    eventIconMapFromValue,
    externalIdChanges,
    findEventForCad,
    incidentIdFor,
    mergeMissions,
    pickableEvents,
    EMPTY_ICON_MAP,
    type EventIconMap,
    type EventMission,
    type EventPriority,
    type EventSummary,
} from '../domain/coreEvent.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import { upsertRegistryEntry } from '../domain/registry.ts';
import { loadDeploymentBundle } from './deploymentDefaults.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { parseCadImport } from './mpsParser.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';
import { createRegistryStore } from './registryPersistence.ts';

export type { EventSummary } from '../domain/coreEvent.ts';

/** What the schema keeps about the incident's MGMT event. */
export interface IncidentEventLink {
    id: string;
    name?: string;
    cad?: string;
}

// ── deployment settings ─────────────────────────────────────────────────

export function eventIconMap(): EventIconMap {
    const { config, files } = loadDeploymentBundle();
    const name = config.eventIconsFile?.trim();
    if (!name || !files[name]) return EMPTY_ICON_MAP;
    try {
        return eventIconMapFromValue(JSON.parse(files[name]));
    } catch {
        return EMPTY_ICON_MAP;
    }
}

function cadUtcOffset(): string {
    const offset = loadDeploymentBundle().config.cadUtcOffset?.trim();
    return offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : DEFAULT_CAD_UTC_OFFSET;
}

// ── raw API ─────────────────────────────────────────────────────────────

function fail(what: string, error: { message?: string } | undefined): never {
    throw new Error(`${what}: ${error?.message ?? 'request failed'}`);
}

/** TAK channel names -> bitpos numbers (what Core Events are shared with). */
export async function channelBitpos(names: string[]): Promise<number[]> {
    if (!names.length) return [];
    const res = await server.GET('/api/marti/group', { params: { query: { useCache: true } } });
    if (res.error) fail('Could not read your channels', res.error);
    const byName = new Map<string, number>();
    for (const g of res.data.data) byName.set(g.name, g.bitpos);
    const missing = names.filter((n) => !byName.has(n));
    if (missing.length) throw new Error(`Channel${missing.length > 1 ? 's' : ''} not found: ${missing.join(', ')}`);
    return [...new Set(names.map((n) => byName.get(n)!))];
}

export async function getEvent(id: string): Promise<EventSummary> {
    const res = await server.GET('/api/core/event/{:event}', { params: { path: { ':event': id } } });
    if (res.error) fail('Could not read the event', res.error);
    return res.data as unknown as EventSummary;
}

/** Every event this user can see on `channels` (all pages). */
export async function listEvents(channels?: number[]): Promise<EventSummary[]> {
    const out: EventSummary[] = [];
    for (let page = 0; page < 20; page++) {
        const res = await server.GET('/api/core/event', {
            params: {
                query: {
                    limit: 100, page, order: 'desc', sort: 'created', filter: '',
                    ...(channels?.length ? { channel: channels } : {}),
                },
            },
        });
        if (res.error) fail('Could not list events', res.error);
        const items = res.data.items as unknown as EventSummary[];
        out.push(...items);
        if (!items.length || out.length >= res.data.total) break;
    }
    return out;
}

type PatchBody = Record<string, unknown>;

async function patchEvent(id: string, body: PatchBody): Promise<EventSummary> {
    const res = await server.PATCH('/api/core/event/{:event}', {
        params: { path: { ':event': id } },
        body: body as never,
    });
    if (res.error) fail('Could not update the event', res.error);
    return res.data as unknown as EventSummary;
}

/** One request per system (the API takes one); an empty value removes it. */
async function setExternalIds(id: string, ids: { system: string; value: string }[]): Promise<void> {
    for (const external_id of ids) await patchEvent(id, { external_id });
}

/** Put the event in the Nominated column of every board it is shared to. */
async function nominate(event: EventSummary): Promise<void> {
    for (const column of columnsToNominate(event)) {
        const res = await server.PUT('/api/board/event', { body: { column, event: event.id } as never });
        if (res.error) fail('Could not nominate the event', res.error);
    }
}

/** Add missions to an event (PATCH replaces the list, so read it first). */
export async function attachMissions(id: string, add: EventMission[]): Promise<EventSummary> {
    const event = await getEvent(id);
    const missions = mergeMissions(event.missions ?? [], add);
    if (missions.length === (event.missions ?? []).length) return event;
    return patchEvent(id, { missions });
}

export async function endEvent(id: string): Promise<void> {
    await patchEvent(id, { active: false });
}

// ── incident link (schema) ──────────────────────────────────────────────

function linkFromSchema(schema: MissionSchema): IncidentEventLink | null {
    const v = schema.core_event as Partial<IncidentEventLink> | undefined;
    return v && typeof v.id === 'string' && v.id ? { id: v.id, name: v.name, cad: v.cad } : null;
}

export async function incidentEventLink(mission: ActiveMission): Promise<IncidentEventLink | null> {
    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);
    return linkFromSchema(schema);
}

async function saveIncidentEventLink(mission: ActiveMission, link: IncidentEventLink): Promise<void> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    loaded.schema.core_event = { ...link };
    await saveMissionSchema(sub, loaded.schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}

function incidentMissions(mission: ActiveMission): EventMission[] {
    const out: EventMission[] = [];
    if (mission.mgmt) out.push({ guid: mission.mgmt.guid, name: mission.mgmt.name });
    out.push({ guid: mission.guid, name: mission.name });
    return out;
}

// ── create ──────────────────────────────────────────────────────────────

export interface CadEventInput {
    cadText: string;
    subjectProfile?: string;
    /** Management channel names; the event is shared with these only. */
    channelNames: string[];
}

/** Create the MGMT event for a CAD call, nominate it and set its Case Number. */
async function createMgmtEvent(input: CadEventInput, missions: EventMission[]): Promise<EventSummary> {
    const cad = parseCadImport(input.cadText);
    const loc = cad.header.callLocation;
    if (!loc) throw new Error('The CAD call has no Address LL(...) coordinates to place the event.');
    const plan = buildMgmtEvent({
        fields: cad.header.fields,
        cadId: cad.activityNumber,
        caseNumber: cad.reportNumber,
        lat: loc.lat,
        lng: loc.lng,
        subjectProfile: input.subjectProfile,
        channels: await channelBitpos(input.channelNames),
        missions,
        iconMap: eventIconMap(),
        utcOffset: cadUtcOffset(),
    });
    const res = await server.POST('/api/core/event', { body: plan.body as never });
    if (res.error) fail('Could not create the event', res.error);
    const id = (res.data as unknown as EventSummary).id;
    await setExternalIds(id, plan.laterExternalIds);
    const event = await getEvent(id);
    await nominate(event);
    return event;
}

/** "Create event only": a MGMT event with no mission yet. */
export async function createEventOnly(input: CadEventInput): Promise<{ event: EventSummary; existing: boolean }> {
    const cadId = parseCadImport(input.cadText).activityNumber;
    const existing = findEventForCad(await listEvents(), cadId);
    if (existing) return { event: existing, existing: true };
    return { event: await createMgmtEvent(input, []), existing: false };
}

/**
 * After Create Mission: link the incident to its MGMT event - the one picked,
 * else the active one for this CAD call, else a new one - and attach the MGMT
 * sync and the common map to it.
 */
export async function linkIncidentEvent(
    mission: ActiveMission,
    source: { eventId: string } | CadEventInput,
): Promise<{ event: EventSummary; created: boolean }> {
    let event: EventSummary;
    let created = false;
    if ('eventId' in source) {
        event = await attachMissions(source.eventId, incidentMissions(mission));
    } else {
        const cadId = parseCadImport(source.cadText).activityNumber;
        const existing = findEventForCad(await listEvents(), cadId);
        if (existing) {
            event = await attachMissions(existing.id, incidentMissions(mission));
        } else {
            event = await createMgmtEvent(source, incidentMissions(mission));
            created = true;
        }
    }
    await saveIncidentEventLink(mission, { id: event.id, name: event.name, cad: event.external_ids?.CAD });
    return { event, created };
}

/** Active MGMT events for the Create Mission picker. */
export async function pickerEvents(): Promise<EventSummary[]> {
    return pickableEvents(await listEvents());
}

// ── OP lifecycle ────────────────────────────────────────────────────────

/** Plan / Open now: put the OP sync on the incident event. No link, nothing to do. */
export async function attachOpToIncidentEvent(mission: ActiveMission, op: OpPeriodRegistryEntry): Promise<boolean> {
    const link = await incidentEventLink(mission);
    if (!link) return false;
    await attachMissions(link.id, [{ guid: op.guid, name: op.name }]);
    return true;
}

/**
 * Activate / Open now: the OP's field event, on its field channels (the OP's
 * channels minus the management ones), nominated on those channels' boards.
 */
export async function startFieldEvent(
    mission: ActiveMission,
    op: OpPeriodRegistryEntry,
    managementChannels: string[],
): Promise<EventSummary | null> {
    if (op.fieldEventId) return null;
    const link = await incidentEventLink(mission);
    if (!link) return null;
    const incident = await getEvent(link.id);
    const coords = incident.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) throw new Error('The incident event has no location.');
    const mgmt = new Set(managementChannels);
    const fieldNames = op.channels.filter((c) => !mgmt.has(c));

    const body = buildFieldEvent({
        incidentId: incidentIdFor({ caseNumber: incident.external_ids?.Case_Number, cadId: incident.external_ids?.CAD })
            || mission.name,
        opNumber: op.opNumber,
        opMission: { guid: op.guid, name: op.name },
        mgmtEventId: incident.id,
        lat: Number(coords[1]),
        lng: Number(coords[0]),
        location: (incident as { location?: string }).location ?? '',
        priority: ((incident as { priority?: EventPriority }).priority ?? 'none'),
        channels: await channelBitpos(fieldNames),
        started: op.activatedAt ?? op.openedAt ?? new Date().toISOString(),
        iconMap: eventIconMap(),
    });
    const res = await server.POST('/api/core/event', { body: body as never });
    if (res.error) fail('Could not create the field event', res.error);
    const event = await getEvent((res.data as unknown as EventSummary).id);
    await nominate(event);

    const store = createRegistryStore(mission);
    const entries = await store.load();
    const latest = entries.find((e) => e.guid === op.guid) ?? op;
    await store.save(upsertRegistryEntry(entries, { ...latest, fieldEventId: event.id }));
    return event;
}

/** Close: end the OP's field event. */
export async function endFieldEvent(op: OpPeriodRegistryEntry): Promise<boolean> {
    if (!op.fieldEventId) return false;
    await endEvent(op.fieldEventId);
    return true;
}

// ── Initial Information / Wrap Up ───────────────────────────────────────

/** Initial Information save: Case Number and DEMA number onto the incident event. */
export async function syncIncidentEventIds(
    mission: ActiveMission,
    ids: { caseNumber: string; dema: string },
): Promise<boolean> {
    const link = await incidentEventLink(mission);
    if (!link) return false;
    const event = await getEvent(link.id);
    const changes = externalIdChanges(event.external_ids, { Case_Number: ids.caseNumber, DEMA: ids.dema });
    await setExternalIds(link.id, changes);
    return changes.length > 0;
}

/** Wrap Up / Dashboard: whether the incident event is still running. */
export async function incidentEventState(mission: ActiveMission): Promise<{ link: IncidentEventLink; active: boolean } | null> {
    const link = await incidentEventLink(mission);
    if (!link) return null;
    const event = await getEvent(link.id);
    return { link, active: event.active && !event.ended };
}

export async function endIncidentEvent(mission: ActiveMission): Promise<boolean> {
    const link = await incidentEventLink(mission);
    if (!link) return false;
    await endEvent(link.id);
    return true;
}
