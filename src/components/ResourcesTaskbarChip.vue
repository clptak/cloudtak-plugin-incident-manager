<template>
    <button
        type='button'
        class='btn btn-sm btn-outline-light d-flex align-items-center gap-2 text-nowrap'
        title='Open Resources'
        @click='openResources'
    >
        <IconUsersGroup
            :size='16'
            stroke='1.5'
        />
        <span>Resources</span>
    </button>
</template>

<script setup lang='ts'>
import { IconUsersGroup } from '@tabler/icons-vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

function openResources(): void {
    openDesktopPane();
    selectKeyGuarded('resources');
}
</script>
