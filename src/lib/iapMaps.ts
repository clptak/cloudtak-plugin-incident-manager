/**
 * ICS-204 map pages (#28): for each assignment, its segment centred on a
 * letter page with every segment touching it, outlined so it stands out.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { IapMapPage } from './iapPdf.ts';
import { iapMapImagePt } from './iapPdf.ts';
import type { IapAssignmentPlan, IapPlan } from './iapPlanPersistence.ts';
import { loadIncidentSubscription, loadSchemaSubscription } from './incidentSubscription.ts';
import { loadMissionSchema } from './missionSchema.ts';
import { renderPrintMap } from './printMap.ts';
import {
    centredView,
    naturalAspect,
    neighbours,
    PX_PER_PT,
    ringsOf,
    type ShapeRef,
} from './printMapFrame.ts';
import { segmentsFromSchema } from './segmentsPersistence.ts';

interface FeatureLike {
    id?: string | number;
    geometry?: { type?: string; coordinates?: unknown };
}

async function listFeatures(load: () => Promise<{ feature: { list(o: { refresh: boolean }): Promise<unknown> } }>): Promise<FeatureLike[]> {
    try {
        return await (await load()).feature.list({ refresh: true }) as FeatureLike[];
    } catch {
        return [];
    }
}

/**
 * Shapes by uid from the MGMT sync (where search segments live) and the
 * incident map, plus which of them count as segments for the neighbour ring:
 * the registered search segments, or, on an incident with none, every area.
 */
async function loadShapes(mission: ActiveMission, assignedUids: string[]): Promise<{ byUid: Map<string, ShapeRef>; candidates: ShapeRef[] }> {
    const feats = [
        ...(mission.mgmt ? await listFeatures(() => loadSchemaSubscription(mission)) : []),
        ...await listFeatures(() => loadIncidentSubscription(mission)),
    ];
    const byUid = new Map<string, ShapeRef>();
    for (const f of feats) {
        const id = String(f.id ?? '');
        if (!id || byUid.has(id)) continue;
        const rings = ringsOf(f.geometry);
        if (rings.length) byUid.set(id, { id, rings });
    }

    let registered: string[] = [];
    if (mission.mgmt) {
        try {
            const { schema } = await loadMissionSchema(await loadSchemaSubscription(mission));
            registered = Object.keys(segmentsFromSchema(schema));
        } catch { /* fall back to every area */ }
    }
    const isArea = (s: ShapeRef) => s.rings.some((r) => r.length >= 4);
    const ids = registered.length ? new Set([...registered, ...assignedUids]) : null;
    const candidates = [...byUid.values()].filter((s) => (ids ? ids.has(s.id) : isArea(s)));
    return { byUid, candidates };
}

function subtitleFor(plan: IapPlan, a: IapAssignmentPlan, incidentName: string): string {
    const division = plan.divisions.find((d) => d.id === a.divisionId)?.name;
    const teams = a.resources.map((r) => r.identifier.trim()).filter(Boolean).join(', ');
    return [incidentName, `OP${plan.opNumber}`, division && `Division ${division}`, teams]
        .filter(Boolean).join(' · ');
}

/**
 * One map page per assignment, in plan order; null where the segment can't
 * be found. `onProgress(done, total)` reports as each map is drawn.
 */
export async function buildIapMaps(
    mission: ActiveMission,
    plan: IapPlan,
    incidentName: string,
    onProgress?: (done: number, total: number) => void,
): Promise<(IapMapPage | null)[]> {
    const uids = plan.assignments.map((a) => a.segmentUid.trim());
    const { byUid, candidates } = await loadShapes(mission, uids.filter(Boolean));
    const pages: (IapMapPage | null)[] = [];
    for (const [i, a] of plan.assignments.entries()) {
        onProgress?.(i, plan.assignments.length);
        const target = byUid.get(uids[i]);
        if (!target) { pages.push(null); continue; }
        const ring = neighbours(target.rings, candidates, target.id).map((n) => n.rings);
        const landscape = naturalAspect(target.rings, ring) > 1;
        const size = iapMapImagePt(landscape);
        const view = centredView(target.rings, ring, size.width * PX_PER_PT, size.height * PX_PER_PT);
        if (!view) { pages.push(null); continue; }
        const image = await renderPrintMap({ widthPt: size.width, heightPt: size.height, view, highlight: target.rings });
        pages.push({
            image,
            landscape,
            title: `ICS 204 Map — ${a.label || 'Assignment'}`,
            subtitle: subtitleFor(plan, a, incidentName),
        });
    }
    onProgress?.(plan.assignments.length, plan.assignments.length);
    return pages;
}
