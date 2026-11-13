<template>
    <TablerBorder
        class='cloudtak-accent text-white'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0'>
                Search Scenarios Worksheet
            </p>
        </template>

        <div>
            <p class='text-muted small mb-3'>
                Describe likely scenarios (letters A–F).
                <strong>Save</strong> keeps them on the MGMT DataSync;
                <strong>Add to MGMT DataSync Log</strong> also posts a log entry per letter
                (adding a letter again updates that entry). Field teams don't see the MGMT DataSync.
            </p>

            <!-- Recalled (already sent) scenarios -->
            <div
                v-if='loading'
                class='text-muted small mb-2'
            >
                Loading scenarios…
            </div>
            <div
                v-else-if='visibleSent.length'
                class='mb-3'
            >
                <div class='fw-bold small text-muted mb-1'>
                    Already sent ({{ visibleSent.length }})
                </div>
                <div
                    v-for='s in visibleSent'
                    :key='s.key'
                    class='cloudtak-accent border rounded-3 p-2 mb-1'
                >
                    <div class='small d-flex align-items-center justify-content-between'>
                        <span>
                            <span class='badge bg-secondary me-1'>Scenario {{ s.key }}</span>
                            <span
                                v-if='s.fields.priority != null'
                                class='badge bg-azure-lt me-1'
                            >Rank {{ s.fields.priority }}</span>
                            <span class='text-muted'>{{ fmtDtg(s.created) }}</span>
                        </span>
                        <button
                            type='button'
                            class='btn btn-sm btn-link p-0'
                            @click='edit(s.key)'
                        >
                            Edit
                        </button>
                    </div>
                    <div class='small'>
                        {{ s.content }}
                    </div>
                </div>
            </div>

            <!-- Editable drafts: reopened letters first, then schema/new free letters -->
            <div
                v-for='letter in editorLetters'
                :key='letter'
                class='cloudtak-accent border rounded-3 p-2 mb-2'
            >
                <div class='fw-bold mb-2 d-flex align-items-center justify-content-between'>
                    <span>
                        Scenario {{ letter }}
                        <span
                            v-if='drafts[letter].priority != null'
                            class='badge bg-azure-lt ms-1'
                        >Rank {{ drafts[letter].priority }}</span>
                    </span>
                    <span v-if='drafts[letter].logId'>
                        <span class='badge bg-warning text-dark me-2'>editing</span>
                        <button
                            type='button'
                            class='btn btn-sm btn-link p-0'
                            @click='cancelEdit(letter)'
                        >
                            Cancel
                        </button>
                    </span>
                </div>
                <TablerInput
                    v-model='drafts[letter].description'
                    :rows='2'
                    :placeholder='`Description for Scenario ${letter}`'
                />
                <div class='row g-2 mt-0'>
                    <div class='col-md-6'>
                        <ChoiceToggle
                            v-model='drafts[letter].mobility'
                            label='Mobility'
                            :options='MOBILITY_OPTIONS'
                        />
                    </div>
                    <div class='col-md-6'>
                        <ChoiceToggle
                            v-model='drafts[letter].responsiveness'
                            label='Responsiveness'
                            :options='RESPONSIVENESS_OPTIONS'
                        />
                    </div>
                </div>
            </div>

            <div
                v-if='scenarioRanks.length'
                class='cloudtak-accent border rounded-3 p-2 mb-2'
            >
                <div class='d-flex align-items-center mb-1'>
                    <span class='fw-bold small'>Priority ranking</span>
                    <span class='form-text ms-2 my-0'>
                        {{ rankEditing ? 'Drag to reorder, then click ✓ to save.' : '1 is the highest priority.' }}
                    </span>
                    <button
                        type='button'
                        class='btn btn-sm btn-ghost-secondary ms-auto p-1'
                        :title='rankEditing ? "Save this ranking" : (scenarioRanks.length > 1 ? "Reorder the ranking" : "Add another scenario to rank")'
                        :aria-label='rankEditing ? "Save this ranking" : "Reorder the ranking"'
                        :disabled='savingRanks || (!rankEditing && scenarioRanks.length < 2)'
                        @click='toggleRankEditing'
                    >
                        <IconPencilCheck
                            v-if='rankEditing'
                            :size='20'
                            stroke='1.5'
                        />
                        <IconPencil
                            v-else
                            :size='20'
                            stroke='1.5'
                        />
                    </button>
                </div>
                <div ref='rankListRef'>
                    <div
                        v-for='(key, i) in rankOrder'
                        :key='key'
                        class='d-flex align-items-center gap-2 py-1 border-bottom small'
                    >
                        <IconGripVertical
                            v-if='rankEditing'
                            class='rank-drag-handle text-white-50'
                            style='cursor: move'
                            :size='18'
                            stroke='1.5'
                        />
                        <span class='badge bg-azure-lt'>{{ rankEditing ? i + 1 : (rankOf(key) ?? '—') }}</span>
                        <span class='fw-bold'>Scenario {{ key }}</span>
                        <span class='text-truncate text-white-50'>{{ descriptionOf(key) }}</span>
                    </div>
                </div>
                <div
                    v-if='rankTies.length && !rankEditing'
                    class='form-text text-warning'
                >
                    Some scenarios share a rank ({{ rankTies.map((d) => `${d.keys.join(" and ")} at ${d.rank}`).join('; ') }}). Click the pencil to rank them in order.
                </div>
                <div
                    v-else-if='scenarioRanks.some((r) => r.rank == null) && !rankEditing'
                    class='form-text'
                >
                    Unranked scenarios are listed last. Click the pencil to rank them.
                </div>
            </div>

            <button
                v-if='newLetters.length < availableLetters.length'
                type='button'
                class='btn btn-outline-primary btn-sm'
                @click='addScenario'
            >
                + Add Scenario {{ availableLetters[newLetters.length] }}
            </button>

            <div
                v-if='!availableLetters.length && !editingKeys.length && !schemaEditorLetters.length'
                class='form-text text-muted'
            >
                All scenarios A–F have been sent for this mission. Use Edit above to revise one.
            </div>

            <div class='mt-3 d-flex flex-wrap gap-2'>
                <button
                    class='btn btn-primary btn-sm'
                    :disabled='saving || posting || !saveCount || !activeMission || loading'
                    @click='onSave'
                >
                    {{ saving ? 'Saving…' : 'Save to MGMT DataSync' }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='posting || saving || !filledCount || !activeMission || loading'
                    @click='onSend'
                >
                    {{ posting ? 'Adding…' : 'Add to MGMT DataSync Log' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting || !saveCount || loading'
                    @click='downloadPdf'
                >
                    {{ exporting ? 'Generating PDF…' : 'Download PDF' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='uploading || !saveCount || !activeMission || loading'
                    @click='onAddPdfToDataSync'
                >
                    {{ uploading ? 'Uploading…' : 'Add PDF to MGMT DataSync' }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='saving || posting || loading'
                    @click='reset'
                >
                    Clear
                </button>
            </div>
            <div
                v-if='!saveCount'
                class='form-text text-muted'
            >
                Add at least one scenario description to enable Save / PDF.
            </div>

            <TablerInlineAlert
                v-if='!activeMission'
                class='mt-2'
                severity='warning'
                title='No Active Mission'
                description='Select one in Create | Open first.'
            />
            <DataSyncDestination
                v-else
                :mission='activeMission'
                target='mgmt'
            />
            <TablerInlineAlert
                v-if='status'
                class='mt-2'
                :severity='statusError ? "danger" : "success"'
                :title='statusError ? "Error" : "Success"'
                :description='status'
            />

            <!-- Scenarios Record Sheet PDF -->
            <div
                v-if='!pdfExpanded'
                class='cloudtak-accent border rounded-3 text-white mt-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='false'
                @click='pdfExpanded = true'
                @keydown.enter.prevent='pdfExpanded = true'
                @keydown.space.prevent='pdfExpanded = true'
            >
                <p class='text-uppercase text-white-50 small mb-0'>
                    Scenarios Record Sheet PDF
                </p>
                <IconChevronDown
                    class='ms-auto transition-transform text-white-50 rotate-180'
                    :size='20'
                    stroke='1.5'
                />
            </div>
            <TablerBorder
                v-else
                class='cloudtak-accent text-white mt-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <div
                        class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                        role='button'
                        tabindex='0'
                        :aria-expanded='true'
                        @click='pdfExpanded = false'
                        @keydown.enter.prevent='pdfExpanded = false'
                        @keydown.space.prevent='pdfExpanded = false'
                    >
                        <p class='text-uppercase text-white-50 small mb-0'>
                            Scenarios Record Sheet PDF
                        </p>
                        <IconChevronDown
                            class='ms-auto transition-transform text-white-50'
                            :size='20'
                            stroke='1.5'
                        />
                    </div>
                </template>

                <div>
                    <p class='text-muted small mb-2'>
                        Prefills from ICS 201 / Initial Information when available.
                        Edit header and Prepared By before downloading.
                        Rows are ordered by priority rank (1 first).
                    </p>
                    <div class='row g-2 mb-2'>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='pdfHeader.incidentName'
                                label='Incident Name'
                                :disabled='incidentNameReadonly'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='pdfHeader.incidentNumber'
                                label='Incident Number'
                                :disabled='incidentNumberReadonly'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='pdfHeader.date'
                                label='Date'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='pdfHeader.time'
                                label='Time'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='pdfHeader.preparedByName'
                                label='Prepared by (Name)'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='pdfHeader.positionTitle'
                                label='Position / Title'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='pdfHeader.signature'
                                label='Signature'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='pdfHeader.preparedDateTime'
                                label='Date / Time'
                            />
                        </div>
                    </div>
                    <div class='d-flex flex-wrap gap-2'>
                        <button
                            type='button'
                            class='btn btn-outline-primary btn-sm'
                            :disabled='exporting || !saveCount'
                            @click='downloadPdf'
                        >
                            {{ exporting ? 'Generating PDF…' : 'Download Scenarios Record Sheet PDF' }}
                        </button>
                        <button
                            type='button'
                            class='btn btn-outline-primary btn-sm'
                            :disabled='uploading || !saveCount || !activeMission'
                            @click='onAddPdfToDataSync'
                        >
                            {{ uploading ? 'Uploading…' : 'Add Scenarios-Record-Sheet.pdf to MGMT DataSync' }}
                        </button>
                    </div>
                </div>
            </TablerBorder>
        </div>
    </TablerBorder>
</template>

<script setup lang='ts'>
import DataSyncDestination from '../../DataSyncDestination.vue';
import ChoiceToggle, { type ChoiceToggleOption } from '../../ChoiceToggle.vue';
import { reactive, ref, computed, onBeforeUnmount, onMounted, watch } from 'vue';
import {
    IconChevronDown,
    IconGripVertical,
    IconMapPinPause,
    IconMessageCircle,
    IconMessageCircleOff,
    IconPencil,
    IconPencilCheck,
    IconWalk,
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs';
import { TablerBorder, TablerInput, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { loadSchemaSubscription, schemaMission } from '../../../lib/incidentSubscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import { loadIcs201FromMission } from '../../../lib/ics201.ts';
import { nowBriefingDate, nowBriefingTime } from '../../../lib/irBriefing.ts';
import { localDateTimeLabel } from '../../../lib/localTime.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';
import {
    buildSearchScenario,
    duplicateRanks,
    isScenarioLetter,
    moveItem,
    orderByRank,
    ranksFromOrder,
    scenarioFieldsForSave,
    SCENARIO_LETTERS,
    type SearchScenario,
} from '../../../lib/searchScenarios.ts';
import {
    loadSearchScenariosFromMission,
    saveSearchScenariosToMission,
} from '../../../lib/searchScenariosPersistence.ts';
import {
    buildScenariosRecordSheetPdf,
    defaultScenariosRecordSheetFilename,
    SCENARIOS_RECORD_SHEET_MISSION_FILENAME,
    type ScenariosRecordSheetHeader,
} from '../../../lib/scenariosRecordSheetPdf.ts';

const { activeMission, requireActiveMission } = useIncident();

const LETTERS = SCENARIO_LETTERS;
const SCENARIO_KEYWORD = 'search-scenario';

interface Draft {
    description: string;
    mobility: string;
    responsiveness: string;
    priority: number | null;
    /** Log id of the existing DataSync entry for this letter, if it has been sent. */
    logId?: string;
}

interface SentScenario {
    key: string;
    content: string;
    created: string;
    id: string;
    fields: Draft;
}

function blankDraft(): Draft {
    return { description: '', mobility: '', responsiveness: '', priority: null, logId: undefined };
}

const MOBILITY_OPTIONS: ChoiceToggleOption[] = [
    { value: 'mobile', label: 'Mobile', tone: 'green', icon: IconWalk },
    { value: 'immobile', label: 'Immobile', tone: 'orange', icon: IconMapPinPause },
];

const RESPONSIVENESS_OPTIONS: ChoiceToggleOption[] = [
    { value: 'responsive', label: 'Responsive', tone: 'green', icon: IconMessageCircle },
    { value: 'unresponsive', label: 'Unresponsive', tone: 'orange', icon: IconMessageCircleOff },
];

function blankPdfHeader(): ScenariosRecordSheetHeader {
    const date = nowBriefingDate();
    const time = nowBriefingTime();
    return {
        incidentName: '',
        incidentNumber: '',
        date,
        time,
        preparedByName: '',
        positionTitle: '',
        signature: '',
        preparedDateTime: `${date} ${time}`,
    };
}

// One draft slot per letter; only unused / reopened / schema-loaded letters are ever shown.
const drafts = reactive<Record<string, Draft>>(
    Object.fromEntries(LETTERS.map((l) => [l, blankDraft()])),
);

const sentScenarios = ref<SentScenario[]>([]);
const editingKeys = ref<string[]>([]);
const pdfHeader = reactive<ScenariosRecordSheetHeader>(blankPdfHeader());
const incidentNameReadonly = ref(false);
const incidentNumberReadonly = ref(false);
const pdfExpanded = ref(true);

const sentKeys = computed(() => new Set(sentScenarios.value.map((s) => s.key)));
// A letter is "used up" for new-scenario slots if it is sent OR currently being edited.
const usedKeys = computed(() => new Set<string>([...sentKeys.value, ...editingKeys.value]));
const availableLetters = computed(() => LETTERS.filter((l) => !usedKeys.value.has(l)));

// Sent scenarios not currently open in the editor (shown read-only with an Edit button).
const visibleSent = computed(
    () => sentScenarios.value.filter((s) => !editingKeys.value.includes(s.key)),
);

/** Schema-recalled (or locally filled) letters that are not in the Already-sent list. */
const schemaEditorLetters = computed(() => LETTERS.filter((l) => {
    if (visibleSent.value.some((s) => s.key === l)) return false;
    if (editingKeys.value.includes(l)) return false;
    return Boolean(drafts[l].description.trim());
}));

// Scenario A (or the first free letter) shows by default; + reveals the next.
const visibleCount = ref(1);
const newLetters = computed(
    () => availableLetters.value.slice(0, Math.max(0, visibleCount.value)),
);
// Reopened-for-edit letters first, then schema-filled, then next free letters.
const editorLetters = computed(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of [...editingKeys.value, ...schemaEditorLetters.value, ...newLetters.value]) {
        if (seen.has(l)) continue;
        seen.add(l);
        out.push(l);
    }
    return out;
});

/** Every described scenario with its rank: sent ones as saved, open ones as drafted. */
const scenarioRanks = computed(() => [
    ...visibleSent.value.map((s) => ({ key: s.key, rank: s.fields.priority })),
    ...editorLetters.value
        .filter((l) => drafts[l].description.trim())
        .map((l) => ({ key: l, rank: drafts[l].priority })),
]);
const rankTies = computed(() => duplicateRanks(scenarioRanks.value));

// ---- Drag ranking (#20): pencil to reorder, check to save ------------------
const rankEditing = ref(false);
const savingRanks = ref(false);
const draggedOrder = ref<string[]>([]);
const rankOrder = computed(() => (rankEditing.value ? draggedOrder.value : orderByRank(scenarioRanks.value)));
const rankListRef = ref<HTMLElement | null>(null);
let sortable: Sortable | undefined;

function rankOf(key: string): number | null {
    return scenarioRanks.value.find((r) => r.key === key)?.rank ?? null;
}

function descriptionOf(key: string): string {
    if (editorLetters.value.includes(key)) return drafts[key].description.trim();
    return sentScenarios.value.find((s) => s.key === key)?.fields.description.trim() ?? '';
}

function onRankDrop(evt: SortableEvent): void {
    const { oldIndex, newIndex, item, from } = evt;
    if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
    // Put the DOM back and let Vue re-render from the new order.
    from.removeChild(item);
    from.insertBefore(item, from.children[oldIndex] ?? null);
    draggedOrder.value = moveItem(draggedOrder.value, oldIndex, newIndex);
}

watch([rankListRef, rankEditing], ([el, editing]) => {
    if (el && editing) {
        if (sortable && sortable.el === el) return;
        sortable?.destroy();
        sortable = new Sortable(el, { handle: '.rank-drag-handle', animation: 150, onEnd: onRankDrop });
    } else if (sortable) {
        sortable.destroy();
        sortable = undefined;
    }
});

onBeforeUnmount(() => {
    sortable?.destroy();
    sortable = undefined;
});

async function toggleRankEditing(): Promise<void> {
    if (!rankEditing.value) {
        draggedOrder.value = orderByRank(scenarioRanks.value);
        rankEditing.value = true;
        return;
    }
    await saveRanking(ranksFromOrder(draggedOrder.value));
    rankEditing.value = false;
}

/**
 * Apply a ranking: open drafts take the new ranks; sent scenarios whose rank
 * changed get their log entry updated; the MGMT record is saved once.
 */
async function saveRanking(ranks: Record<string, number>): Promise<void> {
    // Drafts of sent scenarios too, so no copy keeps the old rank.
    for (const l of LETTERS) {
        if (ranks[l] != null) drafts[l].priority = ranks[l];
    }
    const changedSent = visibleSent.value.filter((s) => ranks[s.key] != null && s.fields.priority !== ranks[s.key]);
    for (const s of changedSent) s.fields.priority = ranks[s.key];
    if (!activeMission.value) return;
    savingRanks.value = true;
    status.value = '';
    statusError.value = false;
    let failed = 0;
    try {
        if (changedSent.length) {
            const sub = await loadSchemaSubscription(activeMission.value);
            for (const s of changedSent) {
                try {
                    await sub.log.update(s.id, {
                        dtg: new Date().toISOString(),
                        content: summarize(s.key, s.fields),
                        keywords: buildKeywords(s.key, s.fields),
                    });
                } catch {
                    failed++;
                }
            }
        }
        contentHash.value = await saveSearchScenariosToMission(activeMission.value, scenariosForSave(), contentHash.value);
        statusError.value = failed > 0;
        status.value = `Saved the priority ranking to the MGMT DataSync (${schemaMission(activeMission.value).name})`
            + (failed ? `; ${failed} sent scenario${failed === 1 ? '' : 's'} could not be updated.` : '.');
        if (changedSent.length) await loadSent();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingRanks.value = false;
    }
}

function addScenario(): void {
    if (visibleCount.value < availableLetters.value.length) visibleCount.value++;
}

const filled = computed(
    () => editorLetters.value.filter((l) => drafts[l].description.trim()),
);
const filledCount = computed(() => filled.value.length);

const loading = ref(false);
const posting = ref(false);
const saving = ref(false);
const exporting = ref(false);
const uploading = ref(false);
const status = ref('');
const statusError = ref(false);
const contentHash = ref<string | undefined>();

function fmtDtg(raw?: string): string {
    return localDateTimeLabel(raw);
}

function scenarioKeyFromLog(keywords?: string[]): string | null {
    if (!keywords || !keywords.includes(SCENARIO_KEYWORD)) return null;
    const tag = keywords.find((k) => k.startsWith('scenario:'));
    if (!tag) return null;
    const key = tag.slice('scenario:'.length);
    return isScenarioLetter(key) ? key : null;
}

/** Recover the structured fields a scenario was saved with (keywords are authoritative). */
function fieldsFromLog(content: string, keywords?: string[]): Draft {
    const kw = (prefix: string): string => {
        const t = keywords?.find((k) => k.startsWith(prefix));
        return t ? t.slice(prefix.length) : '';
    };
    const priorityRaw = kw('priority:');
    // Description = log content minus the "Scenario X: " prefix and trailing "[ … ]" field summary.
    const description = content
        .replace(/^Scenario [A-F]:\s*/, '')
        .replace(/\s*\[[^\]]*\]\s*$/, '')
        .trim();
    return {
        description,
        mobility: kw('mobility:'),
        responsiveness: kw('responsiveness:'),
        priority: priorityRaw ? Number(priorityRaw) : null,
        logId: undefined,
    };
}

function applyScenarioToDraft(scenario: SearchScenario, logId?: string): void {
    Object.assign(drafts[scenario.letter], {
        description: scenario.description,
        mobility: scenario.mobility,
        responsiveness: scenario.responsiveness,
        priority: scenario.priority,
        logId,
    });
}

/** Collect A–F scenarios for schema Save / PDF, as shown on screen (#22). */
function scenariosForSave(): SearchScenario[] {
    const now = new Date().toISOString();
    return scenarioFieldsForSave(LETTERS, drafts, visibleSent.value)
        .map(({ letter, fields }) => buildSearchScenario(letter, fields, now));
}

const saveCount = computed(() => scenariosForSave().length);

/** Read the mission log and recover which scenario letters have already been sent. */
async function loadSent(): Promise<void> {
    if (!activeMission.value) {
        sentScenarios.value = [];
        editingKeys.value = [];
        return;
    }
    try {
        const sub = await loadSchemaSubscription(activeMission.value);
        const logs = await sub.log.list({ refresh: true });

        // Keep the most recent entry per letter (defensive against legacy duplicates).
        const byKey = new Map<string, SentScenario>();
        for (const log of logs) {
            const key = scenarioKeyFromLog(log.keywords);
            if (!key) continue;
            const created = log.created || log.dtg || '';
            const prev = byKey.get(key);
            if (!prev || Date.parse(created) >= Date.parse(prev.created)) {
                byKey.set(key, {
                    key,
                    content: log.content || '',
                    created,
                    id: String(log.id),
                    fields: fieldsFromLog(log.content || '', log.keywords),
                });
            }
        }
        sentScenarios.value = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));

        // Attach log ids to drafts that already have schema content for that letter.
        for (const s of sentScenarios.value) {
            if (drafts[s.key].description.trim()) {
                drafts[s.key].logId = s.id;
            }
        }
        editingKeys.value = editingKeys.value.filter((k) => sentKeys.value.has(k));
        visibleCount.value = 1;
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load sent scenarios: ${err instanceof Error ? err.message : String(err)}`;
    }
}

async function recallSchema(): Promise<void> {
    if (!activeMission.value) {
        contentHash.value = undefined;
        return;
    }
    const loaded = await loadSearchScenariosFromMission(activeMission.value);
    contentHash.value = loaded.contentHash;
    for (const letter of LETTERS) {
        const existingLogId = drafts[letter].logId;
        Object.assign(drafts[letter], blankDraft());
        if (existingLogId) drafts[letter].logId = existingLogId;
    }
    for (const scenario of loaded.scenarios) {
        applyScenarioToDraft(scenario, drafts[scenario.letter].logId);
    }
    if (loaded.scenarios.length) {
        status.value = `Loaded ${loaded.scenarios.length} scenario${loaded.scenarios.length === 1 ? '' : 's'} from the MGMT DataSync.`;
        statusError.value = false;
    }
}

async function prefillPdfHeader(): Promise<void> {
    const date = nowBriefingDate();
    const time = nowBriefingTime();
    Object.assign(pdfHeader, blankPdfHeader());
    incidentNameReadonly.value = false;
    incidentNumberReadonly.value = false;

    if (!activeMission.value) return;

    try {
        const loaded = await loadIcs201FromMission(
            activeMission.value.guid,
            activeMission.value.token,
            activeMission.value.name,
            activeMission.value,
        );
        const form = loaded.form;
        pdfHeader.incidentName = form.incidentName.trim() || activeMission.value.name || '';
        pdfHeader.incidentNumber = form.incidentNumber.trim();
        pdfHeader.date = form.date.trim() || date;
        pdfHeader.time = form.time.trim() || time;
        pdfHeader.preparedByName = form.preparedByName.trim();
        pdfHeader.positionTitle = form.positionTitle.trim();
        pdfHeader.signature = form.signature.trim();
        pdfHeader.preparedDateTime = form.preparedDateTime.trim() || `${pdfHeader.date} ${pdfHeader.time}`;
        incidentNameReadonly.value = Boolean(pdfHeader.incidentName.trim());
        incidentNumberReadonly.value = Boolean(pdfHeader.incidentNumber.trim());
    } catch {
        pdfHeader.incidentName = activeMission.value.name || '';
        pdfHeader.date = date;
        pdfHeader.time = time;
        pdfHeader.preparedDateTime = `${date} ${time}`;
        incidentNameReadonly.value = Boolean(pdfHeader.incidentName.trim());
    }
}

async function loadAll(): Promise<void> {
    if (!activeMission.value) {
        sentScenarios.value = [];
        editingKeys.value = [];
        contentHash.value = undefined;
        for (const l of LETTERS) Object.assign(drafts[l], blankDraft());
        Object.assign(pdfHeader, blankPdfHeader());
        incidentNameReadonly.value = false;
        incidentNumberReadonly.value = false;
        return;
    }
    loading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        await recallSchema();
        await loadSent();
        await prefillPdfHeader();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => { void loadAll(); });
watch(() => activeMission.value?.guid, () => { void loadAll(); });

function edit(key: string): void {
    const s = sentScenarios.value.find((x) => x.key === key);
    if (!s) return;
    // Prefer existing draft (schema) content; otherwise load from sent fields.
    if (!drafts[key].description.trim()) {
        Object.assign(drafts[key], s.fields, { logId: s.id });
    } else {
        drafts[key].logId = s.id;
    }
    if (!editingKeys.value.includes(key)) {
        editingKeys.value = [...editingKeys.value, key].sort((a, b) => a.localeCompare(b));
    }
}

function cancelEdit(key: string): void {
    Object.assign(drafts[key], blankDraft());
    editingKeys.value = editingKeys.value.filter((k) => k !== key);
}

function reset(): void {
    for (const l of LETTERS) Object.assign(drafts[l], blankDraft());
    editingKeys.value = [];
    visibleCount.value = 1;
    status.value = '';
    statusError.value = false;
}

function summarize(key: string, d: Draft): string {
    const base = `Scenario ${key}: ${d.description.trim()}`;
    const tail: string[] = [];
    if (d.mobility) tail.push(`mobility=${d.mobility}`);
    if (d.responsiveness) tail.push(`responsiveness=${d.responsiveness}`);
    if (d.priority != null) tail.push(`priority=${d.priority}`);
    return tail.length ? `${base} [${tail.join('; ')}]` : base;
}

function buildKeywords(key: string, d: Draft): string[] {
    const kws = [SCENARIO_KEYWORD, `scenario:${key}`];
    if (d.mobility) kws.push(`mobility:${d.mobility}`);
    if (d.responsiveness) kws.push(`responsiveness:${d.responsiveness}`);
    if (d.priority != null) kws.push(`priority:${d.priority}`);
    return kws;
}

async function onSave(): Promise<void> {
    if (!requireActiveMission()) return;
    if (!activeMission.value || !saveCount.value) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const scenarios = scenariosForSave();
        contentHash.value = await saveSearchScenariosToMission(
            activeMission.value,
            scenarios,
            contentHash.value,
        );
        status.value = `Saved ${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} to the MGMT DataSync (${schemaMission(activeMission.value).name}).`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

async function onSend(): Promise<void> {
    if (!requireActiveMission()) return;
    await send();
}

async function send(): Promise<void> {
    if (!activeMission.value || !filledCount.value) return;
    posting.value = true; status.value = ''; statusError.value = false;
    let created = 0; let updated = 0; let failed = 0;
    let didWrite = false;
    try {
        const sub = await loadSchemaSubscription(activeMission.value);
        for (const key of filled.value) {
            const d = drafts[key];
            const body = {
                dtg: new Date().toISOString(),
                content: summarize(key, d),
                keywords: buildKeywords(key, d),
            };
            try {
                if (d.logId) {
                    await sub.log.update(d.logId, body);
                    updated++;
                } else {
                    await sub.log.create(body);
                    created++;
                }
                Object.assign(drafts[key], blankDraft());
                editingKeys.value = editingKeys.value.filter((k) => k !== key);
                didWrite = true;
            } catch {
                failed++;
            }
        }
        statusError.value = failed > 0;
        const parts: string[] = [];
        if (created) parts.push(`${created} new`);
        if (updated) parts.push(`${updated} updated`);
        status.value = `Added ${parts.join(', ') || '0'} to the MGMT DataSync Log (${schemaMission(activeMission.value).name})`
            + (failed ? `, ${failed} failed.` : '.');
        // Recall from the mission so saved letters move into "Already sent".
        if (didWrite) await loadSent();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}

async function generatePdfBytes(): Promise<Uint8Array> {
    return buildScenariosRecordSheetPdf(scenariosForSave(), { ...pdfHeader });
}

async function downloadPdf(): Promise<void> {
    if (!saveCount.value) return;
    exporting.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        const filename = defaultScenariosRecordSheetFilename(
            pdfHeader.incidentName || activeMission.value?.name || 'incident',
        );
        downloadPdfBytes(bytes, filename);
        status.value = 'Scenarios Record Sheet downloaded.';
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
    if (!activeMission.value || !saveCount.value) return;
    uploading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        const planningTarget = schemaMission(activeMission.value);
        await uploadMissionFile(
            planningTarget.guid,
            SCENARIOS_RECORD_SHEET_MISSION_FILENAME,
            bytes,
            { missionToken: planningTarget.missionToken },
        );
        const sub = await loadSchemaSubscription(activeMission.value);
        await sub.fetch();
        status.value = `Added ${SCENARIOS_RECORD_SHEET_MISSION_FILENAME} to ${schemaMission(activeMission.value).name}.`;
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
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
