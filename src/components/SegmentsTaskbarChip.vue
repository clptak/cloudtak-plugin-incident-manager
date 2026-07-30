<template>
    <TaskbarChipButton
        :icon='IconPolygon'
        label='Segments'
        title='Open Segmentation'
        @click='openSegments'
    />
</template>

<script setup lang='ts'>
import { IconPolygon } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

function openSegments(): void {
    openDesktopPane();
    selectKeyGuarded('segmentation');
}
</script>
