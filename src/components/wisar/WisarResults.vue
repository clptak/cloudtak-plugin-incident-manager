<template>
    <div class='wisar-results mt-3 pt-3 border-top'>
        <p class='text-uppercase text-white-50 small mb-2'>
            Results
        </p>

        <div
            v-if='loading'
            class='small text-muted'
        >
            Loading contours…
        </div>
        <div
            v-else-if='loadError'
            class='small text-danger'
        >
            {{ loadError }}
        </div>
        <template v-else-if='contours'>
            <ul
                v-if='warnings.length'
                class='small mb-2 ps-3'
            >
                <li
                    v-for='(w, i) in warnings'
                    :key='i'
                    :class='w.severity === "warning" ? "text-warning" : "text-muted"'
                >
                    {{ w.message }}
                </li>
            </ul>

            <div class='d-flex flex-wrap gap-3 small mb-1'>
                <label
                    v-for='f in rows'
                    :key='contourKey(f)'
                    class='form-check form-check-inline mb-0 d-inline-flex align-items-center gap-1'
                >
                    <input
                        type='checkbox'
                        class='form-check-input'
                        :checked='selected.has(contourKey(f))'
                        @change='toggleContour(contourKey(f))'
                    >
                    <span
                        class='wisar-swatch'
                        :style='{ borderColor: f.properties.stroke, background: f.properties.fill }'
                    />
                    {{ contourLabel(f) }}
                </label>
                <span
                    v-if='!rows.length'
                    class='text-muted'
                >No contours were produced.</span>
            </div>
            <div
                v-if='rows.length'
                class='form-text mt-0 mb-2'
            >
                Checked contours are previewed and sent to DataSync.
            </div>

            <div class='d-flex flex-wrap align-items-center gap-2'>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-secondary'
                    :disabled='!selected.size'
                    @click='togglePreview'
                >
                    {{ previewOn ? 'Hide map preview' : 'Show map preview' }}
                </button>
                <div
                    class='btn-group btn-group-sm'
                    role='group'
                    aria-label='Send to'
                >
                    <button
                        type='button'
                        class='btn'
                        :class='target === "active" ? "btn-primary" : "btn-outline-secondary"'
                        title='The incident DataSync field teams see'
                        @click='target = "active"'
                    >
                        Active DataSync
                    </button>
                    <button
                        type='button'
                        class='btn'
                        :class='target === "mgmt" ? "btn-primary" : "btn-outline-secondary"'
                        :disabled='!activeMission?.mgmt'
                        :title='activeMission?.mgmt ? "The sworn-only planning DataSync" : "This incident has no MGMT DataSync"'
                        @click='target = "mgmt"'
                    >
                        MGMT (planning)
                    </button>
                </div>
                <button
                    type='button'
                    class='btn btn-sm btn-primary'
                    :disabled='!selected.size || adding || !activeMission'
                    @click='addToDataSync'
                >
                    {{ adding ? 'Adding…' : `Add ${selected.size} to DataSync` }}
                </button>
            </div>
            <div
                v-if='addStatus'
                class='small mt-2'
                :class='addError ? "text-danger" : "text-success"'
            >
                {{ addStatus }}
            </div>

            <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                Download Raw Data
            </p>
            <div class='d-flex flex-wrap gap-2'>
                <button
                    v-for='o in downloads'
                    :key='o.name'
                    type='button'
                    class='btn btn-sm btn-outline-secondary'
                    :disabled='!!downloading'
                    @click='download(o.name)'
                >
                    {{ downloading === o.name ? 'Saving…' : o.label }}
                </button>
            </div>
            <div
                v-if='downloadStatus'
                class='small mt-2'
                :class='downloadError ? "text-danger" : "text-muted"'
            >
                {{ downloadStatus }}
            </div>
            <div
                v-if='expires'
                class='form-text'
            >
                Kept on WiSAR until {{ expires }}. Add to DataSync or download anything you need to keep.
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useMapStore } from '../../../../../src/stores/map.ts';
import { useIncident } from '../../composables/useIncident.ts';
import { useWisar } from '../../composables/useWisar.ts';
import { describeSave, saveGeneratedFile } from '../../lib/fileTarget.ts';
import { addContoursToDataSync } from '../../lib/wisarDataSync.ts';
import { clearPreview, showPreview, type PreviewMap } from '../../lib/wisarPreview.ts';
import {
    OUTPUT_LABELS,
    contourKey,
    contourLabel,
    selectContours,
    sortedContours,
    type DataSyncTarget,
} from '../../lib/wisarResults.ts';
import type { ContourCollection, Job, OutputName } from '../../lib/wisar.ts';

const props = defineProps<{
    /** A succeeded Travel Time or TARR job. */
    job: Job;
}>();

const { activeMission } = useIncident();
const { client } = useWisar();
const mapStore = useMapStore();

const contours = ref<ContourCollection | null>(null);
const loading = ref(false);
const loadError = ref('');
const previewOn = ref(false);
/** Contours checked for preview and DataSync (all, after each run). */
const selected = ref<Set<string>>(new Set());
const target = ref<DataSyncTarget>('active');
const adding = ref(false);
const addStatus = ref('');
const addError = ref(false);
const downloading = ref<OutputName | ''>('');
const downloadStatus = ref('');
const downloadError = ref(false);

const rows = computed(() => (contours.value ? sortedContours(contours.value) : []));
const warnings = computed(() => props.job.result?.warnings ?? []);
const downloads = computed(() => OUTPUT_LABELS.filter((o) => props.job.outputs?.[o.name]));
const expires = computed(() => {
    const at = props.job.expires_at ? new Date(props.job.expires_at) : null;
    return at && !Number.isNaN(at.getTime()) ? at.toLocaleString() : '';
});

function map(): PreviewMap | null {
    return (mapStore.map as unknown as PreviewMap | undefined) ?? null;
}

function chosen(): ContourCollection | null {
    return contours.value ? selectContours(contours.value, selected.value) : null;
}

function setPreview(on: boolean, fit = true): void {
    const m = map();
    if (!m) return;
    const fc = chosen();
    if (on && fc?.features.length) showPreview(m, fc, { fit });
    else clearPreview(m);
    previewOn.value = on && !!fc?.features.length;
}

function toggleContour(key: string): void {
    const next = new Set(selected.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selected.value = next;
    if (previewOn.value) setPreview(next.size > 0, false); // keep the preview in step with the checkboxes
}

function togglePreview(): void {
    setPreview(!previewOn.value);
}

async function load(): Promise<void> {
    setPreview(false);
    contours.value = null;
    loadError.value = '';
    addStatus.value = '';
    downloadStatus.value = '';
    loading.value = true;
    try {
        contours.value = await client.value.contours(props.job);
        selected.value = new Set(rows.value.map(contourKey));
        if (rows.value.length) setPreview(true);
    } catch (err) {
        loadError.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

async function addToDataSync(): Promise<void> {
    const mission = activeMission.value;
    const fc = chosen();
    if (!mission || !fc?.features.length) return;
    adding.value = true;
    addStatus.value = '';
    addError.value = false;
    try {
        const r = await addContoursToDataSync(mission, props.job, fc, target.value);
        const parts = [`Added ${r.posted} ring${r.posted === 1 ? '' : 's'} to ${r.missionName}${r.filed ? ` (${r.folderName})` : ''}.`];
        if (r.droppedParts || r.droppedHoles) {
            parts.push(`Each ring is the contour's main outline; ${r.droppedParts} detached piece(s) and ${r.droppedHoles} hole(s) are only in the downloads.`);
        }
        addStatus.value = parts.join(' ');
        setPreview(false); // the mission copy now shows on the map
    } catch (err) {
        addError.value = true;
        addStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        adding.value = false;
    }
}

async function download(name: OutputName): Promise<void> {
    downloading.value = name;
    downloadStatus.value = '';
    downloadError.value = false;
    try {
        const { blob, filename } = await client.value.output(props.job, name);
        const saved = await saveGeneratedFile(new Uint8Array(await blob.arrayBuffer()), filename, {
            mime: blob.type || 'application/octet-stream',
            subfolder: activeMission.value?.name,
        });
        downloadStatus.value = describeSave(saved);
    } catch (err) {
        downloadError.value = true;
        downloadStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        downloading.value = '';
    }
}

watch(() => props.job.id, () => { void load(); }, { immediate: true });

onBeforeUnmount(() => {
    setPreview(false);
});
</script>

<style scoped>
.wisar-swatch {
    display: inline-block;
    width: 14px;
    height: 10px;
    border: 2px solid;
    border-radius: 2px;
}
</style>
