<template>
    <div>
        <h3 class='mb-3'>
            Arizona Distance Traveled Statistics
        </h3>

        <TablerInput
            v-model='filter'
            class='mb-3'
            placeholder='Filter categories…'
            icon='search'
        />

        <TablerInlineAlert
            v-if='notice'
            class='mb-3'
            severity='success'
            title='Done'
            :description='notice'
        />
        <TablerInlineAlert
            v-if='error'
            class='mb-3'
            severity='danger'
            title='Error'
            :description='error'
        />

        <div
            v-if='!filteredRows.length'
            class='text-muted small'
        >
            No LPB categories match that filter.
        </div>

        <div
            v-else
            class='table-responsive'
        >
            <table class='table table-sm table-vcenter small mb-0 align-middle'>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th class='text-end'>
                            Cases
                        </th>
                        <th class='text-end'>
                            25%
                        </th>
                        <th class='text-end'>
                            50%
                        </th>
                        <th class='text-end'>
                            75%
                        </th>
                        <th class='text-end'>
                            90%
                        </th>
                        <th class='text-end'>
                            Max
                        </th>
                        <th class='text-end'>
                            Mean
                        </th>
                        <th class='text-end text-nowrap'>
                            Add to Map
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='row in filteredRows'
                        :key='row.category'
                    >
                        <td>{{ row.category }}</td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbCases(row.cases) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbMiles(row.qAmi) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbMiles(row.qBmi) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbMiles(row.qCmi) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbMiles(row.qDmi) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbMiles(row.maxMi) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            {{ formatLpbMiles(row.meanMi) }}
                        </td>
                        <td class='text-end text-nowrap'>
                            <button
                                type='button'
                                class='btn btn-outline-primary btn-sm'
                                @click='openAddToMap(row)'
                            >
                                Add to Map
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-if='modalRow'
            class='modal modal-blur incident-modal show d-block'
            tabindex='-1'
            role='dialog'
            @click.self='closeModal'
        >
            <div
                class='modal-dialog modal-dialog-centered modal-dialog-scrollable'
                role='document'
            >
                <div class='modal-content'>
                    <div class='modal-header'>
                        <h5 class='modal-title'>
                            {{ modalRow.category }}
                        </h5>
                        <button
                            type='button'
                            class='btn-close'
                            aria-label='Close'
                            @click='closeModal'
                        />
                    </div>
                    <div class='modal-body'>
                        <TablerInlineAlert
                            v-if='ippLoadError'
                            class='mb-3'
                            severity='warning'
                            title='IPP'
                            :description='ippLoadError'
                        />
                        <TablerInlineAlert
                            v-if='modalError'
                            class='mb-3'
                            severity='danger'
                            title='Error'
                            :description='modalError'
                        />

                        <p
                            v-if='ippCenter && ippStoredType'
                            class='text-muted small mb-3'
                        >
                            {{ formatIppSummary(ippCenter, ippStoredType) }}
                        </p>

                        <template v-else-if='!ippLoading && !ippLoadError'>
                            <p class='text-muted small mb-2'>
                                No IPP is set yet. Choose coordinates or a DataSync
                                point, then Add to Map will set the IPP and plot the rings.
                            </p>
                            <TablerInput
                                v-model='ippInput'
                                label='IPP Coordinates'
                                :disabled='!!selectedObjectUid'
                                placeholder='40.0150, -105.2705 or 40 00 54 -105 16 14'
                            />
                            <div class='form-text mb-3'>
                                <span
                                    v-if='selectedObjectUid'
                                    class='text-muted'
                                >Using selected DataSync object.</span>
                                <span
                                    v-else-if='parsedIpp'
                                    class='text-success'
                                >→ {{ parsedIpp.lat.toFixed(5) }}, {{ parsedIpp.lng.toFixed(5) }}</span>
                                <span
                                    v-else-if='ippInput'
                                    class='text-danger'
                                >→ unrecognized format</span>
                                <span v-else>Supports decimal degrees, DMS, DM, and MPS.</span>
                            </div>

                            <p class='text-uppercase text-white-50 small mb-1'>
                                OR Choose DataSync Object
                            </p>
                            <select
                                v-model='selectedObjectUid'
                                class='form-select form-select-sm mb-2'
                            >
                                <option value=''>
                                    — none (use coordinates above) —
                                </option>
                                <option
                                    v-for='m in missionMarkers'
                                    :key='m.uid'
                                    :value='m.uid'
                                >
                                    {{ m.callsign }}
                                </option>
                            </select>
                            <div
                                v-if='loadingFeatures'
                                class='form-text mb-3'
                            >
                                Loading mission objects…
                            </div>
                            <div
                                v-else-if='!missionMarkers.length'
                                class='form-text text-muted mb-3'
                            >
                                No point markers in the active DataSync.
                            </div>

                            <TablerEnum
                                v-model='ippTypeLabel'
                                label='IPP Type'
                                :options='IPP_TYPE_OPTIONS'
                            />
                        </template>

                        <p class='text-muted small mb-2 mt-3'>
                            Plot selected percentile rings at the incident IPP.
                        </p>
                        <label
                            v-for='opt in modalOptions'
                            :key='opt.id'
                            class='form-check'
                        >
                            <input
                                v-model='opt.selected'
                                type='checkbox'
                                class='form-check-input'
                            >
                            <span class='form-check-label'>{{ opt.label }}</span>
                        </label>
                    </div>
                    <div class='modal-footer'>
                        <button
                            type='button'
                            class='btn btn-secondary'
                            :disabled='pushing'
                            @click='closeModal'
                        >
                            Cancel
                        </button>
                        <button
                            type='button'
                            class='btn btn-primary'
                            :disabled='!canPlot'
                            @click='onAddToMap'
                        >
                            {{ pushing ? 'Sending…' : 'Add to Map' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if='modalRow'
            class='modal-backdrop fade show'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { TablerEnum, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import { usePluginSettings } from '../../composables/usePluginSettings.ts';
import { parseCoordinates } from '../../lib/coords.ts';
import {
    ensureIncidentIpp,
    listIncidentPointFeatures,
    type IncidentPointFeature,
} from '../../lib/ensureIncidentIpp.ts';
import { attachFeaturesToFolder, ensureMissionFolder } from '../../lib/folder.ts';
import {
    formatIppSummary,
    IPP_TYPE_OPTIONS,
    ippTypeFromLabel,
} from '../../lib/ippFormat.ts';
import { readIppFromSchema, type IppType } from '../../lib/ippPersistence.ts';
import {
    loadSchemaSubscription,
    schemaMission,
} from '../../lib/incidentSubscription.ts';
import {
    filterLpbRows,
    formatLpbCases,
    formatLpbMiles,
    lpbFolderName,
    LPB_RING_STYLE,
    lpbQuartileOptions,
    uniqueLpbFolderName,
    type LpbQuartileOption,
} from '../../lib/lpbTable.ts';
import { pushPolygonToMission } from '../../lib/missionFeatures.ts';
import { loadMissionSchema } from '../../lib/missionSchema.ts';
import { circleRing } from '../../lib/rings.ts';
import type { AzlpbEntry } from '../../lib/pluginSettings.ts';

const { activeMission, requireActiveMission } = useIncident();
const { lpbTable } = usePluginSettings();

const filter = ref('');
const notice = ref('');
const error = ref('');

const modalRow = ref<AzlpbEntry | null>(null);
const modalOptions = ref<LpbQuartileOption[]>([]);
const ippCenter = ref<[number, number] | null>(null);
const ippStoredType = ref<IppType | null>(null);
const ippLoadError = ref('');
const ippLoading = ref(false);
const pushing = ref(false);
const modalError = ref('');

const ippInput = ref('');
const selectedObjectUid = ref('');
const ippTypeLabel = ref(IPP_TYPE_OPTIONS[0]);
const missionMarkers = ref<IncidentPointFeature[]>([]);
const loadingFeatures = ref(false);

const filteredRows = computed(() => filterLpbRows(lpbTable.value, filter.value));

const selectedOptions = computed(() => modalOptions.value.filter((opt) => opt.selected));

const parsedIpp = computed(() => parseCoordinates(ippInput.value));

const pendingCenter = computed<[number, number] | null>(() => {
    if (selectedObjectUid.value) {
        const marker = missionMarkers.value.find((m) => m.uid === selectedObjectUid.value);
        return marker?.coords ?? null;
    }
    if (parsedIpp.value) return [parsedIpp.value.lng, parsedIpp.value.lat];
    return null;
});

const plotCenter = computed<[number, number] | null>(() => ippCenter.value ?? pendingCenter.value);

const canPlot = computed(() => (
    !!modalRow.value
    && selectedOptions.value.length > 0
    && !!plotCenter.value
    && !ippLoading.value
    && !pushing.value
    && !ippLoadError.value
));

function resetIppPicker(): void {
    ippInput.value = '';
    selectedObjectUid.value = '';
    ippTypeLabel.value = IPP_TYPE_OPTIONS[0];
    missionMarkers.value = [];
    loadingFeatures.value = false;
}

function closeModal(): void {
    if (pushing.value) return;
    modalRow.value = null;
    modalOptions.value = [];
    ippCenter.value = null;
    ippStoredType.value = null;
    ippLoadError.value = '';
    modalError.value = '';
    resetIppPicker();
}

async function loadIppAndMarkers(): Promise<void> {
    ippLoading.value = true;
    ippLoadError.value = '';
    ippCenter.value = null;
    ippStoredType.value = null;
    try {
        const mission = activeMission.value;
        if (!mission) {
            ippLoadError.value = 'Select or create an incident in Create | Open first.';
            return;
        }
        const sub = await loadSchemaSubscription(mission);
        const loaded = await loadMissionSchema(sub);
        const ipp = readIppFromSchema(loaded.schema);
        if (ipp) {
            ippCenter.value = [ipp.lng, ipp.lat];
            ippStoredType.value = ipp.type;
            return;
        }
        loadingFeatures.value = true;
        try {
            missionMarkers.value = await listIncidentPointFeatures(mission);
        } finally {
            loadingFeatures.value = false;
        }
    } catch (err) {
        ippLoadError.value = err instanceof Error ? err.message : String(err);
    } finally {
        ippLoading.value = false;
    }
}

function openAddToMap(row: AzlpbEntry): void {
    if (!requireActiveMission()) return;
    notice.value = '';
    error.value = '';
    modalError.value = '';
    resetIppPicker();
    modalRow.value = row;
    modalOptions.value = lpbQuartileOptions(row);
    void loadIppAndMarkers();
}

async function takenFolderNames(
    sub: Awaited<ReturnType<typeof loadSchemaSubscription>>,
): Promise<Set<string>> {
    const taken = new Set<string>();
    try {
        const layers = await sub.layer.list();
        for (const layer of layers) {
            if (layer.name) taken.add(layer.name);
        }
    } catch {
        // Local layer cache may be empty.
    }
    return taken;
}

async function onAddToMap(): Promise<void> {
    if (!canPlot.value) return;
    const mission = activeMission.value;
    const row = modalRow.value;
    if (!mission || !row) return;

    const rings = selectedOptions.value.filter((opt) => opt.meters > 0);
    if (!rings.length) {
        modalError.value = 'Selected rings have no distance to plot.';
        return;
    }

    pushing.value = true;
    notice.value = '';
    error.value = '';
    modalError.value = '';
    try {
        let center = ippCenter.value;
        if (!center) {
            const pending = pendingCenter.value;
            if (!pending) {
                modalError.value = 'Set IPP coordinates or choose a DataSync object.';
                return;
            }
            const result = await ensureIncidentIpp({
                mission,
                type: ippTypeFromLabel(ippTypeLabel.value),
                coords: pending,
                existingUid: selectedObjectUid.value || undefined,
            });
            center = result.coords;
        }

        const sub = await loadSchemaSubscription(mission);
        const planning = schemaMission(mission);
        const taken = await takenFolderNames(sub);
        const folderName = uniqueLpbFolderName(lpbFolderName(row.category), taken);
        let folderUid: string | undefined;
        try {
            const folder = await ensureMissionFolder(sub, folderName);
            folderUid = folder.uid;
        } catch (folderErr) {
            console.warn(folderErr);
        }

        const postedUids: string[] = [];
        for (const opt of rings) {
            postedUids.push(await pushPolygonToMission({
                missionGuid: planning.guid,
                missionToken: planning.missionToken,
                callsign: opt.label,
                ring: circleRing(center[0], center[1], opt.meters),
                center,
                style: LPB_RING_STYLE,
                folderUid,
            }));
        }

        if (folderUid) {
            try {
                await attachFeaturesToFolder(sub, folderUid, postedUids);
            } catch (attachErr) {
                console.warn(attachErr);
            }
        }

        const n = postedUids.length;
        notice.value = `Added ${n} LPB ring${n === 1 ? '' : 's'} for ${row.category}${folderUid ? ` (${folderName})` : ''}.`;
        pushing.value = false;
        closeModal();
    } catch (err) {
        modalError.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}
</script>
