<template>
    <div class='card'>
        <div class='card-header'>
            <h3 class='card-title mb-0'>
                Search Scenarios Worksheet
            </h3>
        </div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Describe likely scenarios (letters A–F).
                <strong>Save</strong> stores them in <strong>mission_schema.json</strong>;
                <strong>Send to DataSync</strong> posts mission log entries keyed by letter
                (re-sending a letter updates that entry in place).
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
                    class='border rounded p-2 mb-1 bg-body-secondary'
                >
                    <div class='small d-flex align-items-center justify-content-between'>
                        <span>
                            <span class='badge bg-secondary me-1'>Scenario {{ s.key }}</span>
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
                class='border rounded p-2 mb-2'
            >
                <div class='fw-bold mb-2 d-flex align-items-center justify-content-between'>
                    <span>Scenario {{ letter }}</span>
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
                <textarea
                    v-model='drafts[letter].description'
                    class='form-control form-control-sm mb-2'
                    rows='2'
                    :placeholder='`Description for Scenario ${letter}`'
                />
                <div class='row g-2'>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Mobility</label>
                        <select
                            v-model='drafts[letter].mobility'
                            class='form-select form-select-sm'
                        >
                            <option value=''>
                                —
                            </option>
                            <option value='mobile'>
                                Mobile
                            </option>
                            <option value='immobile'>
                                Immobile
                            </option>
                        </select>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Responsiveness</label>
                        <select
                            v-model='drafts[letter].responsiveness'
                            class='form-select form-select-sm'
                        >
                            <option value=''>
                                —
                            </option>
                            <option value='responsive'>
                                Responsive
                            </option>
                            <option value='unresponsive'>
                                Unresponsive
                            </option>
                        </select>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Priority</label>
                        <input
                            v-model.number='drafts[letter].priority'
                            type='number'
                            min='1'
                            max='5'
                            class='form-control form-control-sm'
                        >
                    </div>
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
                    {{ saving ? 'Saving…' : 'Save' }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='posting || saving || !filledCount || !activeMission || loading'
                    @click='onSend'
                >
                    {{ posting ? 'Sending…' : 'Send to DataSync' }}
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
                    {{ uploading ? 'Uploading…' : 'Add PDF to DataSync' }}
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

            <div class='card mt-3'>
                <div class='card-header py-2'>
                    <h4 class='card-title mb-0 fs-6'>
                        Scenarios Record Sheet PDF
                    </h4>
                </div>
                <div class='card-body py-2'>
                    <p class='text-muted small mb-2'>
                        Prefills from ICS 201 / Initial Information when available.
                        Edit header and Prepared By before downloading.
                        Rows are ordered by priority ascending (1→5).
                    </p>
                    <div class='row g-2 mb-2'>
                        <div class='col-md-6'>
                            <label class='form-label small mb-1'>Incident Name</label>
                            <input
                                v-model='pdfHeader.incidentName'
                                type='text'
                                class='form-control form-control-sm'
                                :readonly='incidentNameReadonly'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label small mb-1'>Incident Number</label>
                            <input
                                v-model='pdfHeader.incidentNumber'
                                type='text'
                                class='form-control form-control-sm'
                                :readonly='incidentNumberReadonly'
                            >
                        </div>
                        <div class='col-md-3'>
                            <label class='form-label small mb-1'>Date</label>
                            <input
                                v-model='pdfHeader.date'
                                type='text'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-md-3'>
                            <label class='form-label small mb-1'>Time</label>
                            <input
                                v-model='pdfHeader.time'
                                type='text'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label small mb-1'>Prepared by (Name)</label>
                            <input
                                v-model='pdfHeader.preparedByName'
                                type='text'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label small mb-1'>Position / Title</label>
                            <input
                                v-model='pdfHeader.positionTitle'
                                type='text'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label small mb-1'>Signature</label>
                            <input
                                v-model='pdfHeader.signature'
                                type='text'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label small mb-1'>Date / Time</label>
                            <input
                                v-model='pdfHeader.preparedDateTime'
                                type='text'
                                class='form-control form-control-sm'
                            >
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
                            {{ uploading ? 'Uploading…' : 'Add Scenarios-Record-Sheet.pdf to DataSync' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, computed, onMounted, watch } from 'vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import { loadIcs201FromMission } from '../../../lib/ics201.ts';
import { nowBriefingDate, nowBriefingTime } from '../../../lib/irBriefing.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';
import {
    buildSearchScenario,
    isScenarioLetter,
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
    if (!raw) return '';
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? raw : new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
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

/** Collect A–F scenarios for schema Save / PDF (drafts + non-editing sent). */
function scenariosForSave(): SearchScenario[] {
    const out: SearchScenario[] = [];
    const now = new Date().toISOString();
    for (const letter of LETTERS) {
        const d = drafts[letter];
        if (d.description.trim()) {
            out.push(buildSearchScenario(letter, d, now));
            continue;
        }
        const sent = sentScenarios.value.find((s) => s.key === letter);
        if (sent && !editingKeys.value.includes(letter) && sent.fields.description.trim()) {
            out.push(buildSearchScenario(letter, sent.fields, now));
        }
    }
    return out;
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
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
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
        status.value = `Loaded ${loaded.scenarios.length} scenario${loaded.scenarios.length === 1 ? '' : 's'} from mission_schema.json.`;
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
        status.value = `Saved ${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} to mission_schema.json on ${activeMission.value.name}.`;
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
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
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
        status.value = `Sent ${parts.join(', ') || '0'} to ${activeMission.value.name}`
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
        await uploadMissionFile(
            activeMission.value.guid,
            SCENARIOS_RECORD_SHEET_MISSION_FILENAME,
            bytes,
            { missionToken: activeMission.value.token },
        );
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        await sub.fetch();
        status.value = `Added ${SCENARIOS_RECORD_SHEET_MISSION_FILENAME} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploading.value = false;
    }
}
</script>
