<template>
    <TaskbarChipButton
        v-if='isSearchMission'
        :icon='IconMan'
        label='LPB'
        title='Open Lost Person Behavior'
        @click='openLpb'
    />
</template>

<script setup lang='ts'>
import { IconMan } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded, isSearchMission } = useIncident();

function openLpb(): void {
    openDesktopPane();
    selectKeyGuarded('lpb-distances');
}
</script>
