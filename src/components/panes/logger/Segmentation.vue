<template>
    <div class='row g-3'>
        <div class='col-lg-8'>
            <div class='card mb-3'>
                <div class='card-header d-flex align-items-center'>
                    <h3 class='card-title mb-0 flex-grow-1'>
                        Segments
                    </h3>
                    <NavHelpButton help-key='segmenting-search-area' />
                </div>
                <div class='card-body'>
                    <div class='alert alert-info small mb-3'>
                        Segment names need to be numbered following ICS convention. Letters are for Divisions.
                    </div>
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
                </div>
            </div>
        </div>

        <div class='col-12'>
            <div class='card'>
                <div class='card-header py-2'>
                    <h3 class='card-title mb-0'>
                        Segments in this search ({{ segmentRows.length }})
                    </h3>
                </div>
                <div class='card-body py-2'>
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
                </div>
            </div>
        </div>

        <div class='col-12'>
            <div
                v-if='!activeMission'
                class='form-text text-warning'
            >
                No active mission. Select one in Create | Open first.
            </div>
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
            <div
                v-if='status'
                class='fw-bold mt-1'
                :class='statusError ? "text-danger" : "text-success"'
            >
                {{ status }}
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
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

interface MissionFeatureRef {
    uid: string;
    callsign: string;
    areaSqMi?: number;
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
        missiontoken: activeMission.value!.token ?? '',
    });
}

async function loadFeatures(): Promise<void> {
    if (!activeMission.value) {
        missionPolygons.value = [];
        return;
    }
    loadingFeatures.value = true;
    try {
        const sub = await loadSub();
        const feats = await sub.feature.list({ refresh: true });
        missionPolygons.value = feats
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
                };
            });
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
        const next: SegmentMap = { ...segments.value };
        const now = new Date().toISOString();
        let n = 0;
        for (const uid of segmentUids.value) {
            const poly = missionPolygons.value.find((p) => p.uid === uid);
            next[uid] = {
                callsign: poly?.callsign ?? uid,
                created: next[uid]?.created || now,
            };
            n++;
        }
        contentHash.value = await saveSegmentsToMission(activeMission.value, next, contentHash.value);
        segments.value = next;
        segmentUids.value = [];
        status.value = `Saved ${n} segment${n === 1 ? '' : 's'} to ${activeMission.value.name}.`;
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
