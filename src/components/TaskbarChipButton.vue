<template>
    <button
        type='button'
        class='btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 text-nowrap'
        :title='title'
        @click='emit("click")'
    >
        <component
            :is='icon'
            :size='16'
            stroke='1.5'
        />
        <span>{{ label }}</span>
    </button>
</template>

<script setup lang='ts'>
import type { Component } from 'vue';

defineProps<{
    icon: Component;
    label: string;
    title: string;
}>();

const emit = defineEmits(['click']);
</script>
