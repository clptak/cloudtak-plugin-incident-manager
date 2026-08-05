<template>
    <div>
        <!-- Combined saved assessments -->
        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Saved Assessments
                </p>
            </template>

            <div
                v-if='loading'
                class='text-muted small'
            >
                Loading…
            </div>
            <div
                v-else-if='!savedGroups.length'
                class='text-muted small'
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
                            <th style='width: 110px;'>
                                Model
                            </th>
                            <th>Respondent</th>
                            <th style='width: 70px;'>
                                Risk
                            </th>
                            <th>Level</th>
                            <th class='d-none d-md-table-cell'>
                                Detail
                            </th>
                            <th style='width: 220px;' />
                        </tr>
                    </thead>
                    <tbody
                        v-for='group in savedGroups'
                        :key='group.key'
                    >
                        <tr class='bg-body-secondary'>
                            <td colspan='4'>
                                <div class='fw-semibold'>
                                    {{ group.entry.tacticLabel || '(untitled tactic)' }}
                                    <span
                                        v-if='group.worstGar'
                                        class='badge ms-2'
                                        :class='bandBadgeClass(group.worstGar.band)'
                                    >GAR worst: {{ group.worstGar.score }} — {{ group.worstGar.level }}</span>
                                    <span
                                        v-if='group.worstComp'
                                        class='badge ms-2'
                                        :class='bandBadgeClass(group.worstComp.band)'
                                    >Comp worst: {{ group.worstComp.score }} — {{ group.worstComp.level }}</span>
                                    <span
                                        v-if='group.worstSpe'
                                        class='badge ms-2'
                                        :class='bandBadgeClass(group.worstSpe.band)'
                                    >SPE worst: {{ group.worstSpe.score }} — {{ group.worstSpe.level }}</span>
                                </div>
                                <div
                                    v-if='group.entry.description'
                                    class='text-muted small'
                                >
                                    {{ group.entry.description }}
                                </div>
                            </td>
                            <td class='d-none d-md-table-cell text-muted small'>
                                {{ group.respondentCount }}
                                respondent{{ group.respondentCount === 1 ? '' : 's' }}
                            </td>
                            <td class='text-end text-nowrap'>
                                <button
                                    type='button'
                                    class='btn btn-outline-primary btn-sm me-1'
                                    :disabled='busy'
                                    title='Add a GAR respondent for this tactic'
                                    @click='onGarAddRespondent(group.key)'
                                >
                                    + GAR
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-primary btn-sm me-1'
                                    :disabled='busy'
                                    title='Add a complacency respondent for this tactic'
                                    @click='onCompAddRespondent(group.key)'
                                >
                                    + Comp
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-primary btn-sm me-1'
                                    :disabled='busy'
                                    title='Add an SPE respondent for this tactic'
                                    @click='onSpeAddRespondent(group.key)'
                                >
                                    + SPE
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-danger btn-sm'
                                    :disabled='busy'
                                    title='Remove all assessments for this tactic'
                                    @click='onDeleteAll(group.key)'
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                        <tr
                            v-for='resp in group.entry.garRespondents'
                            :key='`gar-${resp.id}`'
                        >
                            <td>
                                <span class='badge bg-secondary-lt text-secondary'>GAR</span>
                            </td>
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
                        <tr
                            v-for='resp in group.entry.complacencyRespondents'
                            :key='`comp-${resp.id}`'
                        >
                            <td>
                                <span class='badge bg-secondary-lt text-secondary'>Complacency</span>
                            </td>
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
                        <tr
                            v-for='resp in group.entry.speRespondents'
                            :key='`spe-${resp.id}`'
                        >
                            <td>
                                <span class='badge bg-secondary-lt text-secondary'>SPE</span>
                            </td>
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
                                {{ resp.severity }} &times; {{ resp.probability }} &times; {{ resp.exposure }}
                            </td>
                            <td class='text-end'>
                                <button
                                    type='button'
                                    class='btn btn-outline-secondary btn-sm me-1'
                                    :disabled='busy'
                                    @click='onSpeEdit(group.key, resp.id)'
                                >
                                    Edit
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-danger btn-sm'
                                    :disabled='busy'
                                    @click='onSpeDeleteRespondent(group.key, resp.id)'
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </TablerBorder>

        <!-- GAR Model -->
        <div
            v-if='!garExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='garExpanded = true'
            @keydown.enter.prevent='garExpanded = true'
            @keydown.space.prevent='garExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                GAR Model
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='garExpanded = false'
                    @keydown.enter.prevent='garExpanded = false'
                    @keydown.space.prevent='garExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        GAR Model
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <p class='text-muted small mb-3'>
                    Operational Risk Management (GREEN-AMBER-RED). Rate each element
                    0 (no risk) through 10 (maximum risk). Any category rated ≥ 5 should
                    receive specific mitigation.
                </p>

                <TablerInlineAlert
                    v-if='!activeMission'
                    class='mb-3'
                    severity='info'
                    title='No Active Mission'
                    description='Select a mission in Create | Open before saving assessments.'
                />

                <div class='row g-2 mb-2'>
                    <div class='col-md-6'>
                        <TablerEnum
                            v-model='garTacticLabel'
                            label='Tactic'
                            :options='tacticOptions'
                            :disabled='busy'
                        />
                    </div>
                    <div
                        v-if='gar.tacticChoice === "__new__"'
                        class='col-md-6'
                    >
                        <TablerInput
                            v-model='gar.newTacticLabel'
                            label='New Tactic'
                            placeholder='e.g. Hasty search of likely routes from PLS'
                            :disabled='busy'
                        />
                    </div>
                </div>

                <div class='mb-2'>
                    <TablerInput
                        v-model='gar.description'
                        label='Description'
                        :rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
                </div>

                <div class='mb-3'>
                    <TablerInput
                        v-model='gar.respondentName'
                        label='Respondent'
                        placeholder='Name or callsign of the person assessing'
                        :disabled='busy'
                    />
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
                            <TablerEnum
                                :model-value='String(gar.factors[factor.key])'
                                :options='garScoreOptionStrings'
                                :disabled='busy'
                                @update:model-value='(v: string) => onGarFactorChange(factor.key, v)'
                            />
                        </div>
                    </div>
                    <div
                        v-if='gar.factors[factor.key] >= 5'
                        class='mt-1'
                    >
                        <p class='text-warning small mb-1'>
                            Mitigation for {{ factor.label }} (recommended)
                        </p>
                        <TablerInput
                            v-model='gar.mitigations[factor.key]'
                            :rows='2'
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

                <TablerInlineAlert
                    v-if='garStatusMessage'
                    class='mt-2'
                    :severity='garStatusError ? "danger" : "success"'
                    :title='garStatusError ? "Error" : "Status"'
                    :description='garStatusMessage'
                />
            </div>
        </TablerBorder>

        <!-- Complacency Model -->
        <div
            v-if='!compExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='compExpanded = true'
            @keydown.enter.prevent='compExpanded = true'
            @keydown.space.prevent='compExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Complacency Model
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='compExpanded = false'
                    @keydown.enter.prevent='compExpanded = false'
                    @keydown.space.prevent='compExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Complacency Model
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <p class='text-muted small mb-3'>
                    Risk = Repetition &times; Confidence &times; Experience
                    (Craig E. Geis, California Training Institute). Each respondent
                    assesses the tactic for themselves before deploying.
                </p>

                <div class='row g-2 mb-2'>
                    <div class='col-md-6'>
                        <TablerEnum
                            v-model='compTacticLabel'
                            label='Tactic'
                            :options='tacticOptions'
                            :disabled='busy'
                        />
                    </div>
                    <div
                        v-if='comp.tacticChoice === "__new__"'
                        class='col-md-6'
                    >
                        <TablerInput
                            v-model='comp.newTacticLabel'
                            label='New Tactic'
                            placeholder='e.g. Hasty search of likely routes from PLS'
                            :disabled='busy'
                        />
                    </div>
                </div>

                <div class='mb-2'>
                    <TablerInput
                        v-model='comp.description'
                        label='Description'
                        :rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
                </div>

                <div class='mb-3'>
                    <TablerInput
                        v-model='comp.respondentName'
                        label='Respondent'
                        placeholder='Name or callsign of the person assessing'
                        :disabled='busy'
                    />
                </div>

                <div class='row g-2 mb-3'>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='compRepetitionLabel'
                            label='Repetition'
                            :options='repetitionOptionLabels'
                            :disabled='busy'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='compConfidenceLabel'
                            label='Confidence'
                            :options='confidenceOptionLabels'
                            :disabled='busy'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='compExperienceLabel'
                            label='Experience'
                            :options='experienceOptionLabels'
                            :disabled='busy'
                        />
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

                <TablerInlineAlert
                    v-if='compStatusMessage'
                    class='mt-2'
                    :severity='compStatusError ? "danger" : "success"'
                    :title='compStatusError ? "Error" : "Status"'
                    :description='compStatusMessage'
                />
            </div>
        </TablerBorder>

        <!-- SPE Model -->
        <div
            v-if='!speExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='speExpanded = true'
            @keydown.enter.prevent='speExpanded = true'
            @keydown.space.prevent='speExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                SPE Model
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='speExpanded = false'
                    @keydown.enter.prevent='speExpanded = false'
                    @keydown.space.prevent='speExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        SPE Model
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <p class='text-muted small mb-3'>
                    Risk = Severity &times; Probability &times; Exposure.
                    Compare the result to the SPE Guidance Table (Table 18.1).
                </p>

                <div class='row g-2 mb-2'>
                    <div class='col-md-6'>
                        <TablerEnum
                            v-model='speTacticLabel'
                            label='Tactic'
                            :options='tacticOptions'
                            :disabled='busy'
                        />
                    </div>
                    <div
                        v-if='spe.tacticChoice === "__new__"'
                        class='col-md-6'
                    >
                        <TablerInput
                            v-model='spe.newTacticLabel'
                            label='New Tactic'
                            placeholder='e.g. Hasty search of likely routes from PLS'
                            :disabled='busy'
                        />
                    </div>
                </div>

                <div class='mb-2'>
                    <TablerInput
                        v-model='spe.description'
                        label='Description'
                        :rows='2'
                        placeholder='Task being assessed, conditions, team notes…'
                        :disabled='busy'
                    />
                </div>

                <div class='mb-3'>
                    <TablerInput
                        v-model='spe.respondentName'
                        label='Respondent'
                        placeholder='Name or callsign of the person assessing'
                        :disabled='busy'
                    />
                </div>

                <div class='row g-2 mb-3'>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='speSeverityLabel'
                            label='Severity'
                            :options='severityOptionLabels'
                            :disabled='busy'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='speProbabilityLabel'
                            label='Probability'
                            :options='probabilityOptionLabels'
                            :disabled='busy'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='speExposureLabel'
                            label='Exposure'
                            :options='exposureOptionLabels'
                            :disabled='busy'
                        />
                    </div>
                </div>

                <div
                    v-if='speResult'
                    class='border rounded p-2 mb-3'
                >
                    <div class='d-flex align-items-center gap-2 mb-2'>
                        <span class='fw-bold fs-3'>{{ speResult.score }}</span>
                        <span
                            class='badge'
                            :class='bandBadgeClass(speResult.band)'
                        >{{ speResult.label }}</span>
                        <span class='small'>{{ speResult.recommendation }}</span>
                    </div>
                    <div
                        class='progress'
                        style='height: 8px;'
                    >
                        <div
                            class='progress-bar'
                            :class='bandBarClass(speResult.band)'
                            :style='{ width: `${speResult.score}%` }'
                        />
                    </div>
                    <div
                        class='d-flex justify-content-between text-muted mt-1'
                        style='font-size: 0.7rem;'
                    >
                        <span>1–19 Slight</span>
                        <span>20–39 Possible</span>
                        <span>40–59 Substantial</span>
                        <span>60–79 High</span>
                        <span>80–100 Very High</span>
                    </div>
                </div>
                <div
                    v-else
                    class='text-muted small mb-3'
                >
                    Select Severity, Probability, and Exposure to compute the risk value.
                </div>

                <div class='d-flex align-items-center gap-2'>
                    <button
                        type='button'
                        class='btn btn-primary btn-sm'
                        :disabled='!speCanSave || busy'
                        @click='onSpeSave'
                    >
                        {{ saving ? 'Saving…' : (spe.editingRespondentId ? 'Update assessment' : 'Save assessment') }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='resetSpeForm'
                    >
                        Clear
                    </button>
                </div>

                <TablerInlineAlert
                    v-if='speStatusMessage'
                    class='mt-2'
                    :severity='speStatusError ? "danger" : "success"'
                    :title='speStatusError ? "Error" : "Status"'
                    :description='speStatusMessage'
                />
            </div>
        </TablerBorder>

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
import { IconChevronDown } from '@tabler/icons-vue';
import { computed, reactive, ref, watch } from 'vue';
import {
    TablerBorder,
    TablerEnum,
    TablerInlineAlert,
    TablerInput,
} from '@tak-ps/vue-tabler';
import { useIncident } from '../../../composables/useIncident.ts';
import { useWorkAssignments } from '../../../composables/useWorkAssignments.ts';
import {
    CONFIDENCE_OPTIONS,
    EXPERIENCE_OPTIONS,
    EXPOSURE_OPTIONS,
    GAR_FACTORS,
    GAR_SCORE_OPTIONS,
    PROBABILITY_OPTIONS,
    REPETITION_OPTIONS,
    SEVERITY_OPTIONS,
    entryHasRespondents,
    factorsNeedingMitigation,
    garFactorLabel,
    garLevelForScore,
    garScoreFromFactors,
    newTacticKey,
    riskLevelForScore,
    speLevelForScore,
    worstComplacencyRespondent,
    worstGarRespondent,
    worstSpeRespondent,
    type ComplacencyRiskRespondent,
    type FactorOption,
    type GarFactorKey,
    type GarMitigations,
    type GarRiskRespondent,
    type RiskBand,
    type SpeRiskRespondent,
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

const garExpanded = ref(false);
const compExpanded = ref(false);
const speExpanded = ref(false);

const garStatusMessage = ref('');
const garStatusError = ref(false);
const compStatusMessage = ref('');
const compStatusError = ref(false);
const speStatusMessage = ref('');
const speStatusError = ref(false);

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

const spe = reactive({
    tacticChoice: '',
    newTacticLabel: '',
    description: '',
    respondentName: '',
    severity: 0,
    probability: 0,
    exposure: 0,
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

// ── TablerEnum presentation helpers ──
// These map the existing string/number model fields to the string[] label
// options TablerEnum requires, without altering the underlying scoring data.
const NEW_TACTIC_LABEL = 'New Tactic…';

function tacticPlaceholderLabel(): string {
    return assignmentOptions.value.length ? 'Select a tactic…' : 'No assignments yet — use New Tactic';
}

const tacticOptions = computed(() => [
    tacticPlaceholderLabel(),
    ...assignmentOptions.value.map((o) => o.label),
    NEW_TACTIC_LABEL,
]);

function tacticChoiceToLabel(choice: string): string {
    if (choice === '__new__') return NEW_TACTIC_LABEL;
    if (!choice) return tacticPlaceholderLabel();
    return assignmentOptions.value.find((o) => o.id === choice)?.label ?? tacticPlaceholderLabel();
}

function tacticLabelToChoice(label: string): string {
    if (label === NEW_TACTIC_LABEL) return '__new__';
    return assignmentOptions.value.find((o) => o.label === label)?.id ?? '';
}

const garTacticLabel = computed({
    get: () => tacticChoiceToLabel(gar.tacticChoice),
    set: (label: string) => { gar.tacticChoice = tacticLabelToChoice(label); },
});
const compTacticLabel = computed({
    get: () => tacticChoiceToLabel(comp.tacticChoice),
    set: (label: string) => { comp.tacticChoice = tacticLabelToChoice(label); },
});
const speTacticLabel = computed({
    get: () => tacticChoiceToLabel(spe.tacticChoice),
    set: (label: string) => { spe.tacticChoice = tacticLabelToChoice(label); },
});

const garScoreOptionStrings = GAR_SCORE_OPTIONS.map(String);

function onGarFactorChange(key: GarFactorKey, label: string): void {
    gar.factors[key] = Number(label) || 0;
}

function factorOptionLabels(options: FactorOption[]): string[] {
    return ['Select…', ...options.map((o) => `${o.value} — ${o.label}`)];
}

function factorValueToLabel(value: number, options: FactorOption[]): string {
    const opt = options.find((o) => o.value === value);
    return opt ? `${opt.value} — ${opt.label}` : 'Select…';
}

function factorLabelToValue(label: string, options: FactorOption[]): number {
    return options.find((o) => `${o.value} — ${o.label}` === label)?.value ?? 0;
}

const repetitionOptionLabels = factorOptionLabels(REPETITION_OPTIONS);
const confidenceOptionLabels = factorOptionLabels(CONFIDENCE_OPTIONS);
const experienceOptionLabels = factorOptionLabels(EXPERIENCE_OPTIONS);
const severityOptionLabels = factorOptionLabels(SEVERITY_OPTIONS);
const probabilityOptionLabels = factorOptionLabels(PROBABILITY_OPTIONS);
const exposureOptionLabels = factorOptionLabels(EXPOSURE_OPTIONS);

const compRepetitionLabel = computed({
    get: () => factorValueToLabel(comp.repetition, REPETITION_OPTIONS),
    set: (label: string) => { comp.repetition = factorLabelToValue(label, REPETITION_OPTIONS); },
});
const compConfidenceLabel = computed({
    get: () => factorValueToLabel(comp.confidence, CONFIDENCE_OPTIONS),
    set: (label: string) => { comp.confidence = factorLabelToValue(label, CONFIDENCE_OPTIONS); },
});
const compExperienceLabel = computed({
    get: () => factorValueToLabel(comp.experience, EXPERIENCE_OPTIONS),
    set: (label: string) => { comp.experience = factorLabelToValue(label, EXPERIENCE_OPTIONS); },
});
const speSeverityLabel = computed({
    get: () => factorValueToLabel(spe.severity, SEVERITY_OPTIONS),
    set: (label: string) => { spe.severity = factorLabelToValue(label, SEVERITY_OPTIONS); },
});
const speProbabilityLabel = computed({
    get: () => factorValueToLabel(spe.probability, PROBABILITY_OPTIONS),
    set: (label: string) => { spe.probability = factorLabelToValue(label, PROBABILITY_OPTIONS); },
});
const speExposureLabel = computed({
    get: () => factorValueToLabel(spe.exposure, EXPOSURE_OPTIONS),
    set: (label: string) => { spe.exposure = factorLabelToValue(label, EXPOSURE_OPTIONS); },
});

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

const speResult = computed(() => {
    if (!spe.severity || !spe.probability || !spe.exposure) return null;
    const score = spe.severity * spe.probability * spe.exposure;
    const level = speLevelForScore(score);
    return { score, ...level };
});

const speCanSave = computed(() => {
    if (!speResult.value || !spe.tacticChoice) return false;
    if (!labelForChoice(spe.tacticChoice, spe.newTacticLabel)) return false;
    return !!spe.respondentName.trim();
});

const savedGroups = computed(() => Object.entries(assessments.value)
    .filter(([, entry]) => entryHasRespondents(entry))
    .map(([key, entry]) => ({
        key,
        entry,
        worstGar: worstGarRespondent(entry),
        worstComp: worstComplacencyRespondent(entry),
        worstSpe: worstSpeRespondent(entry),
        respondentCount: entry.garRespondents.length
            + entry.complacencyRespondents.length
            + entry.speRespondents.length,
    }))
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

function resetSpeForm(): void {
    spe.tacticChoice = '';
    spe.newTacticLabel = '';
    spe.description = '';
    clearSpeRespondentFields();
    spe.editingKey = '';
    speStatusMessage.value = '';
}

function clearSpeRespondentFields(): void {
    spe.respondentName = '';
    spe.severity = 0;
    spe.probability = 0;
    spe.exposure = 0;
    spe.editingRespondentId = '';
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
    speStatusError.value = false;
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

watch(() => spe.tacticChoice, (choice) => {
    spe.editingKey = '';
    spe.editingRespondentId = '';
    if (choice === '__new__' || !choice) return;
    const assignment = assignmentForChoice(choice);
    const existing = assignment ? assessments.value[assignment.assignmentUid] : undefined;
    if (existing) spe.description = existing.description;
});

function selectTacticInto(
    key: string,
    form: typeof gar | typeof comp | typeof spe,
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
    garExpanded.value = true;
}

function onCompAddRespondent(key: string): void {
    if (!selectTacticInto(key, comp)) return;
    clearCompRespondentFields();
    compStatusMessage.value = '';
    compExpanded.value = true;
}

function onSpeAddRespondent(key: string): void {
    if (!selectTacticInto(key, spe)) return;
    clearSpeRespondentFields();
    speStatusMessage.value = '';
    speExpanded.value = true;
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
    garExpanded.value = true;
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
    compExpanded.value = true;
}

function onSpeEdit(key: string, respondentId: string): void {
    const entry = assessments.value[key];
    const resp = entry?.speRespondents.find((r) => r.id === respondentId);
    if (!resp || !selectTacticInto(key, spe)) return;

    spe.respondentName = resp.name;
    spe.severity = resp.severity;
    spe.probability = resp.probability;
    spe.exposure = resp.exposure;
    spe.editingRespondentId = respondentId;
    speStatusMessage.value = '';
    speExpanded.value = true;
}

async function persist(
    next: TacticRiskMap,
    successMessage: string,
    which: 'gar' | 'comp' | 'spe',
): Promise<void> {
    if (!activeMission.value) return;
    saving.value = true;
    if (which === 'gar') {
        garStatusError.value = false;
        garStatusMessage.value = 'Saving…';
    } else if (which === 'comp') {
        compStatusError.value = false;
        compStatusMessage.value = 'Saving…';
    } else {
        speStatusError.value = false;
        speStatusMessage.value = 'Saving…';
    }
    try {
        contentHash.value = await saveTacticAssessmentsToMission(
            activeMission.value,
            next,
            contentHash.value,
        );
        assessments.value = next;
        if (which === 'gar') garStatusMessage.value = successMessage;
        else if (which === 'comp') compStatusMessage.value = successMessage;
        else speStatusMessage.value = successMessage;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (which === 'gar') {
            garStatusError.value = true;
            garStatusMessage.value = msg;
        } else if (which === 'comp') {
            compStatusError.value = true;
            compStatusMessage.value = msg;
        } else {
            speStatusError.value = true;
            speStatusMessage.value = msg;
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
        speRespondents: existing?.speRespondents ?? [],
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

async function onSpeSave(): Promise<void> {
    if (!requireActiveMission() || !speResult.value || !speCanSave.value) return;

    const key = keyForForm(spe.tacticChoice, spe.editingKey) ?? newTacticKey();
    const existing = assessments.value[key];
    const entry = upsertEntryMeta(
        spe.tacticChoice,
        spe.newTacticLabel,
        spe.description,
        existing,
    );
    const name = spe.respondentName.trim();

    const respondent: SpeRiskRespondent = {
        id: spe.editingRespondentId || crypto.randomUUID(),
        name,
        severity: spe.severity,
        probability: spe.probability,
        exposure: spe.exposure,
        score: speResult.value.score,
        level: speResult.value.label,
        recommendation: speResult.value.recommendation,
        band: speResult.value.band,
        assessedAt: new Date().toISOString(),
    };

    const respondents = [...entry.speRespondents];
    const idx = respondents.findIndex((r) => (
        spe.editingRespondentId
            ? r.id === spe.editingRespondentId
            : r.name.toLowerCase() === name.toLowerCase()
    ));
    if (idx >= 0) {
        respondent.id = respondents[idx].id;
        respondents[idx] = respondent;
    } else {
        respondents.push(respondent);
    }
    entry.speRespondents = respondents;

    await persist(
        { ...assessments.value, [key]: entry },
        `Saved ${name}'s SPE assessment of "${entry.tacticLabel}" (${respondent.level}).`,
        'spe',
    );
    if (!speStatusError.value) {
        spe.editingKey = key.startsWith('tactic:') ? key : '';
        clearSpeRespondentFields();
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

async function onSpeDeleteRespondent(key: string, respondentId: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;
    const removed = entry.speRespondents.find((r) => r.id === respondentId);
    const speRespondents = entry.speRespondents.filter((r) => r.id !== respondentId);
    await persist(
        removeOrUpdateEntry(key, { speRespondents }),
        `Deleted ${removed?.name || 'respondent'}'s SPE assessment of "${entry.tacticLabel}".`,
        'spe',
    );
}

async function onDeleteAll(key: string): Promise<void> {
    if (!requireActiveMission()) return;
    const entry = assessments.value[key];
    if (!entry) return;
    await persist(
        removeOrUpdateEntry(key, {
            garRespondents: [],
            complacencyRespondents: [],
            speRespondents: [],
        }),
        `Deleted all assessments for "${entry.tacticLabel}".`,
        'gar',
    );
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
