<template>
    <div>
        <!-- 1 · IPP -->
        <div
            v-if='expanded !== "ipp"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center user-select-none'
            :class='openable(0) ? "cursor-pointer" : "opacity-50"'
            :style='openable(0) ? "cursor:pointer" : "cursor:not-allowed"'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggle("ipp", 0)'
            @keydown.enter.prevent='toggle("ipp", 0)'
            @keydown.space.prevent='toggle("ipp", 0)'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Initial Planning Point (IPP)
            </p>
            <span
                v-if='stepDone.ipp'
                class='badge bg-success text-white ms-2'
            >set</span>
            <IconLock
                v-else-if='!openable(0)'
                :size='16'
                stroke='1.5'
                class='ms-2 text-white-50'
            />
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='toggle("ipp", 0)'
                    @keydown.enter.prevent='toggle("ipp", 0)'
                    @keydown.space.prevent='toggle("ipp", 0)'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Initial Planning Point (IPP)
                    </p>
                    <span
                        v-if='stepDone.ipp'
                        class='badge bg-success text-white ms-2'
                    >set</span>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <TablerInput
                    v-model='ippInput'
                    label='IPP Coordinates'
                    :disabled='!!selectedObjectUid'
                    placeholder='40.0150, -105.2705 or 40 00 54 -105 16 14'
                />
                <div class='form-text'>
                    <span
                        v-if='selectedObjectUid'
                        class='text-muted'
                    >Using selected DataSync object.</span>
                    <span
                        v-else-if='ipp'
                        class='text-success'
                    >→ {{ ipp.lat.toFixed(5) }}, {{ ipp.lng.toFixed(5) }}</span>
                    <span
                        v-else-if='ippInput'
                        class='text-danger'
                    >→ unrecognized format</span>
                    <span v-else>Supports decimal degrees, DMS, DM, and MPS.</span>
                </div>

                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    OR Choose DataSync Object
                </p>
                <select
                    v-model='selectedObjectUid'
                    class='form-select form-select-sm'
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
                    class='form-text'
                >
                    Loading mission objects…
                </div>
                <div
                    v-else-if='!missionMarkers.length'
                    class='form-text text-muted'
                >
                    No point markers in the active DataSync.
                </div>

                <div class='mt-3'>
                    <TablerEnum
                        v-model='ippTypeLabel'
                        label='IPP Type'
                        :options='IPP_TYPE_OPTIONS'
                    />
                </div>

                <button
                    class='btn btn-primary mt-3'
                    :disabled='!canSetIpp || settingIpp'
                    @click='onSetIpp'
                >
                    {{ settingIpp ? 'Setting…' : 'Set IPP' }}
                </button>
            </div>
        </TablerBorder>

        <!-- 2 · Theoretical -->
        <div
            v-if='expanded !== "theoretical"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center user-select-none'
            :class='openable(1) ? "cursor-pointer" : "opacity-50"'
            :style='openable(1) ? "cursor:pointer" : "cursor:not-allowed"'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggle("theoretical", 1)'
            @keydown.enter.prevent='toggle("theoretical", 1)'
            @keydown.space.prevent='toggle("theoretical", 1)'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Theoretical Search Area
            </p>
            <span
                v-if='stepDone.theoretical'
                class='badge bg-success text-white ms-2'
            >added</span>
            <IconLock
                v-else-if='!openable(1)'
                :size='16'
                stroke='1.5'
                class='ms-2 text-white-50'
            />
            <span
                class='ms-auto d-inline-flex me-2'
                @click.stop
            >
                <NavHelpButton help-key='theoretical-search-area' />
            </span>
            <IconChevronDown
                class='transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='toggle("theoretical", 1)'
                    @keydown.enter.prevent='toggle("theoretical", 1)'
                    @keydown.space.prevent='toggle("theoretical", 1)'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Theoretical Search Area
                    </p>
                    <span
                        v-if='stepDone.theoretical'
                        class='badge bg-success text-white ms-2'
                    >added</span>
                    <span
                        class='ms-auto d-inline-flex me-2'
                        @click.stop
                    >
                        <NavHelpButton help-key='theoretical-search-area' />
                    </span>
                    <IconChevronDown
                        class='transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <TablerInput
                    v-model='timeMissing'
                    label='Time Missing'
                    type='datetime-local'
                />
                <TablerInput
                    v-model='timeReportedMissing'
                    label='Time Reported Missing'
                    type='datetime-local'
                />
                <TablerInput
                    v-model.number='travelSpeed'
                    label='Travel Speed (mph)'
                    type='number'
                    placeholder='e.g. 2.5'
                />
                <div
                    v-if='theoreticalMiles'
                    class='form-text'
                >
                    Radius: <strong>{{ theoreticalMiles.toFixed(2) }} mi</strong>
                    ({{ elapsedHours.toFixed(1) }} h elapsed × {{ travelSpeed }} mph)
                </div>
                <button
                    class='btn btn-primary btn-sm mt-2'
                    :disabled='!canPushTheoretical || pushing'
                    @click='onPushTheoretical'
                >
                    Add to DataSync
                </button>
            </div>
        </TablerBorder>

        <!-- 3 · Statistical / LPB -->
        <div
            v-if='expanded !== "statistical"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center user-select-none'
            :class='openable(2) ? "cursor-pointer" : "opacity-50"'
            :style='openable(2) ? "cursor:pointer" : "cursor:not-allowed"'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggle("statistical", 2)'
            @keydown.enter.prevent='toggle("statistical", 2)'
            @keydown.space.prevent='toggle("statistical", 2)'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Statistical Search Area (LPB)
            </p>
            <span
                v-if='stepDone.statistical'
                class='badge bg-success text-white ms-2'
            >added</span>
            <IconLock
                v-else-if='!openable(2)'
                :size='16'
                stroke='1.5'
                class='ms-2 text-white-50'
            />
            <span
                class='ms-auto d-inline-flex me-2'
                @click.stop
            >
                <NavHelpButton help-key='statistical-search-area' />
            </span>
            <IconChevronDown
                class='transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='toggle("statistical", 2)'
                    @keydown.enter.prevent='toggle("statistical", 2)'
                    @keydown.space.prevent='toggle("statistical", 2)'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Statistical Search Area (LPB)
                    </p>
                    <span
                        v-if='stepDone.statistical'
                        class='badge bg-success text-white ms-2'
                    >added</span>
                    <span
                        class='ms-auto d-inline-flex me-2'
                        @click.stop
                    >
                        <NavHelpButton help-key='statistical-search-area' />
                    </span>
                    <IconChevronDown
                        class='transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <TablerEnum
                    v-model='category'
                    label='Arizona Subject LPB Category'
                    :options='categories'
                />

                <span
                    class='badge rounded-pill mb-2 mt-2'
                    :class='casesPillClass'
                >
                    Cases: {{ selectedCases }}
                </span>

                <div class='table-responsive'>
                    <table class='table table-sm table-vcenter mb-0'>
                        <thead>
                            <tr>
                                <th>Ring</th><th>Percentile</th><th>Distance</th><th>Send</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='q in quartiles'
                                :key='q.key'
                            >
                                <td>
                                    <span :style='`color:${q.color}`'>●</span> {{ q.key }}
                                </td>
                                <td>{{ q.pct }}</td>
                                <td>{{ q.miles.toFixed(2) }} mi</td>
                                <td>
                                    <input
                                        v-model='q.selected'
                                        type='checkbox'
                                        class='form-check-input'
                                    >
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <button
                    class='btn btn-primary btn-sm mt-3'
                    :disabled='!canPushLpb || pushing'
                    @click='onPushLpb'
                >
                    {{ pushing ? 'Sending…' : 'Add selected rings to DataSync' }}
                </button>

                <div class='mt-3 pt-3 border-top'>
                    <button
                        v-if='!showCustomSource'
                        type='button'
                        class='btn btn-outline-secondary btn-sm'
                        @click='openCustomSource'
                    >
                        <IconPlus
                            :size='16'
                            class='me-1'
                        />
                        Add source
                    </button>

                    <div
                        v-else
                        class='cloudtak-accent border rounded-3 p-3'
                    >
                        <div class='d-flex align-items-center justify-content-between mb-2'>
                            <p class='text-uppercase text-white-50 small mb-0'>
                                Custom LPB Source
                            </p>
                            <button
                                type='button'
                                class='btn btn-sm btn-link text-muted p-0'
                                title='Remove custom source'
                                @click='closeCustomSource'
                            >
                                <IconX :size='18' />
                            </button>
                        </div>

                        <TablerInput
                            v-model='customSource'
                            label='Source'
                            placeholder='e.g. Regional SAR stats'
                        />

                        <TablerInput
                            v-model='customCategory'
                            label='Category'
                            placeholder='e.g. Adult hiker'
                        />

                        <p class='text-uppercase text-white-50 small mb-1 mt-2'>
                            Ranges
                        </p>
                        <div
                            v-for='(row, i) in customRanges'
                            :key='i'
                            class='input-group input-group-sm mb-2'
                        >
                            <input
                                v-model='row.label'
                                type='text'
                                class='form-control'
                                placeholder='Label (e.g. 25%)'
                                :aria-label='`Range ${i + 1} label`'
                            >
                            <input
                                v-model.number='row.distance'
                                type='number'
                                min='0'
                                step='any'
                                class='form-control'
                                placeholder='Distance'
                                style='max-width: 7rem'
                                :aria-label='`Range ${i + 1} distance`'
                            >
                            <select
                                v-model='row.unit'
                                class='form-select'
                                style='max-width: 5rem'
                                :aria-label='`Range ${i + 1} unit`'
                            >
                                <option value='mi'>
                                    mi
                                </option>
                                <option value='me'>
                                    me
                                </option>
                            </select>
                            <button
                                type='button'
                                class='btn btn-outline-secondary'
                                :disabled='customRanges.length <= 1'
                                title='Remove range'
                                @click='removeCustomRange(i)'
                            >
                                <IconX :size='16' />
                            </button>
                        </div>
                        <button
                            type='button'
                            class='btn btn-outline-secondary btn-sm mb-2'
                            :disabled='customRanges.length >= MAX_CUSTOM_RANGES'
                            @click='addCustomRange'
                        >
                            <IconPlus
                                :size='16'
                                class='me-1'
                            />
                            Add range
                        </button>
                        <div
                            v-if='customRanges.length >= MAX_CUSTOM_RANGES'
                            class='form-text mb-2'
                        >
                            Maximum of {{ MAX_CUSTOM_RANGES }} ranges.
                        </div>

                        <button
                            class='btn btn-primary btn-sm d-block'
                            :disabled='!canPushCustomLpb || pushing'
                            @click='onPushCustomLpb'
                        >
                            {{ pushing ? 'Sending…' : 'Add rings to DataSync' }}
                        </button>
                    </div>
                </div>
            </div>
        </TablerBorder>

        <!-- 4 · Subjective -->
        <div
            v-if='expanded !== "subjective"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center user-select-none'
            :class='openable(3) ? "cursor-pointer" : "opacity-50"'
            :style='openable(3) ? "cursor:pointer" : "cursor:not-allowed"'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggle("subjective", 3)'
            @keydown.enter.prevent='toggle("subjective", 3)'
            @keydown.space.prevent='toggle("subjective", 3)'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Subjective Search Area
            </p>
            <span
                v-if='stepDone.subjective'
                class='badge bg-success text-white ms-2'
            >added</span>
            <IconLock
                v-else-if='!openable(3)'
                :size='16'
                stroke='1.5'
                class='ms-2 text-white-50'
            />
            <span
                class='ms-auto d-inline-flex me-2'
                @click.stop
            >
                <NavHelpButton help-key='subjective-search-area' />
            </span>
            <IconChevronDown
                class='transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
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
                    @click='toggle("subjective", 3)'
                    @keydown.enter.prevent='toggle("subjective", 3)'
                    @keydown.space.prevent='toggle("subjective", 3)'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Subjective Search Area
                    </p>
                    <span
                        v-if='stepDone.subjective'
                        class='badge bg-success text-white ms-2'
                    >added</span>
                    <span
                        class='ms-auto d-inline-flex me-2'
                        @click.stop
                    >
                        <NavHelpButton help-key='subjective-search-area' />
                    </span>
                    <IconChevronDown
                        class='transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <p class='text-uppercase text-white-50 small mb-1'>
                    Choose a polygon from the active DataSync
                </p>
                <select
                    v-model='subjectiveUid'
                    class='form-select form-select-sm'
                >
                    <option value=''>
                        — select a polygon —
                    </option>
                    <option
                        v-for='p in missionPolygons'
                        :key='p.uid'
                        :value='p.uid'
                    >
                        {{ p.callsign }}
                    </option>
                </select>
                <div
                    v-if='!missionPolygons.length'
                    class='form-text text-muted'
                >
                    No polygons in the active DataSync.
                </div>
                <button
                    class='btn btn-primary btn-sm mt-2'
                    :disabled='!canAddSubjective || pushing'
                    @click='onAddSubjective'
                >
                    Add to DataSync
                </button>
            </div>
        </TablerBorder>

        <!-- Recall: areas already on DataSync -->
        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Search Areas on DataSync ({{ sentAreas.length }})
                </p>
            </template>

            <div
                v-if='loadingAreas'
                class='text-muted small'
            >
                Loading…
            </div>
            <div
                v-else-if='!sentAreas.length'
                class='text-muted small'
            >
                No search areas sent yet. Set the IPP to begin.
            </div>
            <table
                v-else
                class='table table-sm table-vcenter mb-0'
            >
                <thead>
                    <tr><th>Area</th><th>Map Object</th><th>Area (mi²)</th><th class='text-end' /></tr>
                </thead>
                <tbody>
                    <template
                        v-for='row in recallRows'
                        :key='row.rowKey'
                    >
                        <tr
                            v-if='row.kind === "section"'
                            class='table-active'
                        >
                            <td
                                colspan='4'
                                class='fw-bold small py-1'
                            >
                                {{ row.label }}
                            </td>
                        </tr>
                        <tr
                            v-else-if='row.kind === "folder"'
                            class='table-light'
                        >
                            <td
                                colspan='4'
                                class='small text-muted py-1 ps-3'
                            >
                                {{ row.label }}
                            </td>
                        </tr>
                        <tr v-else>
                            <td :class='row.indent ? "ps-4" : ""'>
                                {{ row.area.label }}
                            </td>
                            <td>
                                <FeatureCallsignCell
                                    :uid='row.area.uuid'
                                    :callsign='callsignForUid(row.area.uuid, row.area.label)'
                                    @fly='onFlyTo(row.area.uuid)'
                                />
                            </td>
                            <td>{{ formatSqMi(areaForUid(row.area.uuid)) }}</td>
                            <td class='text-end'>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-link text-danger p-0'
                                    :disabled='pushing'
                                    @click='removeArea(row.area)'
                                >
                                    Remove
                                </button>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </TablerBorder>

        <!-- shared status -->
        <TablerInlineAlert
            v-if='!activeMission'
            class='mb-2'
            severity='warning'
            title='No Active Mission'
            description='Select one in Create | Open first.'
        />
        <div
            v-else
            class='form-text d-flex flex-wrap align-items-center gap-2 mb-2'
        >
            <span>Active DataSync: <strong>{{ activeMission.name }}</strong></span>
            <button
                type='button'
                class='btn btn-outline-primary btn-sm'
                :disabled='loadingFeatures'
                title='Reload markers and polygons from the active DataSync mission'
                @click='onRefreshFeatures'
            >
                {{ loadingFeatures ? 'Loading…' : 'Refresh map objects' }}
            </button>
        </div>
        <TablerInlineAlert
            v-if='status'
            :severity='statusError ? "danger" : "success"'
            :title='statusError ? "Error" : "Success"'
            :description='status'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { IconPlus, IconX, IconChevronDown, IconLock } from '@tabler/icons-vue';
import { TablerBorder, TablerInput, TablerEnum, TablerInlineAlert } from '@tak-ps/vue-tabler';
import type { Feature } from '../../../../../../src/types.ts';
import azlpb from '../../../data/azlpb_table.json';
import { parseCoordinates } from '../../../lib/coords.ts';
import { circleRing, milesToMeters, MILES_TO_METERS } from '../../../lib/rings.ts';
import { pushPolygonToMission, pushPointToMission, deletePolygonFromMission } from '../../../lib/missionFeatures.ts';
import type { RingStyle } from '../../../lib/missionFeatures.ts';
import { ensureMissionFolder, attachFeaturesToFolder } from '../../../lib/folder.ts';
import { flyToFeature } from '../../../lib/flyToFeature.ts';
import FeatureCallsignCell from '../../FeatureCallsignCell.vue';
import { areaSqMi, formatSqMi } from '../../../lib/geometryArea.ts';
import { loadMissionSchema } from '../../../lib/missionSchema.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import { loadIncidentSubscription, loadSchemaSubscription, missionAuthToken } from '../../../lib/incidentSubscription.ts';
import NavHelpButton from '../../NavHelpButton.vue';

const SEARCH_AREA_KEYWORD = 'search-area';
const SEARCH_AREA_FOLDER = 'Search Area';
const IPP_KEY = 'ipp';
const IPP_ICON = '83198b4872a8c34eb9c549da8a4de5a28f07821185b39a2277948f66c24ac17a/Wildfire/Fire Origin.png';
const LPB_RING_STYLE: RingStyle = {
    stroke: '#ff0000',
    fillOpacity: 0,
    strokeWidth: 2,
    strokeStyle: 'dotted',
};
const AZ_LPB_SOURCE = 'AZ';
const MAX_CUSTOM_RANGES = 4;
const IPP_TYPE_OPTIONS = ['LKP — Last Known Position', 'PLS — Point Last Seen'];

type LpbDistanceUnit = 'mi' | 'me';

interface CustomLpbRange {
    label: string;
    distance: number | null;
    unit: LpbDistanceUnit;
}

function emptyCustomRange(): CustomLpbRange {
    return { label: '', distance: null, unit: 'mi' };
}

interface MissionFeatureRef {
    uid: string;
    callsign: string;
    coords?: [number, number];
    areaSqMi?: number;
}

/** A search area recalled from a DataSync log entry. */
interface SentArea {
    key: string;       // stable identity, e.g. 'theoretical', 'lpb:m5k2x:A'
    label: string;     // callsign / display text
    uuid: string;      // CoT uuid of the referenced feature (entryUid)
    logId: string;     // mission-log entry id
    created: string;
    folder?: string;   // LPB mission folder name from keywords folder:…
}

type RecallRow =
    | { kind: 'section'; rowKey: string; label: string }
    | { kind: 'folder'; rowKey: string; label: string }
    | { kind: 'area'; rowKey: string; area: SentArea; indent?: boolean };

/** The mission-log wrapper, widened to carry the patched `entryUid` field. */
interface LogWriteBody {
    dtg?: string;
    content: string;
    keywords?: string[];
    entryUid?: string;
}
interface LogApi {
    create(body: LogWriteBody): Promise<{ id: string }>;
    update(logid: string, body: LogWriteBody): Promise<{ id: string }>;
    delete(logid: string): Promise<void>;
}

interface AzlpbEntry {
    category: string;
    cases: number;
    qAmi: number; qBmi: number; qCmi: number; qDmi: number;
}

const { activeMission, requireActiveMission } = useIncident();
const table = azlpb as AzlpbEntry[];

const ippInput = ref('');
const ipp = computed(() => parseCoordinates(ippInput.value));

const ippType = ref<'LKP' | 'PLS'>('LKP');
const ippTypeLabel = computed({
    get(): string {
        return ippType.value === 'PLS' ? IPP_TYPE_OPTIONS[1] : IPP_TYPE_OPTIONS[0];
    },
    set(label: string): void {
        ippType.value = label === IPP_TYPE_OPTIONS[1] ? 'PLS' : 'LKP';
    },
});
const selectedObjectUid = ref('');
const missionMarkers = ref<MissionFeatureRef[]>([]);
const missionPolygons = ref<MissionFeatureRef[]>([]);
const loadingFeatures = ref(false);
const settingIpp = ref(false);

const subjectiveUid = ref('');

const categories = table.map((t) => t.category);
const category = ref<string>(categories[0]);

const showCustomSource = ref(false);
const customSource = ref('');
const customCategory = ref('');
const customRanges = ref<CustomLpbRange[]>([emptyCustomRange()]);

const QUARTILE_COLORS = { A: '#ff0000', B: '#ff0000', C: '#ff0000', D: '#ff0000' };

const quartiles = reactive([
    { key: 'A', pct: '25%', miField: 'qAmi', color: QUARTILE_COLORS.A, miles: 0, selected: true },
    { key: 'B', pct: '50%', miField: 'qBmi', color: QUARTILE_COLORS.B, miles: 0, selected: true },
    { key: 'C', pct: '75%', miField: 'qCmi', color: QUARTILE_COLORS.C, miles: 0, selected: false },
    { key: 'D', pct: '90%', miField: 'qDmi', color: QUARTILE_COLORS.D, miles: 0, selected: false },
]);

function refreshQuartiles(): void {
    const entry = table.find((t) => t.category === category.value);
    if (!entry) return;
    for (const q of quartiles) {
        q.miles = (entry as unknown as Record<string, number>)[q.miField] ?? 0;
    }
}
watch(category, refreshQuartiles, { immediate: true });

const selectedAzlpb = computed(() =>
    table.find((t) => t.category === category.value),
);
const selectedCases = computed(() => selectedAzlpb.value?.cases ?? 0);
const casesPillClass = computed(() => {
    const n = selectedCases.value;
    if (n < 10) return 'bg-danger text-white';
    if (n < 50) return 'bg-warning text-white';
    return 'bg-success text-white';
});

function openCustomSource(): void {
    showCustomSource.value = true;
    if (!customRanges.value.length) customRanges.value = [emptyCustomRange()];
}

function closeCustomSource(): void {
    showCustomSource.value = false;
    customSource.value = '';
    customCategory.value = '';
    customRanges.value = [emptyCustomRange()];
}

function addCustomRange(): void {
    if (customRanges.value.length >= MAX_CUSTOM_RANGES) return;
    customRanges.value.push(emptyCustomRange());
}

function removeCustomRange(index: number): void {
    if (customRanges.value.length <= 1) return;
    customRanges.value.splice(index, 1);
}

function distanceToMiles(distance: number, unit: LpbDistanceUnit): number {
    return unit === 'mi' ? distance : distance / MILES_TO_METERS;
}

/** Valid custom ranges ready to push (label + positive distance). */
const validCustomRanges = computed(() =>
    customRanges.value
        .map((row) => {
            const label = row.label.trim();
            const dist = typeof row.distance === 'number' ? row.distance : NaN;
            if (!label || !Number.isFinite(dist) || dist <= 0) return null;
            return { label, miles: distanceToMiles(dist, row.unit) };
        })
        .filter((r): r is { label: string; miles: number } => r !== null),
);

// Theoretical
const timeMissing = ref('');
const timeReportedMissing = ref('');
const travelSpeed = ref<number>(0);
const elapsedHours = computed(() => {
    if (!timeMissing.value || !timeReportedMissing.value) return 0;
    const ms = new Date(timeReportedMissing.value).getTime() - new Date(timeMissing.value).getTime();
    return ms > 0 ? ms / 3_600_000 : 0;
});
const theoreticalMiles = computed(() =>
    elapsedHours.value > 0 && travelSpeed.value > 0 ? elapsedHours.value * travelSpeed.value : 0
);

const pushing = ref(false);
const status = ref('');
const statusError = ref(false);

const sentAreas = ref<SentArea[]>([]);
const loadingAreas = ref(false);

type LoadedSub = Awaited<ReturnType<typeof loadIncidentSubscription>>;

async function loadSub(): Promise<LoadedSub> {
    return loadIncidentSubscription(activeMission.value!);
}

// ---- Sequential accordion state -------------------------------------------

const STEPS = ['ipp', 'theoretical', 'statistical', 'subjective'] as const;
type StepKey = typeof STEPS[number];

const expanded = ref<StepKey | ''>('ipp');

const stepDone = computed(() => ({
    ipp: sentAreas.value.some((a) => a.key === IPP_KEY),
    theoretical: sentAreas.value.some((a) => a.key === 'theoretical'),
    statistical: sentAreas.value.some((a) => a.key.startsWith('lpb:')),
    subjective: sentAreas.value.some((a) => a.key === 'subjective'),
}));

/** Index of the current (first not-yet-done) step; === STEPS.length when all done. */
const currentIndex = computed(() => {
    for (let i = 0; i < STEPS.length; i++) {
        if (!stepDone.value[STEPS[i]]) return i;
    }
    return STEPS.length;
});

/** A step can be opened only once every step before it is done (i.e. it is the
 * current step or an already-completed one). */
function openable(index: number): boolean {
    return index <= currentIndex.value;
}

function toggle(key: StepKey, index: number): void {
    if (!openable(index)) return;
    expanded.value = expanded.value === key ? '' : key;
}

/**
 * Open the first not-yet-completed step — i.e. resume where the operator left
 * off based on what's already on DataSync. Called after every list load (mount,
 * mission switch, and after each push/remove), so reopening the tab picks up at
 * the right step (e.g. all 4 LPB rings present → opens Subjective).
 */
function resumeToCurrentStep(): void {
    const idx = currentIndex.value;
    expanded.value = idx < STEPS.length ? STEPS[idx] : '';
}

// ---- Mission data loading --------------------------------------------------

/** Read the mission log and recover which search areas have already been pushed. */
async function loadAreas(sub?: LoadedSub): Promise<void> {
    if (!activeMission.value) {
        sentAreas.value = [];
        timeReportedMissing.value = '';
        return;
    }
    loadingAreas.value = true;
    try {
        const s = sub ?? await loadSub();
        await loadTimeReportedMissing();
        const logs = await s.log.list({ refresh: true });
        const kw = (keywords: string[] | undefined, prefix: string): string => {
            const t = keywords?.find((k) => k.startsWith(prefix));
            return t ? t.slice(prefix.length) : '';
        };
        const byKey = new Map<string, SentArea>();
        for (const log of logs) {
            if (!log.keywords?.includes(SEARCH_AREA_KEYWORD)) continue;
            const key = kw(log.keywords, 'area:');
            const uuid = kw(log.keywords, 'uid:');
            const folder = kw(log.keywords, 'folder:') || undefined;
            // Segments moved to mission_schema.json; skip legacy segment logs here.
            if (!key || !uuid || key.startsWith('segment:')) continue;
            const created = log.created || log.dtg || '';
            const prev = byKey.get(key);
            if (!prev || Date.parse(created) >= Date.parse(prev.created)) {
                byKey.set(key, {
                    key,
                    label: log.content || key,
                    uuid,
                    logId: String(log.id),
                    created,
                    folder,
                });
            }
        }
        sentAreas.value = [...byKey.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
        resumeToCurrentStep();
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load search areas: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingAreas.value = false;
    }
}

/** Prefill Theoretical Time Reported Missing from CFS Created in mission_schema.json. */
async function loadTimeReportedMissing(): Promise<void> {
    try {
        const schemaSub = await loadSchemaSubscription(activeMission.value!);
        const { schema } = await loadMissionSchema(schemaSub);
        const created = schema.cad_data?.call_timestamps?.call_created?.trim() ?? '';
        if (created) {
            timeReportedMissing.value = created;
        }
    } catch {
        // Schema may be missing on new missions; leave the field as-is.
    }
}

/** Logical ordering of recall-card rows. */
function rank(key: string): number {
    if (key === IPP_KEY) return 0;
    if (key === 'theoretical') return 1;
    if (key.startsWith('lpb:')) return 2;
    if (key === 'subjective') return 3;
    return 9;
}

/** Grouped recall table: IPP/Theoretical, Statistical (by folder), Subjective. */
const recallRows = computed((): RecallRow[] => {
    const areas = sentAreas.value;
    const rows: RecallRow[] = [];

    const ipp = areas.find((a) => a.key === IPP_KEY);
    if (ipp) rows.push({ kind: 'area', rowKey: ipp.key, area: ipp });

    const theoretical = areas.find((a) => a.key === 'theoretical');
    if (theoretical) rows.push({ kind: 'area', rowKey: theoretical.key, area: theoretical });

    const lpbAreas = areas
        .filter((a) => a.key.startsWith('lpb:'))
        .sort((a, b) => (a.folder || 'Unfiled').localeCompare(b.folder || 'Unfiled')
            || a.key.localeCompare(b.key));

    if (lpbAreas.length) {
        rows.push({ kind: 'section', rowKey: 'section:statistical', label: 'Statistical' });
        const byFolder = new Map<string, SentArea[]>();
        for (const a of lpbAreas) {
            const name = a.folder || 'Unfiled';
            const list = byFolder.get(name) ?? [];
            list.push(a);
            byFolder.set(name, list);
        }
        for (const [folderName, rings] of byFolder) {
            rows.push({ kind: 'folder', rowKey: `folder:${folderName}`, label: folderName });
            for (const a of rings) {
                rows.push({ kind: 'area', rowKey: a.key, area: a, indent: true });
            }
        }
    }

    const subjective = areas.find((a) => a.key === 'subjective');
    if (subjective) rows.push({ kind: 'area', rowKey: subjective.key, area: subjective });

    // Any unexpected keys (keep visible)
    const known = new Set(rows.filter((r): r is Extract<RecallRow, { kind: 'area' }> => r.kind === 'area').map((r) => r.area.key));
    for (const a of areas) {
        if (known.has(a.key)) continue;
        rows.push({ kind: 'area', rowKey: a.key, area: a });
    }

    return rows;
});

/** Load point markers and polygons from the active DataSync mission. */
async function loadFeatures(sub?: LoadedSub): Promise<void> {
    if (!activeMission.value) {
        missionMarkers.value = [];
        missionPolygons.value = [];
        return;
    }
    loadingFeatures.value = true;
    try {
        const s = sub ?? await loadSub();
        const feats = await s.feature.list({ refresh: true });
        const toRef = (f: { id: unknown; properties?: unknown; geometry?: unknown }): MissionFeatureRef => {
            const props = (f.properties ?? {}) as { callsign?: string };
            const geom = (f.geometry ?? {}) as { type?: string; coordinates?: number[] };
            const ref: MissionFeatureRef = { uid: String(f.id), callsign: props.callsign || String(f.id) };
            if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                ref.coords = [geom.coordinates[0], geom.coordinates[1]];
            }
            ref.areaSqMi = areaSqMi(f.geometry);
            return ref;
        };
        missionMarkers.value = feats.filter((f: Feature) => (f.geometry as { type?: string })?.type === 'Point').map(toRef);
        missionPolygons.value = feats
            .filter((f: Feature) => {
                const t = (f.geometry as { type?: string })?.type;
                return t === 'Polygon' || t === 'MultiPolygon';
            })
            .map(toRef);
    } catch {
        missionMarkers.value = [];
        missionPolygons.value = [];
    } finally {
        loadingFeatures.value = false;
    }
}

onMounted(() => { void loadAreas(); void loadFeatures(); });
watch(() => activeMission.value?.guid, () => { void loadAreas(); void loadFeatures(); });

async function onRefreshFeatures(): Promise<void> {
    if (!requireActiveMission()) return;
    await refreshFeatures();
}

async function refreshFeatures(): Promise<void> {
    if (!activeMission.value) return;
    status.value = '';
    statusError.value = false;
    await loadFeatures();
}

/** Prefer the live feature callsign; fall back to the log label when not loaded. */
function callsignForUid(uid: string, fallback: string): string {
    const match = missionMarkers.value.find((m) => m.uid === uid)
        ?? missionPolygons.value.find((p) => p.uid === uid);
    return match?.callsign ?? fallback;
}

/** Polygon area in mi² for a sent area's feature; undefined for points (IPP) or unloaded features. */
function areaForUid(uid: string): number | undefined {
    return missionPolygons.value.find((p) => p.uid === uid)?.areaSqMi;
}

/** Recenter the main map on a sent area's CoT feature (works from the popout too). */
async function onFlyTo(uid: string): Promise<void> {
    const found = await flyToFeature(uid);
    if (!found) {
        status.value = 'Feature is not on the map yet — try "Refresh map objects".';
        statusError.value = true;
    }
}

// ---- IPP -------------------------------------------------------------------

const canSetIpp = computed(
    () => !!ipp.value || !!selectedObjectUid.value,
);

/** Center for ring math: selected object, typed coordinates, or recalled IPP marker. */
const ippCenter = computed<[number, number] | null>(() => {
    const asTuple = (coords: [number, number]): [number, number] => [coords[0], coords[1]];

    if (selectedObjectUid.value) {
        const selected = missionMarkers.value.find((m) => m.uid === selectedObjectUid.value);
        if (selected?.coords) return asTuple(selected.coords);
    }
    if (ipp.value && !selectedObjectUid.value) return [ipp.value.lng, ipp.value.lat];
    const ippArea = sentAreas.value.find((a) => a.key === IPP_KEY);
    if (ippArea) {
        const marker = missionMarkers.value.find((m) => m.uid === ippArea.uuid);
        if (marker?.coords) return asTuple(marker.coords);
    }
    if (ipp.value) return [ipp.value.lng, ipp.value.lat];
    return null;
});

/** Upsert a log entry that references an existing CoT feature (no feature created). */
async function writeAreaLog(
    sub: LoadedSub,
    key: string,
    content: string,
    uuid: string,
    opts?: { folder?: string },
): Promise<void> {
    const existing = sentAreas.value.find((a) => a.key === key);
    const log = sub.log as unknown as LogApi;
    const keywords = [SEARCH_AREA_KEYWORD, `area:${key}`, `uid:${uuid}`];
    if (opts?.folder) keywords.push(`folder:${opts.folder}`);
    const body: LogWriteBody = {
        dtg: new Date().toISOString(),
        content,
        keywords,
        entryUid: uuid,
    };
    if (existing?.logId) await log.update(existing.logId, body);
    else await log.create(body);
}

async function onSetIpp(): Promise<void> {
    if (!requireActiveMission()) return;
    await setIpp();
}

async function setIpp(): Promise<void> {
    if (!activeMission.value || (!ipp.value && !selectedObjectUid.value)) return;
    settingIpp.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const label = `IPP-${ippType.value}`;
        const existing = sentAreas.value.find((a) => a.key === IPP_KEY);

        let uuid: string;
        if (selectedObjectUid.value) {
            uuid = selectedObjectUid.value;
        } else {
            uuid = await pushPointToMission({
                missionGuid: activeMission.value.guid,
                missionToken: missionAuthToken(activeMission.value),
                callsign: label,
                point: [ipp.value!.lng, ipp.value!.lat],
                type: 'a-f-G',
                icon: IPP_ICON,
                id: existing?.uuid,
            });
        }

        await writeAreaLog(sub, IPP_KEY, label, uuid);
        await Promise.all([loadAreas(sub), loadFeatures(sub)]);
        status.value = `Set ${label} on ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        settingIpp.value = false;
    }
}

// ---- Theoretical & Statistical (rings around the IPP) ----------------------

const canPushLpb = computed(() => {
    if (!ippCenter.value) return false;
    return quartiles.some((q) => q.selected);
});
const canPushCustomLpb = computed(() => {
    if (!ippCenter.value) return false;
    if (!customSource.value.trim() || !customCategory.value.trim()) return false;
    return validCustomRanges.value.length > 0;
});
const canPushTheoretical = computed(() => !!ippCenter.value && theoreticalMiles.value > 0);

/** Push (or update) a ring feature AND its referencing log entry. */
async function upsertRing(
    sub: LoadedSub,
    key: string,
    miles: number,
    label: string,
    style: RingStyle,
    folderUid?: string,
): Promise<string> {
    const center = ippCenter.value;
    if (!center) throw new Error('No IPP center set.');
    const ring = circleRing(center[0], center[1], milesToMeters(miles));
    const existing = sentAreas.value.find((a) => a.key === key);

    const uuid = await pushPolygonToMission({
        missionGuid: activeMission.value!.guid,
        missionToken: missionAuthToken(activeMission.value!),
        callsign: label,
        ring,
        center,
        style,
        id: existing?.uuid,
        folderUid,
    });

    await writeAreaLog(sub, key, label, uuid);
    return uuid;
}

/** Always insert a new LPB ring CoT (never reuse prior uuid/key). */
async function insertLpbRing(
    sub: LoadedSub,
    key: string,
    miles: number,
    label: string,
    folderName: string,
    folderUid?: string,
): Promise<string> {
    const center = ippCenter.value;
    if (!center) throw new Error('No IPP center set.');
    const ring = circleRing(center[0], center[1], milesToMeters(miles));

    const uuid = await pushPolygonToMission({
        missionGuid: activeMission.value!.guid,
        missionToken: missionAuthToken(activeMission.value!),
        callsign: label,
        ring,
        center,
        style: LPB_RING_STYLE,
        folderUid,
    });

    await writeAreaLog(sub, key, label, uuid, { folder: folderName });
    return uuid;
}

async function onPushTheoretical(): Promise<void> {
    if (!requireActiveMission()) return;
    await pushTheoretical();
}

async function pushTheoretical(): Promise<void> {
    if (!ippCenter.value || !activeMission.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        let folderUid: string | undefined;
        try {
            const folder = await ensureMissionFolder(sub, SEARCH_AREA_FOLDER);
            folderUid = folder.uid;
        } catch (folderErr) {
            console.warn(folderErr);
        }
        const uuid = await upsertRing(sub, 'theoretical', theoreticalMiles.value, `Theoretical ${theoreticalMiles.value.toFixed(1)}mi`, {
            stroke: '#ff9900',
            fillOpacity: 0.1,
        }, folderUid);
        // Backup filing in case dest.path was ignored on ingest; best-effort only.
        if (folderUid) {
            try {
                await attachFeaturesToFolder(sub, folderUid, [uuid]);
            } catch (attachErr) {
                console.warn(attachErr);
            }
        }
        await loadAreas(sub);
        status.value = `Saved theoretical ring (${theoreticalMiles.value.toFixed(1)} mi) to ${activeMission.value.name}${folderUid ? ` (${SEARCH_AREA_FOLDER})` : ''}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

async function onPushLpb(): Promise<void> {
    if (!requireActiveMission()) return;
    await pushLpb();
}

async function onPushCustomLpb(): Promise<void> {
    if (!requireActiveMission()) return;
    await pushCustomLpb();
}

/** Mission folder name: "LPB {category} - {source}". */
function lpbFolderName(categoryName: string, source: string): string {
    return `LPB ${categoryName} - ${source}`;
}

/** Ring callsign: "{label} {category} {source}". */
function lpbRingCallsign(label: string, categoryName: string, source: string): string {
    return `${label} ${categoryName} ${source}`;
}

/** Names already used by LPB folders (layers + recalled log keywords). */
async function takenLpbFolderNames(sub: LoadedSub): Promise<Set<string>> {
    const taken = new Set<string>();
    for (const a of sentAreas.value) {
        if (a.folder) taken.add(a.folder);
    }
    try {
        const layers = await sub.layer.list();
        for (const layer of layers) {
            if (layer.name) taken.add(layer.name);
        }
    } catch {
        // Local layer cache may be empty; log-derived names still apply.
    }
    return taken;
}

/** Next free folder name: base, base (2), base (3), … */
async function uniqueLpbFolderName(sub: LoadedSub, base: string): Promise<string> {
    const taken = await takenLpbFolderNames(sub);
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base} (${n})`)) n += 1;
    return `${base} (${n})`;
}

async function pushLpb(): Promise<void> {
    if (!ippCenter.value || !activeMission.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const cat = category.value;
        const pushId = Date.now().toString(36);
        const folderName = await uniqueLpbFolderName(sub, lpbFolderName(cat, AZ_LPB_SOURCE));
        let folderUid: string | undefined;
        try {
            const folder = await ensureMissionFolder(sub, folderName);
            folderUid = folder.uid;
        } catch (folderErr) {
            console.warn(folderErr);
        }
        const postedUids: string[] = [];
        for (const q of quartiles) {
            if (!q.selected) continue;
            postedUids.push(await insertLpbRing(
                sub,
                `lpb:${pushId}:${q.key}`,
                q.miles,
                lpbRingCallsign(q.pct, cat, AZ_LPB_SOURCE),
                folderName,
                folderUid,
            ));
        }
        if (folderUid) {
            try {
                await attachFeaturesToFolder(sub, folderUid, postedUids);
            } catch (attachErr) {
                console.warn(attachErr);
            }
        }
        await loadAreas(sub);
        const n = postedUids.length;
        status.value = `Saved ${n} LPB ring${n === 1 ? '' : 's'} to ${activeMission.value.name}${folderUid ? ` (${folderName})` : ''}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

async function pushCustomLpb(): Promise<void> {
    if (!ippCenter.value || !activeMission.value) return;
    const source = customSource.value.trim();
    const cat = customCategory.value.trim();
    const ranges = validCustomRanges.value;
    if (!source || !cat || !ranges.length) return;

    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const pushId = Date.now().toString(36);
        const folderName = await uniqueLpbFolderName(sub, lpbFolderName(cat, source));
        let folderUid: string | undefined;
        try {
            const folder = await ensureMissionFolder(sub, folderName);
            folderUid = folder.uid;
        } catch (folderErr) {
            console.warn(folderErr);
        }
        const postedUids: string[] = [];
        for (let i = 0; i < ranges.length; i++) {
            const row = ranges[i];
            postedUids.push(await insertLpbRing(
                sub,
                `lpb:${pushId}:${i}`,
                row.miles,
                lpbRingCallsign(row.label, cat, source),
                folderName,
                folderUid,
            ));
        }
        if (folderUid) {
            try {
                await attachFeaturesToFolder(sub, folderUid, postedUids);
            } catch (attachErr) {
                console.warn(attachErr);
            }
        }
        await loadAreas(sub);
        const n = postedUids.length;
        status.value = `Saved ${n} LPB ring${n === 1 ? '' : 's'} to ${activeMission.value.name}${folderUid ? ` (${folderName})` : ''}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

// ---- Subjective (reference existing mission polygons) ---------------------

const canAddSubjective = computed(() => !!subjectiveUid.value);

async function onAddSubjective(): Promise<void> {
    if (!requireActiveMission()) return;
    await addSubjective();
}

async function addSubjective(): Promise<void> {
    if (!activeMission.value || !subjectiveUid.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const poly = missionPolygons.value.find((p) => p.uid === subjectiveUid.value);
        const label = `Subjective: ${poly?.callsign ?? subjectiveUid.value}`;
        await writeAreaLog(sub, 'subjective', label, subjectiveUid.value);
        // The polygon already exists in the mission, so a direct attach files it
        // into the folder immediately (same as Mission → Layers drag-drop).
        try {
            const folder = await ensureMissionFolder(sub, SEARCH_AREA_FOLDER);
            await sub.layer.attachFeatures(folder.uid, [subjectiveUid.value]);
        } catch (attachErr) {
            // Log entry is authoritative; polygon may stay where it was.
            console.warn('Failed to file subjective polygon into Search Area folder', attachErr);
        }
        await loadAreas(sub);
        status.value = `Saved subjective search area to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

// ---- Remove ----------------------------------------------------------------

/** Remove a search area: delete its log entry and (for rings/markers we created) the feature. */
async function removeArea(area: SentArea): Promise<void> {
    if (!activeMission.value) return;
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        const sub = await loadSub();
        const log = sub.log as unknown as LogApi;
        await log.delete(area.logId);
        // Best-effort: drop the feature from the mission map. Subjective
        // references user-drawn polygons, so leave those in place.
        const ownsFeature = area.key === 'theoretical' || area.key.startsWith('lpb:') || area.key === IPP_KEY;
        if (ownsFeature) {
            try {
                await deletePolygonFromMission({
                    missionGuid: activeMission.value.guid,
                    uid: area.uuid,
                    missiontoken: missionAuthToken(activeMission.value) || undefined,
                });
            } catch { /* feature may already be gone; leave the log removal authoritative */ }
        }
        await loadAreas(sub);
        status.value = `Removed ${area.label}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}
</script>

<style scoped>
.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
