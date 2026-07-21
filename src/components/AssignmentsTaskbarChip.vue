<template>
    <button
        type='button'
        class='btn btn-sm btn-outline-light d-flex align-items-center gap-2 text-nowrap'
        title='Open Assignments'
        @click='openAssignments'
    >
        <IconClipboardList
            :size='16'
            stroke='1.5'
        />
        <span>Assignments</span>
    </button>
</template>

<script setup lang='ts'>
import { IconClipboardList } from '@tabler/icons-vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

function openAssignments(): void {
    openDesktopPane();
    selectKeyGuarded('work-assignments');
}
</script>
