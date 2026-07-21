<template>
    <button
        type='button'
        class='btn btn-sm btn-outline-light d-flex align-items-center gap-2 text-nowrap'
        title='Open Search Area'
        @click='openSegments'
    >
        <IconPolygon
            :size='16'
            stroke='1.5'
        />
        <span>Segments</span>
    </button>
</template>

<script setup lang='ts'>
import { IconPolygon } from '@tabler/icons-vue';
import { openDesktopPane } from '../lib/floatMinimize.ts';
import { useIncident } from '../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

function openSegments(): void {
    openDesktopPane();
    selectKeyGuarded('search-area');
}
</script>
