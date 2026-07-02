<template>
    <div>
        <h3 class='mb-3'>
            {{ subLabel }}
        </h3>

        <InitialInformation v-if='sub === "initial-information"' />
        <SubjectInformation v-else-if='sub === "subject-info"' />
        <SearchArea v-else-if='sub === "search-area"' />
        <SearchUrgency v-else-if='sub === "search-urgency"' />
        <IrBriefing v-else-if='sub === "ir-briefing"' />
        <SearchScenarios v-else-if='sub === "search-scenarios"' />
        <RiskAssessment v-else-if='sub === "risk-assessment"' />
        <IncidentPost v-else-if='sub === "incident-post"' />

        <div
            v-else
            class='card'
        >
            <div class='card-body'>
                <p class='text-muted mb-0'>
                    Stub for the "{{ subLabel }}" logger sub-pane.
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, defineAsyncComponent } from 'vue';

const InitialInformation = defineAsyncComponent(() => import('./logger/InitialInformation.vue'));
const SubjectInformation = defineAsyncComponent(() => import('./logger/SubjectInformation.vue'));
const SearchArea = defineAsyncComponent(() => import('./logger/SearchArea.vue'));
const SearchUrgency = defineAsyncComponent(() => import('./logger/SearchUrgency.vue'));
const IrBriefing = defineAsyncComponent(() => import('./logger/IrBriefing.vue'));
const SearchScenarios = defineAsyncComponent(() => import('./logger/SearchScenarios.vue'));
const RiskAssessment = defineAsyncComponent(() => import('./logger/RiskAssessment.vue'));
const IncidentPost = defineAsyncComponent(() => import('./logger/IncidentPost.vue'));

const props = defineProps<{ sub: string }>();

const labels: Record<string, string> = {
    'initial-information': 'Initial Information',
    'subject-info': 'Subject Information',
    'search-area': 'Search Area',
    'search-urgency': 'Search Urgency',
    'ir-briefing': 'IR Briefing',
    'search-scenarios': 'Search Scenarios',
    'risk-assessment': 'Risk Assessment',
    'incident-post': 'Incident POST',
};

const subLabel = computed(() => labels[props.sub] ?? props.sub);
</script>
