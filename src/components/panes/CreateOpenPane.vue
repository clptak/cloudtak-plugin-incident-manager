<template>
    <div>
        <h3 class='mb-3'>
            Create | Open
        </h3>

        <!-- ══ Create Mission ══ -->
        <div class='card mb-3'>
            <div class='card-header'>
                <h4 class='card-title mb-0'>
                    Create Mission
                </h4>
            </div>
            <div class='card-body'>
                <p class='text-muted small mb-3'>
                    Creates a DataSync (TAK Mission) via the CloudTAK API. Optionally creates a paired Caltopo map.
                </p>

                <!-- Mission Details -->
                <div class='row g-3'>
                    <div class='col-md-3'>
                        <label class='form-label'>Activity Number</label>
                        <input
                            v-model='form.activityNumber'
                            type='text'
                            class='form-control'
                            placeholder='e.g. 12345'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label'>Date</label>
                        <input
                            v-model='form.date'
                            type='date'
                            class='form-control'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label'>Incident Type</label>
                        <select
                            v-model='form.incidentType'
                            class='form-select'
                        >
                            <option value=''>
                                — Select —
                            </option>
                            <option value='search'>
                                Search
                            </option>
                            <option value='rescue'>
                                Rescue
                            </option>
                            <option value='recovery'>
                                Recovery
                            </option>
                            <option value='evidence'>
                                Evidence
                            </option>
                            <option value='wildland-fire'>
                                Wildland Fire
                            </option>
                            <option value='other'>
                                Other
                            </option>
                        </select>
                    </div>
                    <div
                        v-if='showSubjectType'
                        class='col-md-3'
                    >
                        <label class='form-label'>Subject Type</label>
                        <select
                            v-model='form.subjectType'
                            class='form-select'
                        >
                            <option value=''>
                                — Select —
                            </option>
                            <option
                                v-for='s in subjectTypes'
                                :key='s'
                                :value='s'
                            >
                                {{ s }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class='row g-3 mt-1'>
                    <div class='col-12'>
                        <label class='form-label'>Location Information</label>
                        <textarea
                            v-model='form.locationInfo'
                            class='form-control'
                            rows='2'
                            placeholder='e.g. Oak Creek Canyon, near Slide Rock'
                        />
                    </div>
                    <div class='col-md-8'>
                        <label class='form-label'>
                            Location Coordinates
                            <span class='text-muted small'>(parsed — blank = none)</span>
                        </label>
                        <input
                            v-model='form.coords'
                            type='text'
                            class='form-control'
                            placeholder='35.1862, -111.6404 or 35 11 10 -111 38 25'
                        >
                        <div class='form-text'>
                            Supports decimal degrees, DMS, DM, and MPS.
                            <span
                                v-if='parsedCoords'
                                class='text-success'
                            >
                                → {{ parsedCoords.lat.toFixed(5) }}, {{ parsedCoords.lng.toFixed(5) }}
                            </span>
                            <span
                                v-else-if='form.coords'
                                class='text-danger'
                            >→ unrecognized format</span>
                        </div>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label'>Operational Period</label>
                        <select
                            v-model='form.operationalPeriod'
                            class='form-select'
                        >
                            <option value=''>
                                — Select —
                            </option>
                            <option value='OP-00'>
                                OP-0 | Initial Response
                            </option>
                            <option
                                v-for='n in 14'
                                :key='n'
                                :value='`OP-${String(n).padStart(2, "0")}`'
                            >
                                OP-{{ n }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class='row g-3 mt-1'>
                    <div class='col-12'>
                        <label class='form-label'>Mission Description</label>
                        <input
                            v-model='form.description'
                            type='text'
                            class='form-control'
                            placeholder='Optional mission description'
                        >
                    </div>
                </div>

                <div
                    v-if='templates.length || templatesLoading'
                    class='row g-3 mt-1'
                >
                    <div class='col-12'>
                        <div class='d-flex align-items-center mb-2'>
                            <label class='form-label mb-0'>Templates</label>
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
                            <input
                                v-model='templatesPaging.filter'
                                type='text'
                                class='form-control form-control-sm'
                                placeholder='Search Templates...'
                            >
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
                                    class='card p-2 text-center cursor-pointer h-100 d-flex flex-column align-items-center justify-content-center'
                                    :class='{ "border-primary bg-primary-lt": selectedTemplate === template.id }'
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

                <!-- Channels (TAK groups) -->
                <div class='row g-3 mt-1'>
                    <div class='col-12'>
                        <label class='form-label'>Channels</label>
                        <GroupSelect
                            v-model='form.groups'
                            :active='true'
                            direction='IN'
                        />
                    </div>
                </div>

                <hr class='my-3'>

                <!-- Derived name preview -->
                <div class='mb-2'>
                    <label class='form-label'>Mission Name</label>
                    <input
                        v-model='form.nameOverride'
                        type='text'
                        class='form-control'
                        :placeholder='derivedName'
                    >
                    <div class='form-text'>
                        DataSync name: <code>{{ finalName }}</code>
                    </div>
                </div>

                <!-- Caltopo checkbox -->
                <div class='form-check mb-3'>
                    <input
                        id='chk-create-caltopo'
                        v-model='form.createCaltopo'
                        class='form-check-input'
                        type='checkbox'
                    >
                    <label
                        class='form-check-label'
                        for='chk-create-caltopo'
                    >
                        Create Caltopo map
                    </label>
                    <div class='form-text'>
                        Delegates to the caltopo-sync plugin.
                        <span
                            v-if='!caltopoReady'
                            class='text-warning'
                        >(provider not detected — will be skipped)</span>
                    </div>
                </div>

                <button
                    class='btn btn-success'
                    :disabled='loading'
                    @click='createMission'
                >
                    {{ loading ? 'Creating…' : 'Create Active Mission' }}
                </button>

                <div
                    v-if='status'
                    class='mt-3 fw-bold'
                    :class='statusError ? "text-danger" : "text-success"'
                    style='word-break: break-word;'
                >
                    {{ status }}
                </div>
            </div>
        </div>

        <!-- ══ Open Existing Mission ══ -->
        <div class='card'>
            <div class='card-header'>
                <h4 class='card-title mb-0'>
                    Open Existing Mission
                </h4>
            </div>
            <div class='card-body'>
                <OpenExistingMission />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import { IconSearch, IconX, IconLayout } from '@tabler/icons-vue';
import { server } from '../../../../../src/std.ts';
import type { Mission_Create, MissionTemplateList } from '../../../../../src/types.ts';
import { useMapStore } from '../../../../../src/stores/map.ts';
import OverlayManager from '../../../../../src/base/overlay.ts';
import GroupSelect from '../../../../../src/components/CloudTAK/util/GroupSelect.vue';
import OpenExistingMission from './OpenExistingMission.vue';
import { buildMissionName, parseCoordinates } from '../../lib/coords.ts';
import { createCaltopoMap, caltopoAvailable } from '../../lib/caltopo.ts';
import { useIncident } from '../../composables/useIncident.ts';

const mapStore = useMapStore();
const { setActiveMission } = useIncident();

const subjectTypes = [
    'Hiker', 'Hunter', 'Climber', 'Canyoneering', 'Camper',
    'Vehicle', 'Child', 'Dementia', 'Alzheimers', 'other',
];

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
    createCaltopo: false,
});

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
    ['search', 'rescue', 'recovery', 'other'].includes(form.incidentType)
);

const parsedCoords = computed(() => parseCoordinates(form.coords));

const derivedName = computed(() => buildMissionName({
    activityNumber: form.activityNumber,
    date: form.date,
    incidentType: form.incidentType,
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
    if (form.incidentType) kw.push(`incidentType:${form.incidentType}`);
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
        const body: Mission_Create = {
            name: finalName.value,
            group: form.groups,
            description: form.description || '',
            keywords: buildKeywords(),
        };
        body.defaultRole = 'MISSION_SUBSCRIBER';

        const res = await server.POST('/api/marti/mission', { body });
        if (res.error) throw new Error(res.error.message);

        // Register as a loaded overlay + make active, matching MissionCreate.vue
        await OverlayManager.createLoaded({
            name: res.data.name,
            url: `/mission/${encodeURIComponent(res.data.name)}`,
            type: 'geojson',
            mode: 'mission',
            token: res.data.token,
            mode_id: res.data.guid,
        });
        const sub = await mapStore.loadMission(res.data.guid);
        if (sub) await mapStore.makeActiveMission(sub);

        setActiveMission({
            guid: res.data.guid,
            name: res.data.name,
            token: res.data.token,
        });

        status.value = `Created DataSync "${res.data.name}".`;

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
