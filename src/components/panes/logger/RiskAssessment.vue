<template>
    <div>
        <div class='card mb-3'>
            <div class='card-header'>
                <h3 class='card-title mb-0'>
                    Risk Assessment — Complacency Model
                </h3>
            </div>
            <div class='card-body'>
                <p class='text-muted small mb-3'>
                    Risk = Repetition &times; Confidence &times; Experience
                    (Craig E. Geis, California Training Institute). Each respondent
                    assesses the tactic for themselves before deploying.
                </p>

                <div
                    v-if='!activeMission'
                    class='alert alert-info small mb-3'
                >
                    Select a mission in <strong>Create | Open</strong> before saving assessments.
                </div>

                <div class='row g-2 mb-2'>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Tactic</label>
                        <select
                            v-model='tacticChoice'
                            class='form-select form-select-sm'
                            :disabled='busy'
                        >
                            <option value=''>
                                {{ assignmentOptions.length ? 'Select a tactic…' : 'No assignments yet — use New Tactic' }}
                            </option>
                            <option
                                v-for='opt in assignmentOptions'
                                :key='opt.id'
                                :value='opt.id'
                            >
                                {{ opt.label }}
                            </option>
                            <option value='__new__'>
                                New Tactic…
                            </option>
                        </select>
                    </div>
                    <div
                        v-if='tacticChoice === "__new__"'
                        class='col-md-6'
                    >
                        <label class='form-label small mb-1'>New Tactic</label>
                        <input
                            v-model='newTacticLabel'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='e.g. Hasty search of likely routes from PLS'
                            :disabled='busy'
                        >
                    </div>
                </div>

                <div class='mb-2'>
                    <label class='form-label small mb-1'>Description</label>
                    <textarea
                        v-model='description'
                        class='form-control form-control-sm'
                        rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
                </div>

                <div class='mb-3'>
                    <label class='form-label small mb-1'>Respondent</label>
                    <input
                        v-model='respondentName'
                        type='text'
                        class='form-control form-control-sm'
                        placeholder='Name or callsign of the person assessing'
                        :disabled='busy'
                    >
                </div>

                <div class='row g-2 mb-3'>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Repetition</label>
                        <select
                            v-model.number='repetition'
                            class='form-select form-select-sm'
                            :disabled='busy'
                        >
                            <option :value='0'>
                                Select…
                            </option>
                            <option
                                v-for='opt in REPETITION_OPTIONS'
                                :key='opt.value'
                                :value='opt.value'
                            >
                                {{ opt.value }} — {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Confidence</label>
                        <select
                            v-model.number='confidence'
                            class='form-select form-select-sm'
                            :disabled='busy'
                        >
                            <option :value='0'>
                                Select…
                            </option>
                            <option
                                v-for='opt in CONFIDENCE_OPTIONS'
                                :key='opt.value'
                                :value='opt.value'
                            >
                                {{ opt.value }} — {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Experience</label>
                        <select
                            v-model.number='experience'
                            class='form-select form-select-sm'
                            :disabled='busy'
                        >
                            <option :value='0'>
                                Select…
                            </option>
                            <option
                                v-for='opt in EXPERIENCE_OPTIONS'
                                :key='opt.value'
                                :value='opt.value'
                            >
                                {{ opt.value }} — {{ opt.label }}
                            </option>
                        </select>
                    </div>
                </div>

                <div
                    v-if='result'
                    class='border rounded p-2 mb-3'
                >
                    <div class='d-flex align-items-center gap-2 mb-2'>
                        <span class='fw-bold fs-3'>{{ result.score }}</span>
                        <span
                            class='badge'
                            :class='bandBadgeClass(result.band)'
                        >{{ result.label }}</span>
                        <span class='small'>{{ result.recommendation }}</span>
                    </div>
                    <div
                        class='progress'
                        style='height: 8px;'
                    >
                        <div
                            class='progress-bar'
                            :class='bandBarClass(result.band)'
                            :style='{ width: `${result.score}%` }'
                        />
                    </div>
                    <div
                        class='d-flex justify-content-between text-muted mt-1'
                        style='font-size: 0.7rem;'
                    >
                        <span>1–19 Low Skill</span>
                        <span>20–39 Moderate Skill</span>
                        <span>40–59 Safety Zone</span>
                        <span>60–79 Moderate Complacency</span>
                        <span>80–100 High Complacency</span>
                    </div>
                </div>
                <div
                    v-else
                    class='text-muted small mb-3'
                >
                    Select Repetition, Confidence, and Experience to compute the risk value.
                </div>

                <div class='d-flex align-items-center gap-2'>
                    <button
                        type='button'
                        class='btn btn-primary btn-sm'
                        :disabled='!canSave || busy'
                        @click='onSave'
                    >
                        {{ saving ? 'Saving…' : (editingRespondentId ? 'Update assessment' : 'Save assessment') }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='resetForm'
                    >
                        Clear
                    </button>
                </div>

                <div
                    v-if='statusMessage'
                    class='fw-bold small mt-2'
                    :class='statusError ? "text-danger" : "text-success"'
                >
                    {{ statusMessage }}
                </div>
            </div>
        </div>

        <div class='card'>
            <div class='card-header py-2 small fw-semibold'>
                Saved assessments
            </div>
            <div class='card-body p-0'>
                <div
                    v-if='loading'
                    class='p-3 text-muted small'
                >
                    Loading…
                </div>
                <div
                    v-else-if='!savedGroups.length'
                    class='p-3 text-muted small'
                >
                    No assessments saved yet.
                </div>
                <div
                    v-else
                    class='table-responsive'
                >
                    <table class='table table-sm table-vcenter mb-0'>
                        <thead>
                            <tr>
                                <th>Respondent</th>
                                <th style='width: 70px;'>
                                    Risk
                                </th>
                                <th>Level</th>
                                <th class='d-none d-md-table-cell'>
                                    R &times; C &times; E
                                </th>
                                <th style='width: 120px;' />
                            </tr>
                        </thead>
                        <tbody
                            v-for='group in savedGroups'
                            :key='group.key'
                        >
                            <tr class='bg-body-secondary'>
                                <td colspan='3'>
                                    <div class='fw-semibold'>
                                        {{ group.entry.tacticLabel || '(untitled tactic)' }}
                                        <span
                                            v-if='group.worst'
                                            class='badge ms-2'
                                            :class='bandBadgeClass(group.worst.band)'
                                        >Worst: {{ group.worst.score }} — {{ group.worst.level }}</span>
                                    </div>
                                    <div
                                        v-if='group.entry.description'
                                        class='text-muted small'
                                    >
                                        {{ group.entry.description }}
                                    </div>
                                </td>
                                <td class='d-none d-md-table-cell text-muted small'>
                                    {{ group.entry.respondents.length }}
                                    respondent{{ group.entry.respondents.length === 1 ? '' : 's' }}
                                </td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-outline-primary btn-sm me-1'
                                        :disabled='busy'
                                        title='Add a respondent for this tactic'
                                        @click='onAddRespondent(group.key)'
                                    >
                                        + Respondent
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        title='Delete this tactic and all its assessments'
                                        @click='onDeleteTactic(group.key)'
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                            <tr
                                v-for='resp in group.entry.respondents'
                                :key='resp.id'
                            >
                                <td>{{ resp.name || '(unnamed)' }}</td>
                                <td class='fw-bold'>
                                    {{ resp.score }}
                                </td>
                                <td>
                                    <span
                                        class='badge'
                                        :class='bandBadgeClass(resp.band)'
                                    >{{ resp.level }}</span>
                                    <div class='text-muted small'>
                                        {{ resp.recommendation }}
                                    </div>
                                </td>
                                <td class='d-none d-md-table-cell text-muted small'>
                                    {{ resp.repetition }} &times; {{ resp.confidence }} &times; {{ resp.experience }}
                                </td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-outline-secondary btn-sm me-1'
                                        :disabled='busy'
                                        @click='onEdit(group.key, resp.id)'
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        @click='onDeleteRespondent(group.key, resp.id)'
                                    >
                                        Delete
                                    </button>
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
import { computed, ref, watch } from 'vue';
import { useIncident } from '../../../composables/useIncident.ts';
import { useWorkAssignments } from '../../../composables/useWorkAssignments.ts';
import {
    CONFIDENCE_OPTIONS,
    EXPERIENCE_OPTIONS,
    REPETITION_OPTIONS,
    newTacticKey,
    riskLevelForScore,
    worstRespondent,
    type ComplacencyRiskEntry,
    type ComplacencyRiskMap,
    type ComplacencyRiskRespondent,
    type RiskBand,
} from '../../../lib/complacencyRisk.ts';
import {
    loadRiskAssessmentsFromMission,
    saveRiskAssessmentsToMission,
} from '../../../lib/complacencyRiskPersistence.ts';

const { activeMission, requireActiveMission } = useIncident();
const { assignments, loadForMission } = useWorkAssignments();

const assessments = ref<ComplacencyRiskMap>({});
const contentHash = ref<string | undefined>();
const loading = ref(false);
const saving = ref(false);
const statusMessage = ref('');
const statusError = ref(false);

const tacticChoice = ref('');
const newTacticLabel = ref('');
const description = ref('');
const respondentName = ref('');
const repetition = ref(0);
const confidence = ref(0);
const experience = ref(0);
/** Set when editing a saved tactic keyed by `tactic:<uuid>` (no assignment uid). */
const editingKey = ref('');
/** Set when editing an existing respondent row (upsert target survives a rename). */
const editingRespondentId = ref('');

const busy = computed(() => loading.value || saving.value);

const assignmentOptions = computed(() => assignments.value.map((a) => ({
    id: a.id,
    label: `#${a.assignmentNumber} — ${a.teamLabel || 'Team'} — ${a.assignmentCallsign || a.assignmentUid}`,
})));

const selectedAssignment = computed(() => assignments.value.find(
    (a) => a.id === tacticChoice.value,
) ?? null);

const tacticLabel = computed(() => {
    if (tacticChoice.value === '__new__') return newTacticLabel.value.trim();
    const opt = assignmentOptions.value.find((o) => o.id === tacticChoice.value);
    return opt?.label ?? '';
});

const result = computed(() => {
    if (!repetition.value || !confidence.value || !experience.value) return null;
    const score = repetition.value * confidence.value * experience.value;
    const level = riskLevelForScore(score);
    return { score, ...level };
});

const canSave = computed(() => {
    if (!result.value || !tacticLabel.value) return false;
    if (!respondentName.value.trim()) return false;
    return tacticChoice.value !== '';
});

const savedGroups = computed(() => Object.entries(assessments.value)
    .map(([key, entry]) => ({ key, entry, worst: worstRespondent(entry) }))
    .sort((a, b) => a.entry.tacticLabel.localeCompare(b.entry.tacticLabel)));

function bandBadgeClass(band: RiskBand): string {
    if (band === 'green') return 'bg-green-lt text-green';
    if (band === 'amber') return 'bg-yellow-lt text-yellow';
    return 'bg-danger-lt text-danger';
}

function bandBarClass(band: RiskBand): string {
    if (band === 'green') return 'bg-green';
    if (band === 'amber') return 'bg-yellow';
    return 'bg-red';
}

function resetForm(): void {
    tacticChoice.value = '';
    newTacticLabel.value = '';
    description.value = '';
    respondentName.value = '';
    repetition.value = 0;
    confidence.value = 0;
    experience.value = 0;
    editingKey.value = '';
    editingRespondentId.value = '';
    statusMessage.value = '';
}

function clearRespondentFields(): void {
    respondentName.value = '';
    repetition.value = 0;
    confidence.value = 0;
    experience.value = 0;
    editingRespondentId.value = '';
}

/** Storage key for the tactic currently selected in the form, if it already exists. */
function keyForCurrentTactic(): string | null {
    const assignment = selectedAssignment.value;
    if (assignment) return assignment.assignmentUid;
    if (editingKey.value) return editingKey.value;
    return null;
}

async function load(): Promise<void> {
    if (!activeMission.value) {
        assessments.value = {};
        contentHash.value = undefined;
        return;
    }
    loading.value = true;
    statusError.value = false;
    try {
        await loadForMission(activeMission.value);
        const loaded = await loadRiskAssessmentsFromMission(activeMission.value);
        assessments.value = loaded.assessments;
        contentHash.value = loaded.contentHash;
    } catch (err) {
        statusError.value = true;
        statusMessage.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

watch(activeMission, load, { immediate: true });

/** Pre-fill the tactic description when an already-assessed assignment is selected. */
watch(tacticChoice, (choice) => {
    editingKey.value = '';
    editingRespondentId.value = '';
    if (choice === '__new__' || !choice) return;
    const assignment = assignments.value.find((a) => a.id === choice);
    const existing = assignment ? assessments.value[assignment.assignmentUid] : undefined;
    if (existing) description.value = existing.description;
});

function selectTacticByKey(key: string): boolean {
    const entry = assessments.value[key];
    if (!entry) return false;

    if (entry.tacticAssignmentId
        && assignments.value.some((a) => a.id === entry.tacticAssignmentId)) {
        tacticChoice.value = entry.tacticAssignmentId;
    } else {
        tacticChoice.value = '__new__';
        newTacticLabel.value = entry.tacticLabel;
        editingKey.value = key;
    }
    description.value = entry.description;
    return true;
}

function onAddRespondent(key: string): void {
    if (!selectTacticByKey(key)) return;
    clearRespondentFields();
    statusMessage.value = '';
}

function onEdit(key: string, respondentId: string): void {
    const entry = assessments.value[key];
    const resp = entry?.respondents.find((r) => r.id === respondentId);
    if (!resp || !selectTacticByKey(key)) return;

    respondentName.value = resp.name;
    repetition.value = resp.repetition;
    confidence.value = resp.confidence;
    experience.value = resp.experience;
    editingRespondentId.value = respondentId;
    statusMessage.value = '';
}

async function persist(next: ComplacencyRiskMap, successMessage: string): Promise<void> {
    if (!activeMission.value) return;
    saving.value = true;
    statusError.value = false;
    statusMessage.value = 'Saving…';
    try {
        contentHash.value = await saveRiskAssessmentsToMission(
            activeMission.value,
            next,
            contentHash.value,
        );
        assessments.value = next;
        statusMessage.value = successMessage;
    } catch (err) {
        statusError.value = true;
        statusMessage.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

async function onSave(): Promise<void> {
    if (!requireActiveMission() || !result.value || !canSave.value) return;

    const assignment = selectedAssignment.value;
    const key = keyForCurrentTactic() ?? newTacticKey();
    const existing = assessments.value[key];
    const name = respondentName.value.trim();

    const respondent: ComplacencyRiskRespondent = {
        id: editingRespondentId.value || crypto.randomUUID(),
        name,
        repetition: repetition.value,
        confidence: confidence.value,
        experience: experience.value,
        score: result.value.score,
        level: result.value.label,
        recommendation: result.value.recommendation,
        band: result.value.band,
        assessedAt: new Date().toISOString(),
    };

    // Upsert: match the row being edited, else an existing respondent with the same name.
    const respondents = [...(existing?.respondents ?? [])];
    const idx = respondents.findIndex((r) => (
        editingRespondentId.value
            ? r.id === editingRespondentId.value
            : r.name.toLowerCase() === name.toLowerCase()
    ));
    if (idx >= 0) {
        respondent.id = respondents[idx].id;
        respondents[idx] = respondent;
    } else {
        respondents.push(respondent);
    }

    const entry: ComplacencyRiskEntry = {
        assignmentUid: assignment?.assignmentUid ?? existing?.assignmentUid ?? '',
        tacticAssignmentId: assignment?.id ?? existing?.tacticAssignmentId ?? '',
        tacticLabel: tacticLabel.value,
        description: description.value.trim(),
        respondents,
    };

    await persist(
        { ...assessments.value, [key]: entry },
        `Saved ${name}'s assessment of "${entry.tacticLabel}" (${respondent.level}).`,
    );
    if (!statusError.value) {
        editingKey.value = key.startsWith('tactic:') ? key : '';
        clearRespondentFields();
    }
}

async function onDeleteRespondent(key: string, respondentId: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;

    const respondents = entry.respondents.filter((r) => r.id !== respondentId);
    const removed = entry.respondents.find((r) => r.id === respondentId);
    const next = { ...assessments.value };
    if (respondents.length) {
        next[key] = { ...entry, respondents };
    } else {
        delete next[key];
    }
    await persist(
        next,
        `Deleted ${removed?.name || 'respondent'}'s assessment of "${entry.tacticLabel}".`,
    );
}

async function onDeleteTactic(key: string): Promise<void> {
    if (!requireActiveMission()) return;
    const next = { ...assessments.value };
    const label = next[key]?.tacticLabel || 'tactic';
    delete next[key];
    await persist(next, `Deleted all risk assessments for "${label}".`);
}
</script>
