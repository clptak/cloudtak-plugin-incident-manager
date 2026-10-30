<template>
    <div class='form-text d-flex flex-wrap align-items-center gap-1'>
        <span>Sends to</span>
        <span
            class='badge'
            :class='isMgmt ? "bg-purple-lt" : "bg-azure-lt"'
            :title='isMgmt ? "The sworn-only planning DataSync" : "The incident DataSync field teams see"'
        >
            {{ isMgmt ? 'MGMT (planning)' : 'Field' }}
        </span>
        <strong>{{ destination.name }}</strong>
        <span
            v-if='target === "mgmt" && !mission.mgmt'
            class='text-muted'
        >
            (this incident has no MGMT DataSync)
        </span>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { ActiveMission } from '../composables/useIncident.ts';
import { schemaMission } from '../lib/incidentSubscription.ts';

/**
 * Shows which DataSync a pane's "Send / Add to DataSync" actions write to.
 * Planning panes target MGMT (falling back to the field mission on
 * single-sync incidents); IR Briefing targets the field mission.
 */
const props = defineProps<{
    mission: ActiveMission;
    target: 'mgmt' | 'field';
}>();

const destination = computed(() => (
    props.target === 'mgmt' ? schemaMission(props.mission) : props.mission
));

const isMgmt = computed(() => props.target === 'mgmt' && !!props.mission.mgmt);
</script>
