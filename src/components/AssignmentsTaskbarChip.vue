<template>
    <TaskbarChipButton
        :icon='IconClipboardList'
        label='Assignments'
        title='Open Assignments'
        @click='openAssignments'
    />
</template>

<script setup lang='ts'>
import { IconClipboardList } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

function openAssignments(): void {
    openDesktopPane();
    selectKeyGuarded('work-assignments');
}
</script>
