<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 py-1 border-top'>
            <button
                type='button'
                class='btn btn-link btn-sm p-0 text-start text-reset text-decoration-none fw-normal'
                :aria-expanded='open'
                @click='emit("toggle")'
            >
                <strong>#{{ work.assignmentNumber }} {{ work.assignmentCallsign || 'map object' }}</strong>
                <span
                    v-if='showTeam && work.teamLabel'
                    class='text-white-50'
                >{{ ` · was ${work.teamLabel}` }}</span>
                <span
                    v-if='work.instructions'
                    class='text-white-50'
                >{{ ` · ${work.instructions}` }}</span>
            </button>
            <span class='small ms-auto'>{{ times }}</span>
            <button
                type='button'
                class='btn btn-outline-green btn-sm py-0'
                title='Log the start to the FIELD DataSync'
                :disabled='busy'
                @click='emit("start")'
            >
                Start
            </button>
            <button
                type='button'
                class='btn btn-outline-blue btn-sm py-0'
                title='Log the completion to the FIELD DataSync'
                :disabled='busy'
                @click='emit("complete")'
            >
                Complete
            </button>
        </div>
        <slot v-if='open' />
    </div>
</template>

<script setup lang='ts'>
/** One Initial Response work assignment on the board: tap to edit (slot), Start / Complete. */
import { computed } from 'vue';
import { shortLocalTime } from '../../lib/resourceBoard.ts';
import type { WorkAssignment } from '../../lib/workAssignments.ts';

const props = defineProps<{
    work: WorkAssignment;
    open: boolean;
    busy: boolean;
    showTeam?: boolean;
}>();

const emit = defineEmits<{
    (e: 'toggle'): void;
    (e: 'start'): void;
    (e: 'complete'): void;
}>();

const times = computed(() => [
    props.work.started ? `Started ${shortLocalTime(props.work.started)}` : 'Not started',
    props.work.completed ? `Completed ${shortLocalTime(props.work.completed)}` : '',
].filter(Boolean).join(' · '));
</script>
