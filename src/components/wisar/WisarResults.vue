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

            <template v-if='overlays'>
                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    Map Layers
                </p>
                <div
                    v-if='!overlays.length'
                    class='small text-muted'
                >
                    No map layers were drawn for this run.
                </div>
                <template v-else>
                    <div
                        v-for='o in overlays'
                        :key='o.id'
                        class='d-flex flex-wrap align-items-center gap-2 small mb-1'
                    >
                        <button
                            type='button'
                            class='btn btn-sm'
                            :class='overlayOn(o.id) ? "btn-primary" : "btn-outline-secondary"'
                            :disabled='overlayBusy(o.id)'
                            @click='toggleOverlay(o)'
                        >
                            {{ overlayBusy(o.id) ? 'Loading…' : overlayOn(o.id) ? 'Hide preview' : 'Preview' }}
                        </button>
                        <button
                            v-if='overlayOn(o.id) || keepBusy(o.id)'
                            type='button'
                            class='btn btn-sm btn-primary'
                            :disabled='keepBusy(o.id)'
                            title='Add it to your CloudTAK Overlays (only you see it)'
                            @click='keep(o)'
                        >
                            {{ keepLabel(o.id) }}
                        </button>
                        <span>{{ o.title }}</span>
                        <span
                            v-if='overlayError(o.id)'
                            class='text-danger'
                        >{{ overlayError(o.id) }}</span>
                        <span
                            v-if='keepMessage(o.id)'
                            :class='keepState[o.id]?.error ? "text-danger" : "text-success"'
                        >{{ keepMessage(o.id) }}</span>
                    </div>
                    <div class='form-text mt-0'>
                        Previews are temporary and only on your map, drawn like the WiSAR web tool's layers.
                        Keep adds a previewed layer to your CloudTAK Overlays (only you see it).
                    </div>
                </template>
            </template>

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
import { clearPreview, previewSourceId, showPreview, type PreviewMap } from '../../lib/wisarPreview.ts';
import { OVERLAY_OPACITY, clearOverlay, overlaySourceId, showOverlay, type OverlayMap } from '../../lib/wisarOverlays.ts';
import { keepOverlay, keptLayerName, type KeepPhase } from '../../lib/wisarKeep.ts';
import { cloudTakKeepDeps } from '../../composables/wisarKeepDeps.ts';
import {
    OUTPUT_LABELS,
    contourKey,
    contourLabel,
    selectContours,
    sortedContours,
    type DataSyncTarget,
} from '../../lib/wisarResults.ts';
import type { ContourCollection, Job, OutputName, Overlay } from '../../lib/wisar.ts';

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
/** This panel's own preview layer, separate from any other results panel. */
const previewSource = previewSourceId();

/** Colored map layers WiSAR drew for this job (1.1.0+); null on an older WiSAR. */
const overlays = computed<Overlay[] | null>(() => props.job.result?.overlays ?? null);
const overlayState = ref<Record<string, { on: boolean; busy: boolean; error: string }>>({});

function overlayOn(id: string): boolean { return !!overlayState.value[id]?.on; }
function overlayBusy(id: string): boolean { return !!overlayState.value[id]?.busy; }
function overlayError(id: string): string { return overlayState.value[id]?.error ?? ''; }

function overlayMap(): OverlayMap | null {
    return (mapStore.map as unknown as OverlayMap | undefined) ?? null;
}

function hideOverlay(id: string): void {
    const m = overlayMap();
    if (m) clearOverlay(m, overlaySourceId(previewSource, id));
    overlayState.value = { ...overlayState.value, [id]: { on: false, busy: false, error: '' } };
}

function hideAllOverlays(): void {
    for (const id of Object.keys(overlayState.value)) hideOverlay(id);
    overlayState.value = {};
}

/** Keep (5d): per layer, the current step and the result. */
const keepState = ref<Record<string, { phase: KeepPhase | ''; message: string; error: boolean }>>({});
const keepAborts = new Map<string, AbortController>();
const KEEP_LABELS: Record<KeepPhase, string> = {
    uploading: 'Uploading…', converting: 'Converting…', adding: 'Adding…', done: 'Kept',
};

function keepBusy(id: string): boolean {
    const p = keepState.value[id]?.phase;
    return p === 'uploading' || p === 'converting' || p === 'adding';
}
function keepLabel(id: string): string {
    const p = keepState.value[id]?.phase;
    return p && p !== 'done' ? KEEP_LABELS[p] : 'Keep';
}
function keepMessage(id: string): string { return keepState.value[id]?.message ?? ''; }

/**
 * Keep: send the layer's RGBA GeoTIFF through CloudTAK Imports and add it to
 * the user's Overlays once tiled. The temporary preview is then removed.
 */
async function keep(o: Overlay): Promise<void> {
    if (keepBusy(o.id)) return;
    const ac = new AbortController();
    keepAborts.set(o.id, ac);
    const name = keptLayerName(props.job, o.title);
    const set = (v: { phase: KeepPhase | ''; message: string; error: boolean }) => {
        keepState.value = { ...keepState.value, [o.id]: v };
    };
    set({ phase: 'uploading', message: '', error: false });
    try {
        const { blob } = await client.value.output(props.job, o.geotiff);
        await keepOverlay(cloudTakKeepDeps(), blob, name, {
            signal: ac.signal,
            onPhase: (phase) => set({ phase, message: '', error: false }),
        });
        set({ phase: 'done', message: `Added to your Overlays as “${name}”.`, error: false });
        hideOverlay(o.id);
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        set({ phase: '', message: err instanceof Error ? err.message : String(err), error: true });
    } finally {
        if (keepAborts.get(o.id) === ac) keepAborts.delete(o.id);
    }
}

function stopKeeps(): void {
    for (const ac of keepAborts.values()) ac.abort();
    keepAborts.clear();
    keepState.value = {};
}

/** The PNG decoded onto an off-screen canvas: no request, so CloudTAK's CSP can't block it. */
async function pngCanvas(blob: Blob): Promise<HTMLCanvasElement> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw the preview.');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
}

/** Preview: fetch the layer's PNG with the CloudTAK token and draw it under the contours. */
async function toggleOverlay(o: Overlay): Promise<void> {
    if (overlayOn(o.id)) {
        hideOverlay(o.id);
        return;
    }
    const m = overlayMap();
    if (!m) return;
    const jobId = props.job.id;
    overlayState.value = { ...overlayState.value, [o.id]: { on: false, busy: true, error: '' } };
    try {
        const { blob } = await client.value.output(props.job, o.png);
        const canvas = await pngCanvas(blob);
        if (props.job.id !== jobId) return; // a new run replaced this one meanwhile
        showOverlay(m, overlaySourceId(previewSource, o.id), canvas, o.bounds, {
            opacity: OVERLAY_OPACITY,
            beforeId: `${previewSource}-fill`,
        });
        overlayState.value = { ...overlayState.value, [o.id]: { on: true, busy: false, error: '' } };
    } catch (err) {
        overlayState.value = { ...overlayState.value, [o.id]: {
            on: false, busy: false, error: err instanceof Error ? err.message : String(err),
        } };
    }
}
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
    if (on && fc?.features.length) showPreview(m, fc, { fit, source: previewSource });
    else clearPreview(m, previewSource);
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
    hideAllOverlays();
    stopKeeps();
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
    hideAllOverlays();
    // A Keep still converting stays in the user's Files; it just isn't added to Overlays
    stopKeeps();
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
