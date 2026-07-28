<template>
    <div class='card'>
        <div class='card-header'>
            <h3 class='card-title mb-0'>
                Search Urgency Rating
            </h3>
        </div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Score each factor 1 (most urgent) to 3 (least urgent).
                Save stores the rating in <strong>mission_schema.json</strong>;
                Send to DataSync posts a mission log entry.
            </p>

            <div class='table-responsive urgency-table-wrap'>
                <table class='table table-sm table-vcenter mb-0'>
                    <thead>
                        <tr>
                            <th>Factor</th><th style='width:90px;'>
                                Rating (1–3)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='f in factors'
                            :key='f.key'
                        >
                            <td>
                                <div class='d-flex align-items-center gap-1'>
                                    <span>{{ f.label }}</span>
                                    <div
                                        :ref='(el) => setHelpRef(f.key, el as HTMLElement | null)'
                                        class='position-relative d-inline-flex'
                                    >
                                        <button
                                            type='button'
                                            class='btn btn-link btn-sm p-0 text-muted lh-1 border-0'
                                            :aria-label='`Scoring guidance for ${f.label}`'
                                            @click.stop='toggleHelp(f.key)'
                                        >
                                            <IconInfoCircle
                                                :size='16'
                                                stroke='1.5'
                                            />
                                        </button>
                                        <div
                                            v-if='openHelpKey === f.key'
                                            class='position-absolute start-0 mt-1 p-2 bg-body border rounded shadow-sm small'
                                            style='z-index:1050; min-width:16rem; top:100%;'
                                            @click.stop
                                        >
                                            <ul class='mb-0 ps-3'>
                                                <li
                                                    v-for='line in f.helpLines'
                                                    :key='line.text'
                                                >
                                                    {{ line.text }} = {{ line.score }}
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <input
                                    v-model.number='f.value'
                                    type='number'
                                    min='1'
                                    max='3'
                                    class='form-control form-control-sm'
                                >
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class='text-end fw-bold'>
                                Total
                            </td>
                            <td class='fw-bold'>
                                {{ total }}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class='d-flex align-items-center gap-2 mt-2'>
                <progress
                    :value='Math.max(7, Math.min(21, total))'
                    max='21'
                    style='flex:1;'
                />
                <span
                    class='badge'
                    :class='level.cls'
                >{{ level.label }}</span>
            </div>

            <div class='mt-3 d-flex flex-wrap gap-2'>
                <button
                    class='btn btn-primary btn-sm'
                    :disabled='saving || posting || !valid || !activeMission || loading'
                    @click='onSave'
                >
                    {{ saving ? 'Saving…' : 'Save' }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='posting || saving || !valid || !activeMission || loading'
                    @click='onSend'
                >
                    {{ posting ? 'Sending…' : 'Send to DataSync' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='exporting || !valid || loading'
                    @click='downloadPdf'
                >
                    {{ exporting ? 'Generating PDF…' : 'Download PDF' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='uploading || !valid || !activeMission || loading'
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
                v-if='!valid'
                class='form-text text-danger'
            >
                Each rating must be 1, 2, or 3.
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
                        Urgency Rating Chart PDF
                    </h4>
                </div>
                <div class='card-body py-2'>
                    <p class='text-muted small mb-2'>
                        Prefills from ICS 201 / Initial Information when available.
                        Edit header and Prepared By before downloading.
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
                            :disabled='exporting || !valid'
                            @click='downloadPdf'
                        >
                            {{ exporting ? 'Generating PDF…' : 'Download Urgency Rating Chart PDF' }}
                        </button>
                        <button
                            type='button'
                            class='btn btn-outline-primary btn-sm'
                            :disabled='uploading || !valid || !activeMission'
                            @click='onAddPdfToDataSync'
                        >
                            {{ uploading ? 'Uploading…' : 'Add Urgency-Rating-Chart.pdf to DataSync' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import { loadIcs201FromMission } from '../../../lib/ics201.ts';
import { nowBriefingDate, nowBriefingTime } from '../../../lib/irBriefing.ts';
import { downloadPdfBytes, uploadMissionFile } from '../../../lib/missionUpload.ts';
import {
    buildUrgencyRating,
    defaultUrgencyFactors,
    urgencyLevelFromTotal,
    type UrgencyFactorKey,
} from '../../../lib/urgencyRating.ts';
import {
    buildUrgencyRatingChartPdf,
    defaultUrgencyRatingChartFilename,
    URGENCY_RATING_CHART_MISSION_FILENAME,
    type UrgencyRatingChartHeader,
} from '../../../lib/urgencyRatingChartPdf.ts';
import {
    loadUrgencyRatingFromMission,
    saveUrgencyRatingToMission,
} from '../../../lib/urgencyRatingPersistence.ts';

interface HelpLine {
    text: string;
    score: string;
}

interface Factor {
    key: UrgencyFactorKey;
    label: string;
    value: number;
    helpLines: HelpLine[];
}

const { activeMission, requireActiveMission } = useIncident();

function blankPdfHeader(): UrgencyRatingChartHeader {
    return {
        incidentName: '',
        incidentNumber: '',
        date: '',
        time: '',
        preparedByName: '',
        positionTitle: '',
        signature: '',
        preparedDateTime: '',
    };
}

const pdfHeader = reactive<UrgencyRatingChartHeader>(blankPdfHeader());
const incidentNameReadonly = ref(false);
const incidentNumberReadonly = ref(false);
const exporting = ref(false);
const uploading = ref(false);

const factors = reactive<Factor[]>([
    {
        key: 'age',
        label: 'Subject age / profile',
        value: 1,
        helpLines: [
            { text: 'Very Young', score: '1' },
            { text: 'Very Old', score: '1' },
            { text: 'Other', score: '2–3' },
        ],
    },
    {
        key: 'medical',
        label: 'Medical condition',
        value: 1,
        helpLines: [
            { text: 'Known / Suspected injured, ill, or mental problem', score: '1–2' },
            { text: 'Healthy', score: '3' },
            { text: 'Known Fatality', score: '3' },
        ],
    },
    {
        key: 'number',
        label: 'Number of subjects',
        value: 1,
        helpLines: [
            { text: 'One / Alone', score: '1' },
            { text: 'More Than One (Unless Separated)', score: '2–3' },
        ],
    },
    {
        key: 'experience',
        label: 'Experience / fitness',
        value: 1,
        helpLines: [
            { text: 'Not experienced, does not know the area', score: '1' },
            { text: 'Not experienced, knows the area', score: '1–2' },
            { text: 'Experienced, not familiar with the area', score: '2' },
            { text: 'Experienced, knows the area', score: '3' },
        ],
    },
    {
        key: 'weather',
        label: 'Weather (current & forecast)',
        value: 1,
        helpLines: [
            { text: 'Past and/or existing hazardous weather', score: '1' },
            { text: 'Predicted hazardous weather (less than 8 hours)', score: '1–2' },
            { text: 'Predicted hazardous weather (more than 8 hours)', score: '2' },
            { text: 'No hazardous weather predicted', score: '3' },
        ],
    },
    {
        key: 'equipment',
        label: 'Equipment / clothing',
        value: 1,
        helpLines: [
            { text: 'Inadequate for environment and weather', score: '1' },
            { text: 'Questionable for environment and weather', score: '1–2' },
            { text: 'Adequate for environment and weather', score: '3' },
        ],
    },
    {
        key: 'terrain',
        label: 'Terrain / hazards',
        value: 1,
        helpLines: [
            { text: 'Known hazardous terrain or other hazards', score: '1' },
            { text: 'Few or no hazards', score: '2–3' },
        ],
    },
]);

const openHelpKey = ref<string | null>(null);
const helpRefs: Record<string, HTMLElement | null> = {};

function setHelpRef(key: string, el: HTMLElement | null): void {
    helpRefs[key] = el;
}

function toggleHelp(key: string): void {
    openHelpKey.value = openHelpKey.value === key ? null : key;
}

function onDocumentClick(event: MouseEvent): void {
    if (!openHelpKey.value) return;
    const el = helpRefs[openHelpKey.value];
    if (el && !el.contains(event.target as Node)) {
        openHelpKey.value = null;
    }
}

const total = computed(() => factors.reduce((s, f) => s + (Number(f.value) || 0), 0));
const valid = computed(() => factors.every((f) => [1, 2, 3].includes(Number(f.value))));

const level = computed(() => {
    const label = urgencyLevelFromTotal(total.value);
    if (label === 'High') return { label, cls: 'bg-danger-lt text-danger' };
    if (label === 'Moderate') return { label, cls: 'bg-yellow-lt text-yellow' };
    return { label, cls: 'bg-green-lt text-green' };
});

const posting = ref(false);
const saving = ref(false);
const loading = ref(false);
const status = ref('');
const statusError = ref(false);
const contentHash = ref<string | undefined>();

function currentFactors(): Record<UrgencyFactorKey, number> {
    const out = defaultUrgencyFactors();
    for (const f of factors) {
        out[f.key] = Number(f.value) || 1;
    }
    return out;
}

function applyFactors(scores: Record<UrgencyFactorKey, number>): void {
    for (const f of factors) {
        f.value = scores[f.key] ?? 1;
    }
}

function reset(): void {
    applyFactors(defaultUrgencyFactors());
    status.value = '';
    statusError.value = false;
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

async function recall(): Promise<void> {
    if (!activeMission.value) {
        contentHash.value = undefined;
        Object.assign(pdfHeader, blankPdfHeader());
        incidentNameReadonly.value = false;
        incidentNumberReadonly.value = false;
        return;
    }
    loading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const loaded = await loadUrgencyRatingFromMission(activeMission.value);
        contentHash.value = loaded.contentHash;
        if (loaded.rating) {
            applyFactors(loaded.rating.factors);
            status.value = 'Loaded saved urgency from mission_schema.json.';
        }
        await prefillPdfHeader();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

async function onSave(): Promise<void> {
    if (!requireActiveMission()) return;
    if (!activeMission.value || !valid.value) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const rating = buildUrgencyRating(currentFactors());
        contentHash.value = await saveUrgencyRatingToMission(
            activeMission.value,
            rating,
            contentHash.value,
        );
        status.value = `Saved urgency rating (${rating.level}) to mission_schema.json on ${activeMission.value.name}.`;
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
    if (!activeMission.value || !valid.value) return;
    posting.value = true; status.value = ''; statusError.value = false;
    try {
        const breakdown = factors.map((f) => `${f.label}: ${f.value}`).join('; ');
        const content = `Search Urgency: ${level.value.label} (total ${total.value}/21). ${breakdown}`;
        const sub = await Subscription.load(activeMission.value.guid, {
            missiontoken: activeMission.value.token ?? '',
        });
        await sub.log.create({
            content,
            keywords: ['search-urgency', `urgency:${level.value.label}`, `total:${total.value}`],
        });
        status.value = `Sent urgency rating (${level.value.label}) to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}

async function generatePdfBytes(): Promise<Uint8Array> {
    return buildUrgencyRatingChartPdf(currentFactors(), { ...pdfHeader });
}

async function downloadPdf(): Promise<void> {
    if (!valid.value) return;
    exporting.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        const filename = defaultUrgencyRatingChartFilename(
            pdfHeader.incidentName || activeMission.value?.name || 'incident',
        );
        downloadPdfBytes(bytes, filename);
        status.value = 'Urgency Rating Chart downloaded.';
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
    if (!activeMission.value || !valid.value) return;
    uploading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const bytes = await generatePdfBytes();
        await uploadMissionFile(
            activeMission.value.guid,
            URGENCY_RATING_CHART_MISSION_FILENAME,
            bytes,
            { missionToken: activeMission.value.token },
        );
        const sub = await Subscription.load(activeMission.value.guid, {
            missiontoken: activeMission.value.token ?? '',
        });
        await sub.fetch();
        status.value = `Added ${URGENCY_RATING_CHART_MISSION_FILENAME} to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        uploading.value = false;
    }
}

watch(
    () => activeMission.value?.guid,
    () => {
        void recall();
    },
);

onMounted(() => {
    document.addEventListener('click', onDocumentClick);
    void recall();
});

onUnmounted(() => {
    document.removeEventListener('click', onDocumentClick);
});
</script>

<style scoped>
.urgency-table-wrap {
    overflow: visible;
}
</style>
