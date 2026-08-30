<template>
    <div>
        <h3 class='mb-3 d-flex align-items-center gap-2'>
            CASIE — Search Progress
            <template v-if='loaded && inputs.hasConsensus'>
                <select
                    v-model.number='exportThroughOp'
                    class='form-select form-select-sm w-auto ms-auto'
                    title='Export the WinCASIE III file set as of this operational period'
                >
                    <option :value='0'>
                        Initial Consensus
                    </option>
                    <option
                        v-for='n in realOpNumbers'
                        :key='n'
                        :value='n'
                    >
                        Through OP{{ n }}
                    </option>
                </select>
                <button
                    class='btn btn-outline-success btn-sm'
                    :disabled='loading || !inputs.consensus'
                    @click='onExportWc3'
                >
                    WinCASIE Export
                </button>
            </template>
            <button
                class='btn btn-outline-primary btn-sm'
                :class='{ "ms-auto": !(loaded && inputs.hasConsensus) }'
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

            <!-- ── Expand Search Area (WC3) ────────────────────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center w-100'>
                        <span>Expand Search Area</span>
                        <button
                            v-if='!expandOpen'
                            class='btn btn-outline-primary btn-sm ms-auto'
                            @click='startExpansion'
                        >
                            Expand…
                        </button>
                    </p>
                </template>

                <p
                    v-if='!expandOpen'
                    class='text-muted small mb-0'
                >
                    Add new segments funded out of R.O.W. — used when the subject may be
                    outside the current search area.
                </p>

                <template v-else>
                    <div class='d-flex align-items-center gap-2 mb-2'>
                        <label class='form-label mb-0'>Number of new segments</label>
                        <select
                            v-model.number='expandCount'
                            class='form-select form-select-sm w-auto'
                            @change='rebuildExpansionRows'
                        >
                            <option
                                v-for='n in 6'
                                :key='n'
                                :value='n'
                            >
                                {{ n }}
                            </option>
                        </select>
                        <button
                            class='btn btn-link btn-sm p-0'
                            title='Split the allocated share equally among the new segments'
                            @click='equalizeExpansion'
                        >
                            All new segments equally likely
                        </button>
                        <button
                            class='btn btn-link btn-sm p-0 ms-auto'
                            :disabled='loadingExpandPolys'
                            @click='loadExpandCandidates'
                        >
                            {{ loadingExpandPolys ? 'Loading…' : 'Refresh polygons' }}
                        </button>
                    </div>
                    <p class='form-text mt-0'>
                        Draw the new segment polygons on the map now (the map stays live), Refresh,
                        and select them below. Each share you allocate is deducted from
                        R.O.W. automatically (current R.O.W. mass: {{ fmt(history.final.rowPoa) }}%).
                    </p>

                    <div class='row g-2 align-items-center mb-1'>
                        <div class='col-4'>
                            <span class='form-label mb-0'>R.O.W. retains</span>
                        </div>
                        <div class='col-3'>
                            <span
                                class='fw-bold'
                                :class='expandRowRetained < 0 ? "text-danger" : "text-success"'
                            >{{ expandRowRetained }}%</span>
                        </div>
                        <div class='col-5 form-text mt-0'>
                            Auto: 100% minus what you allocate below.
                        </div>
                    </div>
                    <div
                        v-for='(seg, i) in expandRows'
                        :key='i'
                        class='row g-2 align-items-end mb-1'
                    >
                        <div class='col-4'>
                            <TablerInput
                                v-model='seg.callsign'
                                :label='i === 0 ? "New segment" : undefined'
                            />
                        </div>
                        <div class='col-3'>
                            <TablerInput
                                v-model='seg.pct'
                                :label='i === 0 ? "% of R.O.W." : undefined'
                            />
                        </div>
                        <div class='col-5'>
                            <select
                                v-model='seg.polygonUid'
                                class='form-select form-select-sm'
                            >
                                <option value=''>
                                    — no polygon yet —
                                </option>
                                <option
                                    v-for='p in availableExpandPolys(seg.polygonUid)'
                                    :key='p.uid'
                                    :value='p.uid'
                                >
                                    {{ p.callsign }} · {{ p.source }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div
                        v-if='expandRowRetained < 0'
                        class='small mb-2 text-danger'
                    >
                        Allocated more than 100% — reduce the segment shares.
                    </div>
                    <TablerInput
                        v-model='expandNote'
                        label='Note (required — recorded in History)'
                        placeholder='Why the search area is being expanded'
                    />
                    <div class='d-flex gap-2 mt-2'>
                        <button
                            class='btn btn-primary btn-sm'
                            :disabled='savingExpansion || !expansionValid'
                            @click='applyExpansion'
                        >
                            {{ savingExpansion ? 'Working…' : 'Accept' }}
                        </button>
                        <button
                            class='btn btn-outline-secondary btn-sm'
                            :disabled='savingExpansion'
                            @click='expandOpen = false'
                        >
                            Cancel
                        </button>
                    </div>
                </template>
            </TablerBorder>

            <!-- ── History (WC3-style audit trail) ─────────────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        History
                    </p>
                </template>

                <div
                    v-if='!auditTrail.length'
                    class='text-muted small'
                >
                    No history yet — events appear as the consensus is accepted,
                    assignments are debriefed, and segments are split.
                </div>
                <div
                    v-for='(line, i) in auditTrail'
                    :key='i'
                    class='d-flex gap-2 border-bottom py-1 small font-monospace'
                >
                    <span class='text-muted'>{{ String(i + 1).padStart(3, '0') }}</span>
                    <span class='flex-grow-1'>{{ line.text }}</span>
                    <span class='text-muted text-nowrap'>{{ line.when }}</span>
                </div>
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
import Subscription from '../../../../../src/base/subscription.ts';
import { flyToFeature } from '../../lib/flyToFeature.ts';
import { schemaMission } from '../../lib/incidentSubscription.ts';
import { deletePolygonFromMission, pushPolygonToMission } from '../../lib/missionFeatures.ts';
import { loadRollupInputs, saveScenarios, type RollupInputs } from '../../lib/rollupPersistence.ts';
import { expandSearchArea } from '../../lib/segmentSplit.ts';
import { downloadWc3PeriodZip } from '../../lib/wc3Export.ts';
import { computeRollup } from '../../domain/rollup.ts';

const { activeMission, casieExpandRequested } = useIncident();

const inputs = ref<RollupInputs>({
    segments: [],
    segmentLabels: {},
    rowPoa: 0,
    hasConsensus: false,
    records: [],
    registry: [],
    scenarios: [],
    historyEvents: [],
    consensusUpdatedAt: '',
    consensus: null,
    clues: [],
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
    computeOpHistory(inputs.value.segments, inputs.value.rowPoa, inputs.value.records, inputs.value.clues));

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

// ── WC3-style audit trail: consensus + debriefs + splits, chronological ───
function trailWhen(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const h24 = d.getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `(${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} `
        + `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'})`;
}

const auditTrail = computed(() => {
    const events: { at: string; text: string }[] = [];
    if (inputs.value.consensusUpdatedAt) {
        events.push({ at: inputs.value.consensusUpdatedAt, text: 'Initial Consensus accepted' });
    }
    for (const record of inputs.value.records) {
        const label = inputs.value.segmentLabels[record.segmentUid] ?? record.segmentUid;
        const coverage = record.coverage !== undefined && record.coverage < 1
            ? ` over ${Math.round(record.coverage * 100)}%`
            : '';
        const resource = record.resource ? ` (${record.resource})` : '';
        events.push({
            at: record.recordedAt ?? '',
            text: `OP${record.opNumber}: ${label} POD ${record.pod}%${coverage}${resource}`,
        });
    }
    events.push(...inputs.value.historyEvents);
    return events
        .sort((a, b) => (a.at || '').localeCompare(b.at || ''))
        .map((e) => ({ text: e.text, when: trailWhen(e.at) }));
});

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
        inputs.value.clues,
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

// ── WinCASIE III period export ────────────────────────────────────────────
const exportThroughOp = ref(0);

function onExportWc3(): void {
    const consensus = inputs.value.consensus;
    if (!consensus) return;
    error.value = '';
    try {
        const throughOp = exportThroughOp.value;
        const segments = sortedSegments.value.map((seg) => ({
            uid: seg.uid,
            callsign: inputs.value.segmentLabels[seg.uid] ?? seg.uid,
        }));

        // State as of the chosen OP
        const step = history.value.steps.find((s) => s.opNumber === throughOp)
            ?? history.value.steps[0];
        const recordsThrough = inputs.value.records.filter((r) => r.opNumber <= throughOp);
        const rollup = computeRollup(inputs.value.segments, inputs.value.rowPoa, recordsThrough);
        const cpodPctByUid: Record<string, number> = {};
        for (const seg of rollup.segments) cpodPctByUid[seg.uid] = seg.cumulativePod;

        // Trail cutoff: last debrief in scope (or consensus time for OP0);
        // split/expansion events after that instant are excluded.
        const cutoff = recordsThrough.reduce(
            (acc, r) => (r.recordedAt && r.recordedAt > acc ? r.recordedAt : acc),
            inputs.value.consensusUpdatedAt,
        );
        const events = [
            ...recordsThrough.map((r) => ({
                at: r.recordedAt ?? '',
                text: `OP${r.opNumber}: ${inputs.value.segmentLabels[r.segmentUid] ?? r.segmentUid} `
                    + `POD ${r.pod}%${r.coverage !== undefined && r.coverage < 1 ? ` over ${Math.round(r.coverage * 100)}%` : ''}`
                    + `${r.resource ? ` (${r.resource})` : ''}`,
            })),
            ...inputs.value.historyEvents.filter((e) => !cutoff || (e.at && e.at <= cutoff)),
        ].sort((a, b) => (a.at || '').localeCompare(b.at || ''));

        const zipName = downloadWc3PeriodZip(consensus, segments, {
            throughOp,
            rowPoaPct: step.rowPoa,
            poaPctByUid: step.poa,
            cpodPctByUid,
            events,
        });
        console.info(`WinCASIE export downloaded: ${zipName}`);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    }
}

// ── Expand Search Area (WC3): new segments funded out of R.O.W. ──────────
interface ExpandRow {
    callsign: string;
    pct: string;
    polygonUid: string;
}
interface ExpandPoly {
    uid: string;
    callsign: string;
    source: string;
    sourceGuid: string;
    sourceToken?: string;
    onMgmt: boolean;
    geometry: unknown;
}

const expandOpen = ref(false);
const expandCount = ref(3);
const expandRows = ref<ExpandRow[]>([]);
const expandNote = ref('');
const expandPolys = ref<ExpandPoly[]>([]);
const loadingExpandPolys = ref(false);
const savingExpansion = ref(false);

function nextSegmentNumber(): { start: number; width: number } {
    let max = 0;
    let width = 2;
    for (const label of Object.values(inputs.value.segmentLabels)) {
        const match = /^(\d+)$/.exec(label.trim());
        if (!match) continue;
        const n = Number(match[1]);
        if (n > max) { max = n; width = match[1].length; }
    }
    return { start: max + 1, width };
}

function rebuildExpansionRows(): void {
    const { start, width } = nextSegmentNumber();
    expandRows.value = Array.from({ length: expandCount.value }, (_, i) => ({
        callsign: String(start + i).padStart(width, '0'),
        pct: '0',
        polygonUid: '',
    }));
}

function startExpansion(): void {
    expandOpen.value = true;
    expandNote.value = '';
    rebuildExpansionRows();
    void loadExpandCandidates();
}

/** Redistribute the currently allocated total equally among the segments. */
function equalizeExpansion(): void {
    const allocated = expandRows.value.reduce((a, s) => a + (Number(s.pct) || 0), 0);
    if (allocated <= 0) return;
    const share = Math.floor((allocated / expandRows.value.length) * 100) / 100;
    expandRows.value.forEach((seg, i) => {
        seg.pct = i === expandRows.value.length - 1
            ? String(Math.round((allocated - share * (expandRows.value.length - 1)) * 100) / 100)
            : String(share);
    });
}

const expandAllocated = computed(() =>
    Math.round(expandRows.value.reduce((a, s) => a + (Number(s.pct) || 0), 0) * 100) / 100);

/** R.O.W. share auto-deducts as segment proportions are entered. */
const expandRowRetained = computed(() => Math.round((100 - expandAllocated.value) * 100) / 100);

const expansionValid = computed(() =>
    expandRowRetained.value >= 0
    && expandAllocated.value > 0
    && expandNote.value.trim().length > 0
    && expandRows.value.every((s) => s.callsign.trim()));

function availableExpandPolys(current: string): ExpandPoly[] {
    const taken = new Set(expandRows.value.map((s) => s.polygonUid).filter((u) => u && u !== current));
    return expandPolys.value.filter((p) => !taken.has(p.uid));
}

/** Unregistered polygons from the common map, MGMT, and open OP syncs. */
async function loadExpandCandidates(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    loadingExpandPolys.value = true;
    try {
        const registered = new Set(inputs.value.segments.map((s) => s.uid));
        const sources = [
            { label: 'common map', guid: mission.guid, token: mission.missionToken, onMgmt: false },
            { label: 'MGMT', guid: mission.mgmt.guid, token: mission.mgmt.missionToken, onMgmt: true },
            ...inputs.value.registry
                .filter((op) => op.status !== 'closed')
                .map((op) => ({ label: op.name, guid: op.guid, token: op.ownerToken, onMgmt: false })),
        ];
        const found: ExpandPoly[] = [];
        const seen = new Set<string>();
        for (const source of sources) {
            try {
                const sub = await Subscription.load(source.guid, {
                    missiontoken: source.token || undefined,
                    reload: false,
                });
                const feats = await sub.feature.list({ refresh: true }) as unknown as {
                    id?: string | number;
                    properties?: { callsign?: string };
                    geometry?: { type?: string };
                }[];
                for (const f of feats) {
                    const uid = String(f.id ?? '');
                    const type = f.geometry?.type;
                    if (!uid || seen.has(uid) || registered.has(uid)) continue;
                    if (type !== 'Polygon' && type !== 'MultiPolygon') continue;
                    seen.add(uid);
                    found.push({
                        uid,
                        callsign: f.properties?.callsign || uid,
                        source: source.label,
                        sourceGuid: source.guid,
                        sourceToken: source.token,
                        onMgmt: source.onMgmt,
                        geometry: f.geometry,
                    });
                }
            } catch { /* unreachable source — skip */ }
        }
        expandPolys.value = found;
    } finally {
        loadingExpandPolys.value = false;
    }
}

function expandRing(geometry: unknown): [number, number][] | null {
    const geom = geometry as { type?: string; coordinates?: unknown };
    const coords = geom?.type === 'Polygon' ? geom.coordinates
        : geom?.type === 'MultiPolygon' && Array.isArray(geom.coordinates)
            ? (geom.coordinates as unknown[])[0]
            : null;
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
    const ring: [number, number][] = [];
    for (const point of coords[0] as unknown[]) {
        if (!Array.isArray(point) || point.length < 2) return null;
        ring.push([Number(point[0]), Number(point[1])]);
    }
    return ring.length >= 4 ? ring : null;
}

async function applyExpansion(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !expansionValid.value) return;
    savingExpansion.value = true;
    error.value = '';
    try {
        const planning = schemaMission(mission);
        const additions: { uid: string; callsign: string; pct: number }[] = [];
        for (const row of expandRows.value) {
            const callsign = row.callsign.trim();
            let uid: string = globalThis.crypto.randomUUID();
            const poly = expandPolys.value.find((p) => p.uid === row.polygonUid);
            if (poly) {
                if (poly.onMgmt) {
                    uid = poly.uid;
                } else {
                    const ring = expandRing(poly.geometry);
                    if (ring) {
                        let lon = 0; let lat = 0;
                        for (const [x, y] of ring) { lon += x; lat += y; }
                        uid = await pushPolygonToMission({
                            missionGuid: planning.guid,
                            missionToken: planning.missionToken,
                            callsign,
                            ring,
                            center: [lon / ring.length, lat / ring.length],
                        });
                        try {
                            await deletePolygonFromMission({
                                missionGuid: poly.sourceGuid,
                                uid: poly.uid,
                                missiontoken: poly.sourceToken || undefined,
                            });
                        } catch { /* cosmetic */ }
                    }
                }
            }
            additions.push({ uid, callsign, pct: Number(row.pct) || 0 });
        }

        await expandSearchArea(mission, {
            rowRetainedPct: expandRowRetained.value,
            additions: additions.filter((a) => a.pct > 0),
            note: expandNote.value,
        });
        expandOpen.value = false;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingExpansion.value = false;
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
        // Segmentation's "Expand Search Area…" button lands here with intent.
        if (casieExpandRequested.value) {
            casieExpandRequested.value = false;
            if (inputs.value.hasConsensus && !expandOpen.value) startExpansion();
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

onMounted(refresh);
watch(() => activeMission.value?.guid, refresh);
// Handles the already-mounted case (CASIE tab was previously open).
watch(casieExpandRequested, (requested) => {
    if (requested && loaded.value && inputs.value.hasConsensus) {
        casieExpandRequested.value = false;
        if (!expandOpen.value) startExpansion();
    }
});
</script>
