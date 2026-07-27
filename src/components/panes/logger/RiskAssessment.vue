<template>
    <div>
        <!-- GAR Model -->
        <div class='card mb-3'>
            <div class='card-header'>
                <h3 class='card-title mb-0'>
                    GAR Model
                </h3>
            </div>
            <div class='card-body'>
                <p class='text-muted small mb-3'>
                    Operational Risk Management (GREEN-AMBER-RED). Rate each element
                    0 (no risk) through 10 (maximum risk). Any category rated ≥ 5 should
                    receive specific mitigation.
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
                            v-model='gar.tacticChoice'
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
                        v-if='gar.tacticChoice === "__new__"'
                        class='col-md-6'
                    >
                        <label class='form-label small mb-1'>New Tactic</label>
                        <input
                            v-model='gar.newTacticLabel'
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
                        v-model='gar.description'
                        class='form-control form-control-sm'
                        rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
                </div>

                <div class='mb-3'>
                    <label class='form-label small mb-1'>Respondent</label>
                    <input
                        v-model='gar.respondentName'
                        type='text'
                        class='form-control form-control-sm'
                        placeholder='Name or callsign of the person assessing'
                        :disabled='busy'
                    >
                </div>

                <div
                    v-for='factor in GAR_FACTORS'
                    :key='factor.key'
                    class='mb-2'
                >
                    <div class='row g-2 align-items-start'>
                        <div class='col-md-8'>
                            <label class='form-label small mb-0'>{{ factor.label }}</label>
                            <div
                                class='text-muted'
                                style='font-size: 0.7rem;'
                            >
                                {{ factor.help }}
                            </div>
                        </div>
                        <div class='col-md-4'>
                            <select
                                v-model.number='gar.factors[factor.key]'
                                class='form-select form-select-sm'
                                :disabled='busy'
                            >
                                <option
                                    v-for='n in GAR_SCORE_OPTIONS'
                                    :key='n'
                                    :value='n'
                                >
                                    {{ n }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div
                        v-if='gar.factors[factor.key] >= 5'
                        class='mt-1'
                    >
                        <label class='form-label small mb-1 text-warning'>
                            Mitigation for {{ factor.label }} (recommended)
                        </label>
                        <textarea
                            v-model='gar.mitigations[factor.key]'
                            class='form-control form-control-sm'
                            rows='2'
                            placeholder='Specific mitigation for this category…'
                            :disabled='busy'
                        />
                    </div>
                </div>

                <div
                    v-if='garResult'
                    class='border rounded p-2 mb-3 mt-3'
                >
                    <div class='d-flex align-items-center gap-2 mb-2'>
                        <span class='fw-bold fs-3'>{{ garResult.score }}</span>
                        <span
                            class='badge'
                            :class='bandBadgeClass(garResult.band)'
                        >{{ garResult.label }}</span>
                        <span class='small'>{{ garResult.recommendation }}</span>
                    </div>
                    <div
                        class='progress'
                        style='height: 8px;'
                    >
                        <div
                            class='progress-bar'
                            :class='bandBarClass(garResult.band)'
                            :style='{ width: `${(garResult.score / 80) * 100}%` }'
                        />
                    </div>
                    <div
                        class='d-flex justify-content-between text-muted mt-1'
                        style='font-size: 0.7rem;'
                    >
                        <span>1–35 Green (Low)</span>
                        <span>36–60 Amber (Caution)</span>
                        <span>61–80 Red (High)</span>
                    </div>
                </div>

                <div class='d-flex align-items-center gap-2'>
                    <button
                        type='button'
                        class='btn btn-primary btn-sm'
                        :disabled='!garCanSave || busy'
                        @click='onGarSaveClick'
                    >
                        {{ saving ? 'Saving…' : (gar.editingRespondentId ? 'Update assessment' : 'Save assessment') }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='resetGarForm'
                    >
                        Clear
                    </button>
                </div>

                <div
                    v-if='garStatusMessage'
                    class='fw-bold small mt-2'
                    :class='garStatusError ? "text-danger" : "text-success"'
                >
                    {{ garStatusMessage }}
                </div>
            </div>
        </div>

        <div class='card mb-4'>
            <div class='card-header py-2 small fw-semibold'>
                GAR saved assessments
            </div>
            <div class='card-body p-0'>
                <div
                    v-if='loading'
                    class='p-3 text-muted small'
                >
                    Loading…
                </div>
                <div
                    v-else-if='!garSavedGroups.length'
                    class='p-3 text-muted small'
                >
                    No GAR assessments saved yet.
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
                                    Mitigations
                                </th>
                                <th style='width: 120px;' />
                            </tr>
                        </thead>
                        <tbody
                            v-for='group in garSavedGroups'
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
                                    {{ group.entry.garRespondents.length }}
                                    respondent{{ group.entry.garRespondents.length === 1 ? '' : 's' }}
                                </td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-outline-primary btn-sm me-1'
                                        :disabled='busy'
                                        title='Add a GAR respondent for this tactic'
                                        @click='onGarAddRespondent(group.key)'
                                    >
                                        + Respondent
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        title='Remove all GAR assessments for this tactic'
                                        @click='onGarDeleteAll(group.key)'
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                            <tr
                                v-for='resp in group.entry.garRespondents'
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
                                    {{ formatGarMitigations(resp) }}
                                </td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-outline-secondary btn-sm me-1'
                                        :disabled='busy'
                                        @click='onGarEdit(group.key, resp.id)'
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        @click='onGarDeleteRespondent(group.key, resp.id)'
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

        <!-- Complacency Model -->
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

                <div class='row g-2 mb-2'>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Tactic</label>
                        <select
                            v-model='comp.tacticChoice'
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
                        v-if='comp.tacticChoice === "__new__"'
                        class='col-md-6'
                    >
                        <label class='form-label small mb-1'>New Tactic</label>
                        <input
                            v-model='comp.newTacticLabel'
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
                        v-model='comp.description'
                        class='form-control form-control-sm'
                        rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
                </div>

                <div class='mb-3'>
                    <label class='form-label small mb-1'>Respondent</label>
                    <input
                        v-model='comp.respondentName'
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
                            v-model.number='comp.repetition'
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
                            v-model.number='comp.confidence'
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
                            v-model.number='comp.experience'
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
                    v-if='compResult'
                    class='border rounded p-2 mb-3'
                >
                    <div class='d-flex align-items-center gap-2 mb-2'>
                        <span class='fw-bold fs-3'>{{ compResult.score }}</span>
                        <span
                            class='badge'
                            :class='bandBadgeClass(compResult.band)'
                        >{{ compResult.label }}</span>
                        <span class='small'>{{ compResult.recommendation }}</span>
                    </div>
                    <div
                        class='progress'
                        style='height: 8px;'
                    >
                        <div
                            class='progress-bar'
                            :class='bandBarClass(compResult.band)'
                            :style='{ width: `${compResult.score}%` }'
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
                        :disabled='!compCanSave || busy'
                        @click='onCompSave'
                    >
                        {{ saving ? 'Saving…' : (comp.editingRespondentId ? 'Update assessment' : 'Save assessment') }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='resetCompForm'
                    >
                        Clear
                    </button>
                </div>

                <div
                    v-if='compStatusMessage'
                    class='fw-bold small mt-2'
                    :class='compStatusError ? "text-danger" : "text-success"'
                >
                    {{ compStatusMessage }}
                </div>
            </div>
        </div>

        <div class='card'>
            <div class='card-header py-2 small fw-semibold'>
                Complacency saved assessments
            </div>
            <div class='card-body p-0'>
                <div
                    v-if='loading'
                    class='p-3 text-muted small'
                >
                    Loading…
                </div>
                <div
                    v-else-if='!compSavedGroups.length'
                    class='p-3 text-muted small'
                >
                    No complacency assessments saved yet.
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
                            v-for='group in compSavedGroups'
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
                                    {{ group.entry.complacencyRespondents.length }}
                                    respondent{{ group.entry.complacencyRespondents.length === 1 ? '' : 's' }}
                                </td>
                                <td class='text-end'>
                                    <button
                                        type='button'
                                        class='btn btn-outline-primary btn-sm me-1'
                                        :disabled='busy'
                                        title='Add a complacency respondent for this tactic'
                                        @click='onCompAddRespondent(group.key)'
                                    >
                                        + Respondent
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        title='Remove all complacency assessments for this tactic'
                                        @click='onCompDeleteAll(group.key)'
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                            <tr
                                v-for='resp in group.entry.complacencyRespondents'
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
                                        @click='onCompEdit(group.key, resp.id)'
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-danger btn-sm'
                                        :disabled='busy'
                                        @click='onCompDeleteRespondent(group.key, resp.id)'
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

        <div
            v-if='showMitigationModal'
            class='modal modal-blur show d-block'
            tabindex='-1'
            role='dialog'
        >
            <div
                class='modal-dialog modal-dialog-centered'
                role='document'
            >
                <div class='modal-content'>
                    <div class='modal-header'>
                        <h5 class='modal-title'>
                            Mitigations recommended
                        </h5>
                        <button
                            type='button'
                            class='btn-close'
                            aria-label='Close'
                            @click='closeMitigationModal'
                        />
                    </div>
                    <div class='modal-body'>
                        <p class='mb-2'>
                            Categories rated 5 or higher should receive specific mitigation.
                            The following are still blank:
                        </p>
                        <ul class='mb-3'>
                            <li
                                v-for='key in pendingMitigationKeys'
                                :key='key'
                            >
                                {{ garFactorLabel(key) }}
                            </li>
                        </ul>
                        <p class='text-muted small mb-0'>
                            You should go back and add mitigations. Saving without them
                            acknowledges that you are dismissing this recommendation.
                        </p>
                    </div>
                    <div class='modal-footer'>
                        <button
                            type='button'
                            class='btn btn-secondary'
                            @click='closeMitigationModal'
                        >
                            Go back
                        </button>
                        <button
                            type='button'
                            class='btn btn-warning'
                            :disabled='busy'
                            @click='confirmSaveWithoutMitigations'
                        >
                            Save without mitigations
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if='showMitigationModal'
            class='modal-backdrop fade show'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, reactive, ref, watch } from 'vue';
import { useIncident } from '../../../composables/useIncident.ts';
import { useWorkAssignments } from '../../../composables/useWorkAssignments.ts';
import {
    CONFIDENCE_OPTIONS,
    EXPERIENCE_OPTIONS,
    GAR_FACTORS,
    GAR_SCORE_OPTIONS,
    REPETITION_OPTIONS,
    entryHasRespondents,
    factorsNeedingMitigation,
    garFactorLabel,
    garLevelForScore,
    garScoreFromFactors,
    newTacticKey,
    riskLevelForScore,
    worstComplacencyRespondent,
    worstGarRespondent,
    type ComplacencyRiskRespondent,
    type GarFactorKey,
    type GarMitigations,
    type GarRiskRespondent,
    type RiskBand,
    type TacticRiskEntry,
    type TacticRiskMap,
} from '../../../lib/tacticRisk.ts';
import {
    loadTacticAssessmentsFromMission,
    saveTacticAssessmentsToMission,
} from '../../../lib/tacticRiskPersistence.ts';

const { activeMission, requireActiveMission } = useIncident();
const { assignments, loadForMission } = useWorkAssignments();

const assessments = ref<TacticRiskMap>({});
const contentHash = ref<string | undefined>();
const loading = ref(false);
const saving = ref(false);

const garStatusMessage = ref('');
const garStatusError = ref(false);
const compStatusMessage = ref('');
const compStatusError = ref(false);

const showMitigationModal = ref(false);
const pendingMitigationKeys = ref<GarFactorKey[]>([]);

function blankGarFactors(): Record<GarFactorKey, number> {
    return {
        supervision: 0,
        planning: 0,
        contingencyResources: 0,
        communication: 0,
        teamSelection: 0,
        teamFitness: 0,
        environment: 0,
        taskComplexity: 0,
    };
}

function blankGarMitigations(): GarMitigations {
    return {};
}

const gar = reactive({
    tacticChoice: '',
    newTacticLabel: '',
    description: '',
    respondentName: '',
    factors: blankGarFactors(),
    mitigations: blankGarMitigations() as GarMitigations,
    editingKey: '',
    editingRespondentId: '',
});

const comp = reactive({
    tacticChoice: '',
    newTacticLabel: '',
    description: '',
    respondentName: '',
    repetition: 0,
    confidence: 0,
    experience: 0,
    editingKey: '',
    editingRespondentId: '',
});

const busy = computed(() => loading.value || saving.value);

const assignmentOptions = computed(() => assignments.value.map((a) => ({
    id: a.id,
    label: `#${a.assignmentNumber} — ${a.teamLabel || 'Team'} — ${a.assignmentCallsign || a.assignmentUid}`,
})));

function assignmentForChoice(choice: string) {
    return assignments.value.find((a) => a.id === choice) ?? null;
}

function labelForChoice(choice: string, newLabel: string): string {
    if (choice === '__new__') return newLabel.trim();
    return assignmentOptions.value.find((o) => o.id === choice)?.label ?? '';
}

const garResult = computed(() => {
    const score = garScoreFromFactors(gar.factors);
    const level = garLevelForScore(score);
    return { score, ...level };
});

const garCanSave = computed(() => {
    if (!gar.tacticChoice || !labelForChoice(gar.tacticChoice, gar.newTacticLabel)) return false;
    return !!gar.respondentName.trim();
});

const compResult = computed(() => {
    if (!comp.repetition || !comp.confidence || !comp.experience) return null;
    const score = comp.repetition * comp.confidence * comp.experience;
    const level = riskLevelForScore(score);
    return { score, ...level };
});

const compCanSave = computed(() => {
    if (!compResult.value || !comp.tacticChoice) return false;
    if (!labelForChoice(comp.tacticChoice, comp.newTacticLabel)) return false;
    return !!comp.respondentName.trim();
});

const garSavedGroups = computed(() => Object.entries(assessments.value)
    .filter(([, entry]) => entry.garRespondents.length > 0)
    .map(([key, entry]) => ({ key, entry, worst: worstGarRespondent(entry) }))
    .sort((a, b) => a.entry.tacticLabel.localeCompare(b.entry.tacticLabel)));

const compSavedGroups = computed(() => Object.entries(assessments.value)
    .filter(([, entry]) => entry.complacencyRespondents.length > 0)
    .map(([key, entry]) => ({ key, entry, worst: worstComplacencyRespondent(entry) }))
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

function formatGarMitigations(resp: GarRiskRespondent): string {
    const parts: string[] = [];
    for (const { key, label } of GAR_FACTORS) {
        const text = (resp.mitigations[key] ?? '').trim();
        if (text) parts.push(`${label}: ${text}`);
    }
    return parts.length ? parts.join('; ') : '—';
}

function resetGarForm(): void {
    gar.tacticChoice = '';
    gar.newTacticLabel = '';
    gar.description = '';
    clearGarRespondentFields();
    gar.editingKey = '';
    garStatusMessage.value = '';
}

function clearGarRespondentFields(): void {
    gar.respondentName = '';
    gar.factors = blankGarFactors();
    gar.mitigations = blankGarMitigations();
    gar.editingRespondentId = '';
}

function resetCompForm(): void {
    comp.tacticChoice = '';
    comp.newTacticLabel = '';
    comp.description = '';
    clearCompRespondentFields();
    comp.editingKey = '';
    compStatusMessage.value = '';
}

function clearCompRespondentFields(): void {
    comp.respondentName = '';
    comp.repetition = 0;
    comp.confidence = 0;
    comp.experience = 0;
    comp.editingRespondentId = '';
}

function keyForForm(tacticChoice: string, editingKey: string): string | null {
    const assignment = assignmentForChoice(tacticChoice);
    if (assignment) return assignment.assignmentUid;
    if (editingKey) return editingKey;
    return null;
}

async function load(): Promise<void> {
    if (!activeMission.value) {
        assessments.value = {};
        contentHash.value = undefined;
        return;
    }
    loading.value = true;
    garStatusError.value = false;
    compStatusError.value = false;
    try {
        await loadForMission(activeMission.value);
        const loaded = await loadTacticAssessmentsFromMission(activeMission.value);
        assessments.value = loaded.assessments;
        contentHash.value = loaded.contentHash;
    } catch (err) {
        garStatusError.value = true;
        garStatusMessage.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

watch(activeMission, load, { immediate: true });

watch(() => gar.tacticChoice, (choice) => {
    gar.editingKey = '';
    gar.editingRespondentId = '';
    if (choice === '__new__' || !choice) return;
    const assignment = assignmentForChoice(choice);
    const existing = assignment ? assessments.value[assignment.assignmentUid] : undefined;
    if (existing) gar.description = existing.description;
});

watch(() => comp.tacticChoice, (choice) => {
    comp.editingKey = '';
    comp.editingRespondentId = '';
    if (choice === '__new__' || !choice) return;
    const assignment = assignmentForChoice(choice);
    const existing = assignment ? assessments.value[assignment.assignmentUid] : undefined;
    if (existing) comp.description = existing.description;
});

function selectTacticInto(
    key: string,
    form: typeof gar | typeof comp,
): boolean {
    const entry = assessments.value[key];
    if (!entry) return false;

    if (entry.tacticAssignmentId
        && assignments.value.some((a) => a.id === entry.tacticAssignmentId)) {
        form.tacticChoice = entry.tacticAssignmentId;
    } else {
        form.tacticChoice = '__new__';
        form.newTacticLabel = entry.tacticLabel;
        form.editingKey = key;
    }
    form.description = entry.description;
    return true;
}

function onGarAddRespondent(key: string): void {
    if (!selectTacticInto(key, gar)) return;
    clearGarRespondentFields();
    garStatusMessage.value = '';
}

function onCompAddRespondent(key: string): void {
    if (!selectTacticInto(key, comp)) return;
    clearCompRespondentFields();
    compStatusMessage.value = '';
}

function onGarEdit(key: string, respondentId: string): void {
    const entry = assessments.value[key];
    const resp = entry?.garRespondents.find((r) => r.id === respondentId);
    if (!resp || !selectTacticInto(key, gar)) return;

    gar.respondentName = resp.name;
    gar.factors = {
        supervision: resp.supervision,
        planning: resp.planning,
        contingencyResources: resp.contingencyResources,
        communication: resp.communication,
        teamSelection: resp.teamSelection,
        teamFitness: resp.teamFitness,
        environment: resp.environment,
        taskComplexity: resp.taskComplexity,
    };
    gar.mitigations = { ...resp.mitigations };
    gar.editingRespondentId = respondentId;
    garStatusMessage.value = '';
}

function onCompEdit(key: string, respondentId: string): void {
    const entry = assessments.value[key];
    const resp = entry?.complacencyRespondents.find((r) => r.id === respondentId);
    if (!resp || !selectTacticInto(key, comp)) return;

    comp.respondentName = resp.name;
    comp.repetition = resp.repetition;
    comp.confidence = resp.confidence;
    comp.experience = resp.experience;
    comp.editingRespondentId = respondentId;
    compStatusMessage.value = '';
}

async function persist(
    next: TacticRiskMap,
    successMessage: string,
    which: 'gar' | 'comp',
): Promise<void> {
    if (!activeMission.value) return;
    saving.value = true;
    if (which === 'gar') {
        garStatusError.value = false;
        garStatusMessage.value = 'Saving…';
    } else {
        compStatusError.value = false;
        compStatusMessage.value = 'Saving…';
    }
    try {
        contentHash.value = await saveTacticAssessmentsToMission(
            activeMission.value,
            next,
            contentHash.value,
        );
        assessments.value = next;
        if (which === 'gar') garStatusMessage.value = successMessage;
        else compStatusMessage.value = successMessage;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (which === 'gar') {
            garStatusError.value = true;
            garStatusMessage.value = msg;
        } else {
            compStatusError.value = true;
            compStatusMessage.value = msg;
        }
    } finally {
        saving.value = false;
    }
}

function upsertEntryMeta(
    tacticChoice: string,
    newTacticLabel: string,
    description: string,
    existing: TacticRiskEntry | undefined,
): TacticRiskEntry {
    const assignment = assignmentForChoice(tacticChoice);
    return {
        assignmentUid: assignment?.assignmentUid ?? existing?.assignmentUid ?? '',
        tacticAssignmentId: assignment?.id ?? existing?.tacticAssignmentId ?? '',
        tacticLabel: labelForChoice(tacticChoice, newTacticLabel),
        description: description.trim(),
        complacencyRespondents: existing?.complacencyRespondents ?? [],
        garRespondents: existing?.garRespondents ?? [],
    };
}

function buildGarRespondent(): GarRiskRespondent {
    const factors = { ...gar.factors };
    const mitigations: GarMitigations = {};
    for (const { key } of GAR_FACTORS) {
        const text = (gar.mitigations[key] ?? '').trim();
        if (text) mitigations[key] = text;
    }
    const score = garScoreFromFactors(factors);
    const level = garLevelForScore(score);
    return {
        id: gar.editingRespondentId || crypto.randomUUID(),
        name: gar.respondentName.trim(),
        ...factors,
        mitigations,
        score,
        level: level.label,
        recommendation: level.recommendation,
        band: level.band,
        assessedAt: new Date().toISOString(),
    };
}

function onGarSaveClick(): void {
    if (!requireActiveMission() || !garCanSave.value) return;
    const draft = buildGarRespondent();
    const needed = factorsNeedingMitigation(draft);
    if (needed.length) {
        pendingMitigationKeys.value = needed;
        showMitigationModal.value = true;
        return;
    }
    void saveGarAssessment();
}

function closeMitigationModal(): void {
    showMitigationModal.value = false;
    pendingMitigationKeys.value = [];
}

function confirmSaveWithoutMitigations(): void {
    closeMitigationModal();
    void saveGarAssessment();
}

async function saveGarAssessment(): Promise<void> {
    if (!requireActiveMission() || !garCanSave.value) return;

    const key = keyForForm(gar.tacticChoice, gar.editingKey) ?? newTacticKey();
    const existing = assessments.value[key];
    const entry = upsertEntryMeta(
        gar.tacticChoice,
        gar.newTacticLabel,
        gar.description,
        existing,
    );
    const respondent = buildGarRespondent();
    const name = respondent.name;

    const respondents = [...entry.garRespondents];
    const idx = respondents.findIndex((r) => (
        gar.editingRespondentId
            ? r.id === gar.editingRespondentId
            : r.name.toLowerCase() === name.toLowerCase()
    ));
    if (idx >= 0) {
        respondent.id = respondents[idx].id;
        respondents[idx] = respondent;
    } else {
        respondents.push(respondent);
    }
    entry.garRespondents = respondents;

    await persist(
        { ...assessments.value, [key]: entry },
        `Saved ${name}'s GAR assessment of "${entry.tacticLabel}" (${respondent.level}).`,
        'gar',
    );
    if (!garStatusError.value) {
        gar.editingKey = key.startsWith('tactic:') ? key : '';
        clearGarRespondentFields();
    }
}

async function onCompSave(): Promise<void> {
    if (!requireActiveMission() || !compResult.value || !compCanSave.value) return;

    const key = keyForForm(comp.tacticChoice, comp.editingKey) ?? newTacticKey();
    const existing = assessments.value[key];
    const entry = upsertEntryMeta(
        comp.tacticChoice,
        comp.newTacticLabel,
        comp.description,
        existing,
    );
    const name = comp.respondentName.trim();

    const respondent: ComplacencyRiskRespondent = {
        id: comp.editingRespondentId || crypto.randomUUID(),
        name,
        repetition: comp.repetition,
        confidence: comp.confidence,
        experience: comp.experience,
        score: compResult.value.score,
        level: compResult.value.label,
        recommendation: compResult.value.recommendation,
        band: compResult.value.band,
        assessedAt: new Date().toISOString(),
    };

    const respondents = [...entry.complacencyRespondents];
    const idx = respondents.findIndex((r) => (
        comp.editingRespondentId
            ? r.id === comp.editingRespondentId
            : r.name.toLowerCase() === name.toLowerCase()
    ));
    if (idx >= 0) {
        respondent.id = respondents[idx].id;
        respondents[idx] = respondent;
    } else {
        respondents.push(respondent);
    }
    entry.complacencyRespondents = respondents;

    await persist(
        { ...assessments.value, [key]: entry },
        `Saved ${name}'s complacency assessment of "${entry.tacticLabel}" (${respondent.level}).`,
        'comp',
    );
    if (!compStatusError.value) {
        comp.editingKey = key.startsWith('tactic:') ? key : '';
        clearCompRespondentFields();
    }
}

function removeOrUpdateEntry(
    key: string,
    patch: Partial<TacticRiskEntry>,
): TacticRiskMap {
    const next = { ...assessments.value };
    const current = next[key];
    if (!current) return next;
    const updated: TacticRiskEntry = { ...current, ...patch };
    if (!entryHasRespondents(updated)) {
        delete next[key];
    } else {
        next[key] = updated;
    }
    return next;
}

async function onGarDeleteRespondent(key: string, respondentId: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;
    const removed = entry.garRespondents.find((r) => r.id === respondentId);
    const garRespondents = entry.garRespondents.filter((r) => r.id !== respondentId);
    await persist(
        removeOrUpdateEntry(key, { garRespondents }),
        `Deleted ${removed?.name || 'respondent'}'s GAR assessment of "${entry.tacticLabel}".`,
        'gar',
    );
}

async function onCompDeleteRespondent(key: string, respondentId: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;
    const removed = entry.complacencyRespondents.find((r) => r.id === respondentId);
    const complacencyRespondents = entry.complacencyRespondents.filter((r) => r.id !== respondentId);
    await persist(
        removeOrUpdateEntry(key, { complacencyRespondents }),
        `Deleted ${removed?.name || 'respondent'}'s complacency assessment of "${entry.tacticLabel}".`,
        'comp',
    );
}

async function onGarDeleteAll(key: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;
    await persist(
        removeOrUpdateEntry(key, { garRespondents: [] }),
        `Deleted all GAR assessments for "${entry.tacticLabel}".`,
        'gar',
    );
}

async function onCompDeleteAll(key: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;
    await persist(
        removeOrUpdateEntry(key, { complacencyRespondents: [] }),
        `Deleted all complacency assessments for "${entry.tacticLabel}".`,
        'comp',
    );
}
</script>
