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
                class='list-group-item'
            >
                <div class='d-flex align-items-center'>
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
                <div
                    v-if='typeof missionPasswords[mission.guid] === "string"'
                    class='mt-2'
                >
                    <div class='d-flex align-items-center'>
                        <input
                            v-model='missionPasswords[mission.guid]'
                            type='password'
                            autocomplete='new-password'
                            class='form-control form-control-sm'
                            placeholder='Password'
                            @keyup.enter='openMission(mission, true)'
                        >
                        <button
                            class='btn btn-sm btn-primary ms-2'
                            :disabled='openingGuid === mission.guid'
                            @click='openMission(mission, true)'
                        >
                            Unlock
                        </button>
                    </div>
                    <div
                        v-if='passwordErrors[mission.guid]'
                        class='text-danger small mt-1'
                    >
                        {{ passwordErrors[mission.guid] }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { server } from '../../../../../src/std.ts';
import type { Mission } from '../../../../../src/types.ts';
import { useMapStore } from '../../../../../src/stores/map.ts';
import OverlayManager from '../../../../../src/base/overlay.ts';
import Subscription from '../../../../../src/base/subscription.ts';
import { useIncident } from '../../composables/useIncident.ts';

const mapStore = useMapStore();
const { activeMission, setActiveMission } = useIncident();

const list = ref<Mission[]>([]);
const filter = ref('');
const loading = ref(false);
const error = ref('');
const openingGuid = ref<string | null>(null);
const missionPasswords = ref<Record<string, string>>({});
const passwordErrors = ref<Record<string, string | undefined>>({});

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

async function openMission(mission: Mission, usePassword = false): Promise<void> {
    error.value = '';

    const alreadyLoaded = !!OverlayManager.loadedByMode('mission', mission.guid);

    // Password-protected missions that aren't loaded yet need a mission
    // token first - reveal the inline password input on first click.
    if (mission.passwordProtected && !alreadyLoaded && !usePassword) {
        missionPasswords.value[mission.guid] = missionPasswords.value[mission.guid] ?? '';
        return;
    }

    openingGuid.value = mission.guid;
    try {
        let fetchedToken: string | undefined;
        if (mission.passwordProtected && !alreadyLoaded && usePassword) {
            passwordErrors.value[mission.guid] = undefined;
            try {
                const getMission = await fetchMission(mission, missionPasswords.value[mission.guid]);
                fetchedToken = getMission.token || undefined;
            } catch (err) {
                passwordErrors.value[mission.guid] = err instanceof Error && err.message.includes('Illegal attempt to access mission')
                    ? 'Invalid Password'
                    : err instanceof Error ? err.message : String(err);
                return;
            }
        }

        // Register the overlay if not already loaded, then activate on the map.
        if (!alreadyLoaded) {
            await OverlayManager.createLoaded({
                name: mission.name,
                url: `/mission/${encodeURIComponent(mission.name)}`,
                type: 'geojson',
                mode: 'mission',
                mode_id: mission.guid,
                token: fetchedToken,
            });
        }
        const sub = await mapStore.loadMission(mission.guid);
        if (sub) await mapStore.makeActiveMission(sub);

        setActiveMission({
            guid: mission.guid,
            name: mission.name,
            missionToken: sub?.missiontoken || fetchedToken || undefined,
        });

        delete missionPasswords.value[mission.guid];
        delete passwordErrors.value[mission.guid];
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        openingGuid.value = null;
    }
}

async function fetchMission(mission: Mission, password?: string): Promise<Mission> {
    const { data, error } = await server.GET('/api/marti/missions/{:name}', {
        params: {
            path: {
                ':name': mission.guid
            },
            query: {
                password,
                changes: false,
                logs: false,
            }
        }
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Mission fetch failed');

    return data;
}
</script>
