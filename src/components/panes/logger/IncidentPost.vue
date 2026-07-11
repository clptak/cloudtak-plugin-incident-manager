<template>
    <div>
        <p class='text-muted small mb-3'>
            ICS 234-CG Work Analysis Matrix — each objective has numbered strategies and tactics.
            Saved to DataSync as log entries. Generate the official ICS 234-CG PDF below.
        </p>

        <div
            v-if='loading'
            class='text-muted small mb-2'
        >
            Loading existing entries…
        </div>

        <div
            v-for='i in visibleCount'
            :key='i'
            class='card mb-2'
        >
            <div class='card-header py-1 d-flex align-items-center'>
                <strong>Objective {{ i }}</strong>
                <span
                    v-if='rowIsLegacy(i - 1)'
                    class='badge bg-secondary ms-2'
                    title='Originally saved under the old risk-assessment keyword'
                >legacy</span>
            </div>
            <div class='card-body py-2'>
                <div class='mb-2'>
                    <label class='form-label small mb-1'>
                        4 · Objective <span class='text-muted'>(Desired Outcome)</span>
                    </label>
                    <textarea
                        v-model='rows[i - 1].objective'
                        class='form-control form-control-sm'
                        rows='3'
                        placeholder='Desired Outcome'
                    />
                </div>
                <ObjectiveStrategies
                    v-model='rows[i - 1].strategies'
                    @delete-id='queueDelete'
                />
            </div>
        </div>

        <button
            v-if='visibleCount < MAX_OBJECTIVES'
            type='button'
            class='btn btn-outline-primary btn-sm'
            @click='addRow'
        >
            + Add Objective {{ visibleCount + 1 }}
        </button>
        <div
            v-else
            class='form-text text-muted'
        >
            Maximum of {{ MAX_OBJECTIVES }} objectives (one ICS 234-CG page).
        </div>

        <div class='mt-3 d-flex flex-wrap align-items-center gap-2'>
            <button
                class='btn btn-primary btn-sm'
                :disabled='saving || (!filledRowCount && !pendingDeletions)'
                @click='onSave'
            >
                {{ saving ? 'Saving…' : `Save ${filledRowCount} objective${filledRowCount === 1 ? '' : 's'} to DataSync` }}
            </button>
            <button
                class='btn btn-outline-secondary btn-sm'
                @click='reset'
            >
                Clear
            </button>
        </div>

        <div
            v-if='!activeMission'
            class='form-text text-warning mt-2'
        >
            No active mission. Select one in Create | Open first.
        </div>
        <div
            v-else
            class='form-text mt-2'
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

        <div class='card mt-3 mb-3'>
            <div
                class='card-header py-2 d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='pdfExpanded'
                @click='pdfExpanded = !pdfExpanded'
                @keydown.enter.prevent='pdfExpanded = !pdfExpanded'
                @keydown.space.prevent='pdfExpanded = !pdfExpanded'
            >
                <h4 class='card-title mb-0 fs-6'>
                    GENERATE ICS-234-CG Form
                </h4>
                <IconChevronDown
                    class='ms-auto transition-transform'
                    :class='{ "rotate-180": pdfExpanded }'
                    :size='18'
                    stroke='1.5'
                />
            </div>
            <div
                v-show='pdfExpanded'
                class='card-body py-2'
            >
                <div class='row g-2'>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>1 · Incident Name</label>
                        <input
                            v-model='pdfHeader.incidentName'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>2 · Incident Location</label>
                        <input
                            v-model='pdfHeader.incidentLocation'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='From DataSync IPP'
                        >
                        <div class='form-text text-muted'>
                            Prefilled from the mission IPP on DataSync when available.
                        </div>
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>3 · Operational Period — From</label>
                        <input
                            v-model='pdfHeader.operationalPeriodFrom'
                            type='datetime-local'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>3 · Operational Period — To</label>
                        <input
                            v-model='pdfHeader.operationalPeriodTo'
                            type='datetime-local'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>7 · Prepared by — Name</label>
                        <input
                            v-model='pdfHeader.preparedByName'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Position / Title</label>
                        <input
                            v-model='pdfHeader.preparedByTitle'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Signature</label>
                        <input
                            v-model='pdfHeader.preparedBySignature'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Date / Time</label>
                        <input
                            v-model='pdfHeader.preparedByDateTime'
                            type='datetime-local'
                            class='form-control form-control-sm'
                        >
                    </div>
                </div>

                <div class='mt-3 d-flex flex-wrap gap-2'>
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm'
                        :disabled='exporting || !filledRowCount'
                        @click='downloadPdf'
                    >
                        {{ exporting ? 'Generating PDF…' : 'Download ICS 234 PDF' }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm'
                        :disabled='uploading || !filledRowCount'
                        @click='onAddPdfToDataSync'
                    >
                        {{ uploading ? 'Uploading…' : 'Add ICS-234.PDF to DataSync' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Running list: ICS 234-CG matrix reconstructed from DataSync -->
        <div class='card mt-4'>
            <div class='card-header py-2 d-flex align-items-center'>
                <h3 class='card-title mb-0'>
                    Work Analysis Matrix — on DataSync ({{ savedRows.length }})
                </h3>
            </div>
            <div class='card-body py-2'>
                <div
                    v-if='loading'
                    class='text-muted small'
                >
                    Loading…
                </div>
                <div
                    v-else-if='!savedRows.length'
                    class='text-muted small'
                >
                    No entries on DataSync yet. Fill an objective above and save.
                </div>
                <div
                    v-else
                    class='table-responsive'
                >
                    <table class='table table-sm table-vcenter table-bordered mb-0'>
                        <thead>
                            <tr>
                                <th style='width:3rem;'>
                                    #
                                </th>
                                <th>4 · Objective (Desired Outcome)</th>
                                <th>5 · Strategies (How)</th>
                                <th>6 · Tactics / Work Assignments (Who / What / Where / When)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='r in savedRows'
                                :key='r.row'
                            >
                                <td>
                                    {{ r.row }}
                                    <span
                                        v-if='r.legacy'
                                        class='badge bg-secondary'
                                        title='Originally saved under the old risk-assessment keyword'
                                    >L</span>
                                </td>
                                <td style='white-space:pre-wrap;'>
                                    {{ r.objective }}
                                </td>
                                <td style='white-space:pre-wrap;'>
                                    {{ formatStrategiesForDisplay(r.strategies) }}
                                </td>
                                <td style='white-space:pre-wrap;'>
                                    {{ formatTacticsForDisplay(r.strategies) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import ObjectiveStrategies from './ObjectiveStrategies.vue';
import {
    buildIcs234Pdf,
    defaultIcs234Filename,
    ICS234_MISSION_FILENAME,
} from '../../../lib/ics234Pdf.ts';
import { defaultIcs234DatetimeFields } from '../../../lib/ics234Datetime.ts';
import { resolveMissionIppLocation } from '../../../lib/missionIpp.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';
import {
    MAX_OBJECTIVES,
    hasPostKeyword,
    blankObjectiveRows,
    countEmptySavedCells,
    ensureStrategy,
    ensureTactic,
    formatStrategiesForDisplay,
    formatTacticsForDisplay,
    objectiveKeyword,
    rowHasContent,
    rowHasSavedData,
    stripObjectiveContent,
    stripStrategyContent,
    stripTacticContent,
    strategyKeyword,
    tacticKeyword,
    type ObjectiveRow,
    type SavedObjectiveRow,
} from '../../../lib/incidentPost.ts';

const { activeMission, requireActiveMission } = useIncident();

const rows = ref<ObjectiveRow[]>(blankObjectiveRows());
const visibleCount = ref(1);
const savedRows = ref<SavedObjectiveRow[]>([]);
const pendingDeleteIds = ref<string[]>([]);

const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const uploading = ref(false);
const pdfExpanded = ref(false);
const status = ref('');
const statusError = ref(false);

const pdfHeader = reactive({
    incidentName: '',
    incidentLocation: '',
    ...defaultIcs234DatetimeFields(),
    preparedByName: '',
    preparedByTitle: '',
    preparedBySignature: '',
});

async function refreshPdfHeader(): Promise<void> {
    const defaults = defaultIcs234DatetimeFields();
    pdfHeader.operationalPeriodFrom = defaults.operationalPeriodFrom;
    pdfHeader.operationalPeriodTo = defaults.operationalPeriodTo;
    pdfHeader.preparedByDateTime = defaults.preparedByDateTime;
    pdfHeader.preparedByTitle = '';

    const mission = activeMission.value;
    if (!mission) {
        pdfHeader.incidentName = '';
        pdfHeader.incidentLocation = '';
        return;
    }

    pdfHeader.incidentName = mission.name;
    try {
        pdfHeader.incidentLocation = await resolveMissionIppLocation(mission.guid, mission.token);
    } catch {
        pdfHeader.incidentLocation = '';
    }
}

const filledRowCount = computed(() => {
    let n = 0;
    for (let i = 0; i < visibleCount.value; i++) {
        if (rowHasContent(rows.value[i])) n++;
    }
    return n;
});

const pendingDeletions = computed(() => {
    let n = pendingDeleteIds.value.length;
    for (let i = 0; i < visibleCount.value; i++) {
        n += countEmptySavedCells(rows.value[i]);
    }
    return n;
});

function rowIsLegacy(i: number): boolean {
    return !!rows.value[i]?.legacy;
}

function addRow(): void {
    if (visibleCount.value < MAX_OBJECTIVES) visibleCount.value++;
}

function queueDelete(id: string): void {
    pendingDeleteIds.value.push(id);
}

function parsePostTag(tag: string): {
    kind: 'objective' | 'strategy' | 'tactic';
    obj: number;
    strat?: number;
    tac?: number;
} | null {
    const objectiveMatch = tag.match(/^objective:(\d+)$/);
    if (objectiveMatch) {
        return { kind: 'objective', obj: Number(objectiveMatch[1]) };
    }

    const nestedStrategyMatch = tag.match(/^strategy:(\d+)-(\d+)$/);
    if (nestedStrategyMatch) {
        return {
            kind: 'strategy',
            obj: Number(nestedStrategyMatch[1]),
            strat: Number(nestedStrategyMatch[2]),
        };
    }

    const legacyStrategyMatch = tag.match(/^strategy:(\d+)$/);
    if (legacyStrategyMatch) {
        return { kind: 'strategy', obj: Number(legacyStrategyMatch[1]), strat: 1 };
    }

    const nestedTacticMatch = tag.match(/^tactic:(\d+)-(\d+)-(\d+)$/);
    if (nestedTacticMatch) {
        return {
            kind: 'tactic',
            obj: Number(nestedTacticMatch[1]),
            strat: Number(nestedTacticMatch[2]),
            tac: Number(nestedTacticMatch[3]),
        };
    }

    const legacyTacticMatch = tag.match(/^tactic:(\d+)$/);
    if (legacyTacticMatch) {
        return { kind: 'tactic', obj: Number(legacyTacticMatch[1]), strat: 1, tac: 1 };
    }

    return null;
}

/** Load rows from DataSync, recognising nested and legacy flat keywords. */
async function loadRows(): Promise<void> {
    if (!activeMission.value) {
        rows.value = blankObjectiveRows();
        savedRows.value = [];
        pendingDeleteIds.value = [];
        return;
    }
    loading.value = true;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const logs = await sub.log.list({ refresh: true });

        const fresh = blankObjectiveRows();
        fresh[0].objective = '';
        const seenAt: Record<string, number> = {};
        let maxRow = 1;

        for (const log of logs) {
            const kws = Array.isArray(log.keywords) ? log.keywords : [];
            if (!hasPostKeyword(kws)) continue;

            const tag = kws.find((k: string) => /^(objective|strategy|tactic):/.test(k));
            if (!tag) continue;

            const parsed = parsePostTag(tag);
            if (!parsed || parsed.obj < 1 || parsed.obj > MAX_OBJECTIVES) continue;

            const created = Date.parse(log.created || log.dtg || '') || 0;
            if (seenAt[tag] !== undefined && created < seenAt[tag]) continue;
            seenAt[tag] = created;

            const row = fresh[parsed.obj - 1];
            const content = log.content || '';
            const id = String(log.id);
            const isLegacy = !kws.includes('incident-post');

            if (parsed.kind === 'objective') {
                row.objective = stripObjectiveContent(content);
                row.objectiveId = id;
            } else if (parsed.kind === 'strategy' && parsed.strat) {
                const strategy = ensureStrategy(row, parsed.strat - 1);
                strategy.text = stripStrategyContent(content);
                strategy.id = id;
            } else if (parsed.kind === 'tactic' && parsed.strat && parsed.tac) {
                const strategy = ensureStrategy(row, parsed.strat - 1);
                const tactic = ensureTactic(strategy, parsed.tac - 1);
                tactic.text = stripTacticContent(content);
                tactic.id = id;
            }

            if (isLegacy) row.legacy = true;
            if (parsed.obj > maxRow) maxRow = parsed.obj;
        }

        const saved: SavedObjectiveRow[] = [];
        for (let i = 0; i < MAX_OBJECTIVES; i++) {
            const row = fresh[i];
            if (!rowHasSavedData(row)) continue;
            saved.push({
                row: i + 1,
                objective: row.objectiveId ? row.objective : '',
                strategies: row.strategies.map((strategy) => ({
                    text: strategy.id ? strategy.text : '',
                    id: strategy.id,
                    tactics: strategy.tactics.map((tactic) => ({
                        text: tactic.id ? tactic.text : '',
                        id: tactic.id,
                    })),
                })),
                legacy: row.legacy,
            });
        }
        savedRows.value = saved;

        if (!fresh[0].objectiveId && !fresh[0].objective.trim()) {
            fresh[0].objective = blankObjectiveRows()[0].objective;
        }

        rows.value = fresh;
        visibleCount.value = Math.max(visibleCount.value, maxRow, 1);
        pendingDeleteIds.value = [];
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load entries: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    void loadRows();
    void refreshPdfHeader();
});
watch(() => activeMission.value?.guid, () => {
    void loadRows();
    void refreshPdfHeader();
});

function reset(): void {
    rows.value = blankObjectiveRows();
    visibleCount.value = 1;
    pendingDeleteIds.value = [];
    status.value = '';
    statusError.value = false;
}

async function upsertCell(
    sub: Awaited<ReturnType<typeof Subscription.load>>,
    text: string,
    keyword: string,
    contentLabel: string,
    id: string | undefined,
    counters: { created: number; updated: number; deleted: number; failed: number },
): Promise<string | undefined> {
    if (!text) {
        if (id) {
            try {
                await sub.log.delete(id);
                counters.deleted++;
                return undefined;
            } catch {
                counters.failed++;
                return id;
            }
        }
        return undefined;
    }

    const body = {
        dtg: new Date().toISOString(),
        content: `${contentLabel}: ${text}`,
        keywords: ['incident-post', keyword],
    };

    try {
        if (id) {
            await sub.log.update(id, body);
            counters.updated++;
            return id;
        }
        const res = await sub.log.create(body);
        counters.created++;
        return String(res.id);
    } catch {
        counters.failed++;
        return id;
    }
}

async function onSave(): Promise<void> {
    if (!requireActiveMission()) return;
    await save();
}

async function save(): Promise<void> {
    if (!activeMission.value || (!filledRowCount.value && !pendingDeletions.value)) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;

    const counters = { created: 0, updated: 0, deleted: 0, failed: 0 };

    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });

        for (const id of pendingDeleteIds.value) {
            try {
                await sub.log.delete(id);
                counters.deleted++;
            } catch {
                counters.failed++;
            }
        }
        pendingDeleteIds.value = [];

        for (let i = 0; i < visibleCount.value; i++) {
            const objNum = i + 1;
            const row = rows.value[i];

            row.objectiveId = await upsertCell(
                sub,
                row.objective.trim(),
                objectiveKeyword(objNum),
                `Objective ${objNum}`,
                row.objectiveId,
                counters,
            );

            for (let si = 0; si < row.strategies.length; si++) {
                const strategy = row.strategies[si];
                const stratNum = si + 1;

                strategy.id = await upsertCell(
                    sub,
                    strategy.text.trim(),
                    strategyKeyword(objNum, stratNum),
                    `Strategy ${objNum}.${stratNum}`,
                    strategy.id,
                    counters,
                );

                for (let ti = 0; ti < strategy.tactics.length; ti++) {
                    const tactic = strategy.tactics[ti];
                    const tacNum = ti + 1;

                    tactic.id = await upsertCell(
                        sub,
                        tactic.text.trim(),
                        tacticKeyword(objNum, stratNum, tacNum),
                        `Tactic ${objNum}.${stratNum}.${tacNum}`,
                        tactic.id,
                        counters,
                    );
                }
            }
        }

        statusError.value = counters.failed > 0;
        const parts: string[] = [];
        if (counters.created) parts.push(`${counters.created} new`);
        if (counters.updated) parts.push(`${counters.updated} updated`);
        if (counters.deleted) parts.push(`${counters.deleted} removed`);
        status.value = `Saved ${parts.join(', ') || '0'} to ${activeMission.value.name}`
            + (counters.failed ? `, ${counters.failed} failed.` : '.');
        await loadRows();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

async function generatePdfBytes(): Promise<Uint8Array> {
    return buildIcs234Pdf(rows.value, { ...pdfHeader }, visibleCount.value);
}

async function downloadPdf(): Promise<void> {
    if (!filledRowCount.value) return;
    exporting.value = true;
    status.value = '';
    statusError.value = false;

    try {
        const bytes = await generatePdfBytes();
        const filename = defaultIcs234Filename(
            pdfHeader.incidentName || activeMission.value?.name || 'incident',
        );
        downloadPdfBytes(bytes, filename);
        status.value = 'PDF downloaded.';
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        exporting.value = false;
    }
}

async function onAddPdfToDataSync(): Promise<void> {
    if (!requireActiveMission()) return;
    await addPdfToDataSync();
}

async function addPdfToDataSync(): Promise<void> {
    if (!filledRowCount.value || !activeMission.value) return;
    uploading.value = true;
    status.value = '';
    statusError.value = false;

    try {
        const bytes = await generatePdfBytes();
        await uploadMissionFile(
            activeMission.value.guid,
            ICS234_MISSION_FILENAME,
            bytes,
            { missionToken: activeMission.value.token },
        );
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        await sub.fetch();
        status.value = `Added ${ICS234_MISSION_FILENAME} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploading.value = false;
    }
}
</script>

<style scoped>
.rotate-180 {
    transform: rotate(-180deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
