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
                    (Craig E. Geis, California Training Institute). Assess each tactic
                    before deploying resources.
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

                <div class='mb-3'>
                    <label class='form-label small mb-1'>Description</label>
                    <textarea
                        v-model='description'
                        class='form-control form-control-sm'
                        rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
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
                        {{ saving ? 'Saving…' : (editingKey ? 'Update assessment' : 'Save assessment') }}
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
                    v-else-if='!savedRows.length'
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
                                <th>Tactic</th>
                                <th style='width: 70px;'>
                                    Risk
                                </th>
                                <th>Level</th>
                                <th class='d-none d-md-table-cell'>
                                    R &times; C &times; E
                                </th>
                                <th style='width: 110px;' />
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='row in savedRows'
                                :key='row.key'
                            >
                                <td>
                                    <div>{{ row.assessment.tacticLabel || '(untitled tactic)' }}</div>
                                    <div
                                        v-if='row.assessment.description'
                                        class='text-muted small'
                                    >
                                        {{ row.assessment.description }}
                                    </div>
                                </td>
                                <td class='fw-bold'>
                                    {{ row.assessment.score }}
                                </td>
                                <td>
                                    <span
                                        class='badge'
                                        :class='bandBadgeClass(row.assessment.band)'
                                    >{{ row.assessment.level }}</span>
                                    <div class='text-muted small'>
                                        {{ row.assessment.recommendation }}
                                    </div>
                                </td>
                                <td class='d-none d-md-table-cell text-muted small'>
                                    {{ row.assessment.repetition }} &times; {{ row.assessment.confidence }} &times; {{ row.assessment.experience }}
                                </td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-outline-secondary btn-sm me-1'
                                        :disabled='busy'
                                        @click='onEdit(row.key)'
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        @click='onDelete(row.key)'
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
    type ComplacencyRiskAssessment,
    type ComplacencyRiskMap,
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
const repetition = ref(0);
const confidence = ref(0);
const experience = ref(0);
/** Set when editing an existing entry keyed by `tactic:<uuid>` (no assignment uid). */
const editingKey = ref('');

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
    return tacticChoice.value !== '';
});

const savedRows = computed(() => Object.entries(assessments.value)
    .map(([key, assessment]) => ({ key, assessment }))
    .sort((a, b) => a.assessment.tacticLabel.localeCompare(b.assessment.tacticLabel)));

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
    repetition.value = 0;
    confidence.value = 0;
    experience.value = 0;
    editingKey.value = '';
    statusMessage.value = '';
}

function loadIntoForm(assessment: ComplacencyRiskAssessment): void {
    description.value = assessment.description;
    repetition.value = assessment.repetition;
    confidence.value = assessment.confidence;
    experience.value = assessment.experience;
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

/** Pre-load the saved assessment when an already-assessed assignment is selected. */
watch(tacticChoice, (choice) => {
    editingKey.value = '';
    if (choice === '__new__' || !choice) return;
    const assignment = assignments.value.find((a) => a.id === choice);
    const existing = assignment ? assessments.value[assignment.assignmentUid] : undefined;
    if (existing) loadIntoForm(existing);
});

function onEdit(key: string): void {
    const assessment = assessments.value[key];
    if (!assessment) return;

    if (assessment.tacticAssignmentId
        && assignments.value.some((a) => a.id === assessment.tacticAssignmentId)) {
        tacticChoice.value = assessment.tacticAssignmentId;
    } else {
        tacticChoice.value = '__new__';
        newTacticLabel.value = assessment.tacticLabel;
        editingKey.value = key;
    }
    loadIntoForm(assessment);
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
    const key = assignment?.assignmentUid || editingKey.value || newTacticKey();

    const assessment: ComplacencyRiskAssessment = {
        assignmentUid: assignment?.assignmentUid ?? '',
        tacticAssignmentId: assignment?.id ?? '',
        tacticLabel: tacticLabel.value,
        description: description.value.trim(),
        repetition: repetition.value,
        confidence: confidence.value,
        experience: experience.value,
        score: result.value.score,
        level: result.value.label,
        recommendation: result.value.recommendation,
        band: result.value.band,
        assessedAt: new Date().toISOString(),
    };

    await persist(
        { ...assessments.value, [key]: assessment },
        `Saved risk assessment for "${assessment.tacticLabel}" (${assessment.level}).`,
    );
    if (!statusError.value) resetFormKeepStatus();
}

function resetFormKeepStatus(): void {
    const msg = statusMessage.value;
    resetForm();
    statusMessage.value = msg;
}

async function onDelete(key: string): Promise<void> {
    if (!requireActiveMission()) return;
    const next = { ...assessments.value };
    const label = next[key]?.tacticLabel || 'assessment';
    delete next[key];
    await persist(next, `Deleted risk assessment for "${label}".`);
}
</script>
