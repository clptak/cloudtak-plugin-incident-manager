<template>
    <div>
        <div class='d-flex align-items-center mb-2'>
            <input
                v-model='filter'
                type='text'
                class='form-control form-control-sm'
                placeholder='Filter missions by name…'
                style='max-width: 320px;'
            >
            <button
                class='btn btn-sm btn-outline-secondary ms-2'
                :disabled='loading'
                @click='fetchMissions'
            >
                {{ loading ? 'Loading…' : 'Refresh' }}
            </button>
        </div>

        <div
            v-if='error'
            class='text-danger small mb-2'
        >
            {{ error }}
        </div>

        <div
            v-if='!loading && !filtered.length'
            class='text-muted small'
        >
            No missions found.
        </div>

        <div class='list-group'>
            <div
                v-for='mission in filtered'
                :key='mission.guid'
                class='list-group-item d-flex align-items-center'
            >
                <div class='me-2'>
                    <span
                        v-if='mission.passwordProtected'
                        title='Password protected'
                    >🔒</span>
                </div>
                <div
                    class='flex-fill'
                    style='min-width: 0;'
                >
                    <div class='text-truncate fw-bold'>
                        {{ mission.name }}
                    </div>
                    <div
                        v-if='mission.description'
                        class='text-muted small text-truncate'
                    >
                        {{ mission.description }}
                    </div>
                </div>
                <span
                    v-if='activeMission && activeMission.guid === mission.guid'
                    class='badge bg-success me-2'
                >Active</span>
                <button
                    class='btn btn-sm btn-primary'
                    :disabled='openingGuid === mission.guid'
                    @click='openMission(mission)'
                >
                    {{ openingGuid === mission.guid ? 'Opening…' : 'Open' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import type { Mission } from '../../../../src/types.ts';
import { useMapStore } from '../../../../src/stores/map.ts';
import OverlayManager from '../../../../src/base/overlay.ts';
import Subscription from '../../../../src/base/subscription.ts';
import { useIncident } from '../../composables/useIncident.ts';

const mapStore = useMapStore();
const { activeMission, setActiveMission } = useIncident();

const list = ref<Mission[]>([]);
const filter = ref('');
const loading = ref(false);
const error = ref('');
const openingGuid = ref<string | null>(null);

const filtered = computed(() =>
    list.value.filter((m) => m.name.toLowerCase().includes(filter.value.toLowerCase()))
);

onMounted(fetchMissions);

async function fetchMissions(): Promise<void> {
    error.value = '';
    loading.value = true;
    try {
        const res = await Subscription.list();
        list.value = res.items;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

async function openMission(mission: Mission): Promise<void> {
    error.value = '';
    openingGuid.value = mission.guid;
    try {
        // Register the overlay if not already loaded, then activate on the map.
        if (!OverlayManager.loadedByMode('mission', mission.guid)) {
            await OverlayManager.createLoaded({
                name: mission.name,
                url: `/mission/${encodeURIComponent(mission.name)}`,
                type: 'geojson',
                mode: 'mission',
                mode_id: mission.guid,
            });
        }
        await mapStore.loadMission(mission.guid);

        setActiveMission({ guid: mission.guid, name: mission.name });
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        openingGuid.value = null;
    }
}
</script>
