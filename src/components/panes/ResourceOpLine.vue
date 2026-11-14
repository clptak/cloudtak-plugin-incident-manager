<template>
    <div class='d-flex flex-wrap align-items-center gap-2 py-1 border-top'>
        <strong>{{ title }}</strong>
        <span
            v-if='showTeam'
            class='text-white-50'
        >· {{ item.assignment.team?.trim() || 'Unassigned' }}</span>
        <span
            v-if='item.assignment.notes'
            class='text-white-50 small'
        >· {{ item.assignment.notes }}</span>
        <span
            v-if='!debriefable'
            class='badge bg-secondary-lt ms-auto'
            title='No map object, so there is no completed-assignment form to fill in'
        >No map object</span>
        <span
            v-else-if='last'
            class='badge bg-green-lt ms-auto'
        >
            Debriefed{{ last.pod !== undefined ? ` · POD ${last.pod}%` : '' }}{{ item.debriefs.length > 1 ? ` · ${item.debriefs.length} sorties` : '' }}
        </span>
        <span
            v-else
            class='badge bg-yellow-lt ms-auto'
        >Not debriefed</span>
        <button
            v-if='debriefable && !last'
            type='button'
            class='btn btn-outline-blue btn-sm py-0'
            :title='`Fill in the completed-assignment form for ${title} in Operational Periods`'
            @click='emit("debrief")'
        >
            Complete / Debrief
        </button>
        <button
            v-else-if='debriefable'
            type='button'
            class='btn btn-link btn-sm p-0'
            :title='`Record another sortie on ${title} in Operational Periods`'
            @click='emit("debrief")'
        >
            Debrief again
        </button>
    </div>
</template>

<script setup lang='ts'>
/** One OP assignment with its debrief status (edited in Operational Periods). */
import { computed } from 'vue';
import { assignmentKind, assignmentKindLabel, isDebriefable } from '../../domain/assignmentKind.ts';
import type { OpWork } from '../../lib/resourceBoard.ts';

const props = defineProps<{
    item: OpWork;
    showTeam?: boolean;
}>();

const emit = defineEmits<{ (e: 'debrief'): void }>();

const last = computed(() => props.item.debriefs[props.item.debriefs.length - 1]);
const debriefable = computed(() => isDebriefable(props.item.assignment));

/** "Seg 3" for search work; the type and label for the rest (#35). */
const title = computed(() => {
    const a = props.item.assignment;
    const kind = assignmentKind(a);
    if (kind === 'search') return `Seg ${a.label}`;
    return kind === 'other' ? a.label : `${assignmentKindLabel(kind)}: ${a.label}`;
});
</script>
