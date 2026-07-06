<template>
    <div class='d-flex flex-column h-100 min-height-0 overflow-hidden'>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2 flex-shrink-0'>
            <h3 class='mb-0'>
                Organizational Status
            </h3>
            <span
                v-if='meta?.fetchedAt'
                class='text-muted small'
            >
                D4H sync {{ formatD4hSyncTime(meta.fetchedAt) }}
            </span>
            <span
                v-if='persistStatus'
                class='text-muted small'
            >
                {{ persistStatus }}
            </span>
            <div class='ms-auto d-flex flex-wrap gap-2 align-items-center'>
                <button
                    type='button'
                    class='btn btn-outline-success btn-sm'
                    :disabled='!activeMission || !hasCanvas || syncingOrgChart'
                    @click='syncOrgChart'
                >
                    {{ syncingOrgChart ? 'Syncing…' : 'Sync org chart to DataSync' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-danger btn-sm'
                    :disabled='!hasCanvas'
                    @click='clearCanvas'
                >
                    Clear canvas
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='loadingRoster'
                    @click='refreshRoster'
                >
                    {{ loadingRoster ? 'Loading…' : 'Refresh D4H' }}
                </button>
            </div>
        </div>

        <p class='text-muted small mb-2 flex-shrink-0'>
            Create resource teams in the <strong>Resources</strong> tab, then drag them onto the chart
            with incident command and rescue roles. Add D4H personnel from the palette. The org chart
            auto-saves in <strong>mission_schema.json</strong>. Use
            <strong>Sync org chart to DataSync</strong> for ICS 201 log lines; teams with a selected
            assignment CoT are linked via <code>entryUid</code>. Use
            <strong>×</strong> to remove a node, or <strong>Clear canvas</strong> to start over.
        </p>

        <div
            v-if='syncStatus'
            class='alert small py-2 mb-2 flex-shrink-0'
            :class='syncStatusError ? "alert-danger" : "alert-success"'
        >
            {{ syncStatus }}
        </div>

        <div
            v-if='!loadingRoster && !members.length'
            class='alert alert-info small mb-2 flex-shrink-0'
        >
            No D4H roster in this browser. Open the <strong>D4H</strong> plugin, configure
            Team Manager, and run <strong>Sync now</strong>, then click <strong>Refresh D4H</strong>.
        </div>

        <div class='d-flex gap-2 flex-grow-1 min-height-0 overflow-hidden assignments-workspace'>
            <!-- Palette -->
            <div
                class='card flex-shrink-0 d-flex flex-column min-height-0 assignments-palette'
                style='width: 300px;'
            >
                <div class='card-header py-2 small fw-semibold flex-shrink-0'>
                    Palette
                </div>
                <div class='card-body p-2 overflow-auto flex-grow-1 min-height-0'>
                    <input
                        v-model='paletteSearch'
                        type='search'
                        class='form-control form-control-sm mb-2'
                        placeholder='Search palette…'
                        autocomplete='off'
                    >

                    <details class='palette-collapse mb-2'>
                        <summary class='palette-collapse__summary'>
                            Resource teams ({{ filteredResourceAssignments.length }})
                        </summary>
                        <div class='palette-collapse__body'>
                            <div
                                v-if='!filteredResourceAssignments.length'
                                class='text-muted small px-1 mb-2'
                            >
                                <span v-if='!activeMission'>Select a mission in Create | Open.</span>
                                <span v-else-if='!resourceAssignments.length'>
                                    No resource teams yet — create them in the <strong>Resources</strong> tab.
                                </span>
                                <span v-else>No resource teams match your search.</span>
                            </div>

                            <div
                                v-for='assignment in filteredResourceAssignments'
                                :key='assignment.id'
                                class='card card-sm mb-2'
                            >
                                <div class='card-body p-2'>
                                    <div class='fw-semibold small text-truncate mb-1'>
                                        {{ assignment.resourceIdentifier }}
                                    </div>
                                    <div class='mb-2'>
                                        <label class='form-label small mb-1'>Assignment</label>
                                        <select
                                            :value='assignment.assignmentUid ?? ""'
                                            class='form-select form-select-sm'
                                            :disabled='!activeMission || loadingCots'
                                            @change='onResourceTeamAssignmentChange(assignment.id, ($event.target as HTMLSelectElement).value)'
                                        >
                                            <option value=''>
                                                {{ assignmentSelectLabel }}
                                            </option>
                                            <option
                                                v-for='cot in filteredMissionCots'
                                                :key='cot.uid'
                                                :value='cot.uid'
                                            >
                                                {{ cot.callsign }}
                                            </option>
                                        </select>
                                    </div>
                                    <div
                                        class='card card-sm border-primary-subtle bg-light'
                                        draggable='true'
                                        style='cursor: grab;'
                                        @dragstart='onResourceTeamDragStart($event, assignment)'
                                        @dragend='onPaletteDragEnd'
                                    >
                                        <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                                            <IconTag
                                                :size='18'
                                                stroke='1.5'
                                            />
                                            <div class='small min-width-0'>
                                                <div
                                                    class='text-muted'
                                                    style='font-size: 0.72rem;'
                                                >
                                                    {{ resourceAssignmentDescription(assignment) }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        class='text-muted mt-1'
                                        style='font-size: 0.68rem;'
                                    >
                                        Drag onto the chart
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>

                    <details class='palette-collapse mb-2'>
                        <summary class='palette-collapse__summary'>
                            Incident Command
                        </summary>
                        <div class='palette-collapse__body'>
                            <div
                                v-if='!filteredIcsPositions.length'
                                class='text-muted small px-1 mb-2'
                            >
                                No command positions match your search.
                            </div>

                            <div
                                v-for='pos in filteredIcsPositions'
                                :key='pos.key'
                                class='card card-sm mb-2'
                            >
                                <div class='card-body p-2'>
                                    <label class='form-label small mb-1'>{{ pos.title }}</label>
                                    <select
                                        v-model='asSingleSlot(icsSlots[pos.key]).d4hMemberId'
                                        class='form-select form-select-sm mb-1'
                                    >
                                        <option value=''>
                                            — D4H —
                                        </option>
                                        <option
                                            v-for='m in configurationMembers'
                                            :key='m.id'
                                            :value='m.id'
                                        >
                                            {{ m.name }}
                                        </option>
                                    </select>
                                    <input
                                        v-model='asSingleSlot(icsSlots[pos.key]).customName'
                                        type='text'
                                        class='form-control form-control-sm mb-1'
                                        placeholder='Or type name'
                                        autocomplete='off'
                                    >
                                    <div
                                        class='card card-sm border-secondary-subtle bg-light'
                                        draggable='true'
                                        style='cursor: grab;'
                                        @dragstart='onRolePositionDragStart($event, pos, icsSlots[pos.key])'
                                        @dragend='onPaletteDragEnd'
                                    >
                                        <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                                            <IconShield
                                                :size='16'
                                                stroke='1.5'
                                            />
                                            <div class='small'>
                                                <div class='fw-semibold'>
                                                    {{ rolePositionPreview(pos, icsSlots[pos.key]).title }}
                                                </div>
                                                <div
                                                    v-if='rolePositionPreview(pos, icsSlots[pos.key]).description'
                                                    class='text-muted'
                                                    style='font-size: 0.72rem;'
                                                >
                                                    {{ rolePositionPreview(pos, icsSlots[pos.key]).description }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>

                    <details class='palette-collapse mb-2'>
                        <summary class='palette-collapse__summary'>
                            Rescue Management
                        </summary>
                        <div class='palette-collapse__body'>
                            <div
                                v-if='!filteredRescuePositions.length && !filteredRescueGroupLabels.length'
                                class='text-muted small px-1 mb-2'
                            >
                                No rescue positions match your search.
                            </div>

                            <div
                                v-for='pos in filteredRescuePositions'
                                :key='pos.key'
                                class='card card-sm mb-2'
                            >
                                <div class='card-body p-2'>
                                    <label class='form-label small mb-1'>{{ pos.title }}</label>
                                    <select
                                        v-model='asSingleSlot(rescueSlots[pos.key]).d4hMemberId'
                                        class='form-select form-select-sm mb-1'
                                    >
                                        <option value=''>
                                            — D4H —
                                        </option>
                                        <option
                                            v-for='m in configurationMembers'
                                            :key='m.id'
                                            :value='m.id'
                                        >
                                            {{ m.name }}
                                        </option>
                                    </select>
                                    <input
                                        v-model='asSingleSlot(rescueSlots[pos.key]).customName'
                                        type='text'
                                        class='form-control form-control-sm mb-1'
                                        placeholder='Or type name'
                                        autocomplete='off'
                                    >
                                    <div
                                        class='card card-sm border-secondary-subtle bg-light'
                                        draggable='true'
                                        style='cursor: grab;'
                                        @dragstart='onRolePositionDragStart($event, pos, rescueSlots[pos.key])'
                                        @dragend='onPaletteDragEnd'
                                    >
                                        <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                                            <IconLifebuoy
                                                :size='16'
                                                stroke='1.5'
                                            />
                                            <div class='small'>
                                                <div class='fw-semibold'>
                                                    {{ rolePositionPreview(pos, rescueSlots[pos.key]).title }}
                                                </div>
                                                <div
                                                    v-if='rolePositionPreview(pos, rescueSlots[pos.key]).description'
                                                    class='text-muted'
                                                    style='font-size: 0.72rem;'
                                                >
                                                    {{ rolePositionPreview(pos, rescueSlots[pos.key]).description }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                v-for='label in filteredRescueGroupLabels'
                                :key='label.key'
                                class='card card-sm mb-2'
                                draggable='true'
                                style='cursor: grab;'
                                @dragstart='onRescueGroupLabelDragStart($event, label)'
                                @dragend='onPaletteDragEnd'
                            >
                                <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                                    <IconLifebuoy
                                        :size='16'
                                        stroke='1.5'
                                    />
                                    <span class='small fw-semibold'>{{ label.title }}</span>
                                </div>
                            </div>
                        </div>
                    </details>

                    <details class='palette-collapse mb-2'>
                        <summary class='palette-collapse__summary'>
                            Personnel ({{ filteredMembers.length }})
                        </summary>
                        <div class='palette-collapse__body'>
                            <div
                                v-if='!members.length'
                                class='text-muted small px-1 mb-2'
                            >
                                No D4H roster — sync in the <strong>D4H</strong> plugin, then
                                <strong>Refresh D4H</strong>.
                            </div>
                            <div
                                v-else-if='!filteredMembers.length'
                                class='text-muted small px-1 mb-2'
                            >
                                No personnel match your search.
                            </div>

                            <div
                                v-for='m in filteredMembers'
                                :key='m.id'
                                class='card card-sm mb-2'
                                draggable='true'
                                style='cursor: grab;'
                                @dragstart='onMemberDragStart($event, m)'
                                @dragend='onPaletteDragEnd'
                            >
                                <div class='card-body py-2 px-2'>
                                    <div class='fw-semibold small text-truncate'>
                                        {{ m.name }}
                                    </div>
                                    <div
                                        class='text-muted text-truncate'
                                        style='font-size: 0.72rem;'
                                    >
                                        {{ memberSubtitle(m) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            <!-- HastyTeam canvas -->
            <div class='card flex-grow-1 min-width-0 min-height-0 d-flex flex-column overflow-hidden assignments-canvas'>
                <div class='card-body p-0 flex-grow-1 min-height-0 assignments-chart'>
                    <HastyTeam
                        v-model='teamTree'
                        @drop:root='onDropRoot'
                        @drop:node='onDropNode'
                    >
                        <template #block='{ node, dragover, draggingSelf }'>
                            <div
                                class='card shadow-sm'
                                style='width: 200px;'
                                :class='{
                                    "border-primary": dragover,
                                    "opacity-50": draggingSelf,
                                }'
                                :draggable='!!node.id'
                                @dragstart.stop='onNodeDragStart($event, node.id)'
                                @dragend='onPaletteDragEnd'
                            >
                                <div class='card-body py-2 px-3'>
                                    <div class='d-flex align-items-start gap-2 mb-1'>
                                        <IconUsers
                                            v-if='node.type === "team"'
                                            :size='16'
                                            stroke='1.5'
                                            class='flex-shrink-0 mt-1'
                                        />
                                        <IconTag
                                            v-else-if='node.type === "position"'
                                            :size='16'
                                            stroke='1.5'
                                            class='flex-shrink-0 mt-1'
                                        />
                                        <IconShield
                                            v-else-if='node.type === "role" && node.roleCategory === "incident-command"'
                                            :size='16'
                                            stroke='1.5'
                                            class='flex-shrink-0 mt-1'
                                        />
                                        <IconLifebuoy
                                            v-else-if='node.type === "role" && node.roleCategory === "rescue-management"'
                                            :size='16'
                                            stroke='1.5'
                                            class='flex-shrink-0 mt-1'
                                        />
                                        <IconUser
                                            v-else
                                            :size='16'
                                            stroke='1.5'
                                            class='flex-shrink-0 mt-1'
                                        />
                                        <span class='fw-semibold small flex-grow-1'>
                                            {{ node.title }}
                                        </span>
                                        <button
                                            type='button'
                                            class='btn btn-link btn-sm text-danger p-0 lh-1'
                                            title='Remove from chart'
                                            @click.stop='removeNode(node.id)'
                                        >
                                            <IconX
                                                :size='16'
                                                stroke='1.5'
                                            />
                                        </button>
                                    </div>
                                    <div
                                        v-if='node.description'
                                        class='text-muted'
                                        style='font-size: 0.72rem;'
                                    >
                                        {{ node.description }}
                                    </div>
                                </div>
                            </div>
                        </template>
                    </HastyTeam>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { HastyTeam } from '@tak-ps/vue-hasty-team';
import { IconLifebuoy, IconShield, IconTag, IconUser, IconUsers, IconX } from '@tabler/icons-vue';
import { useIncident } from '../../composables/useIncident.ts';
import type { RescueGroupLabel } from '../../data/rescueManagementPositions.ts';
import type { RolePositionDef } from '../../data/rolePositionTypes.ts';
import { formatD4hSyncTime, filterAndSortPaletteMembers, loadD4hMeta, loadD4hRoster, sortMembersByNameAsc } from '../../lib/d4hRoster.ts';
import type { D4HMember, D4HRosterMeta } from '../../lib/d4hTypes.ts';
import {
    resourceAssignmentMatchesFilter,
    resourceAssignmentDescription,
    resourceTeamPaletteDrop,
    type ResourceAssignment,
} from '../../lib/resourceAssignments.ts';
import { useResourceAssignments } from '../../composables/useResourceAssignments.ts';
import {
    asSingleSlot,
    createEmptyIcsSlots,
    createEmptyRescueSlots,
    filterIcsPositions,
    filterRescueGroupLabels,
    filterRescuePositions,
    fixedRescueLabelDrop,
    rolePositionDropFromSlot,
    rolePositionPreview as buildRolePositionPreview,
    type RoleSlotConfig,
} from '../../lib/rolePositions.ts';
import {
    applyPaletteToRoot,
    appendPaletteDrop,
    deleteNodeFromTree,
    extractNodeById,
    treeHasContent,
    type HastyTreeNode,
    type PendingPaletteDrop,
} from '../../lib/hastyTeamTree.ts';
import { syncOrgChartToDataSync } from '../../lib/orgChartDataSync.ts';
import { loadOrgChartFromMission, saveOrgChartToMission } from '../../lib/orgChartPersistence.ts';
import { formatPersonNameFirstLast } from '../../lib/personName.ts';
import { listMissionCots, type MissionCotRef } from '../../lib/missionCots.ts';

const { activeMission } = useIncident();
const { assignments: resourceAssignments, loadForMission: loadResourceAssignments, updateAssignment: updateResourceAssignment } = useResourceAssignments();

const teamTree = ref<HastyTreeNode>({});
const pendingDrop = ref<PendingPaletteDrop | null>(null);
const loadingRoster = ref(false);
const loadingCots = ref(false);
const meta = ref<D4HRosterMeta | null>(null);
const members = ref<D4HMember[]>([]);
const missionCots = ref<MissionCotRef[]>([]);
const paletteSearch = ref('');
const icsSlots = ref<Record<string, RoleSlotConfig>>(createEmptyIcsSlots());
const rescueSlots = ref<Record<string, RoleSlotConfig>>(createEmptyRescueSlots());
const syncingOrgChart = ref(false);
const syncStatus = ref('');
const syncStatusError = ref(false);
const orgChartSchemaHash = ref<string | undefined>();
const loadingOrgChart = ref(false);
const savingOrgChart = ref(false);
const persistStatus = ref('');

let saveOrgChartTimer: ReturnType<typeof setTimeout> | null = null;
let saveOrgChartGeneration = 0;

const hasCanvas = computed(() => treeHasContent(teamTree.value));

const filteredMembers = computed(() =>
    filterAndSortPaletteMembers(members.value, paletteSearch.value),
);

const configurationMembers = computed(() => sortMembersByNameAsc(members.value));

const filteredResourceAssignments = computed(() =>
    resourceAssignments.value.filter((a) => resourceAssignmentMatchesFilter(a, paletteSearch.value)),
);

const filteredMissionCots = computed(() => {
    const q = paletteSearch.value.trim().toLowerCase();
    if (!q) return missionCots.value;
    return missionCots.value.filter((c) => c.callsign.toLowerCase().includes(q));
});

const filteredIcsPositions = computed(() =>
    filterIcsPositions(paletteSearch.value, icsSlots.value, members.value),
);

const filteredRescuePositions = computed(() =>
    filterRescuePositions(paletteSearch.value, rescueSlots.value, members.value),
);

const filteredRescueGroupLabels = computed(() =>
    filterRescueGroupLabels(paletteSearch.value),
);

const assignmentSelectLabel = computed(() => {
    if (!activeMission.value) return 'Select a mission in Create | Open';
    if (loadingCots.value) return 'Loading CoTs…';
    if (!missionCots.value.length) return 'No CoTs on this DataSync';
    return '— CoT assignment —';
});

function memberSubtitle(m: D4HMember): string {
    return [m.ref, m.position].filter(Boolean).join(' · ') || 'D4H member';
}

function rolePositionPreview(
    pos: RolePositionDef,
    slot: RoleSlotConfig,
): { title: string; description: string } {
    return buildRolePositionPreview(pos, slot, members.value);
}

function onRolePositionDragStart(
    event: DragEvent,
    pos: RolePositionDef,
    slot: RoleSlotConfig,
): void {
    const drop = rolePositionDropFromSlot(pos, slot, members.value);
    pendingDrop.value = drop;
    event.dataTransfer?.setData('text/plain', `role-position:${pos.category}:${pos.key}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onRescueGroupLabelDragStart(event: DragEvent, label: RescueGroupLabel): void {
    pendingDrop.value = fixedRescueLabelDrop(label);
    event.dataTransfer?.setData('text/plain', `rescue-label:${label.key}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onResourceTeamDragStart(event: DragEvent, assignment: ResourceAssignment): void {
    const drop = resourceTeamPaletteDrop(assignment);
    pendingDrop.value = drop;
    event.dataTransfer?.setData('text/plain', `resource-team:${assignment.id}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

async function onResourceTeamAssignmentChange(id: string, uid: string): Promise<void> {
    if (!activeMission.value) return;
    const cot = missionCots.value.find((c) => c.uid === uid);
    await updateResourceAssignment(activeMission.value, id, {
        assignmentUid: uid || undefined,
        assignmentCallsign: cot?.callsign || undefined,
    });
}

function onMemberDragStart(event: DragEvent, m: D4HMember): void {
    const displayName = formatPersonNameFirstLast(m.name);
    pendingDrop.value = {
        kind: 'member',
        d4hMemberId: m.id,
        title: displayName,
        description: memberSubtitle(m),
    };
    event.dataTransfer?.setData('text/plain', `member:${m.id}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onNodeDragStart(event: DragEvent, nodeId: string): void {
    pendingDrop.value = null;
    event.dataTransfer?.setData('text/plain', nodeId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onPaletteDragEnd(): void {
    pendingDrop.value = null;
}

function onDropRoot(root: HastyTreeNode): void {
    applyPaletteToRoot(root, pendingDrop.value);
    pendingDrop.value = null;
}

function onDropNode(payload: { node: HastyTreeNode; draggedId: string | null }): void {
    const { node, draggedId } = payload;
    if (draggedId) {
        const subtree = extractNodeById(teamTree.value, draggedId);
        if (subtree) {
            if (!node.children) node.children = [];
            node.children.push(subtree);
        }
        pendingDrop.value = null;
        return;
    }
    appendPaletteDrop(node, pendingDrop.value);
    pendingDrop.value = null;
}

function removeNode(nodeId: string): void {
    const result = deleteNodeFromTree(teamTree.value, nodeId);
    if (result === 'root') {
        teamTree.value = {};
    }
}

function clearCanvas(): void {
    if (!hasCanvas.value) return;
    if (!window.confirm('Clear the entire assignment chart? This cannot be undone.')) return;
    teamTree.value = {};
}

function scheduleOrgChartSave(): void {
    if (loadingOrgChart.value || !activeMission.value) return;
    if (saveOrgChartTimer) clearTimeout(saveOrgChartTimer);
    saveOrgChartTimer = setTimeout(() => {
        saveOrgChartTimer = null;
        void persistOrgChart();
    }, 800);
}

async function loadPersistedOrgChart(): Promise<void> {
    if (!activeMission.value) {
        teamTree.value = {};
        orgChartSchemaHash.value = undefined;
        persistStatus.value = '';
        return;
    }

    loadingOrgChart.value = true;
    persistStatus.value = 'Loading chart…';
    try {
        const loaded = await loadOrgChartFromMission(activeMission.value);
        teamTree.value = loaded.tree;
        orgChartSchemaHash.value = loaded.contentHash;
        persistStatus.value = loaded.migratedFromLog
            ? 'Chart moved into mission_schema.json'
            : (loaded.contentHash || treeHasContent(loaded.tree))
                ? 'Chart loaded from mission_schema.json'
                : '';
    } catch (err) {
        persistStatus.value = '';
        syncStatusError.value = true;
        syncStatus.value = `Could not load saved org chart: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingOrgChart.value = false;
    }
}

async function persistOrgChart(): Promise<void> {
    if (!activeMission.value || loadingOrgChart.value) return;

    const generation = ++saveOrgChartGeneration;
    savingOrgChart.value = true;
    persistStatus.value = 'Saving chart…';

    try {
        const contentHash = await saveOrgChartToMission(
            activeMission.value,
            teamTree.value,
            orgChartSchemaHash.value,
        );
        if (generation !== saveOrgChartGeneration) return;
        orgChartSchemaHash.value = contentHash;
        persistStatus.value = treeHasContent(teamTree.value)
            ? 'Chart saved to mission_schema.json'
            : '';
    } catch (err) {
        if (generation !== saveOrgChartGeneration) return;
        persistStatus.value = 'Save failed';
        syncStatusError.value = true;
        syncStatus.value = `Could not save org chart: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        if (generation === saveOrgChartGeneration) {
            savingOrgChart.value = false;
        }
    }
}

async function syncOrgChart(): Promise<void> {
    if (!activeMission.value || !hasCanvas.value) return;
    syncingOrgChart.value = true;
    syncStatus.value = '';
    syncStatusError.value = false;
    try {
        const result = await syncOrgChartToDataSync(activeMission.value, teamTree.value);
        const parts: string[] = [];
        if (result.created) parts.push(`${result.created} new`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.removed) parts.push(`${result.removed} removed`);
        if (result.assignmentRemarksUpdated) {
            parts.push(`${result.assignmentRemarksUpdated} assignment CoT remark${result.assignmentRemarksUpdated === 1 ? '' : 's'} updated`);
        }
        if (result.assignmentRemarksMissing) {
            parts.push(`${result.assignmentRemarksMissing} assignment CoT${result.assignmentRemarksMissing === 1 ? '' : 's'} not found`);
        }
        syncStatus.value = `Synced ${result.lines} org position${result.lines === 1 ? '' : 's'} to ${activeMission.value.name}`
            + (parts.length ? ` (${parts.join(', ')})` : '')
            + '. ICS 201 will pick these up on refresh.';
    } catch (err) {
        syncStatusError.value = true;
        syncStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        syncingOrgChart.value = false;
    }
}

async function refreshRoster(): Promise<void> {
    loadingRoster.value = true;
    try {
        const roster = await loadD4hRoster();
        meta.value = await loadD4hMeta();
        members.value = roster?.members ?? [];
    } finally {
        loadingRoster.value = false;
    }
}

async function refreshMissionCots(): Promise<void> {
    missionCots.value = [];
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

onMounted(() => {
    void refreshRoster();
    void refreshMissionCots();
    void loadPersistedOrgChart();
    void loadResourceAssignments(activeMission.value);
});

onUnmounted(() => {
    if (saveOrgChartTimer) clearTimeout(saveOrgChartTimer);
});

watch(() => activeMission.value?.guid, () => {
    void refreshMissionCots();
    void loadPersistedOrgChart();
    void loadResourceAssignments(activeMission.value);
});

watch(teamTree, () => {
    scheduleOrgChartSave();
}, { deep: true });
</script>

<style scoped>
.assignments-workspace {
    min-width: 0;
}

.assignments-palette,
.assignments-canvas {
    height: 100%;
}

.assignments-chart {
    height: 100%;
}

.assignments-chart :deep(.h-100.w-100.position-relative.d-flex) {
    align-items: flex-start;
    justify-content: flex-start;
}

.assignments-chart :deep(.px-4.py-4) {
    min-height: auto;
    height: auto;
}

.palette-collapse__summary {
    cursor: pointer;
    list-style: none;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--bs-secondary);
    user-select: none;
}

.palette-collapse__summary::-webkit-details-marker {
    display: none;
}

.palette-collapse__summary::before {
    content: '▸ ';
}

.palette-collapse[open] > .palette-collapse__summary::before {
    content: '▾ ';
}

.palette-collapse__body {
    padding-top: 0.25rem;
}
</style>
