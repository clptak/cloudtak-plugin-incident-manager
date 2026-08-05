<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>
                Resources
            </h3>
            <span
                v-if='meta?.fetchedAt'
                class='text-muted small'
            >
                D4H agencies synced {{ formatD4hSyncTime(meta.fetchedAt) }}
            </span>
            <div class='ms-auto d-flex gap-2'>
                <button
                    v-if='infoDismissed'
                    type='button'
                    class='btn btn-outline-secondary btn-sm d-inline-flex align-items-center'
                    title='Show information'
                    aria-label='Show information'
                    @click='restoreInfo'
                >
                    <IconInfoCircle
                        :size='16'
                        stroke='1.5'
                    />
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='loadingRoster'
                    @click='refreshAgencies'
                >
                    {{ loadingRoster ? 'Loading…' : 'Refresh agencies' }}
                </button>
            </div>
        </div>

        <p class='text-muted small mb-2'>
            Create and manage resource team assignments. Each record is saved to
            <strong>mission_schema.json</strong> (<code>incident_response.resource_assignments</code>)
            and appears in the <strong>Organization</strong> palette by Resource Identifier.
        </p>

        <TablerInlineAlert
            v-if='!activeMission'
            class='mb-3'
            severity='info'
            title='Mission required'
            description='Select a mission in Create | Open before creating resource assignments.'
        />

        <TablerInlineAlert
            v-if='statusMessage'
            class='mb-3'
            :severity='statusError ? "danger" : "success"'
            :title='statusError ? "Error" : "Saved"'
            :description='statusMessage'
        />

        <TablerBorder
            v-if='!infoDismissed'
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-1'>
                    <IconInfoCircle
                        :size='16'
                        stroke='1.5'
                    />
                    Information
                </p>
            </template>
            <p class='small mb-2'>
                Utilize the
                <a
                    href='#'
                    @click.prevent='selectHTabGuarded("organization")'
                >Organization Tab</a>
                to create your ICS 201 Organizational Chart and Team Assignments
            </p>
            <button
                type='button'
                class='btn btn-outline-secondary btn-sm'
                @click='dismissInfo'
            >
                Do not remind me
            </button>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='defaultAgencyExpanded'
                    @click='defaultAgencyExpanded = !defaultAgencyExpanded'
                    @keydown.enter.prevent='defaultAgencyExpanded = !defaultAgencyExpanded'
                    @keydown.space.prevent='defaultAgencyExpanded = !defaultAgencyExpanded'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Default Agency
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :class='{ "rotate-180": defaultAgencyExpanded }'
                        :size='18'
                        stroke='1.5'
                    />
                </div>
            </template>
            <div v-show='defaultAgencyExpanded'>
                <TablerInput
                    v-model='defaultAgencyInput'
                    label='Default Agency'
                    placeholder='Your agency name'
                    autocomplete='organization'
                    :disabled='!activeMission || saving || savingDefaultAgency'
                    :description='defaultAgencyHint'
                    @blur='onDefaultAgencyBlur'
                />
            </div>
        </TablerBorder>

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-2 w-100'>
                    <span>New Resource Assignment</span>
                    <span
                        class='ms-auto d-inline-flex'
                        @click.stop
                    >
                        <NavHelpButton help-key='resource-summary' />
                    </span>
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='form.resourceIdentifier'
                        label='Resource Identifier'
                        placeholder='e.g. SO GROUND TEAM 1'
                        autocomplete='off'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerEnum
                        v-model='formResourceLabel'
                        label='Resource'
                        :options='resourceFormOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerEnum
                        v-model='formAgencyLabel'
                        label='Agency'
                        :options='agencyFormOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.timeOrdered'
                        label='Time Ordered'
                        type='datetime-local'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='formEtaString'
                        label='ETA'
                        type='number'
                        placeholder='Hours'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerEnum
                        v-model='formStatusLabel'
                        label='Status'
                        :options='statusLabelOptions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.timeArrived'
                        label='Time Arrived'
                        type='datetime-local'
                        :disabled='!activeMission || saving'
                    />
                </div>
            </div>

            <div class='d-flex flex-wrap gap-2 mt-3'>
                <button
                    type='button'
                    class='btn btn-primary btn-sm'
                    :disabled='!canCreate || saving'
                    @click='createAssignment'
                >
                    {{ saving ? 'Saving…' : 'Create assignment' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='saving'
                    @click='resetForm'
                >
                    Clear form
                </button>
            </div>
        </TablerBorder>

        <TablerBorder
            v-if='activeMission'
            class='cloudtak-accent text-white'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Mission Resource Assignments ({{ assignments.length }})
                    <span
                        v-if='loading'
                        class='text-muted fw-normal text-lowercase'
                    > — Loading…</span>
                </p>
            </template>

            <div
                v-if='!assignments.length && !loading'
                class='text-muted small'
            >
                No assignments yet — create one above. They will be stored in mission_schema.json.
            </div>
            <div
                v-else-if='assignments.length'
                class='resources-table-scroll'
            >
                <table class='table table-sm table-hover mb-0 small align-middle'>
                    <thead class='sticky-top bg-body'>
                        <tr>
                            <th>Resource Identifier</th>
                            <th>Resource</th>
                            <th>Agency</th>
                            <th>Time Ordered</th>
                            <th style='width: 72px;'>
                                ETA
                            </th>
                            <th style='width: 110px;'>
                                Status
                            </th>
                            <th>Time Arrived</th>
                            <th style='width: 72px;' />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='assignment in assignments'
                            :key='assignment.id'
                        >
                            <td>
                                <TablerInput
                                    :model-value='assignment.resourceIdentifier'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "resourceIdentifier", String($event))'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='assignment.resource || "—"'
                                    :options='rowResourceOptions'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "resource", $event === "—" ? "" : $event)'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='assignment.agency'
                                    :options='rowAgencyOptions(assignment.agency)'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "agency", $event)'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='assignment.timeOrdered'
                                    type='datetime-local'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "timeOrdered", String($event))'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='assignment.eta ?? ""'
                                    type='number'
                                    :disabled='saving'
                                    @update:model-value='onEtaChange(assignment.id, String($event))'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='statusLabelFor(assignment.status)'
                                    :options='statusLabelOptions'
                                    :disabled='saving'
                                    @update:model-value='onStatusLabelChange(assignment.id, $event)'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='assignment.timeArrived'
                                    type='datetime-local'
                                    :disabled='saving'
                                    @update:model-value='onFieldChange(assignment.id, "timeArrived", String($event))'
                                />
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-danger btn-sm'
                                    title='Remove assignment'
                                    :disabled='saving'
                                    @click='removeAssignmentRecord(assignment.id)'
                                >
                                    ×
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-vue';
import {
    TablerBorder,
    TablerInput,
    TablerEnum,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import { useResourceAssignments } from '../../composables/useResourceAssignments.ts';
import { formatD4hSyncTime, loadD4hMeta, loadD4hRoster } from '../../lib/d4hRoster.ts';
import type { D4HRosterMeta } from '../../lib/d4hTypes.ts';
import { nowDatetimeLocal } from '../../lib/incidentInfo.ts';
import NavHelpButton from '../NavHelpButton.vue';
import {
    buildAgencyOptions,
    resolveEffectiveDefaultAgency,
    RESOURCE_ASSIGNMENT_STATUSES,
    RESOURCE_TYPE_OPTIONS,
    type ResourceAssignment,
    type ResourceAssignmentStatus,
} from '../../lib/resourceAssignments.ts';

const { activeMission, requireActiveMission, selectHTabGuarded } = useIncident();
const {
    assignments,
    defaultAgency,
    loading,
    saving,
    statusMessage,
    statusError,
    blankResourceAssignmentForm,
    loadForMission,
    addAssignment,
    removeAssignment,
    updateAssignment,
    updateDefaultAgency,
} = useResourceAssignments();

const RESOURCES_INFO_DISMISSED_KEY = 'incident-manager:resources-info-dismissed';
const RESOURCE_PLACEHOLDER = '— Select resource —';
const AGENCY_PLACEHOLDER = '— Select agency —';

function loadInfoDismissed(): boolean {
    try {
        return localStorage.getItem(RESOURCES_INFO_DISMISSED_KEY) === 'true';
    } catch {
        return false;
    }
}

const infoDismissed = ref(loadInfoDismissed());

function dismissInfo(): void {
    infoDismissed.value = true;
    try {
        localStorage.setItem(RESOURCES_INFO_DISMISSED_KEY, 'true');
    } catch {
        // ignore quota / private-mode errors
    }
}

function restoreInfo(): void {
    infoDismissed.value = false;
    try {
        localStorage.removeItem(RESOURCES_INFO_DISMISSED_KEY);
    } catch {
        // ignore quota / private-mode errors
    }
}

const defaultAgencyExpanded = ref(true);
const loadingRoster = ref(false);
const savingDefaultAgency = ref(false);
const meta = ref<D4HRosterMeta | null>(null);
const d4hExternalResources = ref<{ id: number; name: string }[]>([]);
const defaultAgencyInput = ref('');
const agencyOptions = ref<string[]>([]);
const lastEffectiveDefaultAgency = ref('');

const form = ref<Omit<ResourceAssignment, 'id'>>({
    ...blankResourceAssignmentForm(),
    timeOrdered: nowDatetimeLocal(),
});

const resourceTypeOptions = RESOURCE_TYPE_OPTIONS;
const statusOptions = RESOURCE_ASSIGNMENT_STATUSES;
const statusLabelOptions = statusOptions.map((opt) => opt.label);
const rowResourceOptions = ['—', ...resourceTypeOptions];

const resourceFormOptions = computed(() => [RESOURCE_PLACEHOLDER, ...resourceTypeOptions]);
const agencyFormOptions = computed(() => [AGENCY_PLACEHOLDER, ...agencyOptions.value]);

const formResourceLabel = computed({
    get(): string {
        return form.value.resource || RESOURCE_PLACEHOLDER;
    },
    set(label: string): void {
        form.value.resource = label === RESOURCE_PLACEHOLDER ? '' : label;
    },
});

const formAgencyLabel = computed({
    get(): string {
        return form.value.agency || AGENCY_PLACEHOLDER;
    },
    set(label: string): void {
        form.value.agency = label === AGENCY_PLACEHOLDER ? '' : label;
    },
});

const formStatusLabel = computed({
    get(): string {
        return statusLabelFor(form.value.status);
    },
    set(label: string): void {
        const opt = statusOptions.find((entry) => entry.label === label);
        if (opt) form.value.status = opt.value;
    },
});

const formEtaString = computed({
    get(): string {
        return form.value.eta == null ? '' : String(form.value.eta);
    },
    set(raw: string): void {
        form.value.eta = raw.trim() === '' || Number.isNaN(Number(raw)) ? null : Number(raw);
    },
});

const d4hContextName = computed(() => (meta.value?.contextName ?? '').trim());

const effectiveDefaultAgency = computed(() =>
    resolveEffectiveDefaultAgency(defaultAgency.value, d4hContextName.value),
);

const defaultAgencyHint = computed(() => {
    const override = defaultAgency.value.trim();
    const d4h = d4hContextName.value;
    if (override && d4h && override !== d4h) {
        return `Override active. D4H team: ${d4h}.`;
    }
    if (override) {
        return 'Saved on this mission as default_agency in mission_schema.json.';
    }
    if (d4h) {
        return `Using D4H team: ${d4h}. Enter a value above to override.`;
    }
    return 'Enter your agency name, or sync D4H to pull it automatically.';
});

const canCreate = computed(() =>
    form.value.resourceIdentifier.trim().length > 0
    && form.value.resource.trim().length > 0
    && form.value.agency.trim().length > 0,
);

function statusLabelFor(status: ResourceAssignmentStatus): string {
    return statusOptions.find((opt) => opt.value === status)?.label ?? 'Planned';
}

function rebuildAgencyOptions(): void {
    agencyOptions.value = buildAgencyOptions(d4hExternalResources.value, effectiveDefaultAgency.value);
}

function applyEffectiveDefaultToForm(force = false): void {
    const effective = effectiveDefaultAgency.value;
    if (!effective) return;
    if (force || !form.value.agency.trim() || form.value.agency === lastEffectiveDefaultAgency.value) {
        form.value.agency = effective;
    }
    lastEffectiveDefaultAgency.value = effective;
}

function resetForm(): void {
    form.value = {
        ...blankResourceAssignmentForm(),
        timeOrdered: nowDatetimeLocal(),
        agency: effectiveDefaultAgency.value,
    };
}

async function refreshAgencies(): Promise<void> {
    loadingRoster.value = true;
    try {
        const roster = await loadD4hRoster();
        meta.value = roster?.meta ?? await loadD4hMeta();
        d4hExternalResources.value = roster?.externalResources ?? [];
        rebuildAgencyOptions();
        applyEffectiveDefaultToForm();
    } finally {
        loadingRoster.value = false;
    }
}

async function onDefaultAgencyBlur(): Promise<void> {
    if (!activeMission.value) return;
    const next = defaultAgencyInput.value.trim();
    if (next === defaultAgency.value.trim()) return;

    savingDefaultAgency.value = true;
    try {
        await updateDefaultAgency(activeMission.value, next);
        rebuildAgencyOptions();
        applyEffectiveDefaultToForm(true);
    } finally {
        savingDefaultAgency.value = false;
    }
}

async function createAssignment(): Promise<void> {
    if (!requireActiveMission()) return;
    const mission = activeMission.value;
    if (!mission || !canCreate.value) return;

    const etaRaw = form.value.eta;
    const eta = etaRaw == null || Number.isNaN(Number(etaRaw))
        ? null
        : Number(etaRaw);

    await addAssignment(mission, {
        resourceIdentifier: form.value.resourceIdentifier.trim(),
        resource: form.value.resource.trim(),
        agency: form.value.agency.trim(),
        timeOrdered: form.value.timeOrdered.trim(),
        eta,
        status: form.value.status,
        timeArrived: form.value.timeArrived.trim(),
    });

    resetForm();
}

async function removeAssignmentRecord(id: string): Promise<void> {
    if (!activeMission.value) return;
    if (!window.confirm('Remove this resource assignment?')) return;
    await removeAssignment(activeMission.value, id);
}

function rowAgencyOptions(currentAgency: string): string[] {
    if (currentAgency && !agencyOptions.value.includes(currentAgency)) {
        return [currentAgency, ...agencyOptions.value];
    }
    return agencyOptions.value;
}

async function onFieldChange(
    id: string,
    field: keyof Omit<ResourceAssignment, 'id' | 'eta' | 'status'>,
    value: string,
): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, { [field]: value });
}

async function onEtaChange(id: string, raw: string): Promise<void> {
    if (!activeMission.value) return;
    const eta = raw.trim() === '' || Number.isNaN(Number(raw)) ? null : Number(raw);
    await updateAssignment(activeMission.value, id, { eta });
}

async function onStatusChange(id: string, status: ResourceAssignmentStatus): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, { status });
}

async function onStatusLabelChange(id: string, label: string): Promise<void> {
    const opt = statusOptions.find((entry) => entry.label === label);
    if (!opt) return;
    await onStatusChange(id, opt.value);
}

watch(() => activeMission.value?.guid, async (guid) => {
    await loadForMission(guid ? activeMission.value : null);
    defaultAgencyInput.value = defaultAgency.value;
    applyEffectiveDefaultToForm(true);
}, { immediate: true });

watch(defaultAgency, (value) => {
    defaultAgencyInput.value = value;
    rebuildAgencyOptions();
    applyEffectiveDefaultToForm();
});

watch(effectiveDefaultAgency, () => {
    rebuildAgencyOptions();
    applyEffectiveDefaultToForm();
});

onMounted(() => {
    void refreshAgencies();
});
</script>

<style scoped>
.resources-table-scroll {
    max-height: 50vh;
    overflow: auto;
}

.rotate-180 {
    transform: rotate(-180deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
