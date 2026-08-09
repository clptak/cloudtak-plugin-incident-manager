<template>
    <div>
        <h3 class='mb-3 d-flex align-items-center gap-2'>
            CASIE — Search Progress
            <button
                class='btn btn-outline-primary btn-sm ms-auto'
                :disabled='loading'
                @click='refresh'
            >
                {{ loading ? 'Loading…' : 'Refresh' }}
            </button>
        </h3>

        <TablerInlineAlert
            v-if='!activeMission'
            severity='warning'
            title='Mission Required'
            description='Select or create an incident in Create | Open first.'
        />
        <TablerInlineAlert
            v-else-if='!activeMission.mgmt'
            severity='warning'
            title='Management Sync Required'
            description='CASIE rollup needs a dual-sync incident (management DataSync).'
        />
        <TablerInlineAlert
            v-else-if='loaded && !inputs.hasConsensus'
            severity='warning'
            title='Initial Consensus Required'
            description='Complete the Initial Consensus (Search Transition) — it is OP-0 of the CASIE computation.'
        />
        <TablerInlineAlert
            v-else-if='error'
            severity='danger'
            title='Error'
            :description='error'
        />

        <template v-if='loaded && inputs.hasConsensus'>
            <!-- ── Per-OP history (WinCASIE tabular view) ─────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        POA History by Operational Period
                    </p>
                </template>

                <div class='table-responsive'>
                    <table class='table table-sm small mb-0 align-middle'>
                        <thead>
                            <tr>
                                <th
                                    role='button'
                                    class='user-select-none'
                                    title='Sort by segment'
                                    @click='setSort("segment")'
                                >
                                    Segment{{ sortIndicator('segment') }}
                                </th>
                                <th
                                    v-for='step in history.steps'
                                    :key='step.opNumber'
                                    role='button'
                                    class='text-end user-select-none'
                                    :title='`Sort by POA after ${step.opNumber === 0 ? "Initial" : `OP${step.opNumber}`}`'
                                    @click='setSort(step.opNumber)'
                                >
                                    {{ step.opNumber === 0 ? 'Initial' : `OP${step.opNumber}` }}{{ sortIndicator(step.opNumber) }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='seg in sortedSegments'
                                :key='seg.uid'
                            >
                                <td>
                                    <button
                                        class='btn btn-link btn-sm p-0 align-baseline'
                                        title='Center map on this segment'
                                        @click='onFlyTo(seg.uid)'
                                    >
                                        {{ inputs.segmentLabels[seg.uid] }}
                                    </button>
                                </td>
                                <td
                                    v-for='step in history.steps'
                                    :key='step.opNumber'
                                    class='text-end'
                                >
                                    {{ fmt(step.poa[seg.uid]) }}
                                    <span
                                        v-if='step.podEff[seg.uid] !== undefined'
                                        class='text-warning'
                                    ><br>POD {{ fmt(step.podEff[seg.uid]) }}</span>
                                </td>
                            </tr>
                            <tr class='text-muted'>
                                <td>R.O.W.</td>
                                <td
                                    v-for='step in history.steps'
                                    :key='step.opNumber'
                                    class='text-end'
                                >
                                    {{ fmt(step.rowPoa) }}
                                </td>
                            </tr>
                            <tr class='border-top'>
                                <td><strong>OPOS</strong></td>
                                <td
                                    v-for='step in history.steps'
                                    :key='step.opNumber'
                                    class='text-end'
                                >
                                    {{ step.opNumber === 0 ? '—' : fmt(step.opos) }}
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Cumulative POS</strong></td>
                                <td
                                    v-for='step in history.steps'
                                    :key='step.opNumber'
                                    class='text-end'
                                >
                                    <strong>{{ fmt(step.cumulativePos) }}</strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p class='form-text mb-0'>
                    POA shown after each OP (renormalized incl. R.O.W.); POD is that OP's
                    effective detection for the segment. Recomputed from the Initial
                    Consensus + debrief records — nothing here is hand-entered.
                </p>
            </TablerBorder>

            <!-- ── What-if scenarios ───────────────────────────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        What If?
                    </p>
                </template>

                <div class='row g-2'>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='draft.name'
                            label='Scenario Name'
                            placeholder='e.g. Search 12 and 14 with K9'
                        />
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label'>Fork After</label>
                        <select
                            v-model.number='draft.throughOp'
                            class='form-select form-select-sm'
                        >
                            <option :value='0'>
                                Initial Consensus (OP-0)
                            </option>
                            <option
                                v-for='n in realOpNumbers'
                                :key='n'
                                :value='n'
                            >
                                OP{{ n }}
                            </option>
                        </select>
                    </div>
                </div>

                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    Hypothetical Searches
                </p>
                <div
                    v-for='(h, i) in draft.hypotheticals'
                    :key='i'
                    class='d-flex align-items-center gap-2 mb-1'
                >
                    <select
                        v-model='h.segmentUid'
                        class='form-select form-select-sm w-auto'
                    >
                        <option value=''>— segment —</option>
                        <option
                            v-for='seg in inputs.segments'
                            :key='seg.uid'
                            :value='seg.uid'
                        >
                            {{ inputs.segmentLabels[seg.uid] }}
                        </option>
                    </select>
                    <input
                        v-model.number='h.pod'
                        type='number'
                        class='form-control form-control-sm'
                        style='width: 90px;'
                        placeholder='POD %'
                        min='0'
                        max='100'
                    >
                    <span class='text-muted small'>in OP</span>
                    <input
                        v-model.number='h.opNumber'
                        type='number'
                        class='form-control form-control-sm'
                        style='width: 70px;'
                        :min='draft.throughOp + 1'
                    >
                    <button
                        class='btn btn-outline-danger btn-sm'
                        @click='draft.hypotheticals.splice(i, 1)'
                    >
                        ×
                    </button>
                </div>
                <div class='d-flex flex-wrap gap-2 mt-2'>
                    <button
                        class='btn btn-outline-primary btn-sm'
                        @click='addHypothetical'
                    >
                        + Add search
                    </button>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='!canCompute'
                        @click='computeDraft'
                    >
                        Compute
                    </button>
                    <button
                        class='btn btn-outline-success btn-sm'
                        :disabled='!canCompute || !draft.name.trim() || savingScenario'
                        @click='saveDraft'
                    >
                        {{ savingScenario ? 'Saving…' : 'Save scenario' }}
                    </button>
                </div>

                <div
                    v-if='scenarioHistory'
                    class='mt-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Scenario Result
                        <span class='text-muted text-lowercase fw-normal'>
                            (forked after {{ draft.throughOp === 0 ? 'Initial Consensus' : `OP${draft.throughOp}` }})
                        </span>
                    </p>
                    <div class='small'>
                        Cumulative POS:
                        <strong>{{ fmt(scenarioHistory.final.cumulativePos) }}</strong>
                        <span class='text-muted'>(real: {{ fmt(history.final.cumulativePos) }})</span>
                    </div>
                    <div class='table-responsive mt-1'>
                        <table class='table table-sm small mb-0'>
                            <thead>
                                <tr><th>Segment</th><th class='text-end'>POA now (real)</th><th class='text-end'>POA (scenario)</th></tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for='seg in sortedSegments'
                                    :key='seg.uid'
                                >
                                    <td>{{ inputs.segmentLabels[seg.uid] }}</td>
                                    <td class='text-end'>{{ fmt(history.final.poa[seg.uid]) }}</td>
                                    <td class='text-end'>{{ fmt(scenarioHistory.final.poa[seg.uid]) }}</td>
                                </tr>
                                <tr class='text-muted'>
                                    <td>R.O.W.</td>
                                    <td class='text-end'>{{ fmt(history.final.rowPoa) }}</td>
                                    <td class='text-end'>{{ fmt(scenarioHistory.final.rowPoa) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div
                    v-if='inputs.scenarios.length'
                    class='mt-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Saved Scenarios
                    </p>
                    <div
                        v-for='s in inputs.scenarios'
                        :key='s.name'
                        class='d-flex align-items-center gap-2 border-bottom py-1 small'
                    >
                        <span>{{ s.name }}</span>
                        <span class='text-muted'>fork after {{ s.throughOp === 0 ? 'consensus' : `OP${s.throughOp}` }} · {{ s.hypotheticals.length }} search{{ s.hypotheticals.length === 1 ? '' : 'es' }}</span>
                        <button
                            class='btn btn-link btn-sm p-0 ms-auto'
                            @click='loadScenario(s)'
                        >
                            Load
                        </button>
                        <button
                            class='btn btn-link btn-sm text-danger p-0'
                            :disabled='savingScenario'
                            @click='deleteScenario(s.name)'
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </TablerBorder>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import type { DebriefRecord } from '../../domain/entities.ts';
import {
    computeOpHistory,
    computeScenario,
    opNumbersIn,
    type OpHistory,
    type Scenario,
} from '../../domain/history.ts';
import { flyToFeature } from '../../lib/flyToFeature.ts';
import { loadRollupInputs, saveScenarios, type RollupInputs } from '../../lib/rollupPersistence.ts';

const { activeMission } = useIncident();

const inputs = ref<RollupInputs>({
    segments: [],
    segmentLabels: {},
    rowPoa: 0,
    hasConsensus: false,
    records: [],
    registry: [],
    scenarios: [],
});
const loaded = ref(false);
const loading = ref(false);
const savingScenario = ref(false);
const error = ref('');
const scenarioHistory = ref<OpHistory | null>(null);

const draft = reactive<Scenario>({
    name: '',
    throughOp: 0,
    hypotheticals: [],
});

const history = computed(() =>
    computeOpHistory(inputs.value.segments, inputs.value.rowPoa, inputs.value.records));

// ── Table sorting: by segment label or by POA of any OP column ────────────
type SortKey = 'segment' | number;
const sortKey = ref<SortKey>('segment');
const sortDir = ref<'asc' | 'desc'>('asc');

function setSort(key: SortKey): void {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        // Alphabetical defaults ascending; POA columns default descending
        // (highest-probability segments first — the planning question).
        sortDir.value = key === 'segment' ? 'asc' : 'desc';
    }
}

function sortIndicator(key: SortKey): string {
    if (sortKey.value !== key) return '';
    return sortDir.value === 'asc' ? ' ▲' : ' ▼';
}

const sortedSegments = computed(() => {
    const dir = sortDir.value === 'asc' ? 1 : -1;
    const key = sortKey.value;
    const labels = inputs.value.segmentLabels;
    const list = [...inputs.value.segments];
    if (key === 'segment') {
        return list.sort((a, b) => dir * (labels[a.uid] ?? a.uid).localeCompare(
            labels[b.uid] ?? b.uid, undefined, { numeric: true }));
    }
    const step = history.value.steps.find((s) => s.opNumber === key);
    return list.sort((a, b) => dir * ((step?.poa[a.uid] ?? 0) - (step?.poa[b.uid] ?? 0)));
});

async function onFlyTo(uid: string): Promise<void> {
    const found = await flyToFeature(uid);
    if (!found) {
        error.value = 'Segment is not on the map yet — check the MGMT overlay is loaded.';
    }
}

const realOpNumbers = computed(() => opNumbersIn(inputs.value.records));

const canCompute = computed(() => draft.hypotheticals.some(
    (h) => h.segmentUid && Number.isFinite(h.pod) && h.pod > 0,
));

function fmt(value: number | undefined): string {
    return value === undefined ? '—' : value.toFixed(1);
}

function addHypothetical(): void {
    const next: DebriefRecord = {
        opNumber: Math.max(draft.throughOp + 1, (realOpNumbers.value.at(-1) ?? 0) + 1),
        segmentUid: '',
        pod: 0,
    };
    draft.hypotheticals.push(next);
}

function validHypotheticals(): DebriefRecord[] {
    return draft.hypotheticals
        .filter((h) => h.segmentUid && Number.isFinite(h.pod) && h.pod > 0)
        .map((h) => ({ ...h, pod: Math.min(100, Math.max(0, h.pod)) }));
}

function computeDraft(): void {
    scenarioHistory.value = computeScenario(
        inputs.value.segments,
        inputs.value.rowPoa,
        inputs.value.records,
        { ...draft, hypotheticals: validHypotheticals() },
    );
}

async function saveDraft(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !draft.name.trim()) return;
    savingScenario.value = true;
    error.value = '';
    try {
        const scenario: Scenario = {
            name: draft.name.trim(),
            throughOp: draft.throughOp,
            hypotheticals: validHypotheticals(),
            createdAt: new Date().toISOString(),
        };
        const rest = inputs.value.scenarios.filter((s) => s.name !== scenario.name);
        await saveScenarios(mission, [...rest, scenario]);
        inputs.value = { ...inputs.value, scenarios: [...rest, scenario] };
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingScenario.value = false;
    }
}

function loadScenario(s: Scenario): void {
    draft.name = s.name;
    draft.throughOp = s.throughOp;
    draft.hypotheticals = s.hypotheticals.map((h) => ({ ...h }));
    computeDraft();
}

async function deleteScenario(name: string): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    savingScenario.value = true;
    try {
        const rest = inputs.value.scenarios.filter((s) => s.name !== name);
        await saveScenarios(mission, rest);
        inputs.value = { ...inputs.value, scenarios: rest };
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingScenario.value = false;
    }
}

async function refresh(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) {
        loaded.value = true;
        return;
    }
    loading.value = true;
    error.value = '';
    try {
        inputs.value = await loadRollupInputs(mission);
        loaded.value = true;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

onMounted(refresh);
watch(() => activeMission.value?.guid, refresh);
</script>
