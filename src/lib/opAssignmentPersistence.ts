/**
 * Adapters for OP assignment publishing (Phase 3):
 * - AssignmentStore: running list in mgmt schema `incident_response.op_assignments`;
 * - SegmentGeometrySource: polygon geometry from the incident common map's features;
 * - OpFeaturePublisher: re-publish the polygon into the OP sync.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpAssignment, OpPeriodRegistryEntry } from '../domain/entities.ts';
import type { AssignmentStore, OpFeaturePublisher, SegmentGeometrySource } from '../domain/ports.ts';
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

        async append(assignment: OpAssignment): Promise<void> {
            const sub = await loadSchemaSubscription(mission);
            const loaded = await loadMissionSchema(sub);
            const existing = opAssignmentsFromSchema(loaded.schema);
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
    };
    geometry?: {
        type?: string;
        coordinates?: unknown;
    };
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
            };
        },
    };
}

/** Publishes polygon copies into the OP sync with the OP owner token. */
export function createOpFeaturePublisher(): OpFeaturePublisher {
    return {
        async publishPolygon(op: OpPeriodRegistryEntry, polygon) {
            return pushPolygonToMission({
                missionGuid: op.guid,
                missionToken: op.ownerToken,
                callsign: polygon.callsign,
                ring: polygon.ring,
                center: polygon.center,
            });
        },
    };
}
