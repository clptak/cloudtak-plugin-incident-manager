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
            Drag <strong>Team</strong> or D4H personnel onto the chart. Use
            <strong>×</strong> on a node to remove it, or <strong>Clear canvas</strong> to start over.
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
                style='width: 220px;'
            >
                <div class='card-header py-2 small fw-semibold'>
                    Palette
                </div>
                <div class='card-body p-2 overflow-auto'>
                    <div
                        class='card card-sm mb-2'
                        draggable='true'
                        style='cursor: grab;'
                        @dragstart='onPaletteDragStart($event, { kind: "team" })'
                        @dragend='onPaletteDragEnd'
                    >
                        <div class='card-body py-2 px-2 d-flex align-items-center gap-2'>
                            <IconUsers
                                :size='18'
                                stroke='1.5'
                            />
                            <div>
                                <div class='fw-semibold small'>
                                    Team
                                </div>
                                <div
                                    class='text-muted'
                                    style='font-size: 0.72rem;'
                                >
                                    Group or ICS position
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        v-for='m in members'
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
                class='card flex-grow-1 overflow-hidden'
                style='min-width: 0;'
            >
                <div
                    class='card-body p-0 h-100'
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
                                        <IconUser
                                            v-else
                                            :size='16'
                                            stroke='1.5'
                                            class='flex-shrink-0 mt-1'
                                        />
                                        <span class='fw-semibold small flex-grow-1'>
                                            {{ node.title || (node.type === "team" ? "Team" : "Member") }}
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
import { computed, onMounted, ref } from 'vue';
import { HastyTeam } from '@tak-ps/vue-hasty-team';
import { IconUser, IconUsers, IconX } from '@tabler/icons-vue';
import { formatD4hSyncTime, loadD4hMeta, loadD4hRoster } from '../../lib/d4hRoster.ts';
import type { D4HMember, D4HRosterMeta } from '../../lib/d4hTypes.ts';
import {
    applyPaletteToRoot,
    appendPaletteDrop,
    deleteNodeFromTree,
    extractNodeById,
    treeHasContent,
    type HastyTreeNode,
    type PendingPaletteDrop,
} from '../../lib/hastyTeamTree.ts';

const teamTree = ref<HastyTreeNode>({});
const pendingDrop = ref<PendingPaletteDrop | null>(null);
const loadingRoster = ref(false);
const meta = ref<D4HRosterMeta | null>(null);
const members = ref<D4HMember[]>([]);

const hasCanvas = computed(() => treeHasContent(teamTree.value));

function memberSubtitle(m: D4HMember): string {
    return [m.ref, m.position].filter(Boolean).join(' · ') || 'D4H member';
}

function onPaletteDragStart(event: DragEvent, drop: PendingPaletteDrop): void {
    pendingDrop.value = drop;
    event.dataTransfer?.setData('text/plain', drop.kind);
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

onMounted(() => {
    void refreshRoster();
});
</script>
