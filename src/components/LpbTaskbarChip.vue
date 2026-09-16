<template>
    <TaskbarChipButton
        v-if='isSearchMission'
        :icon='IconRuler2'
        label='LPB'
        title='Open LPB distance table'
        @click='openLpb'
    />
</template>

<script setup lang='ts'>
import { IconRuler2 } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectHTabGuarded, isSearchMission } = useIncident();

function openLpb(): void {
    openDesktopPane();
    selectHTabGuarded('lpb');
}
</script>
