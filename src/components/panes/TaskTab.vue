<template>
    <div>
        <h3 class='mb-3'>
            Tasks
        </h3>

        <!-- Initial Actions -->
        <div
            v-if='!expandedSections.initial'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleSection("initial")'
            @keydown.enter.prevent='toggleSection("initial")'
            @keydown.space.prevent='toggleSection("initial")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Initial Actions
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleSection("initial")'
                    @keydown.enter.prevent='toggleSection("initial")'
                    @keydown.space.prevent='toggleSection("initial")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Initial Actions
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div class='row g-3'>
                <div
                    v-for='card in taskCards'
                    :key='card.key'
                    class='col-md-4'
                >
                    <div class='cloudtak-accent border rounded-3 text-white h-100 p-3 d-flex flex-column'>
                        <h4 class='mb-2'>
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
        </TablerBorder>

        <!-- Concurrent Actions -->
        <div
            v-if='!expandedSections.concurrent'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleSection("concurrent")'
            @keydown.enter.prevent='toggleSection("concurrent")'
            @keydown.space.prevent='toggleSection("concurrent")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Concurrent Actions
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleSection("concurrent")'
                    @keydown.enter.prevent='toggleSection("concurrent")'
                    @keydown.space.prevent='toggleSection("concurrent")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Concurrent Actions
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>
        </TablerBorder>

        <!-- Successive Actions -->
        <div
            v-if='!expandedSections.successive'
            class='cloudtak-accent border rounded-3 text-white px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleSection("successive")'
            @keydown.enter.prevent='toggleSection("successive")'
            @keydown.space.prevent='toggleSection("successive")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Successive Actions
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleSection("successive")'
                    @keydown.enter.prevent='toggleSection("successive")'
                    @keydown.space.prevent='toggleSection("successive")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Successive Actions
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, defineAsyncComponent } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import { TablerBorder } from '@tak-ps/vue-tabler';

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
