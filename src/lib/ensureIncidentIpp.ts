/**
 * Persist an incident IPP the same way Search Area does: common-map marker
 * (unless reusing a point), planning search-area log, schema coordinates,
 * and a best-effort copy onto the current OP.
 */

import type { Feature } from '../../../../src/types.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import { currentOpPeriod } from '../domain/registry.ts';
import {
    loadIncidentSubscription,
    loadSchemaSubscription,
    missionAuthToken,
} from './incidentSubscription.ts';
import {
    IPP_AREA_KEY,
    IPP_ICON,
    pointCoordsFromFeature,
    SEARCH_AREA_KEYWORD,
} from './ippFormat.ts';
import { writeIppToSchema, type IppType } from './ippPersistence.ts';
import { pushPointToMission } from './missionFeatures.ts';
import { publishIppToOp } from './opAssignmentPersistence.ts';
import { createRegistryStore } from './registryPersistence.ts';

export interface IncidentPointFeature {
    uid: string;
    callsign: string;
    coords?: [number, number];
}

export interface EnsureIncidentIppInput {
    mission: ActiveMission;
    type: IppType;
    /** IPP center as [lng, lat]. */
    coords: [number, number];
    /** Reuse this existing point instead of creating IPP-{type}. */
    existingUid?: string;
}

export interface EnsureIncidentIppResult {
    uid: string;
    coords: [number, number];
    type: IppType;
}

function kwValue(keywords: string[] | undefined, prefix: string): string {
    const tag = keywords?.find((k) => k.startsWith(prefix));
    return tag ? tag.slice(prefix.length) : '';
}

function isPointFeature(f: Feature): boolean {
    return (f.geometry as { type?: string } | undefined)?.type === 'Point';
}

async function listFeatures(
    loader: () => Promise<{ feature: { list: (opts: { refresh: boolean }) => Promise<unknown> } }>,
): Promise<Feature[]> {
    try {
        const s = await loader();
        return await s.feature.list({ refresh: true }) as Feature[];
    } catch {
        return [];
    }
}

function mergeByUid(...lists: Feature[][]): Feature[] {
    const seen = new Set<string>();
    const out: Feature[] = [];
    for (const list of lists) {
        for (const f of list) {
            const id = String(f.id);
            if (seen.has(id)) continue;
            seen.add(id);
            out.push(f);
        }
    }
    return out;
}

export async function listIncidentPointFeatures(mission: ActiveMission): Promise<IncidentPointFeature[]> {
    const common = await listFeatures(() => loadIncidentSubscription(mission));
    const planning = mission.mgmt
        ? await listFeatures(() => loadSchemaSubscription(mission))
        : [];
    return mergeByUid(common, planning)
        .filter(isPointFeature)
        .map((f) => {
            const props = (f.properties ?? {}) as { callsign?: string };
            return {
                uid: String(f.id),
                callsign: props.callsign || String(f.id),
                coords: pointCoordsFromFeature(f),
            };
        })
        .sort((a, b) => a.callsign.localeCompare(b.callsign, undefined, { sensitivity: 'base' }));
}

interface IppLogRef {
    logId: string;
    uid: string;
}

interface LogWriteBody {
    dtg: string;
    content: string;
    keywords: string[];
    entryUid: string;
}

async function findExistingIppLog(mission: ActiveMission): Promise<IppLogRef | null> {
    const sub = await loadSchemaSubscription(mission);
    const logs = await sub.log.list({ refresh: true });
    let best: IppLogRef | null = null;
    let bestCreated = 0;
    for (const log of logs) {
        if (!log.keywords?.includes(SEARCH_AREA_KEYWORD)) continue;
        if (kwValue(log.keywords, 'area:') !== IPP_AREA_KEY) continue;
        const uid = kwValue(log.keywords, 'uid:');
        if (!uid) continue;
        const created = Date.parse(log.created || log.dtg || '') || 0;
        if (!best || created >= bestCreated) {
            best = { logId: String(log.id), uid };
            bestCreated = created;
        }
    }
    return best;
}

async function writeIppAreaLog(
    mission: ActiveMission,
    uid: string,
    callsign: string,
    coords: [number, number],
    existingLogId?: string,
): Promise<void> {
    const sub = await loadSchemaSubscription(mission);
    const body: LogWriteBody = {
        dtg: new Date().toISOString(),
        content: callsign,
        keywords: [
            SEARCH_AREA_KEYWORD,
            `area:${IPP_AREA_KEY}`,
            `uid:${uid}`,
            `lng:${coords[0]}`,
            `lat:${coords[1]}`,
        ],
        entryUid: uid,
    };
    const log = sub.log as unknown as {
        create(body: LogWriteBody): Promise<{ id: string }>;
        update(logid: string, body: LogWriteBody): Promise<{ id: string }>;
    };
    if (existingLogId) await log.update(existingLogId, body);
    else await log.create(body);
}

/**
 * Write the incident IPP (marker + search-area log + schema). OP publish is
 * best-effort and must not fail the caller.
 */
export async function ensureIncidentIpp(input: EnsureIncidentIppInput): Promise<EnsureIncidentIppResult> {
    const { mission, type, coords } = input;
    const callsign = `IPP-${type}`;
    const existing = await findExistingIppLog(mission);

    let uid: string;
    if (input.existingUid) {
        uid = input.existingUid;
    } else {
        uid = await pushPointToMission({
            missionGuid: mission.guid,
            missionToken: missionAuthToken(mission),
            callsign,
            point: coords,
            type: 'a-f-G',
            icon: IPP_ICON,
            id: existing?.uid,
        });
    }

    await writeIppAreaLog(mission, uid, callsign, coords, existing?.logId);

    try {
        await writeIppToSchema(mission, { lat: coords[1], lng: coords[0], type });
    } catch (err) {
        console.warn('Incident Manager: schema IPP save failed.', err);
    }

    try {
        const registry = await createRegistryStore(mission).load();
        const op = currentOpPeriod(registry);
        if (op) await publishIppToOp(mission, op);
    } catch (err) {
        console.warn('Incident Manager: OP IPP publish failed.', err);
    }

    return { uid, coords, type };
}
