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
                        v-if='!loadingFeatures && availablePolygons.length > 1'
                        class='d-flex gap-2 align-items-center py-1 border-bottom mb-1'
                        style='cursor:pointer'
                    >
                        <input
                            type='checkbox'
                            class='form-check-input'
                            :checked='allSegmentsSelected'
                            :indeterminate='segmentUids.length > 0 && !allSegmentsSelected'
                            @change='toggleAllSegments'
                        >
                        <span class='fw-bold'>Select all ({{ availablePolygons.length }})</span>
                    </label>
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

        <div class='col-lg-4'>
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Declare without drawing
                    </p>
                </template>
                <p class='form-text mt-0'>
                    Sketched the segments on paper? Declare them by number now and run the
                    Initial Consensus; draw and link the polygons afterwards.
                </p>
                <label class='form-label'>Number of segments</label>
                <div class='d-flex gap-2 align-items-center'>
                    <input
                        v-model.number='declareCount'
                        type='number'
                        min='1'
                        max='99'
                        class='form-control form-control-sm'
                        style='max-width: 6rem'
                    >
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm'
                        :disabled='saving || !declareNames.length'
                        @click='onDeclareSegments'
                    >
                        Declare {{ declareNames.length ? declareNames.join(', ') : '' }}
                    </button>
                </div>
                <p class='form-text mb-0'>
                    {{ UNDRAWN_EXPLAINER }}
                </p>
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
                    <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center w-100'>
                        <span>Segments in this search ({{ segmentRows.length }})</span>
                        <button
                            class='btn btn-outline-primary btn-sm ms-auto'
                            title='Add new segments funded out of R.O.W. (CASIE Expand Search Area)'
                            @click='goToExpand'
                        >
                            Expand Search Area…
                        </button>
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
                    No segments registered yet. Select polygons above, or declare them by number.
                </div>
                <TablerInlineAlert
                    v-if='!loadingSegments && declaredRows.length'
                    class='mb-2'
                    severity='warning'
                    :title='`${declaredRows.length} segment${declaredRows.length === 1 ? " is" : "s are"} not drawn yet`'
                    :description='UNDRAWN_EXPLAINER'
                />
                <div
                    v-if='!loadingSegments && suggestedCount > 1'
                    class='d-flex align-items-center gap-2 mb-2'
                >
                    <span class='small'>{{ suggestedCount }} drawn polygons match declared segments by number.</span>
                    <button
                        type='button'
                        class='btn btn-primary btn-sm'
                        :disabled='saving'
                        @click='onLinkAllSuggested'
                    >
                        Link all {{ suggestedCount }}
                    </button>
                </div>
                <table
                    v-if='!loadingSegments && segmentRows.length'
                    class='table table-sm table-vcenter mb-0'
                >
                    <thead>
                        <tr>
                            <th>Segment</th>
                            <th>{{ declaredRows.length ? 'Area (mi²) / polygon' : 'Area (mi²)' }}</th>
                            <th class='text-end' />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='row in segmentRows'
                            :key='row.uid'
                        >
                            <td>
                                <span
                                    v-if='row.undrawn'
                                    class='d-inline-flex align-items-center gap-2'
                                >
                                    <strong>{{ row.callsign }}</strong>
                                    <span
                                        class='badge bg-yellow-lt'
                                        :title='UNDRAWN_EXPLAINER'
                                    >Not drawn</span>
                                </span>
                                <FeatureCallsignCell
                                    v-else
                                    :uid='row.uid'
                                    :callsign='row.callsign'
                                    @fly='onFlyTo(row.uid)'
                                />
                            </td>
                            <td>
                                <div
                                    v-if='row.undrawn'
                                    class='d-flex flex-wrap align-items-center gap-2'
                                >
                                    <select
                                        v-model='linkChoice[row.uid]'
                                        class='form-select form-select-sm'
                                        style='max-width: 14rem'
                                        :aria-label='`Polygon for segment ${row.callsign}`'
                                    >
                                        <option value=''>
                                            {{ linkCandidates.length ? 'Pick the drawn polygon…' : 'No unregistered polygons yet' }}
                                        </option>
                                        <option
                                            v-for='p in linkCandidates'
                                            :key='p.uid'
                                            :value='p.uid'
                                        >
                                            {{ p.callsign }}{{ suggestions[row.uid] === p.uid ? ' (matches)' : '' }}
                                        </option>
                                    </select>
                                    <button
                                        type='button'
                                        class='btn btn-primary btn-sm'
                                        :disabled='saving || !linkChoice[row.uid]'
                                        @click='onLinkPolygon(row.uid, linkChoice[row.uid])'
                                    >
                                        Link
                                    </button>
                                </div>
                                <template v-else>
                                    {{ formatSqMi(areaForUid(row.uid)) }}
                                </template>
                            </td>
                            <td class='text-end'>
                                <button
                                    v-if='!row.undrawn'
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
import { ringCentroid, ringFromGeometry } from '../../../lib/polygonRing.ts';
import { loadRowSegmentsFromMission } from '../../../lib/rowSegmentsPersistence.ts';
import {
    declareSegments,
    isUndrawn,
    markDrawn,
    matchPolygonsToDeclared,
    nextSegmentNames,
    sameSegmentName,
    UNDRAWN_EXPLAINER,
} from '../../../lib/declaredSegments.ts';

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
    /** Declared by number, no polygon yet (#29). */
    undrawn: boolean;
}

/** ICS segment labels are numeric only (e.g. "1", "12"); letters are for Divisions. */
function isIntegerCallsign(callsign: string): boolean {
    return /^\d+$/.test(callsign.trim());
}

const {
    activeMission,
    casieExpandRequested,
    requireActiveMission,
    selectHTabGuarded,
} = useIncident();

/** Jump to the CASIE tab with the Expand Search Area form opened. */
function goToExpand(): void {
    if (!requireActiveMission()) return;
    casieExpandRequested.value = true;
    selectHTabGuarded('casie');
}

const missionPolygons = ref<MissionFeatureRef[]>([]);
const loadingFeatures = ref(false);
const segmentUids = ref<string[]>([]);
const allSegmentsSelected = computed(() => availablePolygons.value.length > 0
    && availablePolygons.value.every((p) => segmentUids.value.includes(p.uid)));
function toggleAllSegments(): void {
    segmentUids.value = allSegmentsSelected.value ? [] : availablePolygons.value.map((p) => p.uid);
}
const segments = ref<SegmentMap>({});
const rowSegments = ref<SegmentMap>({});
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
            undrawn: isUndrawn(rec),
        }))
        .sort((a, b) => a.callsign.localeCompare(b.callsign) || a.uid.localeCompare(b.uid)),
);

/** Polygons not registered as a segment or R.O.W. segment. */
const unregisteredPolygons = computed(() =>
    missionPolygons.value.filter((p) => !segments.value[p.uid] && !rowSegments.value[p.uid]),
);

// ── Declared segments (#29) ─────────────────────────────────────────────
const declaredRows = computed(() => segmentRows.value.filter((r) => r.undrawn));

/**
 * Registering a polygon numbered like a declared segment would make two
 * segments with one number; those polygons are linked instead.
 */
const availablePolygons = computed(() => unregisteredPolygons.value.filter(
    (p) => !declaredRows.value.some((d) => sameSegmentName(d.callsign, p.callsign)),
));

const linkCandidates = unregisteredPolygons;

const suggestions = computed(() => matchPolygonsToDeclared(declaredRows.value, linkCandidates.value));
const suggestedCount = computed(() => Object.keys(suggestions.value).length);

/** Polygon chosen per declared segment; starts at the name match. */
const linkChoice = ref<Record<string, string>>({});
watch(suggestions, (next) => {
    const choice: Record<string, string> = {};
    for (const row of declaredRows.value) {
        const kept = linkChoice.value[row.uid];
        choice[row.uid] = kept && linkCandidates.value.some((p) => p.uid === kept) ? kept : (next[row.uid] ?? '');
    }
    linkChoice.value = choice;
}, { immediate: true });

const declareCount = ref(3);
const declareNames = computed(() => {
    const n = Number(declareCount.value);
    if (!Number.isInteger(n) || n < 1 || n > 99) return [];
    return nextSegmentNames([
        ...Object.values(segments.value).map((s) => s.callsign),
        ...Object.values(rowSegments.value).map((s) => s.callsign),
    ], n);
});

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
        rowSegments.value = {};
        contentHash.value = undefined;
        return;
    }
    loadingSegments.value = true;
    try {
        const [loaded, rowLoaded] = await Promise.all([
            loadSegmentsFromMission(activeMission.value),
            loadRowSegmentsFromMission(activeMission.value),
        ]);
        segments.value = loaded.segments;
        contentHash.value = loaded.contentHash;
        rowSegments.value = rowLoaded.segments;
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

async function onDeclareSegments(): Promise<void> {
    if (!requireActiveMission() || !activeMission.value || !declareNames.value.length) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const names = declareNames.value;
        const { segments: next } = declareSegments(segments.value, names);
        contentHash.value = await saveSegmentsToMission(activeMission.value, next, contentHash.value);
        segments.value = next;
        status.value = `Declared segment${names.length === 1 ? '' : 's'} ${names.join(', ')}. `
            + 'Run the Initial Consensus now; link the polygons here once they are drawn.';
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

/**
 * Give a declared segment its polygon: the polygon is pushed to MGMT under
 * the declared segment's own uid and the original removed, so everything
 * that already refers to the segment (consensus, POA locks) stays put.
 */
async function linkOne(declUid: string, polyUid: string, next: SegmentMap): Promise<void> {
    const mission = activeMission.value!;
    const rec = next[declUid];
    const poly = missionPolygons.value.find((p) => p.uid === polyUid);
    if (!rec || !poly?.geometry) throw new Error('That polygon is no longer on the map. Refresh map objects.');
    const ring = ringFromGeometry(poly.geometry);
    if (!ring) throw new Error(`Polygon ${poly.callsign} has no usable outline.`);
    const planning = schemaMission(mission);
    await pushPolygonToMission({
        id: declUid,
        missionGuid: planning.guid,
        missionToken: planning.missionToken,
        callsign: rec.callsign,
        ring,
        center: ringCentroid(ring),
    });
    try {
        await deletePolygonFromMission(poly.onCommonMap
            ? { missionGuid: mission.guid, uid: poly.uid, missiontoken: missionAuthToken(mission) || undefined }
            : { missionGuid: planning.guid, uid: poly.uid, missiontoken: planning.missionToken || undefined });
    } catch { /* the linked copy exists; a stale original is cosmetic */ }
    next[declUid] = markDrawn(rec);
}

async function linkPolygons(pairs: [string, string][]): Promise<void> {
    if (!requireActiveMission() || !activeMission.value || !pairs.length) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    const mission = activeMission.value;
    const next: SegmentMap = { ...segments.value };
    const linked: string[] = [];
    try {
        for (const [declUid, polyUid] of pairs) {
            await linkOne(declUid, polyUid, next);
            linked.push(declUid);
        }
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    }
    try {
        if (linked.length) {
            contentHash.value = await saveSegmentsToMission(mission, next, contentHash.value);
            segments.value = next;
            try {
                const sub = mission.mgmt ? await loadSchemaSubscription(mission) : await loadSub();
                const folder = await ensureMissionFolder(sub, SEGMENTS_FOLDER);
                await sub.layer.attachFeatures(folder.uid, linked);
            } catch (attachErr) {
                console.warn('Failed to file linked segments into Segments folder', attachErr);
            }
            if (!statusError.value) {
                status.value = `Linked segment${linked.length === 1 ? '' : 's'} `
                    + `${linked.map((uid) => next[uid].callsign).join(', ')} to the drawn polygon${linked.length === 1 ? '' : 's'}.`;
            }
        }
        await loadFeatures();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

function onLinkPolygon(declUid: string, polyUid: string | undefined): void {
    if (polyUid) void linkPolygons([[declUid, polyUid]]);
}

function onLinkAllSuggested(): void {
    void linkPolygons(Object.entries(suggestions.value));
}

// ── ISM segment split ───────────────────────────────────────────────────
const splitParentUid = ref('');
const splitChildUids = ref<string[]>([]);

/** Unregistered candidate polygons usable as split children. */
const splitCandidates = computed(() => missionPolygons.value.filter(
    (p) => !segments.value[p.uid] && !rowSegments.value[p.uid] && p.uid !== splitParentUid.value,
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
