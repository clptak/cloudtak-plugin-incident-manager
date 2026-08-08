/**
 * Adapters for OP assignment publishing (Phase 3):
 * - AssignmentStore: running list in mgmt schema `incident_response.op_assignments`;
 * - SegmentGeometrySource: polygon geometry from the incident common map's features;
 * - OpFeaturePublisher: re-publish the polygon into the OP sync.
 */

import Subscription from '../../../../src/base/subscription.ts';
import { pushPointToMission } from './missionFeatures.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpAssignment, OpPeriodRegistryEntry } from '../domain/entities.ts';
import type {
    AssignmentStore,
    OpFeaturePublisher,
    PolygonStyle,
    SegmentGeometrySource,
} from '../domain/ports.ts';
import { loadIncidentSubscription, loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { pushPolygonToMission } from './missionFeatures.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';

export function opAssignmentsFromSchema(schema: MissionSchema): OpAssignment[] {
    const raw = (schema.incident_response as Record<string, unknown>).op_assignments;
    if (!Array.isArray(raw)) return [];
    const assignments: OpAssignment[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        const segmentUid = typeof rec.segmentUid === 'string' ? rec.segmentUid.trim() : '';
        const label = typeof rec.label === 'string' ? rec.label : '';
        const opNumber = Number(rec.opNumber);
        if (!segmentUid || !Number.isInteger(opNumber)) continue;
        const assignment: OpAssignment = { opNumber, segmentUid, label: label || segmentUid };
        if (typeof rec.opFeatureUid === 'string' && rec.opFeatureUid.trim()) assignment.opFeatureUid = rec.opFeatureUid;
        if (typeof rec.team === 'string' && rec.team.trim()) assignment.team = rec.team.trim();
        if (typeof rec.notes === 'string' && rec.notes.trim()) assignment.notes = rec.notes.trim();
        if (typeof rec.createdAt === 'string' && rec.createdAt.trim()) assignment.createdAt = rec.createdAt;
        assignments.push(assignment);
    }
    return assignments;
}

export function createAssignmentStore(mission: ActiveMission): AssignmentStore {
    return {
        async load(): Promise<OpAssignment[]> {
            const sub = await loadSchemaSubscription(mission);
            const { schema } = await loadMissionSchema(sub);
            return opAssignmentsFromSchema(schema);
        },

        async upsert(assignment: OpAssignment): Promise<void> {
            const sub = await loadSchemaSubscription(mission);
            const loaded = await loadMissionSchema(sub);
            const existing = opAssignmentsFromSchema(loaded.schema).filter(
                (a) => !(a.opNumber === assignment.opNumber && a.segmentUid === assignment.segmentUid),
            );
            (loaded.schema.incident_response as Record<string, unknown>).op_assignments = [
                ...existing,
                assignment,
            ];
            await saveMissionSchema(sub, loaded.schema, {
                contentHash: loaded.contentHash,
                legacyLogId: loaded.legacyLogId,
                missionToken: schemaMissionToken(sub, mission),
            });
        },
    };
}

interface PolygonFeatureLike {
    id?: string | number;
    properties?: {
        callsign?: string;
        center?: [number, number];
        stroke?: string;
        fill?: string;
        'fill-opacity'?: number;
        'stroke-width'?: number;
        'stroke-style'?: string;
    };
    geometry?: {
        type?: string;
        coordinates?: unknown;
    };
}

/** Carry the manager-drawn style onto the OP copy so it renders identically. */
function styleFromFeature(feat: PolygonFeatureLike): PolygonStyle | undefined {
    const props = feat.properties;
    if (!props) return undefined;
    const style: PolygonStyle = {};
    if (typeof props.stroke === 'string') style.stroke = props.stroke;
    if (typeof props.fill === 'string') style.fill = props.fill;
    if (typeof props['fill-opacity'] === 'number') style.fillOpacity = props['fill-opacity'];
    if (typeof props['stroke-width'] === 'number') style.strokeWidth = props['stroke-width'];
    if (props['stroke-style'] === 'solid' || props['stroke-style'] === 'dashed'
        || props['stroke-style'] === 'dotted' || props['stroke-style'] === 'outlined') {
        style.strokeStyle = props['stroke-style'];
    }
    return Object.keys(style).length ? style : undefined;
}

function ringFromFeature(feat: PolygonFeatureLike): [number, number][] | null {
    if (feat.geometry?.type !== 'Polygon') return null;
    const coords = feat.geometry.coordinates;
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
    const ring = coords[0] as unknown[];
    const points: [number, number][] = [];
    for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2) return null;
        points.push([Number(point[0]), Number(point[1])]);
    }
    return points.length >= 4 ? points : null;
}

function centroid(ring: [number, number][]): [number, number] {
    let lon = 0; let lat = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return [lon / ring.length, lat / ring.length];
}

/**
 * Reads segment polygons — MGMT sync first (segments are moved there at
 * registration), falling back to the common map for pre-move segments.
 */
export function createSegmentGeometrySource(mission: ActiveMission): SegmentGeometrySource {
    return {
        async getPolygon(uid: string) {
            let feat: PolygonFeatureLike | undefined;
            if (mission.mgmt) {
                try {
                    const mgmtSub = await loadSchemaSubscription(mission);
                    const mgmtFeats = await mgmtSub.feature.list({ refresh: true }) as unknown as PolygonFeatureLike[];
                    feat = mgmtFeats.find((f) => String(f.id ?? '') === uid);
                } catch { /* fall through to the common map */ }
            }
            if (!feat) {
                const sub = await loadIncidentSubscription(mission);
                const feats = await sub.feature.list({ refresh: true }) as unknown as PolygonFeatureLike[];
                feat = feats.find((f) => String(f.id ?? '') === uid);
            }
            if (!feat) return null;
            const ring = ringFromFeature(feat);
            if (!ring) return null;
            const center = feat.properties?.center
                && Array.isArray(feat.properties.center) && feat.properties.center.length === 2
                ? feat.properties.center
                : centroid(ring);
            return {
                callsign: feat.properties?.callsign || uid,
                ring,
                center,
                style: styleFromFeature(feat),
            };
        },
    };
}

interface PointFeatureLike {
    id?: string | number;
    properties?: {
        callsign?: string;
        icon?: string;
        type?: string;
    };
    geometry?: {
        type?: string;
        coordinates?: unknown;
    };
}

/**
 * Find the incident IPP marker. Authoritative pointer: the `area:ipp` log on
 * the planning (MGMT) sync — the IPP may be an arbitrary chosen marker whose
 * callsign is NOT `IPP-*`. Fallback: any `IPP-*` point on the common map.
 */
async function findIppFeature(mission: ActiveMission): Promise<PointFeatureLike | null> {
    // 1. area:ipp log → uid (planning logs; falls back to common on old incidents)
    let ippUid = '';
    try {
        const planningSub = await loadSchemaSubscription(mission);
        const logs = await planningSub.log.list({ refresh: true });
        for (const log of logs) {
            const keywords = (log as { keywords?: string[] }).keywords;
            if (!keywords?.includes('search-area')) continue;
            const area = keywords.find((k) => k.startsWith('area:'))?.slice('area:'.length);
            if (area !== 'ipp') continue;
            const uid = keywords.find((k) => k.startsWith('uid:'))?.slice('uid:'.length);
            if (uid) ippUid = uid;
        }
    } catch { /* logs unavailable — regex fallback below */ }

    // The marker may live on the common map OR the MGMT sync (managers with
    // the MGMT overlay active drop markers there) — search both.
    const feats: PointFeatureLike[] = [];
    try {
        const sub = await loadIncidentSubscription(mission);
        feats.push(...await sub.feature.list({ refresh: true }) as unknown as PointFeatureLike[]);
    } catch { /* common map unavailable */ }
    if (mission.mgmt) {
        try {
            const mgmtSub = await loadSchemaSubscription(mission);
            feats.push(...await mgmtSub.feature.list({ refresh: true }) as unknown as PointFeatureLike[]);
        } catch { /* mgmt map unavailable */ }
    }

    if (ippUid) {
        const byUid = feats.find((f) => String(f.id ?? '') === ippUid && f.geometry?.type === 'Point');
        if (byUid) return byUid;
    }
    return feats.find((f) => {
        const callsign = f.properties?.callsign ?? '';
        return /^IPP-/i.test(callsign) && f.geometry?.type === 'Point';
    }) ?? null;
}

/**
 * Copy the incident's IPP marker into an OP sync so every operational period
 * carries it. A fixed uid per OP (`ipp-<op guid>`) makes republishing
 * idempotent. Publication is verified against the OP mission and retried
 * (same silent-association failure mode as polygons). Returns the published
 * uid, or null when no IPP is set yet.
 */
export async function publishIppToOp(
    mission: ActiveMission,
    op: OpPeriodRegistryEntry,
): Promise<string | null> {
    const ipp = await findIppFeature(mission);
    if (!ipp) return null;

    const coords = ipp.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    // Reuse the OP's existing IPP copy when present (idempotent republish);
    // otherwise a fresh UUID — TAK ingest is only proven with UUID-shaped uids.
    const callsign = ipp.properties?.callsign ?? 'IPP';
    let uid = '';
    try {
        const opSub = await Subscription.load(op.guid, {
            missiontoken: op.ownerToken ?? '',
            reload: false,
        });
        const opFeats = await opSub.feature.list({ refresh: true }) as unknown as PointFeatureLike[];
        const existing = opFeats.find(
            (f) => f.geometry?.type === 'Point' && f.properties?.callsign === callsign,
        );
        if (existing) uid = String(existing.id ?? '');
    } catch { /* fresh uid below */ }
    if (!uid) uid = globalThis.crypto.randomUUID();
    const push = () => pushPointToMission({
        missionGuid: op.guid,
        missionToken: op.ownerToken,
        callsign,
        point: [Number(coords[0]), Number(coords[1])],
        type: ipp.properties?.type ?? 'a-f-G',
        icon: ipp.properties?.icon,
        id: uid,
    });

    await push();
    for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        if (await verifyInMission(op, uid)) return uid;
        if (attempt < 3) await push();
    }
    throw new Error(`IPP did not appear in ${op.name} after retries — try "Publish IPP" again.`);
}

/** True when the uid is present in the OP mission's feature list. */
async function verifyInMission(op: OpPeriodRegistryEntry, uid: string): Promise<boolean> {
    try {
        const sub = await Subscription.load(op.guid, {
            missiontoken: op.ownerToken ?? '',
            reload: false,
        });
        const feats = await sub.feature.list({ refresh: true }) as unknown as PolygonFeatureLike[];
        return feats.some((f) => String(f.id ?? '') === uid);
    } catch {
        return false;
    }
}

/**
 * Publishes polygon copies into the OP sync with the OP owner token.
 * The websocket publish path can deliver the CoT without the mission
 * association landing (observed in the field: polygon on subscriber maps but
 * absent from the DataSync) — so each publish is VERIFIED against the OP
 * mission's feature list and retried with the SAME uid until it lands.
 */
export function createOpFeaturePublisher(): OpFeaturePublisher {
    return {
        async publishPolygon(op: OpPeriodRegistryEntry, polygon, existingUid?: string) {
            const push = () => pushPolygonToMission({
                missionGuid: op.guid,
                missionToken: op.ownerToken,
                callsign: polygon.callsign,
                ring: polygon.ring,
                center: polygon.center,
                style: polygon.style,
                id: existingUid,
            });

            let uid = await push();
            existingUid = uid;
            for (let attempt = 0; attempt < 4; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                if (await verifyInMission(op, uid)) return uid;
                if (attempt < 3) uid = await push();
            }
            throw new Error(
                `Assignment "${polygon.callsign}" did not appear in ${op.name} after retries — check the OP sync and republish.`,
            );
        },
    };
}
