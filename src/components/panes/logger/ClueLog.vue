<template>
    <div>
        <TablerInlineAlert
            v-if='!activeMission'
            severity='warning'
            title='Mission Required'
            description='Select or create an incident in Create | Open first.'
        />

        <template v-else>
            <TablerInlineAlert
                v-if='error'
                class='mb-3'
                severity='danger'
                title='Error'
                :description='error'
            />
            <TablerInlineAlert
                v-if='notice'
                class='mb-3'
                severity='success'
                title='Done'
                :description='notice'
            />

            <!-- ── Create clue log (from the Clue Found template) ─────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Clue Found — Create Log
                    </p>
                </template>

                <div class='row g-2'>
                    <div class='col-md-2'>
                        <TablerInput
                            :model-value='String(newNumber)'
                            label='Clue Number'
                            :disabled='true'
                        />
                        <div class='form-text'>
                            Auto-assigned
                        </div>
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label'>Clue Validation</label>
                        <select
                            v-model='form.validation'
                            class='form-select form-select-sm'
                        >
                            <option
                                v-for='v in CLUE_VALIDATIONS'
                                :key='v'
                                :value='v'
                            >
                                {{ v }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label'>Clue Disposition</label>
                        <select
                            v-model='form.disposition'
                            class='form-select form-select-sm'
                        >
                            <option value=''>
                                —
                            </option>
                            <option
                                v-for='d in CLUE_DISPOSITIONS'
                                :key='d'
                                :value='d'
                            >
                                {{ d }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-5'>
                        <TablerInput
                            v-model='form.finder'
                            label='Clue Finder (Team or Person)'
                            placeholder='Auto-filled from your callsign'
                        />
                    </div>
                    <div class='col-md-7'>
                        <label class='form-label d-flex align-items-center'>
                            Clue marker / photo on the map
                            <button
                                class='btn btn-link btn-sm p-0 ms-auto'
                                :disabled='loadingMarkers'
                                @click='loadMarkers'
                            >
                                {{ loadingMarkers ? 'Loading…' : 'Refresh' }}
                            </button>
                        </label>
                        <select
                            v-model='form.markerUid'
                            class='form-select form-select-sm'
                        >
                            <option value=''>
                                — none —
                            </option>
                            <option
                                v-for='m in markers'
                                :key='m.uid'
                                :value='m.uid'
                            >
                                {{ m.callsign }} ({{ m.source }})
                            </option>
                        </select>
                    </div>
                    <div class='col-md-5'>
                        <TablerInput
                            v-model='form.notes'
                            label='Notes (optional)'
                        />
                    </div>
                </div>
                <div class='d-flex align-items-center gap-2 mt-2'>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='busy || !form.finder.trim()'
                        @click='onSaveLog'
                    >
                        {{ busy ? 'Saving…' : 'Save Log' }}
                    </button>
                    <span class='form-text'>
                        Logs to {{ logTargetLabel }}.
                    </span>
                </div>
            </TablerBorder>

            <!-- ── Tracked clues across all syncs ─────────────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center w-100'>
                        <span>Clues ({{ clues.length }})</span>
                        <button
                            class='btn btn-outline-primary btn-sm ms-auto'
                            :disabled='loading'
                            @click='refresh'
                        >
                            {{ loading ? 'Loading…' : 'Refresh' }}
                        </button>
                    </p>
                </template>

                <div
                    v-if='!clues.length'
                    class='text-muted small'
                >
                    No clues logged yet.
                </div>
                <div
                    v-else
                    class='table-responsive'
                >
                    <table class='table table-sm small mb-0 align-middle'>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Marker</th>
                                <th>Validation</th>
                                <th>Disposition</th>
                                <th>Finder</th>
                                <th>Sync</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='clue in clues'
                                :key='clue.logId'
                            >
                                <td><strong>{{ clue.number }}</strong></td>
                                <td>
                                    <button
                                        v-if='clue.markerUid'
                                        class='btn btn-link btn-sm p-0 align-baseline'
                                        title='Center map on this clue'
                                        @click='onFlyTo(clue.markerUid)'
                                    >
                                        {{ clue.markerCallsign || clue.markerUid }}
                                    </button>
                                    <span
                                        v-else
                                        class='text-muted'
                                    >—</span>
                                </td>
                                <td>
                                    <select
                                        :value='clue.validation'
                                        class='form-select form-select-sm w-auto'
                                        :disabled='busy'
                                        @change='onValidationChange(clue, $event)'
                                    >
                                        <option
                                            v-for='v in CLUE_VALIDATIONS'
                                            :key='v'
                                            :value='v'
                                        >
                                            {{ v }}
                                        </option>
                                    </select>
                                </td>
                                <td>
                                    <select
                                        :value='clue.disposition'
                                        class='form-select form-select-sm w-auto'
                                        :disabled='busy'
                                        @change='onDispositionChange(clue, $event)'
                                    >
                                        <option value=''>
                                            —
                                        </option>
                                        <option
                                            v-for='d in CLUE_DISPOSITIONS'
                                            :key='d'
                                            :value='d'
                                        >
                                            {{ d }}
                                        </option>
                                    </select>
                                </td>
                                <td>{{ clue.finder || '—' }}</td>
                                <td class='text-muted'>
                                    {{ clue.sourceLabel }}
                                </td>
                                <td class='text-muted text-nowrap'>
                                    {{ shortDt(clue.at) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </TablerBorder>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import Subscription from '../../../../../../src/base/subscription.ts';
import ProfileConfig from '../../../../../../src/base/profile.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../../../domain/entities.ts';
import { currentOpPeriod } from '../../../domain/registry.ts';
import {
    CLUE_DISPOSITIONS,
    CLUE_VALIDATIONS,
    createClueLog,
    listTrackedClues,
    nextClueNumber,
    updateClueLog,
    type ClueDisposition,
    type ClueValidation,
    type TrackedClue,
} from '../../../lib/clueLog.ts';
import { clueSources } from '../../../lib/clueLog.ts';
import { flyToFeature } from '../../../lib/flyToFeature.ts';
import { createRegistryStore } from '../../../lib/registryPersistence.ts';

const { activeMission } = useIncident();

const registry = ref<OpPeriodRegistryEntry[]>([]);
const clues = ref<TrackedClue[]>([]);
const markers = ref<{ uid: string; callsign: string; source: string }[]>([]);
const loading = ref(false);
const loadingMarkers = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const form = reactive({
    validation: 'Pending' as ClueValidation,
    disposition: '' as ClueDisposition | '',
    finder: '',
    markerUid: '',
    notes: '',
});

const newNumber = computed(() => nextClueNumber(clues.value));
const currentOp = computed(() => currentOpPeriod(registry.value));
const logTargetLabel = computed(() =>
    currentOp.value ? currentOp.value.name : activeMission.value?.name ?? '');

function shortDt(iso: string): string {
    return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}

async function refresh(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    loading.value = true;
    error.value = '';
    try {
        registry.value = mission.mgmt ? await createRegistryStore(mission).load() : [];
        clues.value = await listTrackedClues(mission, registry.value);
        if (!form.finder.trim()) {
            try {
                const profile = await ProfileConfig.fetch();
                form.finder = (profile as { tak_callsign?: string }).tak_callsign ?? '';
            } catch { /* leave editable */ }
        }
        await loadMarkers();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

/** Point markers (incl. photo markers) across the incident's syncs. */
async function loadMarkers(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    loadingMarkers.value = true;
    try {
        const found: { uid: string; callsign: string; source: string }[] = [];
        const seen = new Set<string>();
        for (const source of clueSources(mission, registry.value)) {
            try {
                const sub = await Subscription.load(source.guid, {
                    missiontoken: source.token || undefined,
                    reload: false,
                });
                const feats = await sub.feature.list({ refresh: true }) as unknown as {
                    id?: string | number;
                    properties?: { callsign?: string };
                    geometry?: { type?: string };
                }[];
                for (const f of feats) {
                    const uid = String(f.id ?? '');
                    if (!uid || seen.has(uid) || f.geometry?.type !== 'Point') continue;
                    if (!f.properties?.callsign) continue;
                    seen.add(uid);
                    found.push({ uid, callsign: f.properties.callsign, source: source.label });
                }
            } catch { /* skip */ }
        }
        markers.value = found;
    } finally {
        loadingMarkers.value = false;
    }
}

async function onSaveLog(): Promise<void> {
    const mission = activeMission.value;
    if (!mission || !form.finder.trim()) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const marker = markers.value.find((m) => m.uid === form.markerUid);
        const target = currentOp.value
            ? { guid: currentOp.value.guid, token: currentOp.value.ownerToken }
            : { guid: mission.guid, token: mission.missionToken };
        await createClueLog(target, {
            number: newNumber.value,
            validation: form.validation,
            disposition: form.disposition,
            finder: form.finder,
            markerUid: form.markerUid || undefined,
            markerCallsign: marker?.callsign,
            notes: form.notes,
        });
        notice.value = `Clue #${newNumber.value} logged to ${logTargetLabel.value}.`;
        form.validation = 'Pending';
        form.disposition = '';
        form.markerUid = '';
        form.notes = '';
        clues.value = await listTrackedClues(mission, registry.value);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onValidationChange(clue: TrackedClue, event: Event): Promise<void> {
    const validation = (event.target as HTMLSelectElement).value as ClueValidation;
    busy.value = true;
    try {
        await updateClueLog(clue, { validation });
        clue.validation = validation;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onDispositionChange(clue: TrackedClue, event: Event): Promise<void> {
    const disposition = (event.target as HTMLSelectElement).value as ClueDisposition | '';
    busy.value = true;
    try {
        await updateClueLog(clue, { disposition });
        clue.disposition = disposition;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onFlyTo(uid: string): Promise<void> {
    const found = await flyToFeature(uid);
    if (!found) error.value = 'Clue marker is not rendered on your map — check its mission overlay is loaded.';
}

onMounted(refresh);
watch(() => activeMission.value?.guid, refresh);
</script>
