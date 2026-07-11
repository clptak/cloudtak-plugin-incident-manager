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
        <button
            v-if='helpKey'
            type='button'
            class='incident-nav-section-help'
            :aria-label='helpContent?.ariaLabel'
            @click.stop='helpOpen = true'
        >
            <IconInfoCircle
                :size='16'
                stroke='1.5'
            />
        </button>
    </div>

    <div
        v-if='helpOpen && helpContent'
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
                        {{ helpContent.title }}
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='closeHelp'
                    />
                </div>
                <div class='modal-body'>
                    <p class='mb-3'>
                        {{ helpContent.intro }}
                    </p>
                    <p class='mb-2 fw-semibold'>
                        {{ helpContent.characteristicsHeading }}
                    </p>
                    <ul class='mb-3'>
                        <li
                            v-for='item in helpContent.characteristics'
                            :key='item'
                        >
                            {{ item }}
                        </li>
                    </ul>
                    <p class='mb-3'>
                        {{ helpContent.closing }}
                    </p>
                    <p
                        v-if='helpContent.emphasis'
                        class='mb-3 fw-semibold'
                    >
                        {{ helpContent.emphasis }}
                    </p>
                    <div class='text-muted fst-italic'>
                        {{ helpContent.attribution }}
                    </div>
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
        v-if='helpOpen && helpContent'
        class='modal-backdrop fade show'
    />
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { IconChevronDown, IconChevronRight, IconInfoCircle } from '@tabler/icons-vue';
import { NAV_SECTION_HELP, type NavSectionHelpKey } from '../lib/navSectionHelp.ts';

const props = defineProps<{
    label: string;
    expanded: boolean;
    helpKey?: NavSectionHelpKey;
}>();

const emit = defineEmits<{
    toggle: [];
}>();

const helpOpen = ref(false);

const helpContent = computed(() => (
    props.helpKey ? NAV_SECTION_HELP[props.helpKey] : null
));

function closeHelp(): void {
    helpOpen.value = false;
}
</script>
