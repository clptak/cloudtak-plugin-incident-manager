<template>
    <div class='row g-3'>
        <div class='col-lg-8'>
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-2 w-100'>
                        <span>Segments</span>
                        <span
                            class='ms-auto d-inline-flex'
                            @click.stop
                        >
                            <NavHelpButton help-key='segmenting-search-area' />
                        </span>
                    </p>
                </template>

                <TablerInlineAlert
                    class='mb-3'
                    severity='info'
                    description='Segment names need to be numbered following ICS convention. Letters are for Divisions.'
                />
                <label class='form-label'>Select segments from the active DataSync (multiple)</label>
                <div
                    class='border rounded p-2'
                    style='max-height: 240px; overflow:auto;'
                >
                    <div
                        v-if='loadingFeatures'
                        class='text-muted small'
                    >
                        Loading mission polygons…
                    </div>
                    <div
                        v-else-if='!availablePolygons.length'
                        class='text-muted small'
                    >
                        No numbered segment polygons in the active DataSync.
                    </div>
                    <label
                        v-for='p in availablePolygons'
                        :key='p.uid'
                        class='d-flex gap-2 align-items-center py-1'
                        style='cursor:pointer'
                    >
                        <input
                            v-model='segmentUids'
                            type='checkbox'
                            :value='p.uid'
                            class='form-check-input'
                        >
                        <span>{{ p.callsign }}</span>
                    </label>
                </div>
                <button
                    class='btn btn-primary btn-sm mt-2'
                    :disabled='!segmentUids.length || saving'
                    @click='onAddSegments'
                >
                    Add {{ segmentUids.length }} segment{{ segmentUids.length === 1 ? '' : 's' }} to this search
                </button>
            </TablerBorder>
        </div>

        <div class='col-12'>
            <TablerBorder
                class='cloudtak-accent text-white'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Segments in this search ({{ segmentRows.length }})
                    </p>
                </template>

                <div
                    v-if='loadingSegments'
                    class='text-muted small'
                >
                    Loading…
                </div>
                <div
                    v-else-if='!segmentRows.length'
                    class='text-muted small'
                >
                    No segments registered yet. Select polygons above to add them.
                </div>
                <table
                    v-else
                    class='table table-sm table-vcenter mb-0'
                >
                    <thead>
                        <tr>
                            <th>Segment</th>
                            <th>Area (mi²)</th>
                            <th class='text-end' />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='row in segmentRows'
                            :key='row.uid'
                        >
                            <td>
                                <FeatureCallsignCell
                                    :uid='row.uid'
                                    :callsign='row.callsign'
                                    @fly='onFlyTo(row.uid)'
                                />
                            </td>
                            <td>{{ formatSqMi(areaForUid(row.uid)) }}</td>
                            <td class='text-end'>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-link p-0 me-2'
                                    :disabled='saving'
                                    @click='splitParentUid = splitParentUid === row.uid ? "" : row.uid; splitChildUids = []'
                                >
                                    Split…
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-link text-danger p-0'
                                    :disabled='saving'
                                    @click='removeSegment(row.uid)'
                                >
                                    Remove
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- ── ISM segment split ──────────────────────────────── -->
                <div
                    v-if='splitParentUid'
                    class='cloudtak-accent border rounded-3 mt-3 p-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Split {{ segments[splitParentUid]?.callsign || splitParentUid }}
                    </p>
                    <p class='form-text mt-0'>
                        Draw the child polygons on the map first, refresh, then select 2+
                        below. POA and debrief history redistribute by area proportion
                        (ISM); the parent is retired.
                    </p>
                    <div
                        v-if='!splitCandidates.length'
                        class='text-muted small'
                    >
                        No unregistered polygons available — draw the children first.
                    </div>
                    <label
                        v-for='p in splitCandidates'
                        :key='p.uid'
                        class='form-check d-flex align-items-center gap-2 mb-1'
                    >
                        <input
                            v-model='splitChildUids'
                            type='checkbox'
                            class='form-check-input'
                            :value='p.uid'
                        >
                        <span class='form-check-label'>
                            {{ p.callsign }}
                            <span class='text-muted'>({{ formatSqMi(p.areaSqMi) }} mi²<template v-if='splitChildUids.includes(p.uid) && splitFraction(p.uid) !== null'> → {{ Math.round(splitFraction(p.uid)! * 100) }}%</template>)</span>
                        </span>
                    </label>
                    <button
                        type='button'
                        class='btn btn-primary btn-sm mt-2'
                        :disabled='saving || splitChildUids.length < 2'
                        @click='onSplitSegment'
                    >
                        {{ saving ? 'Splitting…' : `Split into ${splitChildUids.length}` }}
                    </button>
                </div>
            </TablerBorder>
        </div>

        <div class='col-12'>
            <TablerInlineAlert
                v-if='!activeMission'
                severity='warning'
                title='Mission Required'
                description='No active mission. Select one in Create | Open first.'
            />
            <div
                v-else
                class='form-text d-flex flex-wrap align-items-center gap-2'
            >
                <span>Active DataSync: <strong>{{ activeMission.name }}</strong></span>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='loadingFeatures'
                    title='Reload polygons from the active DataSync mission'
                    @click='onRefreshFeatures'
                >
                    {{ loadingFeatures ? 'Loading…' : 'Refresh map objects' }}
                </button>
            </div>
            <TablerInlineAlert
                v-if='status'
                class='mt-2'
                :severity='statusError ? "danger" : "success"'
                :title='statusError ? "Error" : "Success"'
                :description='status'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import {
    TablerBorder,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import Subscription from '../../../../../../src/base/subscription.ts';
import type { Feature } from '../../../../../../src/types.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import {
    loadSegmentsFromMission,
    saveSegmentsToMission,
    type SegmentMap,
} from '../../../lib/segmentsPersistence.ts';
import NavHelpButton from '../../NavHelpButton.vue';
import FeatureCallsignCell from '../../FeatureCallsignCell.vue';
import { flyToFeature } from '../../../lib/flyToFeature.ts';
import { areaSqMi, formatSqMi } from '../../../lib/geometryArea.ts';
import { ensureMissionFolder } from '../../../lib/folder.ts';
import {
    loadSchemaSubscription,
    missionAuthToken,
    schemaMission,
} from '../../../lib/incidentSubscription.ts';
import { deletePolygonFromMission, pushPolygonToMission } from '../../../lib/missionFeatures.ts';
import { fractionsFromAreas } from '../../../domain/rollup.ts';
import { splitRegisteredSegment } from '../../../lib/segmentSplit.ts';

function ringFromGeometry(geometry: unknown): [number, number][] | null {
    const geom = geometry as { type?: string; coordinates?: unknown };
    const coords = geom?.type === 'Polygon' ? geom.coordinates
        : geom?.type === 'MultiPolygon' && Array.isArray(geom.coordinates) ? (geom.coordinates as unknown[])[0]
            : null;
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
    const ring: [number, number][] = [];
    for (const point of coords[0] as unknown[]) {
        if (!Array.isArray(point) || point.length < 2) return null;
        ring.push([Number(point[0]), Number(point[1])]);
    }
    return ring.length >= 4 ? ring : null;
}

function ringCentroid(ring: [number, number][]): [number, number] {
    let lon = 0; let lat = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return [lon / ring.length, lat / ring.length];
}

const SEGMENTS_FOLDER = 'Segments';

interface MissionFeatureRef {
    uid: string;
    callsign: string;
    areaSqMi?: number;
    onCommonMap?: boolean;
    geometry?: Feature['geometry'];
}

interface SegmentRow {
    uid: string;
    callsign: string;
    created: string;
}

/** ICS segment labels are numeric only (e.g. "1", "12"); letters are for Divisions. */
function isIntegerCallsign(callsign: string): boolean {
    return /^\d+$/.test(callsign.trim());
}

const { activeMission, requireActiveMission } = useIncident();

const missionPolygons = ref<MissionFeatureRef[]>([]);
const loadingFeatures = ref(false);
const segmentUids = ref<string[]>([]);
const segments = ref<SegmentMap>({});
const contentHash = ref<string | undefined>();
const loadingSegments = ref(false);
const saving = ref(false);
const status = ref('');
const statusError = ref(false);

const segmentRows = computed<SegmentRow[]>(() =>
    Object.entries(segments.value)
        .map(([uid, rec]) => ({
            uid,
            callsign: rec.callsign || uid,
            created: rec.created || '',
        }))
        .sort((a, b) => a.callsign.localeCompare(b.callsign) || a.uid.localeCompare(b.uid)),
);

const availablePolygons = computed(() =>
    missionPolygons.value.filter((p) => !segments.value[p.uid]),
);

async function loadSub(): Promise<Awaited<ReturnType<typeof Subscription.load>>> {
    return Subscription.load(activeMission.value!.guid, {
        missiontoken: missionAuthToken(activeMission.value!),
        // Avoid Subscription.refresh → layer.refresh during picker load;
        // feature.list({ refresh: true }) refreshes CoTs only.
        reload: false,
    });
}

async function loadFeatures(): Promise<void> {
    if (!activeMission.value) {
        missionPolygons.value = [];
        return;
    }
    loadingFeatures.value = true;
    try {
        // Candidates come from BOTH maps: hand-drawn polygons land on the common
        // map (CloudTAK draws onto the map's active mission); registered segments
        // live on the MGMT sync. Registration MOVES common-map polygons to MGMT.
        const collect = (feats: Feature[], onCommonMap: boolean) => feats
            .filter((f: Feature) => {
                const t = (f.geometry as { type?: string })?.type;
                if (t !== 'Polygon' && t !== 'MultiPolygon') return false;
                const props = (f.properties ?? {}) as { callsign?: string };
                return typeof props.callsign === 'string' && isIntegerCallsign(props.callsign);
            })
            .map((f: Feature) => {
                const props = (f.properties ?? {}) as { callsign?: string };
                return {
                    uid: String(f.id),
                    callsign: (props.callsign as string).trim(),
                    areaSqMi: areaSqMi(f.geometry),
                    onCommonMap,
                    geometry: f.geometry,
                };
            });

        const commonSub = await loadSub();
        const commonFeats = collect(await commonSub.feature.list({ refresh: true }), true);

        let mgmtFeats: typeof commonFeats = [];
        if (activeMission.value.mgmt) {
            try {
                const mgmtSub = await loadSchemaSubscription(activeMission.value);
                mgmtFeats = collect(await mgmtSub.feature.list({ refresh: true }), false);
            } catch { /* mgmt features unavailable — common list still usable */ }
        }

        const seen = new Set(mgmtFeats.map((f) => f.uid));
        missionPolygons.value = [...mgmtFeats, ...commonFeats.filter((f) => !seen.has(f.uid))];
    } catch {
        missionPolygons.value = [];
    } finally {
        loadingFeatures.value = false;
    }
}

/** Polygon area in mi² for a segment's feature; undefined until features load. */
function areaForUid(uid: string): number | undefined {
    return missionPolygons.value.find((p) => p.uid === uid)?.areaSqMi;
}

/** Recenter the main map on a segment's CoT feature (works from the popout too). */
async function onFlyTo(uid: string): Promise<void> {
    const found = await flyToFeature(uid);
    if (!found) {
        status.value = 'Feature is not on the map yet — try "Refresh map objects".';
        statusError.value = true;
    }
}

async function loadSegments(): Promise<void> {
    if (!activeMission.value) {
        segments.value = {};
        contentHash.value = undefined;
        return;
    }
    loadingSegments.value = true;
    try {
        const loaded = await loadSegmentsFromMission(activeMission.value);
        segments.value = loaded.segments;
        contentHash.value = loaded.contentHash;
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load segments: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingSegments.value = false;
    }
}

async function refreshAll(): Promise<void> {
    await Promise.all([loadFeatures(), loadSegments()]);
}

async function onRefreshFeatures(): Promise<void> {
    status.value = '';
    statusError.value = false;
    await loadFeatures();
}

async function onAddSegments(): Promise<void> {
    if (!requireActiveMission() || !activeMission.value || !segmentUids.value.length) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const mission = activeMission.value;
        const planning = schemaMission(mission);
        const next: SegmentMap = { ...segments.value };
        const now = new Date().toISOString();
        const registeredUids: string[] = [];
        let moved = 0;
        for (const uid of [...segmentUids.value]) {
            const poly = missionPolygons.value.find((p) => p.uid === uid);
            let finalUid = uid;
            // Hand-drawn polygons land on the common (field-visible) map — MOVE
            // them to the MGMT sync at registration so segments stay Sworn-side.
            if (poly?.onCommonMap && mission.mgmt && poly.geometry) {
                const ring = ringFromGeometry(poly.geometry);
                if (ring) {
                    finalUid = await pushPolygonToMission({
                        missionGuid: planning.guid,
                        missionToken: planning.missionToken,
                        callsign: poly.callsign,
                        ring,
                        center: ringCentroid(ring),
                    });
                    try {
                        await deletePolygonFromMission({
                            missionGuid: mission.guid,
                            uid,
                            missiontoken: missionAuthToken(mission) || undefined,
                        });
                    } catch { /* copy exists in MGMT; stale common copy is cosmetic */ }
                    moved++;
                }
            }
            next[finalUid] = {
                callsign: poly?.callsign ?? finalUid,
                created: next[finalUid]?.created || now,
            };
            registeredUids.push(finalUid);
        }
        contentHash.value = await saveSegmentsToMission(mission, next, contentHash.value);
        segments.value = next;
        segmentUids.value = [];
        // File segment polygons into the Segments folder on the MGMT sync.
        try {
            const sub = mission.mgmt ? await loadSchemaSubscription(mission) : await loadSub();
            const folder = await ensureMissionFolder(sub, SEGMENTS_FOLDER);
            await sub.layer.attachFeatures(folder.uid, registeredUids);
        } catch (attachErr) {
            console.warn('Failed to file segments into Segments folder', attachErr);
        }
        await loadFeatures();
        status.value = `Saved ${registeredUids.length} segment${registeredUids.length === 1 ? '' : 's'}`
            + (moved ? ` (${moved} moved to ${mission.mgmt?.name ?? 'MGMT'})` : '') + '.';
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

// ── ISM segment split ───────────────────────────────────────────────────
const splitParentUid = ref('');
const splitChildUids = ref<string[]>([]);

/** Unregistered candidate polygons usable as split children. */
const splitCandidates = computed(() => missionPolygons.value.filter(
    (p) => !segments.value[p.uid] && p.uid !== splitParentUid.value,
));

function splitFraction(uid: string): number | null {
    const selected = splitCandidates.value.filter((p) => splitChildUids.value.includes(p.uid));
    const areas = selected.map((p) => p.areaSqMi ?? 0);
    if (areas.some((a) => !a || a <= 0)) return null;
    const total = areas.reduce((a, b) => a + b, 0);
    const mine = selected.find((p) => p.uid === uid)?.areaSqMi ?? 0;
    return total > 0 ? mine / total : null;
}

async function onSplitSegment(): Promise<void> {
    const mission = activeMission.value;
    const parentUid = splitParentUid.value;
    if (!mission || !parentUid || splitChildUids.value.length < 2) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const selected = missionPolygons.value.filter((p) => splitChildUids.value.includes(p.uid));
        const areas = selected.map((p) => p.areaSqMi ?? 0);
        const fractions = fractionsFromAreas(areas);
        const planning = schemaMission(mission);

        // Move common-drawn children into MGMT (same as registration).
        const children: { uid: string; callsign: string; fraction: number }[] = [];
        for (let i = 0; i < selected.length; i++) {
            const poly = selected[i];
            let finalUid = poly.uid;
            if (poly.onCommonMap && mission.mgmt && poly.geometry) {
                const ring = ringFromGeometry(poly.geometry);
                if (ring) {
                    finalUid = await pushPolygonToMission({
                        missionGuid: planning.guid,
                        missionToken: planning.missionToken,
                        callsign: poly.callsign,
                        ring,
                        center: ringCentroid(ring),
                    });
                    try {
                        await deletePolygonFromMission({
                            missionGuid: mission.guid,
                            uid: poly.uid,
                            missiontoken: missionAuthToken(mission) || undefined,
                        });
                    } catch { /* cosmetic */ }
                }
            }
            children.push({ uid: finalUid, callsign: poly.callsign, fraction: fractions[i] });
        }

        await splitRegisteredSegment(mission, parentUid, children);

        // Retire the parent polygon from the MGMT map.
        try {
            await deletePolygonFromMission({
                missionGuid: planning.guid,
                uid: parentUid,
                missiontoken: planning.missionToken || undefined,
            });
        } catch { /* parent polygon may live elsewhere; registry is authoritative */ }

        status.value = `Split into ${children.map((c) => c.callsign).join(', ')} (area-proportional POA).`;
        splitParentUid.value = '';
        splitChildUids.value = [];
        await refreshAll();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

async function removeSegment(uid: string): Promise<void> {
    if (!activeMission.value || !segments.value[uid]) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const removed = segments.value[uid];
        const next: SegmentMap = { ...segments.value };
        delete next[uid];
        contentHash.value = await saveSegmentsToMission(activeMission.value, next, contentHash.value);
        segments.value = next;
        status.value = `Removed ${removed.callsign || uid}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

watch(activeMission, () => {
    segmentUids.value = [];
    status.value = '';
    statusError.value = false;
    void refreshAll();
});

onMounted(() => {
    void refreshAll();
});
</script>
