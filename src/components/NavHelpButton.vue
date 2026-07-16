<template>
    <!-- eslint-disable vue/no-v-html -- trusted local help markdown only -->
    <button
        type='button'
        class='btn btn-link btn-sm p-0 text-muted lh-1 border-0 incident-nav-section-help'
        :aria-label='helpDoc.ariaLabel'
        @click.stop='helpOpen = true'
    >
        <IconInfoCircle
            :size='16'
            stroke='1.5'
        />
    </button>

    <div
        v-if='helpOpen'
        class='modal modal-blur show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='closeHelp'
    >
        <div
            class='modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title'>
                        {{ modalTitle }}
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='closeHelp'
                    />
                </div>
                <div class='modal-body'>
                    <div
                        class='help-markdown'
                        v-html='bodyHtml'
                    />
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn btn-secondary'
                        @click='closeHelp'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div
        v-if='helpOpen'
        class='modal-backdrop fade show'
    />
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import { NAV_SECTION_HELP, type NavSectionHelpKey } from '../lib/navSectionHelp.ts';
import { renderHelpMarkdown, splitHelpMarkdownTitle } from '../lib/renderHelpMarkdown.ts';

const props = defineProps<{
    helpKey: NavSectionHelpKey;
}>();

const helpOpen = ref(false);

const helpDoc = computed(() => NAV_SECTION_HELP[props.helpKey]);

const parsed = computed(() => splitHelpMarkdownTitle(helpDoc.value.markdown));

const modalTitle = computed(() => parsed.value.title ?? helpDoc.value.ariaLabel);

const bodyHtml = computed(() => renderHelpMarkdown(parsed.value.bodyMarkdown));

function closeHelp(): void {
    helpOpen.value = false;
}
</script>

<style scoped>
.help-markdown :deep(h2) {
    font-size: 1.15rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
}

.help-markdown :deep(h3) {
    font-size: 1.05rem;
    margin-top: 0.85rem;
    margin-bottom: 0.4rem;
}

.help-markdown :deep(p) {
    margin-bottom: 0.75rem;
}

.help-markdown :deep(ul),
.help-markdown :deep(ol) {
    margin-bottom: 0.75rem;
    padding-left: 1.25rem;
}

.help-markdown :deep(table) {
    margin-bottom: 0.75rem;
}

.help-markdown :deep(a) {
    word-break: break-word;
}
</style>
