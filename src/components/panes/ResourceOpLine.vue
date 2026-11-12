<template>
    <div class='d-flex flex-wrap align-items-center gap-2 py-1 border-top'>
        <strong>Seg {{ item.assignment.label }}</strong>
        <span
            v-if='showTeam'
            class='text-white-50'
        >· {{ item.assignment.team?.trim() || 'Unassigned' }}</span>
        <span
            v-if='item.assignment.notes'
            class='text-white-50 small'
        >· {{ item.assignment.notes }}</span>
        <span
            v-if='last'
            class='badge bg-green-lt ms-auto'
        >
            Debriefed{{ last.pod !== undefined ? ` · POD ${last.pod}%` : '' }}{{ item.debriefs.length > 1 ? ` · ${item.debriefs.length} sorties` : '' }}
        </span>
        <span
            v-else
            class='badge bg-yellow-lt ms-auto'
        >Not debriefed</span>
    </div>
</template>

<script setup lang='ts'>
/** One OP segment assignment with its debrief status (edited in Operational Periods). */
import { computed } from 'vue';
import type { OpWork } from '../../lib/resourceBoard.ts';

const props = defineProps<{
    item: OpWork;
    showTeam?: boolean;
}>();

const last = computed(() => props.item.debriefs[props.item.debriefs.length - 1]);
</script>
