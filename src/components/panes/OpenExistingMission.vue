<template>
    <div>
        <div class='d-flex align-items-start gap-2 mb-2'>
            <div class='flex-fill'>
                <TablerInput
                    v-model='filter'
                    placeholder='Filter missions by name…'
                    icon='search'
                />
            </div>
            <button
                class='btn btn-sm btn-outline-secondary mt-1'
                :disabled='loading'
                @click='fetchMissions'
            >
                {{ loading ? 'Loading…' : 'Refresh' }}
            </button>
        </div>

        <TablerInlineAlert
            v-if='error'
            class='mb-2'
            severity='danger'
            title='Error'
            :description='error'
        />

        <div
            v-if='!loading && !filtered.length'
            class='text-muted small'
        >
            No missions found.
        </div>

        <div class='d-flex flex-column gap-2'>
            <div
                v-for='mission in filtered'
                :key='mission.guid'
                class='cloudtak-accent border rounded-3 text-white px-2 py-2'
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
                    <div class='d-flex align-items-start gap-2'>
                        <div class='flex-fill'>
                            <TablerInput
                                v-model='missionPasswords[mission.guid]'
                                type='password'
                                autocomplete='new-password'
                                placeholder='Password'
                                @submit='openMission(mission, true)'
                            />
                        </div>
                        <button
                            class='btn btn-sm btn-primary mt-1'
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
import { TablerInput, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { server } from '../../../../../src/std.ts';
import type { Mission } from '../../../../../src/types.ts';
import { useMapStore } from '../../../../../src/stores/map.ts';
import OverlayManager from '../../../../../src/base/overlay.ts';
import Subscription from '../../../../../src/base/subscription.ts';
import { useIncident } from '../../composables/useIncident.ts';
import {
    isSameIncidentFamily,
    parseIncidentTypeFromRecord,
} from '../../lib/incidentType.ts';
import { resolveIncidentTypeFromFamily } from '../../lib/incidentTypeResolve.ts';

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
        // Management siblings are opened implicitly with their incident —
        // hide them so the incident is always entered via its common map.
        list.value = res.items.filter((m) => !m.name.endsWith(' - MGMT'));
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

async function openMission(mission: Mission, usePassword = false): Promise<void> {
    error.value = '';

    const overlay = OverlayManager.loadedByMode('mission', mission.guid);
    const alreadyLoaded = !!overlay;

    // Password-protected missions that aren't unlocked yet need a mission token.
    if (mission.passwordProtected && !usePassword) {
        missionPasswords.value[mission.guid] = missionPasswords.value[mission.guid] ?? '';
        return;
    }

    openingGuid.value = mission.guid;
    try {
        let fetchedToken: string | undefined;
        let incidentType = parseIncidentTypeFromRecord(mission);
        passwordErrors.value[mission.guid] = undefined;

        // Always fetch a fresh server token on open. Local/overlay tokens can be
        // stale (wrong mission) and still look "present", which breaks layer APIs.
        try {
            const password = mission.passwordProtected
                ? missionPasswords.value[mission.guid]
                : undefined;
            const getMission = await fetchMission(mission, password);
            fetchedToken = getMission.token || undefined;
            incidentType = parseIncidentTypeFromRecord(getMission) || incidentType;
        } catch (err) {
            if (mission.passwordProtected) {
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
        } else if (fetchedToken && overlay) {
            overlay.token = fetchedToken;
        }

        // Persist the fresh token into the local subscription DB without a full
        // layer refresh (reload:true was failing open for stale tokens).
        if (fetchedToken) {
            const loaded = await Subscription.load(mission.guid, {
                missiontoken: fetchedToken,
                subscribed: true,
                reload: false,
            });
            if (!incidentType) incidentType = parseIncidentTypeFromRecord(loaded);
        }

        const sub = await mapStore.loadMission(mission.guid);
        if (sub) await mapStore.makeActiveMission(sub);
        if (!incidentType) incidentType = parseIncidentTypeFromRecord(sub);
        if (
            !incidentType
            && activeMission.value?.incidentType
            && isSameIncidentFamily(activeMission.value.name, mission.name)
        ) {
            incidentType = activeMission.value.incidentType;
        }
        if (!incidentType) {
            incidentType = await resolveIncidentTypeFromFamily(mission.name);
        }

        const finalToken = fetchedToken || sub?.missiontoken || undefined;

        // Dual-sync incidents: re-attach the Sworn-side management sibling
        // (`<name> - MGMT`). Only users with the management channel can see it —
        // for everyone else the lookup 404s and the incident opens single-sync.
        let mgmt: { guid: string; name: string; missionToken?: string } | undefined;
        try {
            const mgmtName = `${mission.name} - MGMT`;
            const { data: mgmtData } = await server.GET('/api/marti/missions/{:guid}', {
                params: {
                    path: { ':guid': mgmtName },
                    query: { changes: false, logs: false },
                },
            });
            if (mgmtData?.guid) {
                const mgmtToken = (mgmtData as { token?: string }).token || undefined;
                // Server-side subscription so schema writes can resolve a mission
                // token even in sessions that didn't create the incident.
                if (!OverlayManager.loadedByMode('mission', mgmtData.guid)) {
                    await OverlayManager.createLoaded({
                        name: mgmtData.name,
                        url: `/mission/${encodeURIComponent(mgmtData.guid)}`,
                        type: 'geojson',
                        mode: 'mission',
                        mode_id: mgmtData.guid,
                        token: mgmtToken,
                    });
                }
                const mgmtSub = await Subscription.load(mgmtData.guid, {
                    missiontoken: mgmtToken ?? '',
                    subscribed: true,
                    reload: false,
                });
                mgmt = {
                    guid: mgmtData.guid,
                    name: mgmtData.name,
                    missionToken: mgmtToken || mgmtSub?.missiontoken || undefined,
                };
            }
        } catch {
            // No management sibling visible — pre-Phase-1 incident or no channel access.
        }

        setActiveMission({
            guid: mission.guid,
            name: mission.name,
            missionToken: finalToken,
            token: finalToken,
            mgmt,
            incidentType,
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
    const { data, error } = await server.GET('/api/marti/missions/{:guid}', {
        params: {
            path: {
                ':guid': mission.guid
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
