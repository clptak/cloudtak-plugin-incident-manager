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

        <div
            v-if='!activeMission'
            class='alert alert-info small mb-3'
        >
            Select a mission in <strong>Create | Open</strong> before creating resource assignments.
        </div>

        <div
            v-if='statusMessage'
            class='alert small py-2 mb-3'
            :class='statusError ? "alert-danger" : "alert-success"'
        >
            {{ statusMessage }}
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2 small fw-semibold d-flex align-items-center'>
                <IconInfoCircle
                    :size='16'
                    stroke='1.5'
                    class='me-1'
                />
                <span>Information</span>
            </div>
            <div class='card-body py-2 small'>
                Utilize the
                <a
                    href='#'
                    @click.prevent='selectHTabGuarded("organization")'
                >Organization Tab</a>
                to create your ICS 201 Organizational Chart and Team Assignments
            </div>
        </div>

        <div class='card mb-3'>
            <div
                class='card-header py-2 small fw-semibold d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='defaultAgencyExpanded'
                @click='defaultAgencyExpanded = !defaultAgencyExpanded'
                @keydown.enter.prevent='defaultAgencyExpanded = !defaultAgencyExpanded'
                @keydown.space.prevent='defaultAgencyExpanded = !defaultAgencyExpanded'
            >
                <span>Default agency</span>
                <IconChevronDown
                    class='ms-auto transition-transform'
                    :class='{ "rotate-180": defaultAgencyExpanded }'
                    :size='18'
                    stroke='1.5'
                />
            </div>
            <div
                v-show='defaultAgencyExpanded'
                class='card-body py-2'
            >
                <label class='form-label small mb-1'>Default agency</label>
                <input
                    v-model='defaultAgencyInput'
                    type='text'
                    class='form-control form-control-sm'
                    placeholder='Your agency name'
                    autocomplete='organization'
                    :disabled='!activeMission || saving || savingDefaultAgency'
                    @blur='onDefaultAgencyBlur'
                >
                <p
                    v-if='defaultAgencyHint'
                    class='text-muted small mb-0 mt-2'
                >
                    {{ defaultAgencyHint }}
                </p>
            </div>
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2 small fw-semibold d-flex align-items-center gap-2'>
                <span>New resource assignment</span>
                <span
                    class='ms-auto d-inline-flex'
                    @click.stop
                >
                    <NavHelpButton help-key='resource-summary' />
                </span>
            </div>
            <div class='card-body'>
                <div class='row g-2'>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Resource Identifier</label>
                        <input
                            v-model='form.resourceIdentifier'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='e.g. SO GROUND TEAM 1'
                            autocomplete='off'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Resource</label>
                        <select
                            v-model='form.resource'
                            class='form-select form-select-sm'
                            :disabled='!activeMission || saving'
                        >
                            <option value=''>
                                — Select resource —
                            </option>
                            <option
                                v-for='resource in resourceTypeOptions'
                                :key='resource'
                                :value='resource'
                            >
                                {{ resource }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label small mb-1'>Agency</label>
                        <select
                            v-model='form.agency'
                            class='form-select form-select-sm'
                            :disabled='!activeMission || saving'
                        >
                            <option value=''>
                                — Select agency —
                            </option>
                            <option
                                v-for='agency in agencyOptions'
                                :key='agency'
                                :value='agency'
                            >
                                {{ agency }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Time Ordered</label>
                        <input
                            v-model='form.timeOrdered'
                            type='datetime-local'
                            class='form-control form-control-sm'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>ETA</label>
                        <input
                            v-model.number='form.eta'
                            type='number'
                            min='0'
                            step='1'
                            class='form-control form-control-sm'
                            placeholder='Hours'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Status</label>
                        <select
                            v-model='form.status'
                            class='form-select form-select-sm'
                            :disabled='!activeMission || saving'
                        >
                            <option
                                v-for='opt in statusOptions'
                                :key='opt.value'
                                :value='opt.value'
                            >
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Time Arrived</label>
                        <input
                            v-model='form.timeArrived'
                            type='datetime-local'
                            class='form-control form-control-sm'
                            :disabled='!activeMission || saving'
                        >
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
            </div>
        </div>

        <div
            v-if='activeMission'
            class='card'
        >
            <div class='card-header py-2 small fw-semibold d-flex align-items-center gap-2'>
                <span>Mission resource assignments ({{ assignments.length }})</span>
                <span
                    v-if='loading'
                    class='text-muted fw-normal'
                >Loading…</span>
            </div>
            <div
                v-if='!assignments.length && !loading'
                class='card-body text-muted small'
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
                            <th style='width: 96px;'>
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
                                <input
                                    :value='assignment.resourceIdentifier'
                                    type='text'
                                    class='form-control form-control-sm'
                                    :disabled='saving'
                                    @change='onFieldChange(assignment.id, "resourceIdentifier", ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <select
                                    :value='assignment.resource'
                                    class='form-select form-select-sm'
                                    :disabled='saving'
                                    @change='onFieldChange(assignment.id, "resource", ($event.target as HTMLSelectElement).value)'
                                >
                                    <option value=''>
                                        —
                                    </option>
                                    <option
                                        v-for='resource in resourceTypeOptions'
                                        :key='resource'
                                        :value='resource'
                                    >
                                        {{ resource }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <select
                                    :value='assignment.agency'
                                    class='form-select form-select-sm'
                                    :disabled='saving'
                                    @change='onFieldChange(assignment.id, "agency", ($event.target as HTMLSelectElement).value)'
                                >
                                    <option
                                        v-for='agency in rowAgencyOptions(assignment.agency)'
                                        :key='agency'
                                        :value='agency'
                                    >
                                        {{ agency }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <input
                                    :value='assignment.timeOrdered'
                                    type='datetime-local'
                                    class='form-control form-control-sm'
                                    :disabled='saving'
                                    @change='onFieldChange(assignment.id, "timeOrdered", ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <input
                                    :value='assignment.eta ?? ""'
                                    type='number'
                                    min='0'
                                    step='1'
                                    class='form-control form-control-sm'
                                    :disabled='saving'
                                    @change='onEtaChange(assignment.id, ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <select
                                    :value='assignment.status'
                                    class='form-select form-select-sm'
                                    :disabled='saving'
                                    @change='onStatusChange(assignment.id, ($event.target as HTMLSelectElement).value as ResourceAssignmentStatus)'
                                >
                                    <option
                                        v-for='opt in statusOptions'
                                        :key='opt.value'
                                        :value='opt.value'
                                    >
                                        {{ opt.label }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <input
                                    :value='assignment.timeArrived'
                                    type='datetime-local'
                                    class='form-control form-control-sm'
                                    :disabled='saving'
                                    @change='onFieldChange(assignment.id, "timeArrived", ($event.target as HTMLInputElement).value)'
                                >
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
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-vue';
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
