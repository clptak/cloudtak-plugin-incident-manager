<template>
    <TablerBorder
        v-if='state || connectable'
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

        <template v-if='state'>
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
        </template>

        <!-- No event yet: connect one after the fact (#39). -->
        <template v-else>
            <p class='small mb-2'>
                This incident has no event. Connect an active one, or create one from this incident.
                The management and field DataSyncs (and any open OP) are added to it.
            </p>
            <div class='d-flex flex-wrap align-items-center gap-2'>
                <select
                    v-model='pickedId'
                    class='form-select form-select-sm'
                    style='max-width: 28rem'
                    aria-label='Event to connect'
                    :disabled='busy || listing'
                >
                    <option value=''>
                        {{ listing ? 'Loading events…' : 'Create a new event from this incident' }}
                    </option>
                    <option
                        v-for='event in events'
                        :key='event.id'
                        :value='event.id'
                    >
                        {{ event.name }}
                    </option>
                </select>
                <input
                    v-if='!pickedId'
                    v-model='coords'
                    class='form-control form-control-sm'
                    style='max-width: 14rem'
                    placeholder='Location: lat, lng'
                    aria-label='Event location (lat, lng)'
                    :disabled='busy'
                >
                <button
                    class='btn btn-sm btn-primary'
                    :disabled='busy || listing || (!pickedId && !parsedCoords)'
                    @click='onConnect'
                >
                    {{ busy ? 'Connecting…' : pickedId ? 'Connect event' : 'Create and connect' }}
                </button>
            </div>
            <div class='form-text'>
                A new event is shared with this incident's management channels and placed at the
                location (prefilled from the IPP when there is one).
            </div>
        </template>

        <TablerInlineAlert
            v-if='error'
            class='mt-2'
            severity='danger'
            title='Error'
            :description='error'
        />
        <TablerInlineAlert
            v-if='done'
            class='mt-2'
            severity='success'
            title='Connected'
            :description='done'
        />
    </TablerBorder>
</template>

<script setup lang='ts'>
/**
 * The incident's MGMT Core Event (ADR-004): shown on Wrap Up and the
 * Dashboard, where it is ended by hand. An incident without one can connect
 * an existing event or create one here (#39).
 */
import { computed, ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { useIncident } from '../composables/useIncident.ts';
import {
    connectIncidentEvent,
    endIncidentEvent,
    incidentEventDraft,
    incidentEventState,
    managementChannelNames,
    pickerEvents,
    type EventSummary,
    type IncidentEventLink,
} from '../lib/coreEvents.ts';
import { parseCoordinates } from '../lib/coords.ts';

const { activeMission } = useIncident();

const state = ref<{ link: IncidentEventLink; active: boolean } | null>(null);
/** No event linked and the incident has a management sync: offer to connect one. */
const connectable = ref(false);
const busy = ref(false);
const confirming = ref(false);
const error = ref('');
const done = ref('');

const events = ref<EventSummary[]>([]);
const listing = ref(false);
const pickedId = ref('');
const coords = ref('');
const draft = ref<{ activityNumber: string; incidentName: string } | null>(null);
const parsedCoords = computed(() => parseCoordinates(coords.value));

/** "wildland-fire" -> "Wildland Fire". */
function incidentTypeLabel(slug: string): string {
    return slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

async function load(): Promise<void> {
    const mission = activeMission.value;
    state.value = null;
    connectable.value = false;
    if (!mission?.mgmt) return;
    try {
        state.value = await incidentEventState(mission);
    } catch {
        // Linked event not visible to this user: leave the card hidden.
        return;
    }
    if (!state.value) {
        connectable.value = true;
        void loadConnect();
    }
}

async function loadConnect(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    listing.value = true;
    try {
        const [list, d] = await Promise.all([pickerEvents().catch(() => []), incidentEventDraft(mission)]);
        events.value = list;
        draft.value = d;
        if (!coords.value) coords.value = d.coords;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        listing.value = false;
    }
}

async function onConnect(): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    busy.value = true;
    error.value = '';
    done.value = '';
    try {
        let source: Parameters<typeof connectIncidentEvent>[1];
        if (pickedId.value) {
            source = { eventId: pickedId.value };
        } else {
            const at = parsedCoords.value;
            if (!at) throw new Error('Enter the event location as lat, lng.');
            const channelNames = await managementChannelNames(mission);
            if (!channelNames.length) throw new Error('The management sync has no channels to share the event with.');
            source = {
                form: {
                    activityNumber: draft.value?.activityNumber ?? '',
                    incidentName: draft.value?.incidentName ?? mission.name,
                    typeLabel: mission.incidentType ? incidentTypeLabel(mission.incidentType) : undefined,
                    lat: at.lat,
                    lng: at.lng,
                    channelNames,
                },
            };
        }
        const { event, created, ops } = await connectIncidentEvent(mission, source);
        done.value = `${created ? 'Created and connected' : 'Connected'} "${event.name}"`
            + (ops ? `, with ${ops} open OP${ops === 1 ? '' : 's'}.` : '.')
            + ' Field events for OPs already activated are not created after the fact.';
        await load();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
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

watch(() => activeMission.value?.guid, () => {
    pickedId.value = '';
    coords.value = '';
    error.value = '';
    done.value = '';
    void load();
}, { immediate: true });
</script>
