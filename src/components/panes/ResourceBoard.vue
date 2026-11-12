<template>
    <div class='resource-board'>
        <!-- OP picker -->
        <div
            v-if='opRegistry.length'
            class='d-flex flex-wrap align-items-center gap-1 mb-2'
            role='group'
            aria-label='Operational period'
        >
            <button
                v-for='opt in opOptions'
                :key='opt.key'
                type='button'
                class='btn btn-sm'
                :class='opt.op === pickedOp ? "btn-primary" : "btn-outline-secondary"'
                :aria-pressed='opt.op === pickedOp'
                @click='pickOp(opt.op)'
            >
                {{ opt.label }}
            </button>
        </div>

        <!-- Summary -->
        <div class='d-flex flex-wrap align-items-center gap-2 small mb-2'>
            <span class='badge bg-orange-lt'>Need {{ summary.need }}</span>
            <span class='badge bg-azure-lt'>Requested {{ summary.requested }}</span>
            <span class='badge bg-green-lt'>Have {{ summary.have }}</span>
            <span class='badge bg-secondary-lt'>Demobilized {{ summary.demobilized }}</span>
            <span class='text-white-50'>·</span>
            <span>
                {{ summary.running }} assignment{{ summary.running === 1 ? '' : 's' }}
                {{ pickedOp === null ? 'running' : 'not yet debriefed' }}
            </span>
            <button
                v-if='pickedOp !== null'
                type='button'
                class='btn btn-link btn-sm p-0 ms-auto'
                :disabled='loadingOp'
                @click='loadOpWork'
            >
                {{ loadingOp ? 'Loading…' : 'Refresh' }}
            </button>
        </div>

        <!-- Filters -->
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <input
                v-model='search'
                type='search'
                class='form-control form-control-sm board-search'
                placeholder='Search resources and assignments'
                aria-label='Search resources and assignments'
            >
            <button
                type='button'
                class='btn btn-sm'
                :class='freeOnly ? "btn-green" : "btn-outline-green"'
                :aria-pressed='freeOnly'
                title='Show only Have resources with no open work'
                @click='freeOnly = !freeOnly'
            >
                Free only ({{ freeCount }})
            </button>
            <span
                v-if='filtering'
                class='small text-white-50'
            >
                Showing {{ shownActive.length }} of {{ board.active.length }}
                <button
                    type='button'
                    class='btn btn-link btn-sm p-0 align-baseline'
                    @click='clearFilters'
                >Clear</button>
            </span>
        </div>

        <div
            v-if='pickedOp === null && !mapReminderDismissed'
            class='alert alert-info d-flex align-items-start gap-2 py-2 mb-2'
            role='note'
        >
            <IconInfoCircle
                :size='18'
                stroke='1.5'
                class='flex-shrink-0 mt-1'
            />
            <div class='small flex-grow-1'>
                You need a map object before making an assignment. Draw or attach the
                assignment's line or polygon to this DataSync first. If it was drawn in
                another GIS, import its GeoJSON, or use the CalTopo Sync plugin.
            </div>
            <button
                type='button'
                class='btn-close'
                aria-label='Dismiss this reminder'
                title='Dismiss'
                @click='dismissMapReminder'
            />
        </div>

        <TablerInlineAlert
            v-if='workStatusError && workStatusMessage'
            class='mb-2'
            severity='danger'
            title='Assignments'
            :description='workStatusMessage'
        />
        <TablerInlineAlert
            v-if='opError'
            class='mb-2'
            severity='warning'
            title='Operational period'
            :description='opError'
        />

        <div
            v-if='!board.active.length && !board.inactive.length && !orphanCount'
            class='text-muted small'
        >
            No resources on {{ pickedLabel }} yet. Create one above.
        </div>
        <div
            v-else-if='filtering && !shownActive.length'
            class='text-muted small mb-2'
        >
            No {{ freeOnly ? 'free ' : '' }}resources{{ search.trim() ? ` match "${search.trim()}"` : '' }} on {{ pickedLabel }}.
        </div>

        <!-- Resource cards -->
        <template
            v-for='r in shownActive'
            :key='r.id'
        >
            <div
                class='board-card border rounded mb-2'
                :class='{ "board-card-free": freeIds.has(r.id) }'
            >
                <button
                    type='button'
                    class='board-card-head btn w-100 text-start d-flex flex-wrap align-items-center gap-2 p-2'
                    :aria-expanded='openResource === r.id'
                    @click='toggleResource(r)'
                >
                    <strong class='text-break'>{{ r.resourceIdentifier || '(no identifier)' }}</strong>
                    <span class='text-white-50 small'>{{ [r.resource, r.agency].filter(Boolean).join(' · ') }}</span>
                    <span class='ms-auto small text-white-50'>{{ timing(r) }}</span>
                    <span
                        v-if='freeIds.has(r.id)'
                        class='badge bg-green text-white'
                        title='Have, with no open work'
                    >Free</span>
                    <span
                        class='badge'
                        :class='statusBadge(r.status)'
                    >{{ resourceStatusLabel(r.status) }}</span>
                    <IconChevronDown
                        :size='16'
                        stroke='1.5'
                        class='transition-transform'
                        :class='{ "rotate-180": openResource === r.id }'
                    />
                </button>

                <div
                    v-if='openResource === r.id && resDraft'
                    class='p-2 border-top'
                >
                    <div class='row g-2'>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>Resource identifier</label>
                            <input
                                v-model='resDraft.resourceIdentifier'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>Resource</label>
                            <select
                                v-model='resDraft.resource'
                                class='form-select form-select-sm'
                            >
                                <option value=''>
                                    —
                                </option>
                                <option
                                    v-for='t in withCurrent(RESOURCE_TYPE_OPTIONS, resDraft.resource)'
                                    :key='t'
                                    :value='t'
                                >
                                    {{ t }}
                                </option>
                            </select>
                        </div>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>Agency</label>
                            <select
                                v-model='resDraft.agency'
                                class='form-select form-select-sm'
                            >
                                <option
                                    v-for='a in withCurrent(agencyOptions, resDraft.agency)'
                                    :key='a'
                                    :value='a'
                                >
                                    {{ a }}
                                </option>
                            </select>
                        </div>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>Status</label>
                            <select
                                v-model='resDraft.status'
                                class='form-select form-select-sm'
                            >
                                <option
                                    v-for='s in RESOURCE_ASSIGNMENT_STATUSES'
                                    :key='s.value'
                                    :value='s.value'
                                >
                                    {{ s.label }}
                                </option>
                            </select>
                        </div>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>Time ordered</label>
                            <input
                                v-model='resDraft.timeOrdered'
                                type='datetime-local'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>ETA (hours)</label>
                            <input
                                v-model='resDraft.eta'
                                type='number'
                                min='0'
                                step='0.25'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div class='col-sm-6 col-lg-4'>
                            <label class='form-label small mb-0'>Time arrived</label>
                            <input
                                v-model='resDraft.timeArrived'
                                type='datetime-local'
                                class='form-control form-control-sm'
                            >
                        </div>
                        <div
                            v-if='opRegistry.length'
                            class='col-sm-6 col-lg-4'
                        >
                            <label class='form-label small mb-0'>Operational period</label>
                            <select
                                v-model='resDraft.op'
                                class='form-select form-select-sm'
                            >
                                <option :value='0'>
                                    Initial Response
                                </option>
                                <option
                                    v-for='op in opRegistry'
                                    :key='op.guid'
                                    :value='op.opNumber'
                                >
                                    OP{{ op.opNumber }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class='d-flex flex-wrap align-items-center gap-2 mt-2'>
                        <button
                            type='button'
                            class='btn btn-primary btn-sm'
                            :disabled='busy || !resDraft.resourceIdentifier.trim()'
                            @click='saveResource(r)'
                        >
                            {{ savingResources ? 'Saving…' : 'Save' }}
                        </button>
                        <button
                            type='button'
                            class='btn btn-outline-secondary btn-sm'
                            @click='closeResource'
                        >
                            Cancel
                        </button>
                        <button
                            type='button'
                            class='btn btn-ghost-secondary btn-sm ms-auto'
                            title='Delete this resource'
                            aria-label='Delete this resource'
                            :disabled='busy'
                            @click='confirmDelete = { kind: "resource", id: r.id }'
                        >
                            <IconTrash
                                :size='16'
                                stroke='1.5'
                            />
                        </button>
                    </div>
                    <div
                        v-if='confirmDelete?.kind === "resource" && confirmDelete.id === r.id'
                        class='alert alert-warning mt-2 mb-0 py-2'
                    >
                        <div class='small mb-2'>
                            Delete {{ r.resourceIdentifier || 'this resource' }}?
                            <template v-if='pickedOp === null && workFor(r, work).length'>
                                Its {{ workFor(r, work).length }} assignment{{ workFor(r, work).length === 1 ? '' : 's' }}
                                will move to No resource.
                            </template>
                            This can't be undone.
                        </div>
                        <button
                            type='button'
                            class='btn btn-warning btn-sm me-2'
                            :disabled='busy'
                            @click='deleteResource(r)'
                        >
                            Delete resource
                        </button>
                        <button
                            type='button'
                            class='btn btn-outline-secondary btn-sm'
                            @click='confirmDelete = null'
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                <!-- Work under this resource -->
                <div class='px-2 pb-2'>
                    <template v-if='pickedOp === null'>
                        <ResourceWorkLine
                            v-for='w in workFor(r, work)'
                            :key='w.id'
                            :work='w'
                            :open='openWork === w.id'
                            :busy='busy'
                            @toggle='toggleWork(w)'
                            @start='sendPhase(w, "started")'
                            @complete='sendPhase(w, "completed")'
                        >
                            <div class='board-form border rounded p-2 mb-1'>
                                <ResourceWorkFields
                                    v-model:draft='workDraft'
                                    :map-objects='missionCots'
                                    :loading-map-objects='loadingCots'
                                    @refresh='refreshMissionCots'
                                />
                                <div class='d-flex flex-wrap align-items-center gap-2 mt-2'>
                                    <button
                                        type='button'
                                        class='btn btn-primary btn-sm'
                                        :disabled='busy || !workDraft.assignmentUid'
                                        @click='saveWork(w)'
                                    >
                                        {{ savingWork ? 'Saving…' : 'Save' }}
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-secondary btn-sm'
                                        @click='openWork = null'
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-ghost-secondary btn-sm ms-auto'
                                        title='Delete this assignment'
                                        aria-label='Delete this assignment'
                                        :disabled='busy'
                                        @click='confirmDelete = { kind: "work", id: w.id }'
                                    >
                                        <IconTrash
                                            :size='16'
                                            stroke='1.5'
                                        />
                                    </button>
                                </div>
                                <div
                                    v-if='confirmDelete?.kind === "work" && confirmDelete.id === w.id'
                                    class='alert alert-warning mt-2 mb-0 py-2'
                                >
                                    <div class='small mb-2'>
                                        Delete assignment #{{ w.assignmentNumber }}? This can't be undone.
                                    </div>
                                    <button
                                        type='button'
                                        class='btn btn-warning btn-sm me-2'
                                        :disabled='busy'
                                        @click='deleteWork(w)'
                                    >
                                        Delete assignment
                                    </button>
                                    <button
                                        type='button'
                                        class='btn btn-outline-secondary btn-sm'
                                        @click='confirmDelete = null'
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </ResourceWorkLine>
                        <div
                            v-if='assignFor === r.id'
                            class='board-form border rounded p-2 mt-1'
                        >
                            <div class='small text-white-50 mb-1'>
                                New assignment for {{ r.resourceIdentifier }}
                            </div>
                            <ResourceWorkFields
                                v-model:draft='newWork'
                                :map-objects='missionCots'
                                :loading-map-objects='loadingCots'
                                @refresh='refreshMissionCots'
                            />
                            <div class='d-flex flex-wrap gap-2 mt-2'>
                                <button
                                    type='button'
                                    class='btn btn-primary btn-sm'
                                    :disabled='busy || !newWork.assignmentUid'
                                    @click='addWork(r)'
                                >
                                    {{ savingWork ? 'Saving…' : 'Add assignment' }}
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-secondary btn-sm'
                                    @click='assignFor = null'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                        <button
                            v-else
                            type='button'
                            class='btn btn-outline-primary btn-sm mt-1'
                            @click='startAssign(r)'
                        >
                            + Assign
                        </button>
                    </template>
                    <template v-else>
                        <ResourceOpLine
                            v-for='item in opItemsFor(r)'
                            :key='item.assignment.id ?? `${item.assignment.opNumber}-${item.assignment.segmentUid}`'
                            :item='item'
                            @debrief='debriefInOperationalPeriods(item.assignment)'
                        />
                        <button
                            v-if='pickedOpOpen'
                            type='button'
                            class='btn btn-outline-primary btn-sm mt-1'
                            @click='assignInOperationalPeriods(r)'
                        >
                            + Assign in Operational Periods
                        </button>
                    </template>
                </div>
            </div>
        </template>

        <!-- Assignments with no resource -->
        <div
            v-if='orphanCount && !freeOnly'
            class='board-card border border-dashed rounded mb-2'
        >
            <div class='p-2 d-flex align-items-center gap-2'>
                <strong>No resource</strong>
                <span class='small text-white-50'>
                    {{ pickedOp === null
                        ? 'Assignments whose team was deleted or moved to an OP. Open one to pick a team.'
                        : `OP${pickedOp} assignments with no team, or a team that isn't a resource on OP${pickedOp}.` }}
                </span>
            </div>
            <div class='px-2 pb-2'>
                <template v-if='pickedOp === null'>
                    <ResourceWorkLine
                        v-for='w in orphanWorkList'
                        :key='w.id'
                        :work='w'
                        :open='openWork === w.id'
                        :busy='busy'
                        show-team
                        @toggle='toggleWork(w)'
                        @start='sendPhase(w, "started")'
                        @complete='sendPhase(w, "completed")'
                    >
                        <div class='board-form border rounded p-2 mb-1'>
                            <ResourceWorkFields
                                v-model:draft='workDraft'
                                :map-objects='missionCots'
                                :loading-map-objects='loadingCots'
                                :teams='irTeams'
                                @refresh='refreshMissionCots'
                            />
                            <div class='d-flex flex-wrap align-items-center gap-2 mt-2'>
                                <button
                                    type='button'
                                    class='btn btn-primary btn-sm'
                                    :disabled='busy || !workDraft.assignmentUid'
                                    @click='saveWork(w)'
                                >
                                    {{ savingWork ? 'Saving…' : 'Save' }}
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-secondary btn-sm'
                                    @click='openWork = null'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-ghost-secondary btn-sm ms-auto'
                                    title='Delete this assignment'
                                    aria-label='Delete this assignment'
                                    :disabled='busy'
                                    @click='confirmDelete = { kind: "work", id: w.id }'
                                >
                                    <IconTrash
                                        :size='16'
                                        stroke='1.5'
                                    />
                                </button>
                            </div>
                            <div
                                v-if='confirmDelete?.kind === "work" && confirmDelete.id === w.id'
                                class='alert alert-warning mt-2 mb-0 py-2'
                            >
                                <div class='small mb-2'>
                                    Delete assignment #{{ w.assignmentNumber }}? This can't be undone.
                                </div>
                                <button
                                    type='button'
                                    class='btn btn-warning btn-sm me-2'
                                    :disabled='busy'
                                    @click='deleteWork(w)'
                                >
                                    Delete assignment
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-outline-secondary btn-sm'
                                    @click='confirmDelete = null'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </ResourceWorkLine>
                </template>
                <template v-else>
                    <ResourceOpLine
                        v-for='item in orphanOpList'
                        :key='item.assignment.id ?? `${item.assignment.opNumber}-${item.assignment.segmentUid}`'
                        :item='item'
                        show-team
                        @debrief='debriefInOperationalPeriods(item.assignment)'
                    />
                </template>
            </div>
        </div>

        <!-- Demobilized and cancelled -->
        <div v-if='shownInactive.length && !freeOnly'>
            <button
                type='button'
                class='btn btn-link btn-sm p-0 text-white-50'
                :aria-expanded='showInactive'
                @click='showInactive = !showInactive'
            >
                {{ showInactive ? 'Hide' : 'Show' }} demobilized and cancelled ({{ shownInactive.length }})
            </button>
            <div
                v-if='showInactive'
                class='mt-2'
            >
                <div
                    v-for='r in shownInactive'
                    :key='r.id'
                    class='border rounded mb-2 p-2 d-flex flex-wrap align-items-center gap-2 opacity-75'
                >
                    <strong>{{ r.resourceIdentifier || '(no identifier)' }}</strong>
                    <span class='text-white-50 small'>{{ [r.resource, r.agency].filter(Boolean).join(' · ') }}</span>
                    <span
                        class='badge ms-auto'
                        :class='statusBadge(r.status)'
                    >{{ resourceStatusLabel(r.status) }}</span>
                    <button
                        type='button'
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='reactivate(r)'
                    >
                        Back to Have
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import { IconChevronDown, IconInfoCircle, IconTrash } from '@tabler/icons-vue';
import { TablerInlineAlert } from '@tak-ps/vue-tabler';
import ResourceOpLine from './ResourceOpLine.vue';
import ResourceWorkFields from './ResourceWorkFields.vue';
import ResourceWorkLine from './ResourceWorkLine.vue';
import { useIncident } from '../../composables/useIncident.ts';
import { useResourceAssignments } from '../../composables/useResourceAssignments.ts';
import { useWorkAssignments } from '../../composables/useWorkAssignments.ts';
import type { DebriefRecord, OpAssignment, OpPeriodRegistryEntry } from '../../domain/entities.ts';
import { currentOpPeriod } from '../../domain/registry.ts';
import { createDebriefStore } from '../../lib/debriefPersistence.ts';
import { ensureMissionFolder } from '../../lib/folder.ts';
import { loadIncidentSubscription } from '../../lib/incidentSubscription.ts';
import { nowDatetimeLocal } from '../../lib/incidentInfo.ts';
import { listMissionCots, type MissionCotRef } from '../../lib/missionCots.ts';
import { createAssignmentStore } from '../../lib/opAssignmentPersistence.ts';
import { pendingOpAssign, pendingOpDebrief } from '../../lib/pendingOpAssign.ts';
import {
    boardResources,
    boardSummary,
    isFreeResource,
    matchesBoardSearch,
    nextAssignmentNumber,
    opOfResource,
    opWorkFor,
    orphanOpWork,
    orphanWork,
    workFor,
    shortLocalTime,
    type BoardOp,
    type OpWork,
    type WorkDraft,
} from '../../lib/resourceBoard.ts';
import {
    RESOURCE_ASSIGNMENT_STATUSES,
    RESOURCE_TYPE_OPTIONS,
    isActiveResource,
    resourceStatusLabel,
    type ResourceAssignment,
    type ResourceAssignmentStatus,
} from '../../lib/resourceAssignments.ts';
import type { WorkAssignment } from '../../lib/workAssignments.ts';

const props = defineProps<{
    opRegistry: OpPeriodRegistryEntry[];
    agencyOptions: string[];
}>();

const emit = defineEmits<{
    /** The OP picked at the top (null = Initial Response). */
    (e: 'op-change', op: BoardOp): void;
}>();

const ASSIGNMENT_FOLDER = 'Assignments';
const MAP_REMINDER_KEY = 'incident-manager:board-map-object-reminder-dismissed';

function loadMapReminderDismissed(): boolean {
    try {
        return localStorage.getItem(MAP_REMINDER_KEY) === '1';
    } catch {
        return false;
    }
}

/** "You need a map object" reminder at the top of Initial Response, until dismissed. */
const mapReminderDismissed = ref(loadMapReminderDismissed());

function dismissMapReminder(): void {
    mapReminderDismissed.value = true;
    try {
        localStorage.setItem(MAP_REMINDER_KEY, '1');
    } catch {
        // private mode or quota: hidden for this session only
    }
}

const { activeMission, requireActiveMission, selectKeyGuarded } = useIncident();
const {
    assignments: resources,
    saving: savingResources,
    updateAssignment: updateResource,
    removeAssignment: removeResource,
} = useResourceAssignments();
const {
    assignments: work,
    saving: savingWork,
    sending,
    statusMessage: workStatusMessage,
    statusError: workStatusError,
    loadForMission: loadWork,
    addAssignment: addWorkAssignment,
    removeAssignment: removeWorkAssignment,
    updateAssignment: updateWorkAssignment,
    sendPhaseLog,
} = useWorkAssignments();

const busy = computed(() => savingResources.value || savingWork.value || sending.value);

// ── Operational period picked at the top ─────────────────────────────────
const pickedOp = ref<BoardOp>(null);
let userPickedOp = false;

const opOptions = computed(() => {
    const current = currentOpPeriod(props.opRegistry)?.opNumber;
    return [
        { key: 'ir', op: null as BoardOp, label: 'Initial Response' },
        ...[...props.opRegistry]
            .sort((a, b) => a.opNumber - b.opNumber)
            .map((op) => ({
                key: op.guid,
                op: op.opNumber as BoardOp,
                label: `OP${op.opNumber}${op.opNumber === current ? ' · current' : op.status === 'closed' ? ' · closed' : ''}`,
            })),
    ];
});

const pickedLabel = computed(() => (pickedOp.value === null ? 'Initial Response' : `OP${pickedOp.value}`));
const pickedOpOpen = computed(() => props.opRegistry.some((op) => op.opNumber === pickedOp.value && op.status !== 'closed'));

watch(() => props.opRegistry, (registry) => {
    if (userPickedOp) return;
    pickedOp.value = currentOpPeriod(registry)?.opNumber ?? null;
}, { immediate: true });

// The new-resource form above follows the OP picked here.
watch(pickedOp, (op) => emit('op-change', op), { immediate: true });

function pickOp(op: BoardOp): void {
    userPickedOp = true;
    pickedOp.value = op;
    closeResource();
    assignFor.value = null;
}

// ── OP segment assignments and debriefs (read-only here) ──────────────────
const opAssignments = ref<OpAssignment[]>([]);
const debriefs = ref<DebriefRecord[]>([]);
const loadingOp = ref(false);
const opError = ref('');

async function loadOpWork(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    loadingOp.value = true;
    opError.value = '';
    try {
        [opAssignments.value, debriefs.value] = await Promise.all([
            createAssignmentStore(mission).load(),
            createDebriefStore(mission).load(),
        ]);
    } catch (err) {
        opError.value = `Assignments for this period could not be loaded: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingOp.value = false;
    }
}

watch(pickedOp, (op) => {
    if (op !== null && !opAssignments.value.length) void loadOpWork();
});

// ── Board contents ─────────────────────────────────────────────────────────
const board = computed(() => boardResources(resources.value, pickedOp.value));

// ── Filters and free resources ─────────────────────────────────────────────
const search = ref('');
const freeOnly = ref(false);
const filtering = computed(() => freeOnly.value || Boolean(search.value.trim()));

const freeIds = computed(() => new Set(board.value.active
    .filter((r) => isFreeResource(r, pickedOp.value, work.value, opAssignments.value, debriefs.value))
    .map((r) => r.id)));
const freeCount = computed(() => freeIds.value.size);

function workTextFor(r: ResourceAssignment): string[] {
    return pickedOp.value === null
        ? workFor(r, work.value).map((w) => `${w.assignmentCallsign} ${w.instructions}`)
        : opItemsFor(r).map((x) => `Seg ${x.assignment.label} ${x.assignment.notes ?? ''}`);
}

const shownActive = computed(() => board.value.active.filter((r) =>
    (!freeOnly.value || freeIds.value.has(r.id)) && matchesBoardSearch(r, search.value, workTextFor(r))));
const shownInactive = computed(() => board.value.inactive.filter((r) => matchesBoardSearch(r, search.value)));

function clearFilters(): void {
    search.value = '';
    freeOnly.value = false;
}
const orphanWorkList = computed(() => (pickedOp.value === null ? orphanWork(resources.value, work.value) : []));
const orphanOpList = computed(() => (pickedOp.value === null
    ? []
    : orphanOpWork(resources.value, pickedOp.value, opAssignments.value, debriefs.value)));
const orphanCount = computed(() => orphanWorkList.value.length + orphanOpList.value.length);

function opItemsFor(r: ResourceAssignment): OpWork[] {
    return pickedOp.value === null ? [] : opWorkFor(r, pickedOp.value, opAssignments.value, debriefs.value);
}
const summary = computed(() => boardSummary(
    resources.value, pickedOp.value, work.value, opAssignments.value, debriefs.value,
));

function statusBadge(status: ResourceAssignmentStatus): string {
    return {
        have: 'bg-green-lt',
        requested: 'bg-azure-lt',
        need: 'bg-orange-lt',
        demobilized: 'bg-secondary-lt',
        cancelled: 'bg-secondary-lt text-decoration-line-through',
    }[status];
}

function timing(r: ResourceAssignment): string {
    if (r.timeArrived.trim()) return `Arrived ${shortLocalTime(r.timeArrived)}`;
    if (r.eta != null && r.status === 'requested') return `ETA ${r.eta} h`;
    if (r.timeOrdered.trim()) return `Ordered ${shortLocalTime(r.timeOrdered)}`;
    return '';
}

function withCurrent(options: readonly string[], current: string): string[] {
    return current && !options.includes(current) ? [current, ...options] : [...options];
}

// ── Editing a resource ─────────────────────────────────────────────────────
interface ResDraft {
    resourceIdentifier: string;
    resource: string;
    agency: string;
    status: ResourceAssignmentStatus;
    timeOrdered: string;
    eta: string | number;
    timeArrived: string;
    op: number;
}

const openResource = ref<string | null>(null);
const resDraft = ref<ResDraft | null>(null);
const confirmDelete = ref<{ kind: 'resource' | 'work'; id: string } | null>(null);
const showInactive = ref(false);

function toggleResource(r: ResourceAssignment): void {
    if (openResource.value === r.id) {
        closeResource();
        return;
    }
    openResource.value = r.id;
    confirmDelete.value = null;
    resDraft.value = {
        resourceIdentifier: r.resourceIdentifier,
        resource: r.resource,
        agency: r.agency,
        status: r.status,
        timeOrdered: r.timeOrdered,
        eta: r.eta ?? '',
        timeArrived: r.timeArrived,
        op: opOfResource(r) ?? 0,
    };
}

function closeResource(): void {
    openResource.value = null;
    resDraft.value = null;
    confirmDelete.value = null;
}

async function saveResource(r: ResourceAssignment): Promise<void> {
    if (!requireActiveMission() || !activeMission.value || !resDraft.value) return;
    const d = resDraft.value;
    const etaText = String(d.eta).trim();
    await updateResource(activeMission.value, r.id, {
        resourceIdentifier: d.resourceIdentifier.trim(),
        resource: d.resource,
        agency: d.agency,
        status: d.status,
        timeOrdered: d.timeOrdered,
        eta: etaText === '' || Number.isNaN(Number(etaText)) ? null : Number(etaText),
        timeArrived: d.timeArrived,
        opNumber: d.op > 0 ? d.op : null,
    });
    // Keep the work list's team name in step with a renamed resource.
    if (d.resourceIdentifier.trim() !== r.resourceIdentifier) {
        for (const w of workFor(r, work.value)) {
            await updateWorkAssignment(activeMission.value, w.id, { teamLabel: d.resourceIdentifier.trim() });
        }
    }
    closeResource();
}

async function deleteResource(r: ResourceAssignment): Promise<void> {
    if (!requireActiveMission() || !activeMission.value) return;
    await removeResource(activeMission.value, r.id);
    closeResource();
}

async function reactivate(r: ResourceAssignment): Promise<void> {
    if (!requireActiveMission() || !activeMission.value) return;
    await updateResource(activeMission.value, r.id, { status: 'have' });
}

// ── Initial Response work assignments ─────────────────────────────────────
const missionCots = ref<MissionCotRef[]>([]);
const loadingCots = ref(false);

async function refreshMissionCots(): Promise<void> {
    if (!activeMission.value) return;
    loadingCots.value = true;
    try {
        missionCots.value = await listMissionCots(activeMission.value);
    } catch {
        missionCots.value = [];
    } finally {
        loadingCots.value = false;
    }
}

async function fileIntoAssignmentFolder(uids: string[]): Promise<void> {
    if (!activeMission.value || !uids.length) return;
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        const folder = await ensureMissionFolder(sub, ASSIGNMENT_FOLDER);
        await sub.layer.attachFeatures(folder.uid, [...new Set(uids)]);
    } catch (err) {
        console.warn('Failed to file CoTs into Assignments folder', err);
    }
}

const assignFor = ref<string | null>(null);
const newWork = ref<WorkDraft>({
    assignmentNumber: 1, teamResourceAssignmentId: '', assignmentUid: '', instructions: '', started: '', completed: '',
});

function startAssign(r: ResourceAssignment): void {
    assignFor.value = r.id;
    newWork.value = {
        assignmentNumber: nextAssignmentNumber(work.value),
        teamResourceAssignmentId: r.id,
        assignmentUid: '',
        instructions: '',
        started: nowDatetimeLocal(),
        completed: '',
    };
    if (!missionCots.value.length) void refreshMissionCots();
}

function callsignFor(uid: string): string {
    return missionCots.value.find((c) => c.uid === uid)?.callsign ?? '';
}

async function addWork(r: ResourceAssignment): Promise<void> {
    if (!requireActiveMission() || !activeMission.value || !newWork.value.assignmentUid) return;
    await addWorkAssignment(activeMission.value, {
        assignmentNumber: newWork.value.assignmentNumber,
        teamResourceAssignmentId: r.id,
        teamLabel: r.resourceIdentifier,
        assignmentUid: newWork.value.assignmentUid,
        assignmentCallsign: callsignFor(newWork.value.assignmentUid),
        instructions: newWork.value.instructions.trim(),
        started: newWork.value.started.trim(),
        completed: newWork.value.completed.trim(),
    });
    await fileIntoAssignmentFolder([newWork.value.assignmentUid]);
    assignFor.value = null;
}

const openWork = ref<string | null>(null);
const workDraft = ref<WorkDraft>({
    assignmentNumber: 1, teamResourceAssignmentId: '', assignmentUid: '', instructions: '', started: '', completed: '',
});

function toggleWork(w: WorkAssignment): void {
    if (openWork.value === w.id) {
        openWork.value = null;
        return;
    }
    openWork.value = w.id;
    confirmDelete.value = null;
    workDraft.value = {
        assignmentNumber: w.assignmentNumber,
        teamResourceAssignmentId: w.teamResourceAssignmentId,
        assignmentUid: w.assignmentUid,
        instructions: w.instructions,
        started: w.started,
        completed: w.completed,
    };
    if (!missionCots.value.length) void refreshMissionCots();
}

const irTeams = computed(() => resources.value.filter((r) => opOfResource(r) === null && isActiveResource(r)));

async function saveWork(w: WorkAssignment): Promise<void> {
    if (!requireActiveMission() || !activeMission.value) return;
    const team = resources.value.find((r) => r.id === workDraft.value.teamResourceAssignmentId);
    const n = Number(workDraft.value.assignmentNumber);
    await updateWorkAssignment(activeMission.value, w.id, {
        assignmentNumber: Number.isInteger(n) && n >= 1 ? n : w.assignmentNumber,
        teamResourceAssignmentId: workDraft.value.teamResourceAssignmentId,
        teamLabel: team?.resourceIdentifier ?? w.teamLabel,
        assignmentUid: workDraft.value.assignmentUid,
        assignmentCallsign: callsignFor(workDraft.value.assignmentUid) || w.assignmentCallsign,
        instructions: workDraft.value.instructions.trim(),
        started: workDraft.value.started.trim(),
        completed: workDraft.value.completed.trim(),
    });
    if (workDraft.value.assignmentUid !== w.assignmentUid) await fileIntoAssignmentFolder([workDraft.value.assignmentUid]);
    openWork.value = null;
}

async function deleteWork(w: WorkAssignment): Promise<void> {
    if (!requireActiveMission() || !activeMission.value) return;
    await removeWorkAssignment(activeMission.value, w.id);
    openWork.value = null;
    confirmDelete.value = null;
}

async function sendPhase(w: WorkAssignment, phase: 'started' | 'completed'): Promise<void> {
    if (!requireActiveMission() || !activeMission.value) return;
    await sendPhaseLog(activeMission.value, w.id, phase);
}

// ── Hand-off to Operational Periods ───────────────────────────────────────
function assignInOperationalPeriods(r: ResourceAssignment): void {
    if (pickedOp.value === null) return;
    pendingOpAssign.value = { team: r.resourceIdentifier.trim(), opNumber: pickedOp.value };
    selectKeyGuarded('operational-periods');
}

/** "Complete / Debrief": open the completed-assignment form in Operational Periods. */
function debriefInOperationalPeriods(a: OpAssignment): void {
    pendingOpDebrief.value = {
        ...(a.id ? { assignmentId: a.id } : {}),
        opNumber: a.opNumber,
        segmentUid: a.segmentUid,
        team: a.team?.trim() ?? '',
    };
    selectKeyGuarded('operational-periods');
}

// ── Loading ────────────────────────────────────────────────────────────────
watch(() => activeMission.value?.guid, (guid) => {
    const mission = guid ? activeMission.value : null;
    opAssignments.value = [];
    debriefs.value = [];
    void (async () => {
        await loadWork(mission);
        if (!mission) return;
        void refreshMissionCots();
        if (pickedOp.value !== null) void loadOpWork();
        await fileIntoAssignmentFolder(work.value.map((w) => w.assignmentUid.trim()).filter(Boolean));
    })();
}, { immediate: true });
</script>

<style scoped>
.board-card-head {
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font-weight: normal;
    justify-content: flex-start;
    white-space: normal;
}

.board-card-head:hover {
    background-color: rgba(var(--tblr-body-color-rgb, 255, 255, 255), 0.04);
}

.board-card-free {
    border-left: 3px solid rgb(var(--tblr-green-rgb, 47, 179, 68)) !important;
}

.board-search {
    max-width: 22rem;
}

.border-dashed {
    border-style: dashed !important;
}

.rotate-180 {
    transform: rotate(-180deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
