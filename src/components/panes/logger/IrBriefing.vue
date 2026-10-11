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

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Briefing Header
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.briefingDate'
                        label='Date'
                        placeholder='MM/DD/YY'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.briefingTime'
                        label='Time'
                        placeholder='HH:MM'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.incidentCommander'
                        label='Incident Commander'
                        :disabled='true'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='form.initialPlanningPoint'
                        label='Initial Planning Point (UTM/Map Datum)'
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
                    Search Subject(s) Information
                </p>
            </template>

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
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Briefing Content
                </p>
            </template>

            <div class='mb-2'>
                <TablerInput
                    v-model='form.situationSummary'
                    label='Situation Summary'
                    :rows='3'
                />
            </div>
            <div class='mb-2'>
                <TablerInput
                    v-model='form.actionsTaken'
                    label='Actions Taken So Far / Resources on Scene'
                    :rows='3'
                />
            </div>
            <div class='row g-2 mb-2'>
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
            <div class='mb-2'>
                <TablerInput
                    v-model='form.weatherSummary'
                    label='Weather Summary'
                    :rows='4'
                    description='Prefilled from CloudTAK weather when IPP coordinates are available.'
                />
            </div>
            <div class='mb-0'>
                <TablerInput
                    v-model='form.safetyMessage'
                    label='Safety Message'
                    :rows='4'
                />
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
                    Page 2 Header (Unit Log)
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.incidentName'
                        label='Incident Name'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.operationalPeriod'
                        label='Operational Period'
                        placeholder='e.g. OP-00'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        :model-value='form.briefingDate'
                        label='Date Prepared'
                        :disabled='true'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        :model-value='form.briefingTime'
                        label='Time Prepared'
                        :disabled='true'
                    />
                </div>
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
                Generate SAR Briefing PDF
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
                        Generate SAR Briefing PDF
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
                    {{ exporting ? 'Generating PDF…' : 'Download SAR Briefing PDF' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='uploading'
                    @click='onAddPdfToDataSync'
                >
                    {{ uploading ? 'Uploading…' : 'Add SAR-Briefing.pdf to DataSync' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='exportingNew'
                    @click='downloadPdfNew'
                >
                    {{ exportingNew ? 'Generating PDF…' : 'Download SAR Briefing PDF (New)' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='uploadingNew'
                    @click='onAddPdfNewToDataSync'
                >
                    {{ uploadingNew ? 'Uploading…' : 'Add SAR-Briefing-New.pdf to DataSync' }}
                </button>
            </div>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, onMounted, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import { TablerBorder, TablerInput, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { loadIncidentSubscription } from '../../../lib/incidentSubscription.ts';
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
import {
    buildSarBriefingModernPdf,
    defaultSarBriefingModernFilename,
    SAR_BRIEFING_MODERN_MISSION_FILENAME,
} from '../../../lib/sarBriefingModernPdf.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';

const { activeMission, requireActiveMission } = useIncident();

const form = reactive<IrBriefingForm>(blankIrBriefingForm());
const loading = ref(false);
const refreshing = ref(false);
const exporting = ref(false);
const uploading = ref(false);
const exportingNew = ref(false);
const uploadingNew = ref(false);
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
            activeMission.value,
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

function formSnapshot(): IrBriefingForm {
    return { ...form, subjects: [...form.subjects] as IrBriefingForm['subjects'] };
}

async function generatePdfBytes(): Promise<Uint8Array> {
    return buildSarBriefingPdf(formSnapshot());
}

async function generateModernPdfBytes(): Promise<Uint8Array> {
    return buildSarBriefingModernPdf(formSnapshot());
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

async function downloadPdfNew(): Promise<void> {
    exportingNew.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generateModernPdfBytes();
        const filename = defaultSarBriefingModernFilename(
            form.incidentName || activeMission.value?.name || 'incident',
        );
        downloadPdfBytes(bytes, filename);
        status.value = 'Modern PDF downloaded.';
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        exportingNew.value = false;
    }
}

async function onAddPdfToDataSync(): Promise<void> {
    if (!requireActiveMission()) return;
    await addPdfToDataSync();
}

async function onAddPdfNewToDataSync(): Promise<void> {
    if (!requireActiveMission()) return;
    await addPdfNewToDataSync();
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
        const sub = await loadIncidentSubscription(activeMission.value);
        await sub.fetch();
        status.value = `Added ${SAR_BRIEFING_MISSION_FILENAME} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploading.value = false;
    }
}

async function addPdfNewToDataSync(): Promise<void> {
    if (!activeMission.value) return;
    uploadingNew.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generateModernPdfBytes();
        await uploadMissionFile(
            activeMission.value.guid,
            SAR_BRIEFING_MODERN_MISSION_FILENAME,
            bytes,
            { missionToken: activeMission.value.token },
        );
        const sub = await loadIncidentSubscription(activeMission.value);
        await sub.fetch();
        status.value = `Added ${SAR_BRIEFING_MODERN_MISSION_FILENAME} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploadingNew.value = false;
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
