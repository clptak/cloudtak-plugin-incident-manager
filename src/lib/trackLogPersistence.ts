/**
 * Adapters for GPS track logs (see docs-archive/multi-op-datasync-architecture.md).
 *
 * Tracks live in the OP DataSync under a "Track Logs" mission folder (Paul,
 * 2026-08-30): the field can see where their own teams have been, and the
 * tracks travel with that OP's mission archive in the demob package.
 *
 * Two ways in:
 * - a file the user uploads (.gpx / .kml / .geojson / .json), parsed by the
 *   pure readers in domain/trackLog.ts;
 * - a LineString already drawn on the map, picked from a candidate list.
 */

import Subscription from '../../../../src/base/subscription.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import type { DebriefRecord, OpPeriodRegistryEntry } from '../domain/entities.ts';
import type { TrackLogPublisher } from '../domain/ports.ts';
import {
    parseTrackFile,
    referencedTrackUids,
    trackLengthMiles,
    type ParsedTrack,
} from '../domain/trackLog.ts';
import { attachFeaturesToFolder } from './folder.ts';
import { loadIncidentSubscription, loadSchemaSubscription } from './incidentSubscription.ts';
import { pushLineToMission } from './missionFeatures.ts';

/** Accept attribute for the file input. */
export const TRACK_FILE_ACCEPT = '.gpx,.kml,.geojson,.json';

interface LineFeatureLike {
    id?: string | number;
    properties?: { callsign?: string };
    geometry?: { type?: string; coordinates?: unknown };
}

/** Read and parse an uploaded track file. Throws with a user-facing message. */
export async function readTrackFile(file: File): Promise<ParsedTrack[]> {
    const text = await file.text();
    const tracks = parseTrackFile(text, file.name);
    if (!tracks.length) {
        throw new Error(`${file.name} has no track lines in it (needs a GPX track, KML LineString, or GeoJSON LineString).`);
    }
    return tracks;
}

/**
 * Publishes tracks into the OP sync's Track Logs folder.
 *
 * Filing uses BOTH mechanisms documented in `folder.ts`, in order:
 *
 * 1. `dest.path` = layer uid on the outgoing CoT (fast path — TAK files it on
 *    ingest). This is a hint, not a guarantee: it races the mission
 *    association, and when the CoT lands first the path is dropped and the
 *    track sits at mission root. Observed in the field 2026-08-30 — three
 *    tracks attached, one filed.
 * 2. `attachFeaturesToFolder` via the Mission Layer API — authoritative, and
 *    the pattern already proven by SearchArea.vue and Segmentation.vue.
 *
 * Step 2 doubles as the publish check. The previous version verified with
 * `sub.feature.list()`, which reads the local Dexie cache that
 * `pushLineToMission` has *already written to* on the folder path
 * (`skipNetwork: true`) — so it would happily confirm a track that never
 * reached TAK. The layer attach only succeeds if the SERVER holds the CoT.
 */
export function createTrackLogPublisher(): TrackLogPublisher {
    return {
        async publishTrack(op: OpPeriodRegistryEntry, folderUid: string, track) {
            const uid = track.uid || globalThis.crypto.randomUUID();
            const push = (): Promise<string> => pushLineToMission({
                missionGuid: op.guid,
                missionToken: op.ownerToken,
                callsign: track.callsign,
                line: track.coords,
                remarks: track.remarks,
                id: uid,
                folderUid,
            });

            await push();

            const sub = await Subscription.load(op.guid, {
                missiontoken: op.ownerToken || undefined,
                reload: false,
            });

            let lastErr: unknown;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    // Already filed by dest.path? Re-attaching is a no-op move
                    // onto the same layer, so this is safe either way.
                    await attachFeaturesToFolder(sub, folderUid, [uid], {
                        initialDelayMs: attempt === 0 ? 800 : 400,
                        attempts: 4,
                    });
                    return uid;
                } catch (err) {
                    lastErr = err;
                    // The CoT is not on the mission yet (or at all) — re-send
                    // and try to file it again.
                    if (attempt < 2) await push();
                }
            }

            throw new Error(
                `Track "${track.callsign}" could not be filed into the Track Logs folder in ${op.name} `
                + `— it may not have reached the DataSync. Check the OP sync and attach it again. `
                + `(${lastErr instanceof Error ? lastErr.message : String(lastErr)})`,
            );
        },
    };
}

/** A line already on the map that could be filed as a track log. */
export interface TrackCandidate {
    uid: string;
    callsign: string;
    /** Which DataSync it currently lives on — shown to disambiguate. */
    source: string;
    /** True when it is already in this OP sync (re-file in place, no copy). */
    inOpSync: boolean;
    points: number;
    lengthMi: number;
    coords: [number, number][];
}

function lineCoords(feat: LineFeatureLike): [number, number][] | null {
    if (feat.geometry?.type !== 'LineString') return null;
    const raw = feat.geometry.coordinates;
    if (!Array.isArray(raw)) return null;
    const coords: [number, number][] = [];
    for (const point of raw) {
        if (!Array.isArray(point) || point.length < 2) continue;
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat]);
    }
    return coords.length >= 2 ? coords : null;
}

/** Structural view of the one Subscription method this file needs. */
interface FeatureLister {
    feature: { list(opts: { refresh: boolean }): Promise<unknown> };
}

async function linesFrom(
    load: () => Promise<unknown>,
    source: string,
    inOpSync: boolean,
): Promise<TrackCandidate[]> {
    try {
        const sub = await load() as FeatureLister;
        const feats = await sub.feature.list({ refresh: true }) as unknown as LineFeatureLike[];
        const out: TrackCandidate[] = [];
        for (const feat of feats) {
            const coords = lineCoords(feat);
            const uid = String(feat.id ?? '');
            if (!coords || !uid) continue;
            out.push({
                uid,
                callsign: feat.properties?.callsign || uid.slice(0, 8),
                source,
                inOpSync,
                points: coords.length,
                lengthMi: Math.round(trackLengthMiles(coords) * 100) / 100,
                coords,
            });
        }
        return out;
    } catch {
        return [];
    }
}

/**
 * Every LineString the manager could file as a track, minus the ones already
 * attached to a completed assignment. Searched across the OP sync, MGMT, and
 * the common map, because managers draw wherever their active overlay is
 * pointed — the same problem the IPP finder has.
 */
export async function listTrackCandidates(
    mission: ActiveMission,
    op: OpPeriodRegistryEntry,
    debriefs: DebriefRecord[],
): Promise<TrackCandidate[]> {
    const taken = referencedTrackUids(debriefs);

    const groups = await Promise.all([
        linesFrom(
            () => Subscription.load(op.guid, {
                missiontoken: op.ownerToken || undefined,
                reload: false,
            }),
            `OP${op.opNumber}`,
            true,
        ),
        mission.mgmt
            ? linesFrom(() => loadSchemaSubscription(mission), 'MGMT', false)
            : Promise.resolve([]),
        linesFrom(() => loadIncidentSubscription(mission), 'common map', false),
    ]);

    const seen = new Set<string>();
    const out: TrackCandidate[] = [];
    for (const candidate of groups.flat()) {
        if (taken.has(candidate.uid) || seen.has(candidate.uid)) continue;
        seen.add(candidate.uid);
        out.push(candidate);
    }
    return out.sort((a, b) => a.callsign.localeCompare(b.callsign));
}

/**
 * Turn a picked map line into a ParsedTrack, plus the uid to publish under.
 *
 * A line already in the OP sync keeps its uid — publishing it again with the
 * same uid re-files it into the Track Logs folder in place, rather than
 * leaving a duplicate at the mission root. A line from MGMT or the common map
 * is copied under a fresh uid, so the original stays where the manager drew it.
 */
export function candidateToTrack(candidate: TrackCandidate): {
    track: ParsedTrack;
    existingUid?: string;
} {
    const track: ParsedTrack = { name: candidate.callsign, coords: candidate.coords };
    return candidate.inOpSync ? { track, existingUid: candidate.uid } : { track };
}
