<template>
    <TaskbarChipButton
        :icon='IconUsersGroup'
        label='Resources'
        title='Open Resources'
        @click='openResources'
    />
</template>

<script setup lang='ts'>
import { IconUsersGroup } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

function openResources(): void {
    openDesktopPane();
    selectKeyGuarded('resources');
}
</script>
