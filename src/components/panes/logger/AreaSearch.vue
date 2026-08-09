<template>
    <div>
        <TablerInlineAlert
            v-if='!activeMission'
            severity='warning'
            title='Mission Required'
            description='Select or create an incident in Create | Open first.'
        />
        <TablerInlineAlert
            v-else-if='!activeMission.mgmt'
            severity='warning'
            title='Management Sync Required'
            description='This incident predates the dual-sync model (no management DataSync), so operational periods cannot be managed here. Create a new incident with Management Channels set.'
        />

        <template v-else>
            <TablerInlineAlert
                v-if='error'
                class='mb-3'
                severity='danger'
                title='Error'
                :description='error'
            />
            <TablerInlineAlert
                v-if='notice'
                class='mb-3'
                severity='success'
                title='Done'
                :description='notice'
            />

            <!-- ── Operational Periods ─────────────────────────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Operational Periods
                    </p>
                </template>

                <div
                    v-if='loadingRegistry'
                    class='text-muted small'
                >
                    Loading registry…
                </div>
                <template v-else>
                    <div
                        v-if='!registry.length'
                        class='text-muted small mb-2'
                    >
                        No operational periods yet. Opening OP1 begins the Area Search phase.
                    </div>
                    <div
                        v-for='op in registry'
                        :key='op.guid'
                        class='cloudtak-accent border rounded-3 mb-2 px-3 py-2 d-flex align-items-center gap-2'
                    >
                        <strong>OP{{ op.opNumber }}</strong>
                        <span class='text-muted small'>{{ op.name }}</span>
                        <span
                            class='badge ms-1'
                            :class='op.status === "closed" ? "bg-secondary-lt text-secondary" : "bg-success-lt text-success"'
                        >{{ op.status }}</span>
                        <span
                            v-if='currentOp && op.guid === currentOp.guid'
                            class='badge bg-blue-lt text-blue'
                        >current</span>
                        <span class='text-muted small ms-auto'>
                            {{ op.openedAt ? shortDt(op.openedAt) : '' }}
                            {{ op.closedAt ? `→ ${shortDt(op.closedAt)}` : '' }}
                        </span>
                        <button
                            v-if='op.status !== "closed"'
                            class='btn btn-link btn-sm p-0'
                            :disabled='busy'
                            @click='makeMapActive(op.guid, op.name)'
                        >
                            Set active
                        </button>
                    </div>
                    <div class='form-text mb-1'>
                        Active mission = where new markers, clues, and logs land.
                        <button
                            class='btn btn-link btn-sm p-0 align-baseline'
                            :disabled='busy'
                            @click='makeMapActive(activeMission.guid, activeMission.name)'
                        >
                            Set common map active
                        </button>
                    </div>

                    <div
                        v-if='!currentOp'
                        class='mt-3'
                    >
                        <label class='form-label'>Channels for OP{{ nextOp }}</label>
                        <GroupSelect
                            v-model='opChannels'
                            :active='true'
                            direction='IN'
                        />
                        <div class='form-text'>
                            Field + management channels (defaults from the incident common map).
                            Subscribed volunteers can add markers and logs immediately.
                        </div>
                        <button
                            class='btn btn-primary mt-2'
                            :disabled='busy || !opChannels.length'
                            @click='onOpenOp'
                        >
                            {{ busy ? 'Working…' : `Open OP${nextOp}` }}
                        </button>
                    </div>
                    <div
                        v-else
                        class='mt-3'
                    >
                        <button
                            class='btn btn-outline-primary me-2'
                            :disabled='busy'
                            @click='onPublishIpp'
                        >
                            Publish IPP to OP{{ currentOp.opNumber }}
                        </button>
                        <button
                            class='btn btn-outline-danger'
                            :disabled='busy'
                            @click='onCloseOp'
                        >
                            {{ busy ? 'Working…' : `Close OP${currentOp.opNumber}` }}
                        </button>
                        <div class='form-text'>
                            Closing removes field channels from the OP sync — volunteers lose
                            access and visibility (fades as server caches expire).
                        </div>
                    </div>
                </template>
            </TablerBorder>

            <!-- ── Assignments ─────────────────────────────────────────── -->
            <TablerBorder
                v-if='currentOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Assignments — OP{{ currentOp.opNumber }}
                    </p>
                </template>

                <p class='text-muted small mb-2'>
                    Publishing copies each segment polygon into {{ currentOp.name }} so
                    volunteers receive it on their channel, and adds it to the running
                    assignment list (the basis for this OP's IAP).
                </p>

                <div
                    v-if='!segmentUids.length'
                    class='text-muted small'
                >
                    No segments registered. Draw and register segments in
                    Search Transition → Segmentation first.
                </div>
                <template v-else>
                    <label
                        v-for='uid in segmentUids'
                        :key='uid'
                        class='form-check d-flex align-items-center gap-2 mb-1'
                    >
                        <input
                            v-model='selectedSegments'
                            type='checkbox'
                            class='form-check-input'
                            :value='uid'
                        >
                        <span class='form-check-label'>{{ segmentLabel(uid) }}</span>
                        <span
                            v-if='assignedThisOp.has(uid)'
                            class='badge bg-success-lt text-success'
                        >published OP{{ currentOp.opNumber }}</span>
                    </label>
                    <div class='row g-2 mt-1'>
                        <div class='col-md-6'>
                            <template v-if='opResourceOptions.length'>
                                <label class='form-label'>Team / Resource (optional)</label>
                                <select
                                    v-model='assignTeam'
                                    class='form-select form-select-sm'
                                >
                                    <option value=''>— unassigned —</option>
                                    <option
                                        v-for='r in opResourceOptions'
                                        :key='r'
                                        :value='r'
                                    >
                                        {{ r }}
                                    </option>
                                </select>
                                <div class='form-text'>
                                    Resources assigned to OP{{ currentOp.opNumber }} in the Resources screen.
                                </div>
                            </template>
                            <template v-else>
                                <TablerInput
                                    v-model='assignTeam'
                                    label='Team / Resource (optional)'
                                    placeholder='No resources assigned to this OP — set OP in Resources'
                                />
                            </template>
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='assignNotes'
                                label='Notes (optional)'
                            />
                        </div>
                    </div>
                    <button
                        class='btn btn-primary mt-2'
                        :disabled='busy || !selectedSegments.length'
                        @click='onPublishAssignments'
                    >
                        {{ busy ? 'Working…' : `Publish ${selectedSegments.length || ''} to OP${currentOp.opNumber}` }}
                    </button>
                </template>

                <div
                    v-if='assignments.length'
                    class='mt-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Running Assignment List ({{ assignments.length }})
                    </p>
                    <div
                        v-for='(a, i) in assignments'
                        :key='i'
                        class='small border-bottom py-1'
                    >
                        OP{{ a.opNumber }} · {{ a.label }}
                        <span
                            v-if='a.team'
                            class='text-muted'
                        > · {{ a.team }}</span>
                        <span
                            v-if='a.notes'
                            class='text-muted'
                        > · {{ a.notes }}</span>
                    </div>
                </div>
            </TablerBorder>

            <!-- ── Check-In ────────────────────────────────────────────── -->
            <TablerBorder
                v-if='currentOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center w-100'>
                        <span>Roster — OP{{ currentOp.opNumber }} Subscribers</span>
                        <button
                            class='btn btn-outline-primary btn-sm ms-auto'
                            :disabled='loadingSubscribers'
                            @click='refreshSubscribers'
                        >
                            {{ loadingSubscribers ? 'Loading…' : 'Refresh' }}
                        </button>
                    </p>
                </template>

                <div
                    v-if='!subscribers.length'
                    class='text-muted small'
                >
                    No subscribers yet. Volunteers appear here after subscribing to
                    {{ currentOp.name }}.
                </div>
                <div
                    v-for='sub in subscribers'
                    :key='sub.clientUid'
                    class='d-flex align-items-center gap-2 border-bottom py-1'
                >
                    <span>{{ sub.username }}</span>
                    <span class='badge bg-secondary-lt text-secondary'>{{ roleLabel(sub.role) }}</span>
                    <button
                        v-if='sub.role === "MISSION_READONLY_SUBSCRIBER"'
                        class='btn btn-outline-success btn-sm ms-auto'
                        :disabled='busy'
                        @click='onCheckIn(sub)'
                    >
                        Check In
                    </button>
                </div>
            </TablerBorder>

            <!-- ── Debrief / POD ───────────────────────────────────────── -->
            <TablerBorder
                v-if='registry.length'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Debrief — POD Capture
                    </p>
                </template>

                <div class='row g-2'>
                    <div class='col-md-6'>
                        <label class='form-label'>Segment</label>
                        <select
                            v-model='debriefForm.segmentUid'
                            class='form-select form-select-sm'
                        >
                            <option value=''>— select segment —</option>
                            <option
                                v-for='(seg, uid) in segments'
                                :key='uid'
                                :value='uid'
                            >
                                {{ seg.callsign || uid }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-2'>
                        <TablerInput
                            v-model='debriefForm.pod'
                            label='POD %'
                            placeholder='0–100'
                        />
                    </div>
                    <div class='col-md-2'>
                        <TablerInput
                            v-model='debriefForm.coverage'
                            label='Completed %'
                            placeholder='100'
                        />
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label'>OP</label>
                        <select
                            v-model.number='debriefForm.opNumber'
                            class='form-select form-select-sm'
                        >
                            <option
                                v-for='op in registry'
                                :key='op.opNumber'
                                :value='op.opNumber'
                            >
                                OP{{ op.opNumber }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-6'>
                        <template v-if='debriefResourceOptions.length'>
                            <label class='form-label'>Resource / Team</label>
                            <select
                                v-model='debriefForm.resource'
                                class='form-select form-select-sm'
                            >
                                <option value=''>— select resource —</option>
                                <option
                                    v-for='r in debriefResourceOptions'
                                    :key='r'
                                    :value='r'
                                >
                                    {{ r }}
                                </option>
                            </select>
                        </template>
                        <TablerInput
                            v-else
                            v-model='debriefForm.resource'
                            label='Resource / Team'
                            placeholder='Team 3, K9-1, …'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='debriefForm.notes'
                            label='Notes'
                        />
                    </div>
                </div>
                <button
                    class='btn btn-primary mt-2'
                    :disabled='busy || !debriefForm.segmentUid'
                    @click='onRecordDebrief'
                >
                    Record Debrief
                </button>

                <div
                    v-if='debriefs.length'
                    class='mt-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Recorded ({{ debriefs.length }})
                    </p>
                    <div
                        v-for='(d, i) in debriefs'
                        :key='i'
                        class='small border-bottom py-1'
                    >
                        OP{{ d.opNumber }} · {{ segmentLabel(d.segmentUid) }} ·
                        POD {{ d.pod }}%<span v-if='d.coverage !== undefined'> ({{ Math.round(d.coverage * 100) }}% completed)</span>
                        <span
                            v-if='d.resource'
                            class='text-muted'
                        > · {{ d.resource }}</span>
                    </div>
                </div>
            </TablerBorder>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import OverlayManager from '../../../../../../src/base/overlay.ts';
import { useMapStore } from '../../../../../../src/stores/map.ts';
import { server } from '../../../../../../src/std.ts';
import GroupSelect from '../../../../../../src/components/CloudTAK/util/GroupSelect.vue';
import { useIncident } from '../../../composables/useIncident.ts';
import type { DebriefRecord, OpAssignment, OpPeriodRegistryEntry } from '../../../domain/entities.ts';
import { currentOpPeriod, nextOpNumber } from '../../../domain/registry.ts';
import {
    checkInSubscriber,
    closeOperationalPeriod,
    openOperationalPeriod,
    publishAssignments,
    recordDebrief,
} from '../../../domain/usecases.ts';
import { createDebriefStore } from '../../../lib/debriefPersistence.ts';
import {
    createAssignmentStore,
    createOpFeaturePublisher,
    createSegmentGeometrySource,
    publishIppToOp,
} from '../../../lib/opAssignmentPersistence.ts';
import { loadResourceAssignmentsFromMission } from '../../../lib/resourceAssignmentPersistence.ts';
import type { ResourceAssignment } from '../../../lib/resourceAssignments.ts';
import { loadSchemaSubscription } from '../../../lib/incidentSubscription.ts';
import { loadMissionSchema } from '../../../lib/missionSchema.ts';
import { createOpPeriodGateway } from '../../../lib/opPeriodGateway.ts';
import { createRegistryStore } from '../../../lib/registryPersistence.ts';
import { segmentsFromSchema, type SegmentMap } from '../../../lib/segmentsPersistence.ts';

const { activeMission } = useIncident();

const registry = ref<OpPeriodRegistryEntry[]>([]);
const segments = ref<SegmentMap>({});
const debriefs = ref<DebriefRecord[]>([]);
const assignments = ref<OpAssignment[]>([]);
const selectedSegments = ref<string[]>([]);
const assignTeam = ref('');
const assignNotes = ref('');
const subscribers = ref<{ clientUid: string; username: string; role: string }[]>([]);
const opChannels = ref<string[]>([]);

const loadingRegistry = ref(false);
const loadingSubscribers = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const gateway = createOpPeriodGateway();

const currentOp = computed(() => currentOpPeriod(registry.value));
const nextOp = computed(() => nextOpNumber(registry.value));
const segmentUids = computed(() => Object.keys(segments.value));
const resources = ref<ResourceAssignment[]>([]);
/** Resource identifiers assigned (in the Resources screen) to the current OP. */
const opResourceOptions = computed(() => {
    const op = currentOp.value;
    if (!op) return [];
    return resources.value
        .filter((r) => r.opNumber === op.opNumber && r.resourceIdentifier.trim())
        .map((r) => r.resourceIdentifier.trim());
});
/** Same idea for the debrief form, but keyed to the OP selected there. */
const debriefResourceOptions = computed(() => resources.value
    .filter((r) => r.opNumber === debriefForm.opNumber && r.resourceIdentifier.trim())
    .map((r) => r.resourceIdentifier.trim()));
const assignedThisOp = computed(() => new Set(
    assignments.value
        .filter((a) => a.opNumber === currentOp.value?.opNumber)
        .map((a) => a.segmentUid),
));

const debriefForm = reactive({
    segmentUid: '',
    pod: '',
    coverage: '',
    opNumber: 1,
    resource: '',
    notes: '',
});

function shortDt(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
}

function roleLabel(role: string): string {
    if (role === 'MISSION_OWNER') return 'owner';
    if (role === 'MISSION_SUBSCRIBER') return 'checked in';
    if (role === 'MISSION_READONLY_SUBSCRIBER') return 'read-only';
    return role || 'unknown';
}

function segmentLabel(uid: string): string {
    return segments.value[uid]?.callsign || uid;
}

async function missionChannels(guid: string): Promise<string[]> {
    try {
        const { data } = await server.GET('/api/marti/missions/{:name}', {
            params: { path: { ':name': guid }, query: { changes: false, logs: false } },
        });
        const groups = (data as { groups?: string | string[] } | undefined)?.groups;
        if (Array.isArray(groups)) return groups;
        if (typeof groups === 'string' && groups) return [groups];
    } catch {
        /* fall through */
    }
    return [];
}

async function refresh(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    loadingRegistry.value = true;
    error.value = '';
    try {
        const store = createRegistryStore(mission);
        registry.value = await store.load();

        const sub = await loadSchemaSubscription(mission);
        const { schema } = await loadMissionSchema(sub);
        segments.value = segmentsFromSchema(schema);
        debriefs.value = await createDebriefStore(mission).load();
        assignments.value = await createAssignmentStore(mission).load();
        resources.value = (await loadResourceAssignmentsFromMission(mission)).assignments;

        if (!opChannels.value.length) {
            opChannels.value = await missionChannels(mission.guid);
        }
        if (currentOp.value) {
            debriefForm.opNumber = currentOp.value.opNumber;
            await ensureOpOverlay(currentOp.value);
            await refreshSubscribers();
        } else if (registry.value.length) {
            debriefForm.opNumber = registry.value[registry.value.length - 1].opNumber;
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingRegistry.value = false;
    }
}

async function refreshSubscribers(): Promise<void> {
    const op = currentOp.value;
    if (!op) return;
    loadingSubscribers.value = true;
    try {
        subscribers.value = await gateway.listSubscribers(op);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingSubscribers.value = false;
    }
}

async function onOpenOp(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const entry = await openOperationalPeriod(
            { registry: createRegistryStore(mission), gateway },
            { incidentName: mission.name, channels: opChannels.value },
        );
        await ensureOpOverlay(entry);
        // The new OP becomes the working mission: clues/logs land there by default.
        await makeMapActive(entry.guid, entry.name);
        // Every OP carries the incident IPP (idempotent per-OP uid).
        let ippNote = '';
        try {
            const ippUid = await publishIppToOp(mission, entry);
            ippNote = ippUid ? ' IPP published.' : ' No IPP set yet — publish it from Search Area, then reopen this pane.';
        } catch (ippErr) {
            ippNote = ` IPP publish failed: ${ippErr instanceof Error ? ippErr.message : String(ippErr)}`;
        }
        notice.value = `Opened ${entry.name}.${ippNote}`;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onCloseOp(): Promise<void> {
    const mission = activeMission.value;
    const op = currentOp.value;
    if (!mission?.mgmt || !op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        let retain = await missionChannels(mission.mgmt.guid);
        if (!retain.length) retain = op.channels.length ? [op.channels[0]] : [];
        const closed = await closeOperationalPeriod(
            { registry: createRegistryStore(mission), gateway },
            op,
            { retainChannels: retain },
        );
        notice.value = `Closed ${closed.name}; volunteers demoted and field channels removed.`;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

const mapStore = useMapStore();

/**
 * Make a mission the MAP's active mission — where drawn markers, clues, and
 * logs go by default. Distinct from the plugin's incident selection.
 */
async function makeMapActive(guid: string, label: string): Promise<void> {
    try {
        const sub = await mapStore.loadMission(guid);
        if (sub) {
            await mapStore.makeActiveMission(sub);
            notice.value = `${label} is now the active mission — new markers and logs go there.`;
        }
    } catch (err) {
        error.value = `Could not activate ${label}: ${err instanceof Error ? err.message : String(err)}`;
    }
}

/** Make sure the OP mission renders as a map overlay on this device. */
async function ensureOpOverlay(op: OpPeriodRegistryEntry): Promise<void> {
    try {
        if (OverlayManager.loadedByMode('mission', op.guid)) return;
        await OverlayManager.createLoaded({
            name: op.name,
            url: `/mission/${encodeURIComponent(op.guid)}`,
            type: 'geojson',
            mode: 'mission',
            mode_id: op.guid,
            token: op.ownerToken,
        });
    } catch (err) {
        console.warn('Failed to attach OP overlay', op.name, err);
    }
}

/** Re-publish the incident IPP into the current OP (idempotent — same uid). */
async function onPublishIpp(): Promise<void> {
    const mission = activeMission.value;
    const op = currentOp.value;
    if (!mission?.mgmt || !op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const uid = await publishIppToOp(mission, op);
        notice.value = uid
            ? `Published IPP to ${op.name}.`
            : 'No IPP found on the incident map — set it in Search Area first.';
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onPublishAssignments(): Promise<void> {
    const mission = activeMission.value;
    const op = currentOp.value;
    if (!mission?.mgmt || !op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const published = await publishAssignments({
            geometry: createSegmentGeometrySource(mission),
            publisher: createOpFeaturePublisher(),
            assignments: createAssignmentStore(mission),
        }, op, {
            segmentUids: selectedSegments.value,
            team: assignTeam.value,
            notes: assignNotes.value,
        });
        notice.value = `Published ${published.length} assignment${published.length === 1 ? '' : 's'} to ${op.name}.`;
        selectedSegments.value = [];
        assignTeam.value = '';
        assignNotes.value = '';
        assignments.value = await createAssignmentStore(mission).load();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onCheckIn(sub: { clientUid: string; username: string }): Promise<void> {
    const op = currentOp.value;
    if (!op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        await checkInSubscriber(gateway, op, sub);
        notice.value = `Checked in ${sub.username}.`;
        await refreshSubscribers();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onRecordDebrief(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const record: DebriefRecord = {
            opNumber: debriefForm.opNumber,
            segmentUid: debriefForm.segmentUid,
            pod: Number(debriefForm.pod),
        };
        const coveragePct = debriefForm.coverage.trim();
        if (coveragePct) record.coverage = Number(coveragePct) / 100;
        if (debriefForm.resource.trim()) record.resource = debriefForm.resource.trim();
        if (debriefForm.notes.trim()) record.notes = debriefForm.notes.trim();

        await recordDebrief(createDebriefStore(mission), record);
        notice.value = `Recorded POD ${record.pod}% for ${segmentLabel(record.segmentUid)}.`;
        debriefForm.pod = '';
        debriefForm.coverage = '';
        debriefForm.notes = '';
        debriefs.value = await createDebriefStore(mission).load();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

onMounted(refresh);
watch(() => activeMission.value?.guid, refresh);
</script>
