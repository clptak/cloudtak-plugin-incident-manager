<template>
    <div>
        <h3 class='mb-3'>
            Arizona Distance Traveled Statistics
        </h3>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center w-100'>
                    <span>Plot rings around</span>
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm ms-auto'
                        :disabled='loadingCenters'
                        @click='loadCenters'
                    >
                        {{ loadingCenters ? 'Loading…' : 'Refresh' }}
                    </button>
                </p>
            </template>
            <select
                v-model='centerChoice'
                class='form-select form-select-sm mb-2'
            >
                <option
                    v-for='c in centerChoices'
                    :key='c.value'
                    :value='c.value'
                >
                    {{ c.label }}
                </option>
                <option value='manual'>
                    Enter coordinates…
                </option>
            </select>
            <template v-if='centerChoice === "manual"'>
                <TablerInput
                    v-model='manualInput'
                    placeholder='33.4484, -112.0740 or 33 26 54 -112 04 26'
                />
                <div class='form-text'>
                    <span
                        v-if='parsedManual'
                        class='text-success'
                    >→ {{ parsedManual.lat.toFixed(5) }}, {{ parsedManual.lng.toFixed(5) }}</span>
                    <span
                        v-else-if='manualInput'
                        class='text-danger'
                    >→ unrecognized format</span>
                    <span v-else>Supports decimal degrees, DMS, DM, and MPS.</span>
                </div>
            </template>
            <div class='form-text'>
                Try any location for planning. Plotting rings does not set the IPP — that
                is set in Search Area.
            </div>
            <TablerInlineAlert
                v-if='centerError'
                class='mt-2'
                severity='warning'
                title='Locations'
                :description='centerError'
            />
        </TablerBorder>

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
            <table class='table table-sm table-vcenter table-hover small mb-0 align-middle'>
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
                            v-if='modalError'
                            class='mb-3'
                            severity='danger'
                            title='Error'
                            :description='modalError'
                        />
                        <p
                            v-if='plotCenter'
                            class='text-muted small mb-2'
                        >
                            {{ lpbCenterSummary(plotCenterLabel, plotCenter) }}
                        </p>
                        <p
                            v-else
                            class='text-warning small mb-2'
                        >
                            Choose a location under "Plot rings around" first.
                        </p>
                        <p class='text-muted small mb-2 mt-3'>
                            Plot the selected percentile rings:
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
                            class='btn btn-azure'
                            title='The incident DataSync field teams see'
                            :disabled='!canPlot'
                            @click='onAddToMap("field")'
                        >
                            {{ pushing === 'field' ? 'Adding…' : 'FIELD' }}
                        </button>
                        <button
                            type='button'
                            class='btn btn-purple'
                            :title='activeMission?.mgmt ? "The sworn-only planning DataSync" : "This incident has no MGMT DataSync"'
                            :disabled='!canPlot || !activeMission?.mgmt'
                            @click='onAddToMap("mgmt")'
                        >
                            {{ pushing === 'mgmt' ? 'Adding…' : 'MGMT' }}
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
import { computed, ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import { usePluginSettings } from '../../composables/usePluginSettings.ts';
import { parseCoordinates } from '../../lib/coords.ts';
import { listIncidentPointFeatures } from '../../lib/ensureIncidentIpp.ts';
import { attachFeaturesToFolder, ensureMissionFolder } from '../../lib/folder.ts';
import { readIppFromSchema } from '../../lib/ippPersistence.ts';
import {
    loadIncidentSubscription,
    loadSchemaSubscription,
    missionAuthToken,
    schemaMission,
} from '../../lib/incidentSubscription.ts';
import { lpbCenterChoices, lpbCenterSummary, type LpbCenterChoice } from '../../lib/lpbCenter.ts';
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

type Target = 'field' | 'mgmt';

const { activeMission, requireActiveMission } = useIncident();
const { lpbTable } = usePluginSettings();

const filter = ref('');
const notice = ref('');
const error = ref('');

const modalRow = ref<AzlpbEntry | null>(null);
const modalOptions = ref<LpbQuartileOption[]>([]);
const pushing = ref<Target | null>(null);
const modalError = ref('');

const centerChoices = ref<LpbCenterChoice[]>([]);
const centerChoice = ref('manual');
const manualInput = ref('');
const loadingCenters = ref(false);
const centerError = ref('');

const filteredRows = computed(() => filterLpbRows(lpbTable.value, filter.value));

const selectedOptions = computed(() => modalOptions.value.filter((opt) => opt.selected));

const parsedManual = computed(() => parseCoordinates(manualInput.value));

const plotCenter = computed<[number, number] | null>(() => {
    if (centerChoice.value === 'manual') {
        return parsedManual.value ? [parsedManual.value.lng, parsedManual.value.lat] : null;
    }
    return centerChoices.value.find((c) => c.value === centerChoice.value)?.coords ?? null;
});

const plotCenterLabel = computed(() => (centerChoice.value === 'manual'
    ? 'the entered coordinates'
    : centerChoices.value.find((c) => c.value === centerChoice.value)?.label ?? ''));

const canPlot = computed(() => (
    !!modalRow.value
    && selectedOptions.value.length > 0
    && !!plotCenter.value
    && !pushing.value
));

/** IPP, subjects' estimated locations and DataSync markers to centre rings on. */
async function loadCenters(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) {
        centerChoices.value = [];
        return;
    }
    loadingCenters.value = true;
    centerError.value = '';
    try {
        let schema = null;
        let ippType: string | undefined;
        try {
            const loaded = await loadMissionSchema(await loadSchemaSubscription(mission));
            schema = loaded.schema;
            ippType = readIppFromSchema(loaded.schema)?.type;
        } catch (err) {
            centerError.value = `Could not read the IPP and subjects: ${err instanceof Error ? err.message : String(err)}`;
        }
        const markers = await listIncidentPointFeatures(mission);
        centerChoices.value = lpbCenterChoices({ schema, ippType, markers });
        if (!centerChoices.value.some((c) => c.value === centerChoice.value) && centerChoice.value !== 'manual') {
            centerChoice.value = 'manual';
        }
        if (centerChoice.value === 'manual' && !manualInput.value && centerChoices.value.length) {
            centerChoice.value = centerChoices.value[0].value;
        }
    } catch (err) {
        centerError.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingCenters.value = false;
    }
}

watch(() => activeMission.value?.guid, () => void loadCenters(), { immediate: true });

function closeModal(): void {
    if (pushing.value) return;
    modalRow.value = null;
    modalOptions.value = [];
    modalError.value = '';
}

function openAddToMap(row: AzlpbEntry): void {
    if (!requireActiveMission()) return;
    notice.value = '';
    error.value = '';
    modalError.value = '';
    modalRow.value = row;
    modalOptions.value = lpbQuartileOptions(row);
}

async function takenFolderNames(
    sub: Awaited<ReturnType<typeof loadIncidentSubscription>>,
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

async function onAddToMap(target: Target): Promise<void> {
    if (!canPlot.value) return;
    const mission = activeMission.value;
    const row = modalRow.value;
    const center = plotCenter.value;
    if (!mission || !row || !center) return;
    if (target === 'mgmt' && !mission.mgmt) return;

    const rings = selectedOptions.value.filter((opt) => opt.meters > 0);
    if (!rings.length) {
        modalError.value = 'Selected rings have no distance to plot.';
        return;
    }

    pushing.value = target;
    notice.value = '';
    error.value = '';
    modalError.value = '';
    try {
        const sub = target === 'mgmt' ? await loadSchemaSubscription(mission) : await loadIncidentSubscription(mission);
        const dest = target === 'mgmt'
            ? schemaMission(mission)
            : { guid: mission.guid, name: mission.name, missionToken: missionAuthToken(mission) };
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
                missionGuid: dest.guid,
                missionToken: dest.missionToken,
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
        notice.value = `Added ${n} LPB ring${n === 1 ? '' : 's'} for ${row.category} to the ${target === 'mgmt' ? 'MGMT' : 'FIELD'} DataSync (${dest.name})${folderUid ? `, folder ${folderName}` : ''}.`;
        pushing.value = null;
        closeModal();
    } catch (err) {
        modalError.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = null;
    }
}
</script>
