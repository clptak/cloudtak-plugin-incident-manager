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

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Header
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='row g-2'>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Incident Name</label>
                        <input
                            v-model='form.incidentName'
                            type='text'
                            class='form-control form-control-sm'
                            readonly
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Incident Number</label>
                        <input
                            v-model='form.incidentNumber'
                            type='text'
                            class='form-control form-control-sm'
                            readonly
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Date</label>
                        <input
                            v-model='form.date'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='MM/DD/YY'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Time</label>
                        <input
                            v-model='form.time'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='HH:MM'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Initial Planning Point</label>
                        <input
                            v-model='form.initialPlanningPoint'
                            type='text'
                            class='form-control form-control-sm'
                            readonly
                        >
                    </div>
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Map / Sketch (TAK Mission, IPP, Weather, Comms)
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='mb-2'>
                    <label class='form-label small mb-1'>Weather Summary</label>
                    <textarea
                        v-model='form.weatherSummary'
                        class='form-control form-control-sm'
                        rows='4'
                    />
                </div>
                <div class='row g-2'>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Repeated Channel</label>
                        <input
                            v-model='form.adamRepeatedChannel'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Car to Car Channel</label>
                        <input
                            v-model='form.carToCarChannel'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Alternate Channel</label>
                        <input
                            v-model='form.alternateChannel'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                </div>
                <div class='form-text mt-1'>
                    Written into Map/Sketch with TAK MISSION name/guid and IPP.
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Situation Summary &amp; Safety
                </h4>
            </div>
            <div class='card-body py-2'>
                <textarea
                    v-model='form.situationSummary'
                    class='form-control form-control-sm'
                    rows='4'
                />
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Prepared By
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='row g-2'>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Name</label>
                        <input
                            v-model='form.preparedByName'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Position / Title</label>
                        <input
                            v-model='form.positionTitle'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Signature</label>
                        <input
                            v-model='form.signature'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Date/Time</label>
                        <input
                            v-model='form.preparedDateTime'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Current and Planned Objectives
                </h4>
            </div>
            <div class='card-body py-2'>
                <textarea
                    v-model='form.objectives'
                    class='form-control form-control-sm'
                    rows='4'
                />
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Current / Planned Actions
                </h4>
            </div>
            <div class='card-body py-2'>
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
                                    <input
                                        v-model='row.time'
                                        type='text'
                                        class='form-control form-control-sm'
                                    >
                                </td>
                                <td>
                                    <textarea
                                        v-model='row.actions'
                                        class='form-control form-control-sm'
                                        rows='2'
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class='form-text mt-1'>
                    Prefills from mission logs tagged <code>201</code>
                    (time = log date/timestamp, actions = remarks with line breaks collapsed), then
                    <code>planned</code> / <code>current</code>, then Risk Assessment strategies/tactics.
                    On the PDF, long actions wrap onto the next §8 rows and shift later entries down.
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Current Organization
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='row g-2'>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Incident Commander(s)</label>
                        <textarea
                            v-model='form.incidentCommanders'
                            class='form-control form-control-sm'
                            rows='2'
                        />
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Liaison Officer</label>
                        <input
                            v-model='form.liaisonOfficer'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Safety Officer</label>
                        <input
                            v-model='form.safetyOfficer'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Public Information Officer</label>
                        <input
                            v-model='form.publicInformationOfficer'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Planning Section Chief</label>
                        <input
                            v-model='form.planningSectionChief'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Operations Section Chief</label>
                        <input
                            v-model='form.operationsSectionChief'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Finance/Admin Section Chief</label>
                        <input
                            v-model='form.financeSectionChief'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Logistics Section Chief</label>
                        <input
                            v-model='form.logisticsSectionChief'
                            type='text'
                            class='form-control form-control-sm'
                        >
                    </div>
                    <div class='col-12'>
                        <label class='form-label small mb-1'>Organization Notes</label>
                        <textarea
                            v-model='form.organizationNotes'
                            class='form-control form-control-sm'
                            rows='2'
                        />
                    </div>
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Resource Summary
                </h4>
            </div>
            <div class='card-body py-2'>
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
                                    <input
                                        v-model='row.resource'
                                        type='text'
                                        class='form-control form-control-sm'
                                    >
                                </td>
                                <td>
                                    <input
                                        v-model='row.identifier'
                                        type='text'
                                        class='form-control form-control-sm'
                                    >
                                </td>
                                <td>
                                    <input
                                        v-model='row.dateTimeOrdered'
                                        type='text'
                                        class='form-control form-control-sm'
                                    >
                                </td>
                                <td>
                                    <input
                                        v-model='row.eta'
                                        type='text'
                                        class='form-control form-control-sm'
                                    >
                                </td>
                                <td class='text-center align-middle'>
                                    <input
                                        v-model='row.arrived'
                                        type='checkbox'
                                        class='form-check-input'
                                    >
                                </td>
                                <td>
                                    <input
                                        v-model='row.notes'
                                        type='text'
                                        class='form-control form-control-sm'
                                    >
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
            </div>
        </div>

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
                    GENERATE ICS 201 PDF
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
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import {
    blankIcs201Form,
    loadIcs201FromMission,
    mergeIcs201Sources,
    saveIcs201ToMission,
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

function lastFilledIndex(hasContent: (i: number) => boolean, length: number): number {
    for (let i = length - 1; i >= 0; i--) {
        if (hasContent(i)) return i;
    }
    return -1;
}

const visibleActions = computed(() => {
    const last = lastFilledIndex(
        (i) => !!(form.actions[i].time.trim() || form.actions[i].actions.trim()),
        form.actions.length,
    );
    return form.actions.slice(0, Math.max(last + 2, 4));
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
            actions: form.actions.map((r) => ({ ...r })),
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
            form.actions = preserved.actions;
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
        const logId = await saveIcs201ToMission(
            activeMission.value.guid,
            form,
            activeMission.value.token,
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
    return buildIcs201Pdf(
        {
            ...form,
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
        await uploadMissionFile(
            activeMission.value.guid,
            ICS201_MISSION_FILENAME,
            bytes,
            { missionToken: activeMission.value.token },
        );
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
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
