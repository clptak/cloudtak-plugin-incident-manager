<template>
    <!-- eslint-disable vue/no-v-html -- WiSAR content, sanitized by sanitizeWisarHtml -->
    <div
        v-if='content'
        class='wisar-scope-note'
        :style='content.style'
        v-html='content.html'
    />
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useWisarContent } from '../../composables/useWisarContent.ts';
import type { ContentId } from '../../lib/wisar.ts';

// The web tool's start-screen note; shown only when WiSAR answers.
const { content } = useWisarContent(ref<ContentId | null>('scope-note'));
</script>

<style scoped>
.wisar-scope-note :deep(p) {
    font-size: 0.85rem !important;
    margin-top: 0.75rem !important;
}
</style>
