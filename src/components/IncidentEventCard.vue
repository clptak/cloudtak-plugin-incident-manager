<template>
    <TablerBorder
        v-if='state'
        class='cloudtak-accent text-white mb-3'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0'>
                Incident event
            </p>
        </template>

        <div class='d-flex flex-wrap align-items-center gap-2 small'>
            <span>{{ state.link.name || state.link.id }}</span>
            <span
                class='badge'
                :class='state.active ? "bg-success-lt text-success" : "bg-secondary-lt text-secondary"'
            >{{ state.active ? 'active' : 'ended' }}</span>
            <template v-if='state.active'>
                <button
                    v-if='!confirming'
                    class='btn btn-sm btn-outline-warning ms-auto'
                    :disabled='busy'
                    @click='confirming = true'
                >
                    End the incident event
                </button>
                <template v-else>
                    <span class='ms-auto text-warning'>End it for everyone on the management channels?</span>
                    <button
                        class='btn btn-sm btn-warning'
                        :disabled='busy'
                        @click='onEnd'
                    >
                        {{ busy ? 'Ending…' : 'End event' }}
                    </button>
                    <button
                        class='btn btn-sm btn-outline-secondary'
                        :disabled='busy'
                        @click='confirming = false'
                    >
                        Cancel
                    </button>
                </template>
            </template>
        </div>
        <div class='form-text'>
            The incident event stays active until it is ended here. Ending it does not close
            any OP or DataSync.
        </div>
        <TablerInlineAlert
            v-if='error'
            class='mt-2'
            severity='danger'
            title='Error'
            :description='error'
        />
    </TablerBorder>
</template>

<script setup lang='ts'>
/**
 * The incident's MGMT Core Event (ADR-004): shown on Wrap Up and the
 * Dashboard, where it is ended by hand. Hidden when the incident has none.
 */
import { ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { useIncident } from '../composables/useIncident.ts';
import { endIncidentEvent, incidentEventState, type IncidentEventLink } from '../lib/coreEvents.ts';

const { activeMission } = useIncident();

const state = ref<{ link: IncidentEventLink; active: boolean } | null>(null);
const busy = ref(false);
const confirming = ref(false);
const error = ref('');

async function load(): Promise<void> {
    const mission = activeMission.value;
    state.value = null;
    if (!mission?.mgmt) return;
    try {
        state.value = await incidentEventState(mission);
    } catch {
        // No event, or not visible to this user: the card stays hidden.
        state.value = null;
    }
}

async function onEnd(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    busy.value = true;
    error.value = '';
    try {
        await endIncidentEvent(mission);
        confirming.value = false;
        await load();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

watch(() => activeMission.value?.guid, () => void load(), { immediate: true });
</script>
