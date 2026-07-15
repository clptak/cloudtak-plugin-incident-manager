<template>
    <button
        type='button'
        class='btn btn-sm btn-outline-light d-flex align-items-center gap-2 text-nowrap'
        title='Open Incident Manager'
        @click='openDesktopPane'
    >
        <IconTarget
            :size='16'
            stroke='1.5'
        />
        <span>Incident Manager</span>
    </button>
</template>

<script setup lang='ts'>
import { IconTarget } from '@tabler/icons-vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
</script>
