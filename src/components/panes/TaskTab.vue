<template>
    <div>
        <h3 class='mb-3'>
            Tasks
        </h3>

        <!-- Initial Actions -->
        <div class='card mb-3'>
            <div
                class='card-header d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='expandedSections.initial'
                @click='toggleSection("initial")'
                @keydown.enter.prevent='toggleSection("initial")'
                @keydown.space.prevent='toggleSection("initial")'
            >
                <h4 class='card-title mb-0'>
                    Initial Actions
                </h4>
                <IconChevronDown
                    class='ms-auto transition-transform'
                    :class='{ "rotate-180": !expandedSections.initial }'
                    :size='20'
                    stroke='1.5'
                />
            </div>
            <div
                v-show='expandedSections.initial'
                class='card-body'
            >
                <div class='row g-3'>
                    <div
                        v-for='card in taskCards'
                        :key='card.key'
                        class='col-md-4'
                    >
                        <div class='card h-100'>
                            <div class='card-body d-flex flex-column'>
                                <h4 class='card-title'>
                                    {{ card.label }}
                                </h4>
                                <p class='text-muted small mb-3'>
                                    {{ card.description }}
                                </p>
                                <button
                                    type='button'
                                    class='btn btn-primary btn-sm mt-auto align-self-start'
                                    @click='toggleChecklist(card.key)'
                                >
                                    {{ activeChecklist === card.key ? 'Close Checklist' : 'Open Checklist' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <InvestigateChecklist
                    v-if='activeChecklist === "investigate"'
                    @close='closeChecklist'
                />
                <ContainChecklist
                    v-else-if='activeChecklist === "contain"'
                    @close='closeChecklist'
                />
                <SearchChecklist
                    v-else-if='activeChecklist === "search"'
                    @close='closeChecklist'
                />
            </div>
        </div>

        <!-- Concurrent Actions -->
        <div class='card mb-3'>
            <div
                class='card-header d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='expandedSections.concurrent'
                @click='toggleSection("concurrent")'
                @keydown.enter.prevent='toggleSection("concurrent")'
                @keydown.space.prevent='toggleSection("concurrent")'
            >
                <h4 class='card-title mb-0'>
                    Concurrent Actions
                </h4>
                <IconChevronDown
                    class='ms-auto transition-transform'
                    :class='{ "rotate-180": !expandedSections.concurrent }'
                    :size='20'
                    stroke='1.5'
                />
            </div>
            <div
                v-show='expandedSections.concurrent'
                class='card-body'
            />
        </div>

        <!-- Successive Actions -->
        <div class='card mb-3'>
            <div
                class='card-header d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='expandedSections.successive'
                @click='toggleSection("successive")'
                @keydown.enter.prevent='toggleSection("successive")'
                @keydown.space.prevent='toggleSection("successive")'
            >
                <h4 class='card-title mb-0'>
                    Successive Actions
                </h4>
                <IconChevronDown
                    class='ms-auto transition-transform'
                    :class='{ "rotate-180": !expandedSections.successive }'
                    :size='20'
                    stroke='1.5'
                />
            </div>
            <div
                v-show='expandedSections.successive'
                class='card-body'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, defineAsyncComponent } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';

const InvestigateChecklist = defineAsyncComponent(() => import('./task/InvestigateChecklist.vue'));
const ContainChecklist = defineAsyncComponent(() => import('./task/ContainChecklist.vue'));
const SearchChecklist = defineAsyncComponent(() => import('./task/SearchChecklist.vue'));

type ActionSection = 'initial' | 'concurrent' | 'successive';
type ChecklistKey = 'investigate' | 'contain' | 'search';

interface TaskCard {
    key: ChecklistKey;
    label: string;
    description: string;
}

const taskCards: TaskCard[] = [
    {
        key: 'investigate',
        label: 'Investigate',
        description: 'Gather information, assess the situation, and identify hazards.',
    },
    {
        key: 'contain',
        label: 'Contain',
        description: 'Establish perimeter, control access, and prevent escalation.',
    },
    {
        key: 'search',
        label: 'Search',
        description: 'Deploy teams, assign sectors, and track search progress.',
    },
];

const expandedSections = reactive<Record<ActionSection, boolean>>({
    initial: true,
    concurrent: true,
    successive: true,
});

const activeChecklist = ref<ChecklistKey | null>(null);

function toggleSection(key: ActionSection): void {
    expandedSections[key] = !expandedSections[key];
}

function toggleChecklist(key: ChecklistKey): void {
    activeChecklist.value = activeChecklist.value === key ? null : key;
}

function closeChecklist(): void {
    activeChecklist.value = null;
}
</script>

<style scoped>
.rotate-180 {
    transform: rotate(180deg);
}

.transition-transform {
    transition: transform 0.15s ease;
}
</style>
