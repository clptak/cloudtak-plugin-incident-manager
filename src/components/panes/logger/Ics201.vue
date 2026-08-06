<template>
    <div>
        <p class='text-muted small mb-3'>
            ICS 201 Incident Briefing — auto-filled from Initial Information, mission logs
            (201 / planned / current / RESOURCES), Risk Assessment strategies/tactics, and IPP weather.
            Save to mission log to persist; generate PDF when ready.
        </p>

        <div
            v-if='loading'
            class='text-muted small mb-2'
        >
            Loading mission data…
        </div>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Header
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.incidentName'
                        label='Incident Name'
                        :disabled='true'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.incidentNumber'
                        label='Incident Number'
                        :disabled='true'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.date'
                        label='Date'
                        placeholder='MM/DD/YY'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.time'
                        label='Time'
                        placeholder='HH:MM'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.initialPlanningPoint'
                        label='Initial Planning Point'
                        :disabled='true'
                    />
                </div>
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Map / Sketch (TAK Mission, IPP, Weather, Comms)
                </p>
            </template>

            <div class='mb-2'>
                <TablerInput
                    v-model='form.weatherSummary'
                    label='Weather Summary'
                    :rows='4'
                />
            </div>
            <div class='row g-2'>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='form.adamRepeatedChannel'
                        label='Repeated Channel'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='form.carToCarChannel'
                        label='Car to Car Channel'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='form.alternateChannel'
                        label='Alternate Channel'
                    />
                </div>
            </div>
            <div class='form-text mt-1'>
                Written into Map/Sketch with TAK MISSION name/guid and IPP.
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Situation Summary &amp; Safety
                </p>
            </template>

            <TablerInput
                v-model='form.situationSummary'
                :rows='4'
            />
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Prepared By
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.preparedByName'
                        label='Name'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.positionTitle'
                        label='Position / Title'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.signature'
                        label='Signature'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.preparedDateTime'
                        label='Date/Time'
                    />
                </div>
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Current and Planned Objectives
                </p>
            </template>

            <div class='mb-3'>
                <p class='text-uppercase text-white-50 small mb-1'>
                    Current Objectives
                </p>
                <div
                    v-for='(text, i) in form.currentObjectives'
                    :key='`current-obj-${i}`'
                    class='d-flex align-items-start gap-2 mb-2'
                >
                    <span
                        class='text-white-50 small pt-2'
                        style='min-width: 1.5rem;'
                    >
                        {{ i + 1 }}
                    </span>
                    <div class='flex-grow-1'>
                        <TablerInput
                            v-model='form.currentObjectives[i]'
                            :placeholder='`Current objective ${i + 1}`'
                        />
                    </div>
                    <button
                        v-if='form.currentObjectives.length > 1'
                        type='button'
                        class='btn btn-outline-danger btn-sm mt-1'
                        :aria-label='`Remove current objective ${i + 1}`'
                        @click='removeCurrentObjective(i)'
                    >
                        <IconX
                            :size='16'
                            stroke='1.5'
                        />
                    </button>
                </div>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1'
                    @click='addCurrentObjective'
                >
                    <IconPlus
                        :size='16'
                        stroke='1.5'
                    />
                    Add current objective
                </button>
            </div>

            <div>
                <p class='text-uppercase text-white-50 small mb-1'>
                    Planned Objectives
                </p>
                <div
                    v-for='(row, i) in form.plannedObjectives'
                    :key='`planned-obj-${i}`'
                    class='row g-2 mb-2 align-items-start'
                >
                    <div class='col d-flex align-items-start gap-2'>
                        <span
                            class='text-white-50 small pt-2'
                            style='min-width: 1.5rem;'
                        >
                            {{ i + 1 }}
                        </span>
                        <div class='flex-grow-1'>
                            <TablerInput
                                v-model='row.text'
                                :placeholder='`Planned objective ${i + 1}`'
                            />
                        </div>
                    </div>
                    <div class='col-auto'>
                        <TablerInput
                            v-model='row.date'
                            type='date'
                        />
                    </div>
                    <div class='col-auto'>
                        <button
                            v-if='form.plannedObjectives.length > 1'
                            type='button'
                            class='btn btn-outline-danger btn-sm mt-1'
                            :aria-label='`Remove planned objective ${i + 1}`'
                            @click='removePlannedObjective(i)'
                        >
                            <IconX
                                :size='16'
                                stroke='1.5'
                            />
                        </button>
                    </div>
                </div>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1'
                    @click='addPlannedObjective'
                >
                    <IconPlus
                        :size='16'
                        stroke='1.5'
                    />
                    Add planned objective
                </button>
            </div>
            <div class='form-text mt-2'>
                Prefills from Incident POST objectives tagged Current / Planned.
                PDF groups planned rows by date (e.g. “Planned Objectives for 7/5/12:”).
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Current / Planned Actions
                </p>
            </template>

            <div class='table-responsive'>
                <table class='table table-sm table-bordered mb-0 small'>
                    <thead>
                        <tr>
                            <th style='width:5rem;'>
                                #
                            </th>
                            <th style='width:6rem;'>
                                Time
                            </th>
                            <th>Actions / Strategies / Tactics</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='(row, i) in visibleActions'
                            :key='`action-${i}`'
                        >
                            <td class='text-muted'>
                                {{ i + 1 }}
                            </td>
                            <td>
                                <TablerInput v-model='row.time' />
                            </td>
                            <td>
                                <TablerInput
                                    v-model='row.actions'
                                    :rows='2'
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class='d-flex flex-wrap align-items-center gap-2 mt-2 mb-1'>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1'
                    :disabled='form.actionContinuationPages >= MAX_ACTION_CONTINUATION_PAGES'
                    @click='addActionContinuationPage'
                >
                    <IconPlus
                        :size='16'
                        stroke='1.5'
                    />
                    Add §8 continuation page
                </button>
                <button
                    v-if='form.actionContinuationPages > 0'
                    type='button'
                    class='btn btn-sm btn-outline-secondary'
                    @click='removeActionContinuationPage'
                >
                    Remove continuation page
                </button>
                <span class='form-text mb-0'>
                    {{ form.actionContinuationPages }} continuation page{{ form.actionContinuationPages === 1 ? '' : 's' }}
                    · {{ actionCapacity }} action rows ({{ MAX_ACTION_ROWS }} per page)
                </span>
            </div>
            <div class='form-text mt-1'>
                Prefills from mission logs tagged <code>201</code>
                (time = log date/timestamp, actions = remarks with line breaks collapsed), then
                <code>planned</code> / <code>current</code>, then Incident POST as separate
                Objective / strategy (<code>1.</code>) / tactic (<code>1.1</code>) rows.
                Overflow spills onto §8 continuation pages (header + Time/Actions, no §7).
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Current Organization
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.incidentCommanders'
                        label='Incident Commander(s)'
                        :rows='2'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.liaisonOfficer'
                        label='Liaison Officer'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.safetyOfficer'
                        label='Safety Officer'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.publicInformationOfficer'
                        label='Public Information Officer'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.planningSectionChief'
                        label='Planning Section Chief'
                    />
                    <TablerInput
                        v-model='form.planningSectionUnits'
                        class='mt-1'
                        :rows='3'
                        placeholder='Planning Section teams/personnel (one per line)'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.operationsSectionChief'
                        label='Operations Section Chief'
                    />
                    <TablerInput
                        v-model='form.operationsSectionUnits'
                        class='mt-1'
                        :rows='3'
                        placeholder='Operations Section teams/personnel (one per line)'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.financeSectionChief'
                        label='Finance/Admin Section Chief'
                    />
                    <TablerInput
                        v-model='form.financeSectionUnits'
                        class='mt-1'
                        :rows='3'
                        placeholder='Finance/Admin Section teams/personnel (one per line)'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.logisticsSectionChief'
                        label='Logistics Section Chief'
                    />
                    <TablerInput
                        v-model='form.logisticsSectionUnits'
                        class='mt-1'
                        :rows='3'
                        placeholder='Logistics Section teams/personnel (one per line)'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='form.organizationNotes'
                        label='Organization Notes'
                        :rows='2'
                    />
                </div>
            </div>
            <div class='form-text mt-1'>
                Prefills from the Organization tab chart: positions fill the officer/chief
                boxes and each section&apos;s teams appear under its Section Chief on the PDF.
                Anything not under a Section Chief goes to Organization Notes.
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Resource Summary
                </p>
            </template>

            <div class='table-responsive'>
                <table class='table table-sm table-bordered mb-0 small'>
                    <thead>
                        <tr>
                            <th>Resource</th>
                            <th>Identifier</th>
                            <th>Ordered</th>
                            <th>ETA</th>
                            <th>Arrived</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='(row, i) in visibleResources'
                            :key='`resource-${i}`'
                        >
                            <td>
                                <TablerInput v-model='row.resource' />
                            </td>
                            <td>
                                <TablerInput v-model='row.identifier' />
                            </td>
                            <td>
                                <TablerInput v-model='row.dateTimeOrdered' />
                            </td>
                            <td>
                                <TablerInput v-model='row.eta' />
                            </td>
                            <td class='text-center align-middle'>
                                <input
                                    v-model='row.arrived'
                                    type='checkbox'
                                    class='form-check-input'
                                >
                            </td>
                            <td>
                                <TablerInput v-model='row.notes' />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class='form-text mt-1'>
                Prefills from Mission Resource assignments (Resources screen)
                and mission logs tagged <code>RESOURCES</code>
                (one resource per log: Agency, Resource Identifier, Date / Time Ordered, ETA, Arrived, Notes).
            </div>
        </TablerBorder>

        <div class='d-flex flex-wrap align-items-center gap-2 mb-3'>
            <button
                type='button'
                class='btn btn-outline-secondary btn-sm'
                :disabled='loading || refreshing'
                @click='onRefreshSources'
            >
                {{ refreshing ? 'Refreshing…' : 'Refresh from mission' }}
            </button>
            <button
                type='button'
                class='btn btn-outline-primary btn-sm'
                :disabled='saving'
                @click='onSaveToMission'
            >
                {{ saving ? 'Saving…' : 'Save to mission log' }}
            </button>
        </div>

        <TablerInlineAlert
            v-if='!activeMission'
            class='mb-2'
            severity='warning'
            title='No active mission'
            description='Select one in Create | Open first.'
        />
        <div
            v-else
            class='form-text'
        >
            Active DataSync: <strong>{{ activeMission.name }}</strong>
        </div>
        <TablerInlineAlert
            v-if='status'
            class='mt-2'
            :severity='statusError ? "danger" : "success"'
            :title='statusError ? "Error" : "Success"'
            :description='status'
        />

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
                Generate ICS 201 PDF
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
                        Generate ICS 201 PDF
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div class='d-flex flex-wrap gap-2'>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting'
                    @click='downloadPdf'
                >
                    {{ exporting ? 'Generating PDF…' : 'Download ICS 201 PDF' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='uploading'
                    @click='onAddPdfToDataSync'
                >
                    {{ uploading ? 'Uploading…' : 'Add ICS-201.pdf to DataSync' }}
                </button>
            </div>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { IconChevronDown, IconPlus, IconX } from '@tabler/icons-vue';
import { TablerBorder, TablerInput, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { loadSchemaSubscription, schemaMission } from '../../../lib/incidentSubscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import {
    actionRowCapacity,
    blankIcs201Form,
    blankPlannedObjective,
    ensureActionRowCapacity,
    loadIcs201FromMission,
    MAX_ACTION_CONTINUATION_PAGES,
    MAX_ACTION_ROWS,
    mergeIcs201Sources,
    normalizeActionContinuationPages,
    saveIcs201ToMission,
    syncObjectivesSnapshot,
    type Ics201Form,
    type Ics201Sources,
} from '../../../lib/ics201.ts';
import { fetchWeatherSummary } from '../../../lib/irBriefingWeather.ts';
import {
    buildIcs201Pdf,
    defaultIcs201Filename,
    ICS201_MISSION_FILENAME,
} from '../../../lib/ics201Pdf.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';

const { activeMission, requireActiveMission } = useIncident();

const form = reactive<Ics201Form>(blankIcs201Form());
const sources = reactive<Ics201Sources>({
    ippLatLng: null,
    missionName: '',
    missionGuid: '',
});
const loading = ref(false);
const refreshing = ref(false);
const saving = ref(false);
const exporting = ref(false);
const uploading = ref(false);
const pdfExpanded = ref(true);
const status = ref('');
const statusError = ref(false);

function ensureObjectiveEditors(): void {
    if (!form.currentObjectives.length) form.currentObjectives.push('');
    if (!form.plannedObjectives.length) form.plannedObjectives.push(blankPlannedObjective());
}

function addCurrentObjective(): void {
    form.currentObjectives.push('');
}

function removeCurrentObjective(index: number): void {
    form.currentObjectives.splice(index, 1);
    ensureObjectiveEditors();
}

function addPlannedObjective(): void {
    form.plannedObjectives.push(blankPlannedObjective());
}

function removePlannedObjective(index: number): void {
    form.plannedObjectives.splice(index, 1);
    ensureObjectiveEditors();
}

ensureObjectiveEditors();

function addActionContinuationPage(): void {
    if (form.actionContinuationPages >= MAX_ACTION_CONTINUATION_PAGES) return;
    form.actionContinuationPages += 1;
    ensureActionRowCapacity(form);
}

function removeActionContinuationPage(): void {
    if (form.actionContinuationPages <= 0) return;
    form.actionContinuationPages -= 1;
    ensureActionRowCapacity(form);
}

const actionCapacity = computed(() => actionRowCapacity(form.actionContinuationPages));

function lastFilledIndex(hasContent: (i: number) => boolean, length: number): number {
    for (let i = length - 1; i >= 0; i--) {
        if (hasContent(i)) return i;
    }
    return -1;
}

const visibleActions = computed(() => {
    const last = lastFilledIndex(
        (i) => !!(form.actions[i]?.time.trim() || form.actions[i]?.actions.trim()),
        form.actions.length,
    );
    const minVisible = Math.min(form.actions.length, Math.max(last + 2, 4));
    return form.actions.slice(0, minVisible);
});

const visibleResources = computed(() => {
    const last = lastFilledIndex((i) => {
        const r = form.resources[i];
        return !!(
            r.resource.trim()
            || r.identifier.trim()
            || r.dateTimeOrdered.trim()
            || r.eta.trim()
            || r.arrived
            || r.notes.trim()
        );
    }, form.resources.length);
    return form.resources.slice(0, Math.max(last + 2, 4));
});

async function loadWeatherIfNeeded(preserveExisting: boolean): Promise<void> {
    if (!sources.ippLatLng) return;
    if (preserveExisting && form.weatherSummary.trim()) return;
    try {
        form.weatherSummary = await fetchWeatherSummary(
            sources.ippLatLng.lng,
            sources.ippLatLng.lat,
        );
    } catch {
        if (!preserveExisting) form.weatherSummary = '';
    }
}

async function loadAll(preserveUserFields = false): Promise<void> {
    if (!activeMission.value) {
        Object.assign(form, blankIcs201Form());
        ensureObjectiveEditors();
        sources.ippLatLng = null;
        sources.missionName = '';
        sources.missionGuid = '';
        return;
    }

    loading.value = true;
    status.value = '';
    statusError.value = false;

    try {
        const preserved = preserveUserFields ? {
            date: form.date,
            time: form.time,
            weatherSummary: form.weatherSummary,
            adamRepeatedChannel: form.adamRepeatedChannel,
            carToCarChannel: form.carToCarChannel,
            alternateChannel: form.alternateChannel,
            situationSummary: form.situationSummary,
            preparedByName: form.preparedByName,
            positionTitle: form.positionTitle,
            signature: form.signature,
            preparedDateTime: form.preparedDateTime,
            objectives: form.objectives,
            currentObjectives: [...form.currentObjectives],
            plannedObjectives: form.plannedObjectives.map((r) => ({ ...r })),
            actions: form.actions.map((r) => ({ ...r })),
            actionContinuationPages: form.actionContinuationPages,
            incidentCommanders: form.incidentCommanders,
            liaisonOfficer: form.liaisonOfficer,
            safetyOfficer: form.safetyOfficer,
            publicInformationOfficer: form.publicInformationOfficer,
            planningSectionChief: form.planningSectionChief,
            operationsSectionChief: form.operationsSectionChief,
            financeSectionChief: form.financeSectionChief,
            logisticsSectionChief: form.logisticsSectionChief,
            organizationNotes: form.organizationNotes,
            resources: form.resources.map((r) => ({ ...r })),
            logId: form.logId,
        } : null;

        const loaded = await loadIcs201FromMission(
            activeMission.value.guid,
            activeMission.value.token,
            activeMission.value.name,
            activeMission.value,
        );
        sources.ippLatLng = loaded.sources.ippLatLng;
        sources.missionName = loaded.sources.missionName;
        sources.missionGuid = loaded.sources.missionGuid;

        if (preserveUserFields && preserved) {
            Object.assign(form, mergeIcs201Sources(form, loaded.form));
            form.date = preserved.date;
            form.time = preserved.time;
            form.weatherSummary = preserved.weatherSummary;
            form.adamRepeatedChannel = preserved.adamRepeatedChannel;
            form.carToCarChannel = preserved.carToCarChannel;
            form.alternateChannel = preserved.alternateChannel;
            form.situationSummary = preserved.situationSummary;
            form.preparedByName = preserved.preparedByName;
            form.positionTitle = preserved.positionTitle;
            form.signature = preserved.signature;
            form.preparedDateTime = preserved.preparedDateTime;
            form.objectives = preserved.objectives;
            form.currentObjectives = preserved.currentObjectives;
            form.plannedObjectives = preserved.plannedObjectives;
            form.actionContinuationPages = normalizeActionContinuationPages(
                preserved.actionContinuationPages,
            );
            form.actions = preserved.actions;
            ensureActionRowCapacity(form);
            form.incidentCommanders = preserved.incidentCommanders;
            form.liaisonOfficer = preserved.liaisonOfficer;
            form.safetyOfficer = preserved.safetyOfficer;
            form.publicInformationOfficer = preserved.publicInformationOfficer;
            form.planningSectionChief = preserved.planningSectionChief;
            form.operationsSectionChief = preserved.operationsSectionChief;
            form.financeSectionChief = preserved.financeSectionChief;
            form.logisticsSectionChief = preserved.logisticsSectionChief;
            form.organizationNotes = preserved.organizationNotes;
            form.resources = preserved.resources;
            form.logId = preserved.logId ?? loaded.form.logId;
        } else {
            Object.assign(form, loaded.form);
        }

        ensureObjectiveEditors();
        ensureActionRowCapacity(form);
        syncObjectivesSnapshot(form);

        await loadWeatherIfNeeded(preserveUserFields);
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

async function onRefreshSources(): Promise<void> {
    if (!requireActiveMission()) return;
    await refreshSources();
}

async function refreshSources(): Promise<void> {
    refreshing.value = true;
    try {
        await loadAll(true);
        status.value = 'Refreshed auto-filled fields from mission.';
        statusError.value = false;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        refreshing.value = false;
    }
}

async function onSaveToMission(): Promise<void> {
    if (!requireActiveMission()) return;
    await saveToMission();
}

async function saveToMission(): Promise<void> {
    if (!activeMission.value) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const planningTarget = schemaMission(activeMission.value);
        const logId = await saveIcs201ToMission(
            planningTarget.guid,
            form,
            planningTarget.missionToken,
        );
        form.logId = logId;
        status.value = 'Saved ICS 201 to mission log.';
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

async function generatePdfBytes(): Promise<Uint8Array> {
    syncObjectivesSnapshot(form);
    ensureActionRowCapacity(form);
    return buildIcs201Pdf(
        {
            ...form,
            currentObjectives: [...form.currentObjectives],
            plannedObjectives: form.plannedObjectives.map((r) => ({ ...r })),
            actions: form.actions.map((r) => ({ ...r })),
            resources: form.resources.map((r) => ({ ...r })),
        },
        {
            missionName: sources.missionName || activeMission.value?.name || '',
            missionGuid: sources.missionGuid || activeMission.value?.guid || '',
        },
    );
}

async function downloadPdf(): Promise<void> {
    exporting.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        const filename = defaultIcs201Filename(
            form.incidentName || activeMission.value?.name || 'incident',
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
    if (!activeMission.value) return;
    uploading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        const planningTarget = schemaMission(activeMission.value);
        await uploadMissionFile(
            planningTarget.guid,
            ICS201_MISSION_FILENAME,
            bytes,
            { missionToken: planningTarget.missionToken },
        );
        const sub = await loadSchemaSubscription(activeMission.value);
        await sub.fetch();
        status.value = `Added ${ICS201_MISSION_FILENAME} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploading.value = false;
    }
}

onMounted(() => { void loadAll(false); });
watch(() => activeMission.value?.guid, () => { void loadAll(false); });
</script>

<style scoped>
.rotate-180 {
    transform: rotate(-180deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
