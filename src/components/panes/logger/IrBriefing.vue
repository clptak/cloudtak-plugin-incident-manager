<template>
    <div>
        <p class='text-muted small mb-3'>
            SAR Briefing form — auto-filled from Initial Information, Subject Information (subjects 1–3),
            and mission data. Briefing-only fields are session-only until you generate the PDF.
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
                    Briefing Header
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='row g-2'>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Date</label>
                        <input
                            v-model='form.briefingDate'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='MM/DD/YY'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Time</label>
                        <input
                            v-model='form.briefingTime'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='HH:MM'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Incident Commander</label>
                        <input
                            v-model='form.incidentCommander'
                            type='text'
                            class='form-control form-control-sm'
                            readonly
                        >
                    </div>
                    <div class='col-12'>
                        <label class='form-label small mb-1'>Initial Planning Point (UTM/Map Datum)</label>
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
                    Search Subject(s) Information
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='table-responsive'>
                    <table class='table table-sm table-bordered mb-0 small'>
                        <thead>
                            <tr>
                                <th style='width:8rem;'>
                                    Field
                                </th>
                                <th>Subject 1</th>
                                <th>Subject 2</th>
                                <th>Subject 3</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='row in subjectRows'
                                :key='row.key'
                            >
                                <td class='text-muted'>
                                    {{ row.label }}
                                </td>
                                <td
                                    v-for='(subject, i) in form.subjects'
                                    :key='`${row.key}-${i}`'
                                >
                                    {{ subject[row.key] || '—' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class='form-text mt-1'>
                    Edit subject details in Subject Information, then click Refresh from mission.
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Briefing Content
                </h4>
            </div>
            <div class='card-body py-2'>
                <div class='mb-2'>
                    <label class='form-label small mb-1'>Situation Summary</label>
                    <textarea
                        v-model='form.situationSummary'
                        class='form-control form-control-sm'
                        rows='3'
                    />
                </div>
                <div class='mb-2'>
                    <label class='form-label small mb-1'>Actions Taken So Far / Resources on Scene</label>
                    <textarea
                        v-model='form.actionsTaken'
                        class='form-control form-control-sm'
                        rows='3'
                    />
                </div>
                <div class='row g-2 mb-2'>
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
                <div class='mb-2'>
                    <label class='form-label small mb-1'>Weather Summary</label>
                    <textarea
                        v-model='form.weatherSummary'
                        class='form-control form-control-sm'
                        rows='4'
                    />
                    <div class='form-text'>
                        Prefilled from CloudTAK weather when IPP coordinates are available.
                    </div>
                </div>
                <div class='mb-0'>
                    <label class='form-label small mb-1'>Safety Message</label>
                    <textarea
                        v-model='form.safetyMessage'
                        class='form-control form-control-sm'
                        rows='4'
                    />
                </div>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2'>
                <h4 class='card-title mb-0 fs-6'>
                    Page 2 Header (Unit Log)
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
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Operational Period</label>
                        <input
                            v-model='form.operationalPeriod'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='e.g. OP-00'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Date Prepared</label>
                        <input
                            :value='form.briefingDate'
                            type='text'
                            class='form-control form-control-sm'
                            readonly
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Time Prepared</label>
                        <input
                            :value='form.briefingTime'
                            type='text'
                            class='form-control form-control-sm'
                            readonly
                        >
                    </div>
                </div>
            </div>
        </div>

        <div class='d-flex flex-wrap align-items-center gap-2 mb-3'>
            <button
                type='button'
                class='btn btn-outline-secondary btn-sm'
                :disabled='!activeMission || loading || refreshing'
                @click='refreshSources'
            >
                {{ refreshing ? 'Refreshing…' : 'Refresh from mission' }}
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
                    GENERATE SAR BRIEFING PDF
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
                        {{ exporting ? 'Generating PDF…' : 'Download SAR Briefing PDF' }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm'
                        :disabled='uploading || !activeMission'
                        @click='addPdfToDataSync'
                    >
                        {{ uploading ? 'Uploading…' : 'Add SAR-Briefing.pdf to DataSync' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, onMounted, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import {
    blankIrBriefingForm,
    loadIrBriefingFromMission,
    mergeIrBriefingSources,
    type IrBriefingForm,
} from '../../../lib/irBriefing.ts';
import { fetchWeatherSummary } from '../../../lib/irBriefingWeather.ts';
import {
    buildSarBriefingPdf,
    defaultSarBriefingFilename,
    SAR_BRIEFING_MISSION_FILENAME,
} from '../../../lib/sarBriefingPdf.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';

const { activeMission } = useIncident();

const form = reactive<IrBriefingForm>(blankIrBriefingForm());
const loading = ref(false);
const refreshing = ref(false);
const exporting = ref(false);
const uploading = ref(false);
const pdfExpanded = ref(true);
const status = ref('');
const statusError = ref(false);

let ippLatLng: { lat: number; lng: number } | null = null;

const subjectRows: Array<{ key: keyof IrBriefingForm['subjects'][number]; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
    { key: 'height', label: 'Height' },
    { key: 'weight', label: 'Weight' },
    { key: 'hairColor', label: 'Hair Color' },
    { key: 'facialHair', label: 'Facial Hair' },
    { key: 'glasses', label: 'Glasses' },
    { key: 'distinguishingMarks', label: 'Other Distinguishing Marks' },
    { key: 'clothing', label: 'Clothing Description' },
    { key: 'footwear', label: 'Footwear' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'vehicle', label: 'Vehicle Description' },
    { key: 'medicalConditions', label: 'Medical Conditions' },
    { key: 'experience', label: 'Experience' },
];

async function loadWeatherIfNeeded(preserveExisting: boolean): Promise<void> {
    if (!ippLatLng) return;
    if (preserveExisting && form.weatherSummary.trim()) return;
    try {
        form.weatherSummary = await fetchWeatherSummary(ippLatLng.lng, ippLatLng.lat);
    } catch {
        if (!preserveExisting) form.weatherSummary = '';
    }
}

async function loadAll(preserveBriefingFields = false): Promise<void> {
    if (!activeMission.value) {
        Object.assign(form, blankIrBriefingForm());
        ippLatLng = null;
        return;
    }

    loading.value = true;
    status.value = '';
    statusError.value = false;

    try {
        const briefingOnly = preserveBriefingFields ? {
            situationSummary: form.situationSummary,
            actionsTaken: form.actionsTaken,
            adamRepeatedChannel: form.adamRepeatedChannel,
            carToCarChannel: form.carToCarChannel,
            alternateChannel: form.alternateChannel,
            weatherSummary: form.weatherSummary,
            safetyMessage: form.safetyMessage,
        } : null;

        const loaded = await loadIrBriefingFromMission(
            activeMission.value.guid,
            activeMission.value.token,
            activeMission.value.name,
        );
        ippLatLng = loaded.sources.ippLatLng;

        if (preserveBriefingFields) {
            Object.assign(form, mergeIrBriefingSources(form, loaded.form));
            if (briefingOnly) {
                form.situationSummary = briefingOnly.situationSummary;
                form.actionsTaken = briefingOnly.actionsTaken;
                form.adamRepeatedChannel = briefingOnly.adamRepeatedChannel;
                form.carToCarChannel = briefingOnly.carToCarChannel;
                form.alternateChannel = briefingOnly.alternateChannel;
                form.weatherSummary = briefingOnly.weatherSummary;
                form.safetyMessage = briefingOnly.safetyMessage;
            }
        } else {
            Object.assign(form, loaded.form);
            if (!form.safetyMessage.trim()) {
                form.safetyMessage = blankIrBriefingForm().safetyMessage;
            }
        }

        await loadWeatherIfNeeded(preserveBriefingFields);
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
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

async function generatePdfBytes(): Promise<Uint8Array> {
    return buildSarBriefingPdf({ ...form, subjects: [...form.subjects] as IrBriefingForm['subjects'] });
}

async function downloadPdf(): Promise<void> {
    exporting.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        const filename = defaultSarBriefingFilename(
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

async function addPdfToDataSync(): Promise<void> {
    if (!activeMission.value) return;
    uploading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        await uploadMissionFile(
            activeMission.value.guid,
            SAR_BRIEFING_MISSION_FILENAME,
            bytes,
            { missionToken: activeMission.value.token },
        );
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        await sub.fetch();
        status.value = `Added ${SAR_BRIEFING_MISSION_FILENAME} to ${activeMission.value.name}.`;
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
