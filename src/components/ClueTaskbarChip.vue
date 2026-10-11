<template>
    <TaskbarChipButton
        v-if='isSearchIncident'
        :icon='IconSearch'
        label='Clues'
        title='Open Clue Log'
        @click='openClueLog'
    />
</template>

<script setup lang='ts'>
import { IconSearch } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectHTabGuarded, isSearchIncident } = useIncident();

function openClueLog(): void {
    openDesktopPane();
    selectHTabGuarded('clues');
}
</script>
