/**
 * Post WiSAR Travel Time contours to the incident's active DataSync or its
 * MGMT (planning) DataSync, the same way Search Area posts LPB rings: a
 * uniquely named folder in that DataSync, one shape per contour filed in it,
 * and a search-area log entry per shape. The log entries always go to the
 * planning DataSync, where Search Area keeps its list of plotted areas.
 */
import type { ActiveMission } from '../composables/useIncident.ts';
import { attachFeaturesToFolder, ensureMissionFolder } from './folder.ts';
import {
    loadIncidentSubscription,
    loadSchemaSubscription,
    missionAuthToken,
    schemaMission,
} from './incidentSubscription.ts';
import { SEARCH_AREA_KEYWORD } from './ippFormat.ts';
import { pushPolygonToMission } from './missionFeatures.ts';
import type { ContourCollection, Job } from './wisar.ts';
import {
    TT_AREA_PREFIX,
    TT_FOLDER_NAME,
    mainOutline,
    simplifyRing,
    sortedContours,
    travelTimeCallsign,
    uniqueName,
    type DataSyncTarget,
} from './wisarResults.ts';

interface LogApi {
    create(body: { dtg?: string; content: string; keywords?: string[]; entryUid?: string }): Promise<{ id: string }>;
}

export interface DataSyncAddResult {
    folderName: string;
    /** Name of the DataSync the rings went to. */
    missionName: string;
    /** False when the folder could not be created; shapes were still posted. */
    filed: boolean;
    posted: number;
    /** Detached pieces and holes left out because a TAK shape is one outline. */
    droppedParts: number;
    droppedHoles: number;
}

/** `fc` holds only the contours to post. */
export async function addTravelTimeToDataSync(
    mission: ActiveMission,
    job: Job,
    fc: ContourCollection,
    target: DataSyncTarget,
): Promise<DataSyncAddResult> {
    const ipp = (job.request as { ipp?: { lat: number; lon: number } }).ipp;
    if (!ipp) throw new Error('This job has no IPP.');
    const center: [number, number] = [ipp.lon, ipp.lat];

    const planningSub = await loadSchemaSubscription(mission);
    const planning = schemaMission(mission);
    const dest = target === 'mgmt'
        ? { sub: planningSub, guid: planning.guid, missionToken: planning.missionToken, name: planning.name }
        : {
            sub: await loadIncidentSubscription(mission),
            guid: mission.guid,
            missionToken: missionAuthToken(mission),
            name: mission.name,
        };
    const sub = dest.sub;
    const taken = new Set<string>();
    try {
        for (const layer of await sub.layer.list()) if (layer.name) taken.add(layer.name);
    } catch {
        // local layer cache may be empty
    }
    const folderName = uniqueName(TT_FOLDER_NAME, taken);
    let folderUid: string | undefined;
    try {
        folderUid = (await ensureMissionFolder(sub, folderName)).uid;
    } catch (err) {
        console.warn(err);
    }

    const pushId = Date.now().toString(36);
    const log = planningSub.log as unknown as LogApi;
    const uids: string[] = [];
    let droppedParts = 0;
    let droppedHoles = 0;
    for (const f of sortedContours(fc)) {
        const outline = mainOutline(f.geometry);
        if (!outline) continue;
        droppedParts += outline.parts - 1;
        droppedHoles += outline.holes;
        const hours = f.properties.hours ?? 0;
        const callsign = travelTimeCallsign(hours);
        const uid = await pushPolygonToMission({
            missionGuid: dest.guid,
            missionToken: dest.missionToken,
            callsign,
            ring: simplifyRing(outline.ring),
            center,
            style: {
                stroke: f.properties.stroke,
                fill: f.properties.fill,
                fillOpacity: f.properties['fill-opacity'],
                strokeWidth: f.properties['stroke-width'],
                strokeStyle: 'solid',
            },
            folderUid,
        });
        uids.push(uid);
        const keywords = [SEARCH_AREA_KEYWORD, `area:${TT_AREA_PREFIX}:${pushId}:${hours}`, `uid:${uid}`,
            `folder:${folderName}`, `datasync:${target}`];
        await log.create({ dtg: new Date().toISOString(), content: callsign, keywords, entryUid: uid });
    }

    if (folderUid && uids.length) {
        try {
            await attachFeaturesToFolder(sub, folderUid, uids);
        } catch (err) {
            console.warn(err);
        }
    }
    return { folderName, missionName: dest.name, filed: !!folderUid, posted: uids.length, droppedParts, droppedHoles };
}
