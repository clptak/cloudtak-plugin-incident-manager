<template>
    <div>
        <h3 class='mb-3'>
            Create | Open
        </h3>

        <!-- ══ Create Mission ══ -->
        <div
            v-if='expandedCard !== "create"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleCard("create")'
            @keydown.enter.prevent='toggleCard("create")'
            @keydown.space.prevent='toggleCard("create")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Create Mission
            </p>
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
                    @click='toggleCard("create")'
                    @keydown.enter.prevent='toggleCard("create")'
                    @keydown.space.prevent='toggleCard("create")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Create Mission
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <p class='text-muted small mb-3'>
                    Creates a DataSync (TAK Mission) via the CloudTAK API. Optionally creates a paired Caltopo map.
                </p>

                <div class='row g-2'>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='form.activityNumber'
                            label='Activity Number'
                            placeholder='e.g. 12345'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='form.date'
                            label='Date'
                            type='date'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerEnum
                            v-model='incidentTypeLabel'
                            label='Incident Type'
                            :options='incidentTypeOptions'
                        />
                    </div>
                    <div
                        v-if='showSubjectType'
                        class='col-md-3'
                    >
                        <TablerEnum
                            v-model='subjectTypeLabel'
                            label='Subject Type'
                            :options='subjectTypeOptions'
                        />
                    </div>
                </div>

                <div class='row g-2 mt-1'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='form.locationInfo'
                            label='Location Information'
                            :rows='2'
                            placeholder='e.g. National Forest, near trailhead'
                        />
                    </div>
                    <div class='col-md-8'>
                        <TablerInput
                            v-model='form.coords'
                            label='Location Coordinates'
                            description='Supports decimal degrees, DMS, DM, and MPS (blank = none).'
                            placeholder='40.0150, -105.2705 or 40 00 54 -105 16 14'
                        />
                        <div
                            v-if='parsedCoords'
                            class='form-text text-success'
                        >
                            → {{ parsedCoords.lat.toFixed(5) }}, {{ parsedCoords.lng.toFixed(5) }}
                        </div>
                        <div
                            v-else-if='form.coords'
                            class='form-text text-danger'
                        >
                            → unrecognized format
                        </div>
                    </div>
                    <div class='col-md-4'>
                        <TablerEnum
                            v-model='operationalPeriodLabel'
                            label='Operational Period'
                            :options='operationalPeriodOptions'
                        />
                    </div>
                </div>

                <div class='row g-2 mt-1'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='form.description'
                            label='Mission Description'
                            placeholder='Optional mission description'
                        />
                    </div>
                </div>

                <div
                    v-if='templates.length || templatesLoading'
                    class='row g-2 mt-1'
                >
                    <div class='col-12'>
                        <div class='d-flex align-items-center mb-2'>
                            <span class='small text-uppercase text-white-50'>Templates</span>
                            <div class='ms-auto'>
                                <button
                                    v-if='!showTemplateSearch'
                                    type='button'
                                    class='btn btn-sm btn-ghost-secondary'
                                    title='Search Templates'
                                    @click='showTemplateSearch = true'
                                >
                                    <IconSearch
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </button>
                                <button
                                    v-else
                                    type='button'
                                    class='btn btn-sm btn-ghost-secondary'
                                    title='Close Search'
                                    @click='showTemplateSearch = false; templatesPaging.filter = ""'
                                >
                                    <IconX
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </button>
                            </div>
                        </div>

                        <div
                            v-if='showTemplateSearch'
                            class='mb-2'
                        >
                            <TablerInput
                                v-model='templatesPaging.filter'
                                placeholder='Search Templates...'
                            />
                        </div>

                        <div
                            v-if='templatesLoading'
                            class='text-muted small'
                        >
                            <span class='spinner-border spinner-border-sm me-1' />
                            Loading Templates…
                        </div>
                        <div
                            v-else-if='templates.length'
                            class='row g-2'
                            role='radiogroup'
                            aria-label='Mission templates'
                        >
                            <div
                                v-for='(template, index) in templates'
                                :key='template.id'
                                class='col-6 col-md-3'
                            >
                                <div
                                    :ref='(el) => setTemplateCardRef(el, index)'
                                    class='template-tile p-2 text-center cursor-pointer h-100 d-flex flex-column align-items-center justify-content-center'
                                    :class='{ "template-tile--selected": selectedTemplate === template.id }'
                                    role='radio'
                                    :aria-checked='selectedTemplate === template.id'
                                    :tabindex='selectedTemplate === template.id ? 0 : -1'
                                    @click='selectTemplateByIndex(index)'
                                    @keydown='onTemplateKeydown($event, index)'
                                >
                                    <img
                                        v-if='template.icon'
                                        :src='template.icon'
                                        class='mb-2'
                                        style='height: 32px; width: 32px; object-fit: contain;'
                                        :style='template.icon.includes("image/svg+xml") ? "filter: brightness(0) invert(1);" : ""'
                                        alt=''
                                    >
                                    <IconLayout
                                        v-else
                                        :size='32'
                                        stroke='1'
                                        class='mb-2'
                                    />
                                    <div class='small lh-1'>
                                        {{ template.name }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div
                            v-else
                            class='text-center fst-italic text-muted small'
                        >
                            No Templates Found
                        </div>
                    </div>
                </div>

                <div class='row g-2 mt-1'>
                    <div class='col-12'>
                        <label class='form-label'>Field Channels</label>
                        <GroupSelect
                            v-model='form.groups'
                            :active='true'
                            direction='IN'
                        />
                        <div class='form-text'>
                            Volunteers &amp; field personnel — the incident common map is shared here.
                        </div>
                    </div>
                    <div class='col-12'>
                        <label class='form-label'>Management Channels</label>
                        <GroupSelect
                            v-model='form.mgmtGroups'
                            :active='true'
                            direction='IN'
                        />
                        <div class='form-text'>
                            IMT only — a second &quot;{{ finalName }} - MGMT&quot; DataSync holding
                            mission_schema.json and planning products is created on these channels.
                            Field channels never see it.
                        </div>
                    </div>
                </div>

                <hr class='my-3'>

                <div class='mb-2'>
                    <TablerInput
                        v-model='form.nameOverride'
                        label='Mission Name'
                        :placeholder='derivedName'
                        :description='`DataSync name: ${finalName}`'
                    />
                </div>

                <div class='mb-3'>
                    <TablerToggle
                        v-model='form.createCaltopo'
                        label='Create Caltopo Map'
                        :description='caltopoReady
                            ? "Delegates to the caltopo-sync plugin."
                            : "Delegates to the caltopo-sync plugin (provider not detected — will be skipped)."'
                    />
                </div>

                <button
                    class='btn btn-success w-100'
                    :disabled='loading'
                    @click='createMission'
                >
                    {{ loading ? 'Creating…' : 'Create Active Mission' }}
                </button>

                <TablerInlineAlert
                    v-if='status'
                    class='mt-3'
                    :severity='statusError ? "danger" : "success"'
                    :title='statusError ? "Error" : "Success"'
                    :description='status'
                />
            </div>
        </TablerBorder>

        <!-- ══ Open Existing Mission ══ -->
        <div
            v-if='expandedCard !== "open"'
            class='cloudtak-accent border rounded-3 text-white px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleCard("open")'
            @keydown.enter.prevent='toggleCard("open")'
            @keydown.space.prevent='toggleCard("open")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Open Existing Mission
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white'
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
                    @click='toggleCard("open")'
                    @keydown.enter.prevent='toggleCard("open")'
                    @keydown.space.prevent='toggleCard("open")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Open Existing Mission
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <OpenExistingMission />
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import { IconSearch, IconX, IconLayout, IconChevronDown } from '@tabler/icons-vue';
import {
    TablerBorder,
    TablerInput,
    TablerEnum,
    TablerToggle,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { server } from '../../../../../src/std.ts';
import type { Mission_Create, MissionTemplateList } from '../../../../../src/types.ts';
import { useMapStore } from '../../../../../src/stores/map.ts';
import OverlayManager from '../../../../../src/base/overlay.ts';
import GroupSelect from '../../../../../src/components/CloudTAK/util/GroupSelect.vue';
import OpenExistingMission from './OpenExistingMission.vue';
import { buildMissionName, parseCoordinates } from '../../lib/coords.ts';
import { createCaltopoMap, caltopoAvailable } from '../../lib/caltopo.ts';
import { useIncident } from '../../composables/useIncident.ts';
import { usePluginSettings } from '../../composables/usePluginSettings.ts';
import { SUBJECT_TYPE_PLACEHOLDER } from '../../lib/subjectTypes.ts';

const mapStore = useMapStore();
const { setActiveMission, setDraftIncidentType, activeMission } = useIncident();
const { enumOptions: subjectTypeEnumOptions } = usePluginSettings();

type CreateOpenCard = 'create' | 'open';
const expandedCard = ref<CreateOpenCard | null>(null);

function toggleCard(card: CreateOpenCard): void {
    expandedCard.value = expandedCard.value === card ? null : card;
}

const incidentTypeOptions = [
    '— Select —',
    'Search',
    'Rescue',
    'Recovery',
    'Evidence',
    'Wildland Fire',
    'Disaster',
    'Other',
];

const incidentTypeByLabel: Record<string, string> = {
    '— Select —': '',
    Search: 'search',
    Rescue: 'rescue',
    Recovery: 'recovery',
    Evidence: 'evidence',
    'Wildland Fire': 'wildland-fire',
    Disaster: 'disaster',
    Other: 'other',
};

const incidentTypeLabel = computed({
    get(): string {
        const entry = Object.entries(incidentTypeByLabel).find(([, value]) => value === form.incidentType);
        return entry?.[0] ?? '— Select —';
    },
    set(label: string): void {
        form.incidentType = incidentTypeByLabel[label] ?? '';
    },
});

const subjectTypeOptions = computed(() => subjectTypeEnumOptions(form.subjectType));

const subjectTypeLabel = computed({
    get(): string {
        return form.subjectType || SUBJECT_TYPE_PLACEHOLDER;
    },
    set(label: string): void {
        form.subjectType = label === SUBJECT_TYPE_PLACEHOLDER ? '' : label;
    },
});

const operationalPeriodOptions = [
    '— Select —',
    'OP-0 | Initial Response',
    ...Array.from({ length: 14 }, (_, i) => `OP-${i + 1}`),
];

const operationalPeriodLabel = computed({
    get(): string {
        if (!form.operationalPeriod) return '— Select —';
        if (form.operationalPeriod === 'OP-00') return 'OP-0 | Initial Response';
        const match = /^OP-0*(\d+)$/.exec(form.operationalPeriod);
        return match ? `OP-${Number(match[1])}` : '— Select —';
    },
    set(label: string): void {
        if (!label || label === '— Select —') {
            form.operationalPeriod = '';
            return;
        }
        if (label === 'OP-0 | Initial Response') {
            form.operationalPeriod = 'OP-00';
            return;
        }
        const match = /^OP-(\d+)$/.exec(label);
        form.operationalPeriod = match
            ? `OP-${String(Number(match[1])).padStart(2, '0')}`
            : '';
    },
});

const form = reactive({
    activityNumber: '',
    date: new Date().toISOString().slice(0, 10),
    incidentType: '',
    subjectType: '',
    locationInfo: '',
    coords: '',
    operationalPeriod: '',
    description: '',
    nameOverride: '',
    groups: [] as string[],
    /** IMT-only channels for the Sworn-side management (planning) sync. */
    mgmtGroups: [] as string[],
    createCaltopo: false,
});

if (!form.incidentType && activeMission.value?.incidentType) {
    form.incidentType = activeMission.value.incidentType;
}

const loading = ref(false);
const status = ref('');
const statusError = ref(false);

const templates = ref<MissionTemplateList['items']>([]);
const templatesLoading = ref(false);
const showTemplateSearch = ref(false);
const templatesPaging = ref({ filter: '' });
const selectedTemplate = ref<string | null>(null);
const templateKeywords = ref<string[]>([]);
const templateCardEls = ref<(HTMLElement | null)[]>([]);

const caltopoReady = computed(() => caltopoAvailable());

const showSubjectType = computed(() =>
    ['search', 'rescue', 'recovery', 'other'].includes(resolvedIncidentType())
);

function resolvedIncidentType(): string {
    return form.incidentType || activeMission.value?.incidentType || '';
}

const parsedCoords = computed(() => parseCoordinates(form.coords));

const derivedName = computed(() => buildMissionName({
    activityNumber: form.activityNumber,
    date: form.date,
    incidentType: resolvedIncidentType(),
    subjectType: showSubjectType.value ? form.subjectType : '',
    locationInfo: form.locationInfo,
}));

const finalName = computed(() => {
    const base = (form.nameOverride.trim() || derivedName.value);
    return form.operationalPeriod ? `${base}_${form.operationalPeriod}` : base;
});

function buildKeywords(): string[] {
    const kw: string[] = [];
    if (form.activityNumber) kw.push(`activityNumber:${form.activityNumber}`);
    const type = resolvedIncidentType();
    if (type) kw.push(`incidentType:${type}`);
    if (showSubjectType.value && form.subjectType) kw.push(`subjectType:${form.subjectType}`);
    if (form.operationalPeriod) kw.push(`operationalPeriod:${form.operationalPeriod}`);
    if (parsedCoords.value) kw.push(`coords:${parsedCoords.value.lat},${parsedCoords.value.lng}`);
    for (const keyword of templateKeywords.value) {
        if (!kw.includes(keyword)) kw.push(keyword);
    }
    if (selectedTemplate.value && selectedTemplate.value !== 'default') {
        kw.push(`template:${selectedTemplate.value}`);
    }
    return kw;
}

watch(selectedTemplate, (newId) => {
    const template = templates.value.find((t) => t.id === newId);
    templateKeywords.value = template?.keywords ? [...template.keywords] : [];
});

watch(() => form.incidentType, (type) => {
    setDraftIncidentType(type);
}, { immediate: true });

watch(templates, () => {
    templateCardEls.value = [];
});

function setTemplateCardRef(el: unknown, index: number): void {
    templateCardEls.value[index] = el instanceof HTMLElement ? el : null;
}

function selectTemplateByIndex(index: number): void {
    const template = templates.value[index];
    if (!template) return;
    selectedTemplate.value = template.id;
}

async function focusTemplateByIndex(index: number): Promise<void> {
    await nextTick();
    templateCardEls.value[index]?.focus();
}

function onTemplateKeydown(event: KeyboardEvent, index: number): void {
    const count = templates.value.length;
    if (!count) return;

    if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        selectTemplateByIndex(index);
        return;
    }

    let nextIndex: number;
    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            nextIndex = (index + 1) % count;
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            nextIndex = (index - 1 + count) % count;
            break;
        case 'Home':
            nextIndex = 0;
            break;
        case 'End':
            nextIndex = count - 1;
            break;
        default:
            return;
    }

    event.preventDefault();
    selectTemplateByIndex(nextIndex);
    void focusTemplateByIndex(nextIndex);
}

watch(templatesPaging, async () => {
    await listTemplates();
}, { deep: true });

onMounted(async () => {
    await listTemplates();
});

async function listTemplates(): Promise<void> {
    templatesLoading.value = true;

    try {
        const res = await server.GET('/api/template/mission', {
            params: {
                query: {
                    limit: 10,
                    sort: 'created',
                    page: 0,
                    order: 'desc',
                    filter: templatesPaging.value.filter || '',
                },
            },
        });

        if (res.error) throw new Error(res.error.message);

        if (!res.data.items.length && !templatesPaging.value.filter) {
            templates.value = [];
        } else {
            templates.value = [{
                id: 'default',
                name: 'Default',
                icon: '',
                description: '',
                created: '',
                updated: '',
                keywords: [],
            }, ...res.data.items];

            if (!selectedTemplate.value) selectedTemplate.value = 'default';
        }
    } catch {
        templates.value = [];
    } finally {
        templatesLoading.value = false;
    }
}

async function createMission(): Promise<void> {
    status.value = '';
    statusError.value = false;
    loading.value = true;

    try {
        // Incident common map: field channels + management channels, so the IMT
        // always sees it even with the field channel toggled off (Phase 0 T3/T4).
        const commonGroups = [...new Set([...form.groups, ...form.mgmtGroups])];
        const body: Mission_Create = {
            name: finalName.value,
            group: commonGroups,
            description: form.description || '',
            keywords: buildKeywords(),
        };
        body.defaultRole = 'MISSION_SUBSCRIBER';

        const res = await server.POST('/api/marti/mission', { body });
        if (res.error) throw new Error(res.error.message);

        // Sworn-only management sync: mission_schema.json + planning products.
        // Never carries field channels — this is the Phase 1 leak fix.
        let mgmt: { guid: string; name: string; missionToken?: string } | undefined;
        if (form.mgmtGroups.length) {
            const mgmtBody: Mission_Create = {
                name: `${finalName.value} - MGMT`,
                group: form.mgmtGroups,
                description: `Management / planning sync for ${finalName.value}`,
                keywords: buildKeywords(),
            };
            mgmtBody.defaultRole = 'MISSION_SUBSCRIBER';

            const mgmtRes = await server.POST('/api/marti/mission', { body: mgmtBody });
            if (mgmtRes.error) throw new Error(`Management sync failed: ${mgmtRes.error.message}`);
            mgmt = {
                guid: mgmtRes.data.guid,
                name: mgmtRes.data.name,
                missionToken: mgmtRes.data.token,
            };
        }

        // Register as a loaded overlay + make active, matching MissionCreate.vue
        await OverlayManager.createLoaded({
            name: res.data.name,
            url: `/mission/${encodeURIComponent(res.data.name)}`,
            type: 'geojson',
            mode: 'mission',
            token: res.data.token,
            mode_id: res.data.guid,
        });
        // Load the MGMT overlay too so planning features (search areas, rings,
        // segments) render on the manager's map.
        if (mgmt) {
            await OverlayManager.createLoaded({
                name: mgmt.name,
                url: `/mission/${encodeURIComponent(mgmt.guid)}`,
                type: 'geojson',
                mode: 'mission',
                token: mgmt.missionToken,
                mode_id: mgmt.guid,
            });
        }
        const sub = await mapStore.loadMission(res.data.guid);
        if (sub) await mapStore.makeActiveMission(sub);

        setActiveMission({
            guid: res.data.guid,
            name: res.data.name,
            missionToken: res.data.token,
            mgmt,
            incidentType: resolvedIncidentType() || undefined,
        });

        status.value = mgmt
            ? `Created DataSyncs "${res.data.name}" + "${mgmt.name}" (planning).`
            : `Created DataSync "${res.data.name}" — no management channels selected; planning data will be visible on the field channels.`;

        // Optional Caltopo map via the caltopo-sync plugin
        if (form.createCaltopo) {
            const caltopo = await createCaltopoMap({
                missionName: res.data.name,
                missionGuid: res.data.guid,
                title: res.data.name,
                lat: parsedCoords.value?.lat,
                lng: parsedCoords.value?.lng,
            });
            if (caltopo) {
                status.value += ` Caltopo map: ${caltopo.url || caltopo.mapId}.`;
            } else {
                status.value += ' Caltopo creation skipped (provider not available).';
            }
        }
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
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

.template-tile {
    border: 1px solid var(--bs-border-color, rgba(255, 255, 255, 0.15));
    border-radius: var(--bs-border-radius, 0.25rem);
}

.template-tile--selected {
    border-color: var(--bs-primary);
    background: color-mix(in srgb, var(--bs-primary) 18%, transparent);
}
</style>
