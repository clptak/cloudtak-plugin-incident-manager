<template>
    <div class='wisar-tarr-form'>
        <p class='text-uppercase text-white-50 small mb-1 mt-3'>
            Subject Profile
        </p>
        <div
            class='btn-group btn-group-sm w-100 mb-2'
            role='group'
            aria-label='Profile source'
        >
            <button
                type='button'
                class='btn'
                :class='source === "arizona" ? "btn-primary" : "btn-outline-secondary"'
                @click='setSource("arizona")'
            >
                Arizona (IM table)
            </button>
            <button
                type='button'
                class='btn'
                :class='source === "koester" ? "btn-primary" : "btn-outline-secondary"'
                @click='setSource("koester")'
            >
                Koester (WiSAR)
            </button>
        </div>

        <select
            v-model='category'
            class='form-select form-select-sm'
            aria-label='Subject profile'
            :disabled='source === "koester" && !dataset'
        >
            <option value=''>
                {{ source === "koester" && profilesLoading ? 'Loading WiSAR profiles…' : 'Select a subject profile' }}
            </option>
            <option
                v-for='name in categoryNames'
                :key='name'
                :value='name'
            >
                {{ name }}
            </option>
        </select>
        <div
            v-if='source === "koester" && profilesError'
            class='form-text text-danger'
        >
            {{ profilesError }}
        </div>

        <template v-if='source === "koester" && koesterCategory'>
            <template v-if='ecos.length'>
                <p class='small mb-1 mt-2'>
                    Eco Region
                </p>
                <div class='d-flex flex-wrap gap-1'>
                    <button
                        v-for='e in ecos'
                        :key='e'
                        type='button'
                        class='btn btn-sm'
                        :class='ecoValue(e) === eco && ecoChosen ? "btn-primary" : "btn-outline-secondary"'
                        @click='chooseEco(e)'
                    >
                        {{ e }}
                    </button>
                </div>
            </template>
            <template v-if='ecoChosen && terrains.length'>
                <p class='small mb-1 mt-2'>
                    Terrain
                </p>
                <div class='d-flex flex-wrap gap-1'>
                    <button
                        v-for='t in terrains'
                        :key='t'
                        type='button'
                        class='btn btn-sm'
                        :class='ecoValue(t) === terrain && terrainChosen ? "btn-primary" : "btn-outline-secondary"'
                        @click='chooseTerrain(t)'
                    >
                        {{ t }}
                    </button>
                </div>
            </template>
            <div class='form-text'>
                Source: {{ dataset?.source || 'Koester (2008), Lost Person Behavior.' }}
            </div>
            <div
                v-if='calibration && !edited'
                class='form-text text-info fw-semibold'
            >
                Coconino calibration: {{ formatMultipliers(calibration.mult) }} (p25/p50/p75) —
                {{ calibration.profileSpecific ? 'profile-specific' : 'global default' }}
            </div>
            <div
                v-if='calibration && !edited'
                class='form-text'
            >
                Rings are drawn at the calibrated distances, and their DataSync labels show those miles.
            </div>
        </template>
        <template v-if='source === "arizona" && arizonaRow'>
            <div class='form-text'>
                Source: Incident Manager LPB table (Arizona), {{ arizonaRow.cases }} case(s).
            </div>
            <div
                v-if='arizonaBlocked'
                class='form-text text-warning'
            >
                {{ arizonaBlocked }}
            </div>
        </template>

        <div class='d-flex align-items-center mt-3 mb-1'>
            <p class='text-uppercase text-white-50 small mb-0'>
                Subject Distance Percentiles ({{ unit }})
            </p>
            <button
                type='button'
                class='btn btn-sm btn-link ms-auto p-0'
                :disabled='!baseValues && !edited'
                @click='toggleEdit'
            >
                {{ edited ? 'Use profile values' : 'Edit / custom' }}
            </button>
        </div>
        <div class='row g-2'>
            <div
                v-for='k in percentileKeys'
                :key='k'
                :class='source === "arizona" ? "col-3" : "col-4"'
            >
                <label class='form-label small mb-0'>{{ k.slice(1) }}th %</label>
                <input
                    type='number'
                    step='0.01'
                    min='0'
                    class='form-control form-control-sm'
                    :readonly='!edited'
                    :value='shown?.[k] ?? ""'
                    placeholder='—'
                    @input='onEdit(k, ($event.target as HTMLInputElement).value)'
                >
            </div>
        </div>
        <label
            v-if='source === "arizona" || edited'
            class='form-check mt-2 mb-0'
        >
            <input
                v-model='globalCalibration'
                type='checkbox'
                class='form-check-input'
            >
            <span class='form-check-label'>
                Apply Coconino global calibration ({{ globalLabel }})
            </span>
        </label>
        <div
            v-if='(source === "arizona" || edited) && globalCalibration'
            class='form-text text-warning'
        >
            Calibration moves the rings out (×{{ globalLabel }}), so their DataSync labels show the
            calibrated miles, not the values above.
        </div>

        <div class='d-flex gap-2 mt-3'>
            <button
                type='button'
                class='btn btn-primary flex-grow-1'
                :disabled='!!problem || busy'
                @click='runAnalysis'
            >
                {{ busy ? 'Running…' : 'Run TARR Analysis' }}
            </button>
            <button
                v-if='busy'
                type='button'
                class='btn btn-outline-secondary'
                @click='cancel'
            >
                Cancel
            </button>
        </div>
        <div
            v-if='problem && !busy'
            class='form-text text-center'
        >
            {{ problem }}
        </div>
        <WisarJobStatus
            :phase='phase'
            :job='job'
            :error='error'
            :started-at='startedAt'
            :now='now'
        >
            <template #done>
                <span v-if='resolvedLine'>{{ ' ' + resolvedLine }}</span>
            </template>
        </WisarJobStatus>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { usePluginSettings } from '../../composables/usePluginSettings.ts';
import { useWisar } from '../../composables/useWisar.ts';
import { useWisarJob } from '../../composables/useWisarJob.ts';
import type { Job, ProfileDataset, ResolvedTarr } from '../../lib/wisar.ts';
import type { WisarIppOption } from '../../lib/wisarIpp.ts';
import {
    OTHER_DEFAULT,
    arizonaPercentiles,
    arizonaRowProblem,
    categoryCalibration,
    ecoOptions,
    findCategory,
    formatMultipliers,
    resolveVariant,
    sourceUnit,
    tarrProblem,
    tarrRequest,
    terrainOptions,
    type ArizonaRow,
    type Percentiles,
    type TarrSource,
} from '../../lib/wisarTarr.ts';
import WisarJobStatus from './WisarJobStatus.vue';

const props = defineProps<{
    ipp: WisarIppOption | null;
}>();

const emit = defineEmits<{
    result: [job: Job];
}>();

type PercentileKey = 'p25' | 'p50' | 'p75' | 'p90';

const { lpbTable } = usePluginSettings();
const { client } = useWisar();
const { job, phase, error, startedAt, now, run, cancel } = useWisarJob();

const source = ref<TarrSource>('arizona');
const category = ref('');
const eco = ref<string | null>(null);
const terrain = ref<string | null>(null);
const ecoChosen = ref(false);
const terrainChosen = ref(false);
const edited = ref<Percentiles | null>(null);
const globalCalibration = ref(false);

const profiles = ref<ProfileDataset[]>([]);
const defaultDataset = ref('');
const profilesLoading = ref(false);
const profilesError = ref('');

const dataset = computed(() => profiles.value.find((d) => d.id === defaultDataset.value) ?? profiles.value[0] ?? null);
const arizonaRows = computed(() => lpbTable.value as unknown as ArizonaRow[]);
const categoryNames = computed(() => (source.value === 'arizona'
    ? arizonaRows.value.map((r) => r.category)
    : dataset.value?.categories.map((c) => c.name) ?? []));
const arizonaRow = computed(() => (source.value === 'arizona' ? arizonaRows.value.find((r) => r.category === category.value) : undefined));
const arizonaBlocked = computed(() => (arizonaRow.value ? arizonaRowProblem(arizonaRow.value) : null));
const koesterCategory = computed(() => (source.value === 'koester' ? findCategory(dataset.value, category.value) : undefined));
const ecos = computed(() => ecoOptions(koesterCategory.value));
const terrains = computed(() => terrainOptions(koesterCategory.value, eco.value));
const calibration = computed(() => categoryCalibration(dataset.value, koesterCategory.value));
const unit = computed(() => sourceUnit(source.value));
const percentileKeys = computed((): PercentileKey[] => (
    source.value === 'arizona' ? ['p25', 'p50', 'p75', 'p90'] : ['p25', 'p50', 'p75']
));
const globalLabel = computed(() => {
    const m = dataset.value?.default_calibration;
    return m ? `${m.m25.toFixed(2)} / ${m.m50.toFixed(2)} / ${m.m75.toFixed(2)}` : '1.05 / 1.35 / 1.80';
});

/** Values from the chosen profile (before any edit). */
const baseValues = computed<Percentiles | null>(() => {
    if (source.value === 'arizona') return arizonaRow.value ? arizonaPercentiles(arizonaRow.value) : null;
    if (!koesterCategory.value) return null;
    if (ecos.value.length && !ecoChosen.value) return null;
    if (ecoChosen.value && terrains.value.length && !terrainChosen.value) return null;
    const v = resolveVariant(koesterCategory.value, eco.value, terrain.value);
    return v ? { p25: v.distances_km.p25, p50: v.distances_km.p50, p75: v.distances_km.p75 } : null;
});
const shown = computed(() => edited.value ?? baseValues.value);

const formState = computed(() => ({
    source: source.value,
    category: category.value,
    eco: eco.value,
    terrain: terrain.value,
    dataset: dataset.value?.id ?? 'koester',
    edited: edited.value,
    globalCalibration: globalCalibration.value,
}));
const busy = computed(() => ['submitting', 'queued', 'running'].includes(phase.value));
const problem = computed(() => {
    if (source.value === 'koester' && koesterCategory.value && !shown.value) {
        return ecos.value.length && !ecoChosen.value ? 'Choose an Eco Region.' : 'Choose a Terrain.';
    }
    return tarrProblem(props.ipp, formState.value, shown.value, arizonaRow.value);
});

const resolvedLine = computed(() => {
    const r = job.value?.resolved as ResolvedTarr | undefined;
    if (!r?.multipliers || !r.final_distances_km) return '';
    const f = r.final_distances_km;
    const km = (v: number) => v.toFixed(2);
    return `Multipliers ${formatMultipliers(r.multipliers)} (${r.calibration_applied}); rings at ${km(f.p25)} / ${km(f.p50)} / ${km(f.p75)} km.`;
});

function ecoValue(label: string): string | null {
    return label === OTHER_DEFAULT ? null : label;
}

function resetProfile(): void {
    eco.value = null;
    terrain.value = null;
    ecoChosen.value = false;
    terrainChosen.value = false;
    edited.value = null;
}

function setSource(next: TarrSource): void {
    if (next === source.value) return;
    source.value = next;
    category.value = '';
    resetProfile();
    if (next === 'koester') void loadProfiles();
}

function chooseEco(label: string): void {
    eco.value = ecoValue(label);
    ecoChosen.value = true;
    terrain.value = null;
    terrainChosen.value = false;
    edited.value = null;
}

function chooseTerrain(label: string): void {
    terrain.value = ecoValue(label);
    terrainChosen.value = true;
    edited.value = null;
}

function toggleEdit(): void {
    edited.value = edited.value ? null : { ...(baseValues.value ?? { p25: 0, p50: 0, p75: 0 }) };
}

function onEdit(key: PercentileKey, text: string): void {
    if (!edited.value) return;
    edited.value = { ...edited.value, [key]: Number(text) };
}

async function loadProfiles(): Promise<void> {
    if (profiles.value.length || profilesLoading.value) return;
    profilesLoading.value = true;
    profilesError.value = '';
    try {
        const list = await client.value.profiles();
        profiles.value = list.datasets;
        defaultDataset.value = list.default_dataset;
    } catch (err) {
        profilesError.value = err instanceof Error ? err.message : String(err);
    } finally {
        profilesLoading.value = false;
    }
}

async function runAnalysis(): Promise<void> {
    const ipp = props.ipp;
    const values = shown.value;
    if (problem.value || !ipp || !values) return;
    const body = tarrRequest(ipp, formState.value, values);
    const final = await run((c, signal) => c.submitTarr(body, signal));
    if (final?.status === 'succeeded') emit('result', final);
}

watch(category, () => resetProfile());

onMounted(() => {
    // The global calibration label needs the dataset default; load quietly.
    void loadProfiles();
});
</script>
