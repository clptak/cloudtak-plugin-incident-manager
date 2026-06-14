<template>
    <div class='card'>
        <div class='card-header'>
            <h3 class='card-title mb-0'>
                Search Scenarios Worksheet
            </h3>
        </div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Describe likely scenarios. Each scenario is stored as a single DataSync log entry keyed by
                its letter — re-saving a letter updates that entry in place, so letters never duplicate.
            </p>

            <!-- Recalled (already sent) scenarios -->
            <div
                v-if='loadingSent'
                class='text-muted small mb-2'
            >
                Loading sent scenarios…
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

            <!-- Editable drafts: reopened letters first, then the next free letters -->
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
                v-if='!availableLetters.length && !editingKeys.length'
                class='form-text text-muted'
            >
                All scenarios A–F have been sent for this mission. Use Edit above to revise one.
            </div>

            <div class='mt-3'>
                <button
                    class='btn btn-primary btn-sm mt-2'
                    :disabled='!activeMission || posting || !filledCount'
                    @click='send'
                >
                    {{ posting ? 'Saving…' : `Save ${filledCount} scenario${filledCount === 1 ? "" : "s"} to DataSync` }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm ms-2'
                    @click='reset'
                >
                    Clear
                </button>
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
        </div>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, computed, onMounted, watch } from 'vue';
import Subscription from '../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
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

// One draft slot per letter; only unused / reopened letters are ever shown.
const drafts = reactive<Record<string, Draft>>(
    Object.fromEntries(LETTERS.map((l) => [l, blankDraft()])),
);

const sentScenarios = ref<SentScenario[]>([]);
const editingKeys = ref<string[]>([]);

const sentKeys = computed(() => new Set(sentScenarios.value.map((s) => s.key)));
// A letter is "used up" for new-scenario slots if it is sent OR currently being edited.
const usedKeys = computed(() => new Set<string>([...sentKeys.value, ...editingKeys.value]));
const availableLetters = computed(() => LETTERS.filter((l) => !usedKeys.value.has(l)));

// Sent scenarios not currently open in the editor (shown read-only with an Edit button).
const visibleSent = computed(
    () => sentScenarios.value.filter((s) => !editingKeys.value.includes(s.key)),
);

// Scenario A (or the first free letter) shows by default; + reveals the next.
const visibleCount = ref(1);
const newLetters = computed(
    () => availableLetters.value.slice(0, Math.max(0, visibleCount.value)),
);
// Reopened-for-edit letters render first, then the next free letters.
const editorLetters = computed(() => [...editingKeys.value, ...newLetters.value]);

function addScenario(): void {
    if (visibleCount.value < availableLetters.value.length) visibleCount.value++;
}

const filled = computed(
    () => editorLetters.value.filter((l) => drafts[l].description.trim()),
);
const filledCount = computed(() => filled.value.length);

const loadingSent = ref(false);
const posting = ref(false);
const status = ref('');
const statusError = ref(false);

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
    return (LETTERS as readonly string[]).includes(key) ? key : null;
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

/** Read the mission log and recover which scenario letters have already been sent. */
async function loadSent(): Promise<void> {
    if (!activeMission.value) {
        sentScenarios.value = [];
        editingKeys.value = [];
        return;
    }
    loadingSent.value = true;
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
        editingKeys.value = [];
        visibleCount.value = 1;
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load sent scenarios: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingSent.value = false;
    }
}

onMounted(loadSent);
watch(() => activeMission.value?.guid, loadSent);

function edit(key: string): void {
    const s = sentScenarios.value.find((x) => x.key === key);
    if (!s) return;
    Object.assign(drafts[key], s.fields, { logId: s.id });
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
        status.value = `Saved ${parts.join(', ') || '0'} to ${activeMission.value.name}`
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
</script>
