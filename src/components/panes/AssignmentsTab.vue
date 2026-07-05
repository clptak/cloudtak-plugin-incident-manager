<template>
    <div class='d-flex flex-column h-100'>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2 flex-shrink-0'>
            <h3 class='mb-0'>
                Assignments
            </h3>
            <span
                v-if='meta?.fetchedAt'
                class='text-muted small'
            >
                D4H sync {{ formatD4hSyncTime(meta.fetchedAt) }}
            </span>
            <div class='ms-auto d-flex flex-wrap gap-2'>
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
            Configure teams and incident command positions, drag them onto the chart, then add
            D4H personnel. Use <strong>×</strong> to remove a node, or
            <strong>Clear canvas</strong> to start over.
        </p>

        <div
            v-if='!loadingRoster && !members.length'
            class='alert alert-info small mb-2 flex-shrink-0'
        >
            No D4H roster in this browser. Open the <strong>D4H</strong> plugin, configure
            Team Manager, and run <strong>Sync now</strong>, then click <strong>Refresh D4H</strong>.
        </div>

        <div
            class='d-flex gap-2 flex-grow-1'
            style='min-height: 420px; min-width: 0;'
        >
            <!-- Palette -->
            <div
                class='card flex-shrink-0'
                style='width: 300px;'
            >
                <div class='card-header py-2 small fw-semibold'>
                    Palette
                </div>
                <div class='card-body p-2 overflow-auto'>
                    <input
                        v-model='paletteSearch'
                        type='search'
                        class='form-control form-control-sm mb-2'
                        placeholder='Search palette…'
                        autocomplete='off'
                    >

                    <div class='text-muted text-uppercase small mb-1 mt-1'>
                        Teams
                    </div>

                    <div class='card card-sm mb-2'>
                        <div class='card-body p-2'>
                            <div class='mb-2'>
                                <label class='form-label small mb-1'>Team number</label>
                                <input
                                    v-model.number='teamNumber'
                                    type='number'
                                    min='1'
                                    class='form-control form-control-sm'
                                >
                            </div>
                            <div class='mb-2'>
                                <label class='form-label small mb-1'>Resource</label>
                                <select
                                    v-model='teamResourceName'
                                    class='form-select form-select-sm'
                                >
                                    <option value=''>
                                        — Resource —
                                    </option>
                                    <option
                                        v-for='resource in filteredTeamResources'
                                        :key='resource'
                                        :value='resource'
                                    >
                                        {{ resource }}
                                    </option>
                                </select>
                            </div>
                            <div class='mb-2'>
                                <label class='form-label small mb-1'>Assignment</label>
                                <select
                                    v-model='teamAssignmentUid'
                                    class='form-select form-select-sm'
                                    :disabled='!activeMission || loadingCots'
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
                                @dragstart='onConfiguredTeamDragStart'
                                @dragend='onPaletteDragEnd'
                            >
                                <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                                    <IconUsers
                                        :size='18'
                                        stroke='1.5'
                                    />
                                    <div class='small'>
                                        <div class='fw-semibold'>
                                            {{ configuredTeamPreview.title }}
                                        </div>
                                        <div
                                            class='text-muted'
                                            style='font-size: 0.72rem;'
                                        >
                                            {{ configuredTeamPreview.description }}
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

                    <div class='text-muted text-uppercase small mb-1 mt-2'>
                        Incident Command
                    </div>

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
                                v-model='icsSlots[pos.key].d4hMemberId'
                                class='form-select form-select-sm mb-1'
                            >
                                <option value=''>
                                    — D4H —
                                </option>
                                <option
                                    v-for='m in members'
                                    :key='m.id'
                                    :value='m.id'
                                >
                                    {{ m.name }}
                                </option>
                            </select>
                            <input
                                v-model='icsSlots[pos.key].customName'
                                type='text'
                                class='form-control form-control-sm mb-1'
                                placeholder='Or type name'
                                autocomplete='off'
                            >
                            <div
                                class='card card-sm border-secondary-subtle bg-light'
                                draggable='true'
                                style='cursor: grab;'
                                @dragstart='onIcsCommandDragStart($event, pos)'
                                @dragend='onPaletteDragEnd'
                            >
                                <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                                    <IconShield
                                        :size='16'
                                        stroke='1.5'
                                    />
                                    <div class='small'>
                                        <div class='fw-semibold'>
                                            {{ icsCommandPreview(pos).title }}
                                        </div>
                                        <div
                                            v-if='icsCommandPreview(pos).description'
                                            class='text-muted'
                                            style='font-size: 0.72rem;'
                                        >
                                            {{ icsCommandPreview(pos).description }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class='text-muted text-uppercase small mb-1 mt-2'>
                        Personnel
                    </div>

                    <div
                        v-if='members.length && !filteredMembers.length'
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
            </div>

            <!-- HastyTeam canvas -->
            <div
                class='card flex-grow-1 overflow-auto'
                style='min-width: 0;'
            >
                <div
                    class='card-body p-0 h-100 assignments-chart'
                    style='min-height: 400px;'
                >
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
                                            v-else-if='node.type === "command"'
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
import { computed, onMounted, ref, watch } from 'vue';
import { HastyTeam } from '@tak-ps/vue-hasty-team';
import { IconShield, IconTag, IconUser, IconUsers, IconX } from '@tabler/icons-vue';
import { useIncident } from '../../composables/useIncident.ts';
import { ASSIGNMENT_RESOURCES } from '../../data/assignmentResources.ts';
import type { IncidentCommandPositionDef } from '../../data/incidentCommandPositions.ts';
import { formatD4hSyncTime, filterAndSortPaletteMembers, loadD4hMeta, loadD4hRoster } from '../../lib/d4hRoster.ts';
import type { D4HMember, D4HRosterMeta } from '../../lib/d4hTypes.ts';
import {
    createEmptyIcsSlots,
    filterIcsPositions,
    icsCommandDropFromSlot,
    icsCommandPreview as buildIcsCommandPreview,
    type IcsSlotConfig,
} from '../../lib/incidentCommandPositions.ts';
import {
    applyPaletteToRoot,
    appendPaletteDrop,
    configuredTeamDescription,
    configuredTeamTitle,
    deleteNodeFromTree,
    extractNodeById,
    treeHasContent,
    type HastyTreeNode,
    type PendingPaletteDrop,
} from '../../lib/hastyTeamTree.ts';
import { listMissionCots, type MissionCotRef } from '../../lib/missionCots.ts';

const { activeMission } = useIncident();

const teamTree = ref<HastyTreeNode>({});
const pendingDrop = ref<PendingPaletteDrop | null>(null);
const loadingRoster = ref(false);
const loadingCots = ref(false);
const meta = ref<D4HRosterMeta | null>(null);
const members = ref<D4HMember[]>([]);
const missionCots = ref<MissionCotRef[]>([]);
const paletteSearch = ref('');
const teamNumber = ref(1);
const teamResourceName = ref('');
const teamAssignmentUid = ref('');
const icsSlots = ref<Record<string, IcsSlotConfig>>(createEmptyIcsSlots());

const hasCanvas = computed(() => treeHasContent(teamTree.value));

const filteredMembers = computed(() =>
    filterAndSortPaletteMembers(members.value, paletteSearch.value),
);

const filteredTeamResources = computed(() => {
    const q = paletteSearch.value.trim().toLowerCase();
    if (!q) return [...ASSIGNMENT_RESOURCES];
    return ASSIGNMENT_RESOURCES.filter((r) => r.toLowerCase().includes(q));
});

const filteredMissionCots = computed(() => {
    const q = paletteSearch.value.trim().toLowerCase();
    if (!q) return missionCots.value;
    return missionCots.value.filter((c) => c.callsign.toLowerCase().includes(q));
});

const filteredIcsPositions = computed(() =>
    filterIcsPositions(paletteSearch.value, icsSlots.value, members.value),
);

const configuredTeamPreview = computed(() => {
    const n = Math.max(1, Math.floor(teamNumber.value) || 1);
    const resource = teamResourceName.value.trim();
    const cot = missionCots.value.find((c) => c.uid === teamAssignmentUid.value);
    return {
        title: configuredTeamTitle(n),
        description: configuredTeamDescription({
            resourceName: resource || undefined,
            assignmentCallsign: cot?.callsign,
        }),
    };
});

const assignmentSelectLabel = computed(() => {
    if (!activeMission.value) return 'Select a mission in Create | Open';
    if (loadingCots.value) return 'Loading CoTs…';
    if (!missionCots.value.length) return 'No CoTs on this DataSync';
    return '— CoT assignment —';
});

function memberSubtitle(m: D4HMember): string {
    return [m.ref, m.position].filter(Boolean).join(' · ') || 'D4H member';
}

function icsCommandPreview(pos: IncidentCommandPositionDef): { title: string; description: string } {
    return buildIcsCommandPreview(pos, icsSlots.value[pos.key], members.value);
}

function onIcsCommandDragStart(event: DragEvent, pos: IncidentCommandPositionDef): void {
    const drop = icsCommandDropFromSlot(pos, icsSlots.value[pos.key], members.value);
    pendingDrop.value = drop;
    event.dataTransfer?.setData('text/plain', `ics-command:${pos.key}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onConfiguredTeamDragStart(event: DragEvent): void {
    const n = Math.max(1, Math.floor(teamNumber.value) || 1);
    const resource = teamResourceName.value.trim();
    const cot = missionCots.value.find((c) => c.uid === teamAssignmentUid.value);
    const drop: PendingPaletteDrop = {
        kind: 'configured-team',
        teamNumber: n,
        resourceName: resource || undefined,
        assignmentUid: cot?.uid,
        assignmentCallsign: cot?.callsign,
        title: configuredTeamTitle(n),
        description: configuredTeamDescription({
            resourceName: resource || undefined,
            assignmentCallsign: cot?.callsign,
        }),
    };
    pendingDrop.value = drop;
    event.dataTransfer?.setData('text/plain', `configured-team:${n}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onMemberDragStart(event: DragEvent, m: D4HMember): void {
    pendingDrop.value = {
        kind: 'member',
        d4hMemberId: m.id,
        title: m.name,
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
    teamAssignmentUid.value = '';
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
});

watch(() => activeMission.value?.guid, () => {
    void refreshMissionCots();
});
</script>

<style scoped>
.assignments-chart :deep(.h-100.w-100.position-relative.d-flex) {
    align-items: flex-start;
    justify-content: flex-start;
}

.assignments-chart :deep(.px-4.py-4) {
    min-height: auto;
    height: auto;
}
</style>
