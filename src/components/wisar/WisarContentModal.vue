<template>
    <!-- eslint-disable vue/no-v-html -- WiSAR content, sanitized by sanitizeWisarHtml -->
    <div
        v-if='id'
        class='modal modal-blur incident-modal show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='emit("close")'
    >
        <div
            class='modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title'>
                        {{ content?.title || 'WiSAR' }}
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='emit("close")'
                    />
                </div>
                <div class='modal-body'>
                    <p
                        v-if='loading'
                        class='text-muted mb-0'
                    >
                        Loading from WiSAR…
                    </p>
                    <p
                        v-else-if='error'
                        class='text-danger mb-0'
                    >
                        {{ error }}
                    </p>
                    <div
                        v-else-if='content'
                        class='wisar-content'
                        :style='content.style'
                        v-html='content.html'
                    />
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn btn-secondary'
                        @click='emit("close")'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div
        v-if='id'
        class='modal-backdrop fade show'
    />
</template>

<script setup lang='ts'>
import { toRef } from 'vue';
import { useWisarContent } from '../../composables/useWisarContent.ts';
import type { ContentId } from '../../lib/wisar.ts';
import '../incidentModal.css';

const props = defineProps<{
    id: ContentId | null;
}>();

const emit = defineEmits<{
    close: [];
}>();

const { content, loading, error } = useWisarContent(toRef(props, 'id'));
</script>

<style scoped>
/* Jamie's fragments start with the title as a heading; the modal header already shows it. */
.wisar-content :deep(> h2:first-child) {
    display: none;
}
.wisar-content :deep(svg) {
    max-width: 100%;
    height: auto;
}
</style>
