<template>
    <div class='incident-nav-section-header'>
        <button
            type='button'
            class='incident-nav-section-toggle'
            :aria-expanded='expanded'
            :aria-label='`${expanded ? "Collapse" : "Expand"} ${label} section`'
            @click='emit("toggle")'
        >
            <IconChevronDown
                v-if='expanded'
                :size='14'
                stroke='1.5'
            />
            <IconChevronRight
                v-else
                :size='14'
                stroke='1.5'
            />
            <span>{{ label }}</span>
        </button>
        <NavHelpButton
            v-if='helpKey'
            :help-key='helpKey'
        />
    </div>
</template>

<script setup lang='ts'>
import { IconChevronDown, IconChevronRight } from '@tabler/icons-vue';
import NavHelpButton from './NavHelpButton.vue';
import type { NavSectionHelpKey } from '../lib/navSectionHelp.ts';

defineProps<{
    label: string;
    expanded: boolean;
    helpKey?: NavSectionHelpKey;
}>();

const emit = defineEmits<{
    toggle: [];
}>();
</script>
