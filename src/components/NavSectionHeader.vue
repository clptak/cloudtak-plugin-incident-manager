<template>
    <div
        class='d-flex align-items-center gap-1 px-2 mt-3 mb-1 text-muted text-uppercase fw-bold'
        style='font-size: 0.72rem; letter-spacing: 0.04em;'
    >
        <span>{{ label }}</span>
        <div
            v-if='helpKey'
            class='d-inline-flex'
            style='text-transform: none;'
        >
            <button
                type='button'
                class='btn btn-link btn-sm p-0 text-muted lh-1 border-0'
                :aria-label='helpContent?.ariaLabel'
                @click.stop='helpOpen = true'
            >
                <IconInfoCircle
                    :size='16'
                    stroke='1.5'
                />
            </button>
        </div>
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
import { IconInfoCircle } from '@tabler/icons-vue';
import { NAV_SECTION_HELP, type NavSectionHelpKey } from '../lib/navSectionHelp.ts';

const props = defineProps<{
    label: string;
    helpKey?: NavSectionHelpKey;
}>();

const helpOpen = ref(false);

const helpContent = computed(() => (
    props.helpKey ? NAV_SECTION_HELP[props.helpKey] : null
));

function closeHelp(): void {
    helpOpen.value = false;
}
</script>
