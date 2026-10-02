<template>
    <span class='wisar-content-link'>
        <a
            href='#'
            class='text-decoration-underline'
            @click.prevent='open = id'
        >{{ label }}</a>
        <WisarContentModal
            :id='open'
            @close='open = null'
        />
    </span>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import type { ContentId } from '../../lib/wisar.ts';
import WisarContentModal from './WisarContentModal.vue';

defineProps<{
    id: ContentId;
    label: string;
}>();

const open = ref<ContentId | null>(null);
</script>
