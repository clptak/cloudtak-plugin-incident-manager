<template>
    <div>
        <h3 class='mb-3'>
            Tasks
        </h3>

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
</template>

<script setup lang='ts'>
import { ref, defineAsyncComponent } from 'vue';

const InvestigateChecklist = defineAsyncComponent(() => import('./task/InvestigateChecklist.vue'));
const ContainChecklist = defineAsyncComponent(() => import('./task/ContainChecklist.vue'));
const SearchChecklist = defineAsyncComponent(() => import('./task/SearchChecklist.vue'));

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

const activeChecklist = ref<ChecklistKey | null>(null);

function toggleChecklist(key: ChecklistKey): void {
    activeChecklist.value = activeChecklist.value === key ? null : key;
}

function closeChecklist(): void {
    activeChecklist.value = null;
}
</script>
