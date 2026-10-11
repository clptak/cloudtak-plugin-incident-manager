<template>
    <TaskbarChipButton
        :icon='IconTarget'
        label='Incident Manager'
        title='Open Incident Manager'
        @click='openDesktopPane'
    />
</template>

<script setup lang='ts'>
import { IconTarget } from '@tabler/icons-vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
</script>
