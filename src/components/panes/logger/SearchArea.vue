<template>
    <div class='row g-3'>
        <div class='col-lg-8'>
            <!-- 1 · IPP -->
            <div class='card mb-3'>
                <div
                    class='card-header'
                    :style='openable(0) ? "cursor:pointer" : "cursor:not-allowed"'
                    :class='{ "opacity-50": !openable(0) }'
                    @click='toggle("ipp", 0)'
                >
                    <h3 class='card-title mb-0 d-flex align-items-center'>
                        <span class='me-2'>{{ expanded === 'ipp' ? '▾' : '▸' }}</span>
                        Initial Planning Point (IPP)
                        <span
                            v-if='stepDone.ipp'
                            class='badge bg-success ms-2'
                        >set</span>
                        <span
                            v-else-if='!openable(0)'
                            class='ms-2'
                        >🔒</span>
                    </h3>
                </div>
                <div
                    v-show='expanded === "ipp"'
                    class='card-body'
                >
                    <label class='form-label'>IPP Coordinates</label>
                    <div class='input-group'>
                        <input
                            v-model='ippInput'
                            type='text'
                            class='form-control'
                            :disabled='!!selectedObjectUid'
                            placeholder='35.1862, -111.6404 or 35 11 10 -111 38 25'
                        >
                        <button
                            class='btn btn-primary'
                            :disabled='!canSetIpp || settingIpp'
                            @click='setIpp'
                        >
                            {{ settingIpp ? 'Setting…' : 'Set IPP' }}
                        </button>
                    </div>
                    <div class='form-text'>
                        <span
                            v-if='selectedObjectUid'
                            class='text-muted'
                        >Using selected DataSync object.</span>
                        <span
                            v-else-if='ipp'
                            class='text-success'
                        >→ {{ ipp.lat.toFixed(5) }}, {{ ipp.lng.toFixed(5) }}</span>
                        <span
                            v-else-if='ippInput'
                            class='text-danger'
                        >→ unrecognized format</span>
                        <span v-else>Supports decimal degrees, DMS, DM, and MPS.</span>
                    </div>

                    <label class='form-label mt-2'>OR Choose DataSync Object</label>
                    <select
                        v-model='selectedObjectUid'
                        class='form-select form-select-sm'
                    >
                        <option value=''>
                            — none (use coordinates above) —
                        </option>
                        <option
                            v-for='m in missionMarkers'
                            :key='m.uid'
                            :value='m.uid'
                        >
                            {{ m.callsign }}
                        </option>
                    </select>
                    <div
                        v-if='loadingFeatures'
                        class='form-text'
                    >
                        Loading mission objects…
                    </div>
                    <div
                        v-else-if='!missionMarkers.length'
                        class='form-text text-muted'
                    >
                        No point markers in the active DataSync.
                    </div>

                    <label class='form-label mt-2'>IPP Type</label>
                    <select
                        v-model='ippType'
                        class='form-select form-select-sm'
                    >
                        <option value='LKP'>
                            LKP — Last Known Position
                        </option>
                        <option value='PLS'>
                            PLS — Point Last Seen
                        </option>
                    </select>
                </div>
            </div>

            <!-- 2 · Theoretical -->
            <div class='card mb-3'>
                <div
                    class='card-header'
                    :style='openable(1) ? "cursor:pointer" : "cursor:not-allowed"'
                    :class='{ "opacity-50": !openable(1) }'
                    @click='toggle("theoretical", 1)'
                >
                    <h3 class='card-title mb-0 d-flex align-items-center'>
                        <span class='me-2'>{{ expanded === 'theoretical' ? '▾' : '▸' }}</span>
                        Theoretical Search Area
                        <span
                            v-if='stepDone.theoretical'
                            class='badge bg-success ms-2'
                        >added</span>
                        <span
                            v-else-if='!openable(1)'
                            class='ms-2'
                        >🔒</span>
                    </h3>
                </div>
                <div
                    v-show='expanded === "theoretical"'
                    class='card-body'
                >
                    <label class='form-label'>Time Missing</label>
                    <input
                        v-model='timeMissing'
                        type='datetime-local'
                        class='form-control mb-2'
                    >
                    <label class='form-label'>Travel Speed (mph)</label>
                    <input
                        v-model.number='travelSpeed'
                        type='number'
                        min='0'
                        step='0.1'
                        class='form-control'
                        placeholder='e.g. 2.5'
                    >
                    <div
                        v-if='theoreticalMiles'
                        class='form-text'
                    >
                        Radius: <strong>{{ theoreticalMiles.toFixed(2) }} mi</strong>
                        ({{ elapsedHours.toFixed(1) }} h × {{ travelSpeed }} mph)
                    </div>
                    <button
                        class='btn btn-orange text-white btn-sm mt-2'
                        :disabled='!canPushTheoretical || pushing'
                        @click='pushTheoretical'
                    >
                        Add to DataSync
                    </button>
                </div>
            </div>

            <!-- 3 · Statistical / LPB -->
            <div class='card mb-3'>
                <div
                    class='card-header'
                    :style='openable(2) ? "cursor:pointer" : "cursor:not-allowed"'
                    :class='{ "opacity-50": !openable(2) }'
                    @click='toggle("statistical", 2)'
                >
                    <h3 class='card-title mb-0 d-flex align-items-center'>
                        <span class='me-2'>{{ expanded === 'statistical' ? '▾' : '▸' }}</span>
                        Statistical Search Area (LPB)
                        <span
                            v-if='stepDone.statistical'
                            class='badge bg-success ms-2'
                        >added</span>
                        <span
                            v-else-if='!openable(2)'
                            class='ms-2'
                        >🔒</span>
                    </h3>
                </div>
                <div
                    v-show='expanded === "statistical"'
                    class='card-body'
                >
                    <label class='form-label'>Subject LPB Category</label>
                    <select
                        v-model='category'
                        class='form-select form-select-sm mb-2'
                    >
                        <option
                            v-for='c in categories'
                            :key='c'
                            :value='c'
                        >
                            {{ c }}
                        </option>
                    </select>

                    <div class='table-responsive'>
                        <table class='table table-sm table-vcenter mb-0'>
                            <thead>
                                <tr>
                                    <th>Ring</th><th>Percentile</th><th>Distance</th><th>Send</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for='q in quartiles'
                                    :key='q.key'
                                >
                                    <td>
                                        <span :style='`color:${q.color}`'>●</span> {{ q.key }}
                                    </td>
                                    <td>{{ q.pct }}</td>
                                    <td>{{ q.miles.toFixed(2) }} mi</td>
                                    <td>
                                        <input
                                            v-model='q.selected'
                                            type='checkbox'
                                            class='form-check-input'
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <button
                        class='btn btn-primary btn-sm mt-3'
                        :disabled='!canPushLpb || pushing'
                        @click='pushLpb'
                    >
                        {{ pushing ? 'Sending…' : 'Add selected rings to DataSync' }}
                    </button>
                </div>
            </div>

            <!-- 4 · Subjective -->
            <div class='card mb-3'>
                <div
                    class='card-header'
                    :style='openable(3) ? "cursor:pointer" : "cursor:not-allowed"'
                    :class='{ "opacity-50": !openable(3) }'
                    @click='toggle("subjective", 3)'
                >
                    <h3 class='card-title mb-0 d-flex align-items-center'>
                        <span class='me-2'>{{ expanded === 'subjective' ? '▾' : '▸' }}</span>
                        Subjective Search Area
                        <span
                            v-if='stepDone.subjective'
                            class='badge bg-success ms-2'
                        >added</span>
                        <span
                            v-else-if='!openable(3)'
                            class='ms-2'
                        >🔒</span>
                    </h3>
                </div>
                <div
                    v-show='expanded === "subjective"'
                    class='card-body'
                >
                    <label class='form-label'>Choose a polygon from the active DataSync</label>
                    <select
                        v-model='subjectiveUid'
                        class='form-select form-select-sm'
                    >
                        <option value=''>
                            — select a polygon —
                        </option>
                        <option
                            v-for='p in missionPolygons'
                            :key='p.uid'
                            :value='p.uid'
                        >
                            {{ p.callsign }}
                        </option>
                    </select>
                    <div
                        v-if='!missionPolygons.length'
                        class='form-text text-muted'
                    >
                        No polygons in the active DataSync.
                    </div>
                    <button
                        class='btn btn-primary btn-sm mt-2'
                        :disabled='!canAddSubjective || pushing'
                        @click='addSubjective'
                    >
                        Add to DataSync
                    </button>
                </div>
            </div>

            <!-- 5 · Segments -->
            <div class='card mb-3'>
                <div
                    class='card-header'
                    :style='openable(4) ? "cursor:pointer" : "cursor:not-allowed"'
                    :class='{ "opacity-50": !openable(4) }'
                    @click='toggle("segments", 4)'
                >
                    <h3 class='card-title mb-0 d-flex align-items-center'>
                        <span class='me-2'>{{ expanded === 'segments' ? '▾' : '▸' }}</span>
                        Segments
                        <span
                            v-if='stepDone.segments'
                            class='badge bg-success ms-2'
                        >added</span>
                        <span
                            v-else-if='!openable(4)'
                            class='ms-2'
                        >🔒</span>
                    </h3>
                </div>
                <div
                    v-show='expanded === "segments"'
                    class='card-body'
                >
                    <label class='form-label'>Select segments from the active DataSync (multiple)</label>
                    <div
                        class='border rounded p-2'
                        style='max-height: 240px; overflow:auto;'
                    >
                        <div
                            v-if='!missionPolygons.length'
                            class='text-muted small'
                        >
                            No polygons in the active DataSync.
                        </div>
                        <label
                            v-for='p in missionPolygons'
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
                        :disabled='!segmentUids.length || pushing'
                        @click='addSegments'
                    >
                        Add {{ segmentUids.length }} segment{{ segmentUids.length === 1 ? '' : 's' }} to DataSync
                    </button>
                </div>
            </div>
        </div>

        <!-- Recall: areas already on DataSync -->
        <div class='col-12'>
            <div class='card'>
                <div class='card-header py-2'>
                    <h3 class='card-title mb-0'>
                        Search Areas on DataSync ({{ sentAreas.length }})
                    </h3>
                </div>
                <div class='card-body py-2'>
                    <div
                        v-if='loadingAreas'
                        class='text-muted small'
                    >
                        Loading…
                    </div>
                    <div
                        v-else-if='!sentAreas.length'
                        class='text-muted small'
                    >
                        No search areas sent yet. Set the IPP to begin.
                    </div>
                    <table
                        v-else
                        class='table table-sm table-vcenter mb-0'
                    >
                        <thead>
                            <tr><th>Area</th><th>CoT UID</th><th class='text-end' /></tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='a in sentAreas'
                                :key='a.key'
                            >
                                <td>{{ a.label }}</td>
                                <td><code class='small'>{{ a.uuid }}</code></td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-sm btn-link text-danger p-0'
                                        :disabled='pushing'
                                        @click='removeArea(a)'
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

        <!-- shared status -->
        <div class='col-12'>
            <div
                v-if='!activeMission'
                class='form-text text-warning'
            >
                No active mission. Select one in Create | Open first.
            </div>
            <div
                v-else
                class='form-text'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
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
import { ref, computed, reactive, watch, onMounted } from 'vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import type { Feature } from '../../../../../../src/types.ts';
import azlpb from '../../../data/azlpb_table.json';
import { parseCoordinates } from '../../../lib/coords.ts';
import { circleRing, milesToMeters } from '../../../lib/rings.ts';
import { pushPolygonToMission, pushPointToMission, deletePolygonFromMission } from '../../../lib/missionFeatures.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const SEARCH_AREA_KEYWORD = 'search-area';
const IPP_KEY = 'ipp';
const IPP_ICON = '83198b4872a8c34eb9c549da8a4de5a28f07821185b39a2277948f66c24ac17a/Wildfire/Fire Origin.png';

interface MissionFeatureRef {
    uid: string;
    callsign: string;
    coords?: [number, number];
}

/** A search area recalled from a DataSync log entry. */
interface SentArea {
    key: string;       // stable identity, e.g. 'theoretical', 'lpb:A', 'segment:<uuid>'
    label: string;     // callsign / display text
    uuid: string;      // CoT uuid of the referenced feature (entryUid)
    logId: string;     // mission-log entry id
    created: string;
}

/** The mission-log wrapper, widened to carry the patched `entryUid` field. */
interface LogWriteBody {
    dtg?: string;
    content: string;
    keywords?: string[];
    entryUid?: string;
}
interface LogApi {
    create(body: LogWriteBody): Promise<{ id: string }>;
    update(logid: string, body: LogWriteBody): Promise<{ id: string }>;
    delete(logid: string): Promise<void>;
}

interface AzlpbEntry {
    category: string;
    qAmi: number; qBmi: number; qCmi: number; qDmi: number;
}

const { activeMission } = useIncident();
const table = azlpb as AzlpbEntry[];

const ippInput = ref('');
const ipp = computed(() => parseCoordinates(ippInput.value));

const ippType = ref<'LKP' | 'PLS'>('LKP');
const selectedObjectUid = ref('');
const missionMarkers = ref<MissionFeatureRef[]>([]);
const missionPolygons = ref<MissionFeatureRef[]>([]);
const loadingFeatures = ref(false);
const settingIpp = ref(false);

const subjectiveUid = ref('');
const segmentUids = ref<string[]>([]);

const categories = table.map((t) => t.category);
const category = ref<string>(categories[0]);

const QUARTILE_COLORS = { A: '#2fb344', B: '#f59f00', C: '#f76707', D: '#d63939' };

const quartiles = reactive([
    { key: 'A', pct: '25%', miField: 'qAmi', color: QUARTILE_COLORS.A, miles: 0, selected: true },
    { key: 'B', pct: '50%', miField: 'qBmi', color: QUARTILE_COLORS.B, miles: 0, selected: true },
    { key: 'C', pct: '75%', miField: 'qCmi', color: QUARTILE_COLORS.C, miles: 0, selected: false },
    { key: 'D', pct: '90%', miField: 'qDmi', color: QUARTILE_COLORS.D, miles: 0, selected: false },
]);

function refreshQuartiles(): void {
    const entry = table.find((t) => t.category === category.value);
    if (!entry) return;
    for (const q of quartiles) {
        q.miles = (entry as unknown as Record<string, number>)[q.miField] ?? 0;
    }
}
watch(category, refreshQuartiles, { immediate: true });

// Theoretical
const timeMissing = ref('');
const travelSpeed = ref<number>(0);
const elapsedHours = computed(() => {
    if (!timeMissing.value) return 0;
    const ms = Date.now() - new Date(timeMissing.value).getTime();
    return ms > 0 ? ms / 3_600_000 : 0;
});
const theoreticalMiles = computed(() =>
    elapsedHours.value > 0 && travelSpeed.value > 0 ? elapsedHours.value * travelSpeed.value : 0
);

const pushing = ref(false);
const status = ref('');
const statusError = ref(false);

const sentAreas = ref<SentArea[]>([]);
const loadingAreas = ref(false);

type LoadedSub = Awaited<ReturnType<typeof Subscription.load>>;

async function loadSub(): Promise<LoadedSub> {
    return Subscription.load(activeMission.value!.guid, {
        token: activeMission.value!.token ?? '',
    });
}

// ---- Sequential accordion state -------------------------------------------

const STEPS = ['ipp', 'theoretical', 'statistical', 'subjective', 'segments'] as const;
type StepKey = typeof STEPS[number];

const expanded = ref<StepKey | ''>('ipp');

const stepDone = computed(() => ({
    ipp: sentAreas.value.some((a) => a.key === IPP_KEY),
    theoretical: sentAreas.value.some((a) => a.key === 'theoretical'),
    statistical: sentAreas.value.some((a) => a.key.startsWith('lpb:')),
    subjective: sentAreas.value.some((a) => a.key === 'subjective'),
    segments: sentAreas.value.some((a) => a.key.startsWith('segment:')),
}));

/** Index of the current (first not-yet-done) step; === STEPS.length when all done. */
const currentIndex = computed(() => {
    for (let i = 0; i < STEPS.length; i++) {
        if (!stepDone.value[STEPS[i]]) return i;
    }
    return STEPS.length;
});

/** A step can be opened only once every step before it is done (i.e. it is the
 * current step or an already-completed one). */
function openable(index: number): boolean {
    return index <= currentIndex.value;
}

function toggle(key: StepKey, index: number): void {
    if (!openable(index)) return;
    expanded.value = expanded.value === key ? '' : key;
}

/**
 * Open the first not-yet-completed step — i.e. resume where the operator left
 * off based on what's already on DataSync. Called after every list load (mount,
 * mission switch, and after each push/remove), so reopening the tab picks up at
 * the right step (e.g. all 4 LPB rings present → opens Subjective).
 */
function resumeToCurrentStep(): void {
    const idx = currentIndex.value;
    expanded.value = idx < STEPS.length ? STEPS[idx] : '';
}

// ---- Mission data loading --------------------------------------------------

/** Read the mission log and recover which search areas have already been pushed. */
async function loadAreas(sub?: LoadedSub): Promise<void> {
    if (!activeMission.value) {
        sentAreas.value = [];
        return;
    }
    loadingAreas.value = true;
    try {
        const s = sub ?? await loadSub();
        const logs = await s.log.list({ refresh: true });
        const kw = (keywords: string[] | undefined, prefix: string): string => {
            const t = keywords?.find((k) => k.startsWith(prefix));
            return t ? t.slice(prefix.length) : '';
        };
        const byKey = new Map<string, SentArea>();
        for (const log of logs) {
            if (!log.keywords?.includes(SEARCH_AREA_KEYWORD)) continue;
            const key = kw(log.keywords, 'area:');
            const uuid = kw(log.keywords, 'uid:');
            if (!key || !uuid) continue;
            const created = log.created || log.dtg || '';
            const prev = byKey.get(key);
            if (!prev || Date.parse(created) >= Date.parse(prev.created)) {
                byKey.set(key, { key, label: log.content || key, uuid, logId: String(log.id), created });
            }
        }
        sentAreas.value = [...byKey.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
        resumeToCurrentStep();
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load search areas: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingAreas.value = false;
    }
}

/** Logical ordering of recall-card rows. */
function rank(key: string): number {
    if (key === IPP_KEY) return 0;
    if (key === 'theoretical') return 1;
    if (key.startsWith('lpb:')) return 2;
    if (key === 'subjective') return 3;
    if (key.startsWith('segment:')) return 4;
    return 9;
}

/** Load point markers and polygons from the active DataSync mission. */
async function loadFeatures(sub?: LoadedSub): Promise<void> {
    if (!activeMission.value) {
        missionMarkers.value = [];
        missionPolygons.value = [];
        return;
    }
    loadingFeatures.value = true;
    try {
        const s = sub ?? await loadSub();
        const feats = await s.feature.list({ refresh: true });
        const toRef = (f: { id: unknown; properties?: unknown; geometry?: unknown }): MissionFeatureRef => {
            const props = (f.properties ?? {}) as { callsign?: string };
            const geom = (f.geometry ?? {}) as { type?: string; coordinates?: number[] };
            const ref: MissionFeatureRef = { uid: String(f.id), callsign: props.callsign || String(f.id) };
            if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                ref.coords = [geom.coordinates[0], geom.coordinates[1]];
            }
            return ref;
        };
        missionMarkers.value = feats.filter((f: Feature) => (f.geometry as { type?: string })?.type === 'Point').map(toRef);
        missionPolygons.value = feats
            .filter((f: Feature) => {
                const t = (f.geometry as { type?: string })?.type;
                return t === 'Polygon' || t === 'MultiPolygon';
            })
            .map(toRef);
    } catch {
        missionMarkers.value = [];
        missionPolygons.value = [];
    } finally {
        loadingFeatures.value = false;
    }
}

onMounted(() => { void loadAreas(); void loadFeatures(); });
watch(() => activeMission.value?.guid, () => { void loadAreas(); void loadFeatures(); });

// ---- IPP -------------------------------------------------------------------

const canSetIpp = computed(
    () => !!activeMission.value && (!!ipp.value || !!selectedObjectUid.value),
);

/** Center for ring math: typed coordinates, else the recalled IPP marker's location. */
const ippCenter = computed<[number, number] | null>(() => {
    if (ipp.value && !selectedObjectUid.value) return [ipp.value.lng, ipp.value.lat];
    const ippArea = sentAreas.value.find((a) => a.key === IPP_KEY);
    if (ippArea) {
        const marker = missionMarkers.value.find((m) => m.uid === ippArea.uuid);
        if (marker?.coords) return marker.coords;
    }
    if (ipp.value) return [ipp.value.lng, ipp.value.lat];
    return null;
});

/** Upsert a log entry that references an existing CoT feature (no feature created). */
async function writeAreaLog(sub: LoadedSub, key: string, content: string, uuid: string): Promise<void> {
    const existing = sentAreas.value.find((a) => a.key === key);
    const log = sub.log as unknown as LogApi;
    const body: LogWriteBody = {
        dtg: new Date().toISOString(),
        content,
        keywords: [SEARCH_AREA_KEYWORD, `area:${key}`, `uid:${uuid}`],
        entryUid: uuid,
    };
    if (existing?.logId) await log.update(existing.logId, body);
    else await log.create(body);
}

async function setIpp(): Promise<void> {
    if (!activeMission.value || (!ipp.value && !selectedObjectUid.value)) return;
    settingIpp.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const label = `IPP-${ippType.value}`;
        const existing = sentAreas.value.find((a) => a.key === IPP_KEY);

        let uuid: string;
        if (selectedObjectUid.value) {
            uuid = selectedObjectUid.value;
        } else {
            uuid = await pushPointToMission({
                missionGuid: activeMission.value.guid,
                callsign: label,
                point: [ipp.value!.lng, ipp.value!.lat],
                type: 'a-f-G',
                icon: IPP_ICON,
                id: existing?.uuid,
            });
        }

        await writeAreaLog(sub, IPP_KEY, label, uuid);
        await Promise.all([loadAreas(sub), loadFeatures(sub)]);
        status.value = `Set ${label} on ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        settingIpp.value = false;
    }
}

// ---- Theoretical & Statistical (rings around the IPP) ----------------------

const canPushLpb = computed(() => !!ippCenter.value && !!activeMission.value && quartiles.some((q) => q.selected));
const canPushTheoretical = computed(() => !!ippCenter.value && !!activeMission.value && theoreticalMiles.value > 0);

/** Push (or update) a ring feature AND its referencing log entry. */
async function upsertRing(
    sub: LoadedSub,
    key: string,
    miles: number,
    label: string,
    color: string,
): Promise<void> {
    const center = ippCenter.value;
    if (!center) throw new Error('No IPP center set.');
    const ring = circleRing(center[0], center[1], milesToMeters(miles));
    const existing = sentAreas.value.find((a) => a.key === key);

    const uuid = await pushPolygonToMission({
        missionGuid: activeMission.value!.guid,
        callsign: label,
        ring,
        center,
        style: { stroke: color, fillOpacity: 0.1 },
        id: existing?.uuid,
    });

    await writeAreaLog(sub, key, label, uuid);
}

async function pushTheoretical(): Promise<void> {
    if (!ippCenter.value || !activeMission.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        await upsertRing(sub, 'theoretical', theoreticalMiles.value, `Theoretical ${theoreticalMiles.value.toFixed(1)}mi`, '#ff9900');
        await loadAreas(sub);
        status.value = `Saved theoretical ring (${theoreticalMiles.value.toFixed(1)} mi) to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

async function pushLpb(): Promise<void> {
    if (!ippCenter.value || !activeMission.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        let n = 0;
        for (const q of quartiles) {
            if (!q.selected) continue;
            await upsertRing(sub, `lpb:${q.key}`, q.miles, `${category.value} ${q.pct} (${q.miles.toFixed(1)}mi)`, q.color);
            n++;
        }
        await loadAreas(sub);
        status.value = `Saved ${n} LPB ring${n === 1 ? '' : 's'} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

// ---- Subjective & Segments (reference existing mission polygons) -----------

const canAddSubjective = computed(() => !!activeMission.value && !!subjectiveUid.value);

async function addSubjective(): Promise<void> {
    if (!activeMission.value || !subjectiveUid.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const poly = missionPolygons.value.find((p) => p.uid === subjectiveUid.value);
        const label = `Subjective: ${poly?.callsign ?? subjectiveUid.value}`;
        await writeAreaLog(sub, 'subjective', label, subjectiveUid.value);
        await loadAreas(sub);
        status.value = `Saved subjective search area to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

async function addSegments(): Promise<void> {
    if (!activeMission.value || !segmentUids.value.length) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        let n = 0;
        for (const uid of segmentUids.value) {
            const poly = missionPolygons.value.find((p) => p.uid === uid);
            await writeAreaLog(sub, `segment:${uid}`, `Segment: ${poly?.callsign ?? uid}`, uid);
            n++;
        }
        segmentUids.value = [];
        await loadAreas(sub);
        status.value = `Saved ${n} segment${n === 1 ? '' : 's'} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

// ---- Remove ----------------------------------------------------------------

/** Remove a search area: delete its log entry and (for rings/markers we created) the feature. */
async function removeArea(area: SentArea): Promise<void> {
    if (!activeMission.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const log = sub.log as unknown as LogApi;
        await log.delete(area.logId);
        // Best-effort: drop the feature from the mission map. Subjective/segments
        // reference user-drawn polygons, so leave those in place.
        const ownsFeature = area.key === 'theoretical' || area.key.startsWith('lpb:') || area.key === IPP_KEY;
        if (ownsFeature) {
            try {
                await deletePolygonFromMission({
                    missionGuid: activeMission.value.guid,
                    uid: area.uuid,
                    missiontoken: activeMission.value.token || undefined,
                });
            } catch { /* feature may already be gone; leave the log removal authoritative */ }
        }
        await loadAreas(sub);
        status.value = `Removed ${area.label}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}
</script>
