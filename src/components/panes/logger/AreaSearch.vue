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
                            class='btn btn-link btn-sm p-0'
                            :disabled='busy'
                            title='Generate the Incident Action Plan PDF for this operational period'
                            @click='onGenerateIap(op)'
                        >
                            IAP
                        </button>
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
                            class='btn btn-outline-primary me-2'
                            :disabled='busy'
                            @click='openClueForm'
                        >
                            Add Influence of Clue
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

            <!-- ── IAP builder (editable, prefilled) ───────────────────── -->
            <TablerBorder
                v-if='iapOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Incident Action Plan
                    </p>
                </template>
                <IapBuilder
                    :key='iapOp.guid'
                    :op='iapOp'
                    :registry='registry'
                    :category='iapCategory'
                    @close='iapOp = null'
                />
            </TablerBorder>

            <!-- ── Influence of Clue (ISM 8.17/8.18) — inline, map stays usable ── -->
            <TablerBorder
                v-if='clueFormOpen && currentOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Add Influence of Clue — OP{{ clueForm.opNumber }}
                    </p>
                </template>

                <p class='form-text mt-0 mb-2'>
                    Rate what the clue suggests — assuming it is authentic — for R.O.W. and
                    every segment: A = strongly suggests subject IS here, E = says nothing,
                    I = strongly suggests subject is NOT here. Authenticity then discounts
                    the whole update.
                </p>

                <div class='row g-2'>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='clueForm.description'
                            label='Description'
                            placeholder='e.g. Wallet found in Segment 1'
                        />
                        <div
                            v-if='cluePointOptions.length'
                            class='mt-1'
                        >
                            <select
                                class='form-select form-select-sm'
                                @change='onCluePointPick($event)'
                            >
                                <option value=''>
                                    — or pick a clue marker from {{ currentOp.name }} —
                                </option>
                                <option
                                    v-for='m in cluePointOptions'
                                    :key='m.uid'
                                    :value='m.callsign'
                                >
                                    {{ m.callsign }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label'>Authenticity</label>
                        <select
                            v-model.number='clueForm.authIndex'
                            class='form-select form-select-sm'
                        >
                            <option
                                v-for='(opt, i) in CLUE_AUTHENTICITY_OPTIONS'
                                :key='opt.label'
                                :value='i'
                            >
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='clueForm.xref'
                            label='X Reference to paperwork'
                        />
                    </div>
                </div>

                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    Relative importance of clue
                </p>
                <div class='row g-3'>
                    <div class='col-lg-7'>
                        <div class='table-responsive'>
                            <table class='table table-sm mb-0 align-middle w-auto'>
                                <tbody>
                                    <tr
                                        v-for='row in clueLetterRows'
                                        :key='row.key'
                                    >
                                        <td class='small text-muted pe-3 text-nowrap'>
                                            {{ row.label }}
                                        </td>
                                        <td>
                                            <div
                                                class='btn-group btn-group-sm'
                                                role='group'
                                            >
                                                <button
                                                    v-for='l in CLUE_LETTERS'
                                                    :key='l'
                                                    type='button'
                                                    class='btn px-2'
                                                    :class='clueForm.letters[row.key] === l
                                                        ? (l === "E" ? "btn-secondary" : "btn-primary")
                                                        : "btn-outline-secondary"'
                                                    :title='clueLetterHint(l)'
                                                    @click='clueForm.letters[row.key] = l'
                                                >
                                                    {{ l }}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class='col-lg-5'>
                        <div class='cloudtak-accent border rounded-3 p-2 h-100'>
                            <p class='text-uppercase text-white-50 small mb-1'>
                                Significance of Clue (ISM Table 8.17)
                            </p>
                            <div
                                v-for='l in CLUE_LETTERS'
                                :key='l'
                                class='small d-flex gap-2'
                            >
                                <strong style='min-width: 1rem;'>{{ l }}</strong>
                                <span :class='CLUE_SCALE[l] ? "" : "text-muted"'>
                                    {{ CLUE_SCALE[l] || '—' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class='d-flex gap-2 mt-3'>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='busy || !clueForm.description.trim()'
                        @click='onAcceptClue'
                    >
                        {{ busy ? 'Working…' : 'Accept' }}
                    </button>
                    <button
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='clueFormOpen = false'
                    >
                        Cancel
                    </button>
                </div>
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
                                <label class='form-label'>Team / Resource</label>
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
                                    label='Team / Resource'
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
                        Add Complete Search Assignment
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
                    Record Completed Assignment
                </button>

                <!-- ── Incomplete-segment split (ISM) — inline, map stays usable ── -->
                <div
                    v-if='splitPrompt'
                    class='cloudtak-accent border border-warning rounded-3 mt-3 p-3'
                >
                    <p class='text-uppercase text-warning small mb-1'>
                        Split {{ splitPrompt.label }} — only {{ splitPrompt.completedPct }}% completed
                    </p>
                    <p class='form-text mt-0 mb-2'>
                        The map stays live: edit {{ splitPrompt.label }}'s boundary on the MGMT
                        sync down to the searched portion, draw the remainder as
                        <strong>{{ splitNewName }}</strong>, then hit Refresh and select it below.
                        The searched portion keeps the POD; the remainder takes the rest of the POA.
                    </p>
                    <div class='row g-2'>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='splitRetainedPct'
                                label='POA retained in searched portion (%)'
                            />
                            <div class='form-text'>
                                Remainder gets {{ splitRemainderPct }}%.
                            </div>
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='splitNewName'
                                label='New segment name'
                            />
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label d-flex align-items-center'>
                                Remainder polygon
                                <button
                                    class='btn btn-link btn-sm p-0 ms-auto'
                                    :disabled='loadingRemainder'
                                    @click='loadRemainderCandidates'
                                >
                                    {{ loadingRemainder ? 'Loading…' : 'Refresh' }}
                                </button>
                            </label>
                            <div
                                v-if='!remainderCandidates.length'
                                class='text-muted small'
                            >
                                No unregistered polygons found yet.
                            </div>
                            <label
                                v-for='p in remainderCandidates'
                                :key='p.uid'
                                class='form-check d-flex align-items-center gap-2 mb-1'
                            >
                                <input
                                    v-model='selectedRemainderUid'
                                    type='radio'
                                    class='form-check-input'
                                    :value='p.uid'
                                >
                                <span class='form-check-label small'>
                                    {{ p.callsign }}
                                    <span class='text-muted'>· {{ formatSqMi(p.areaSqMi) }} mi² · {{ p.source }}</span>
                                </span>
                                <button
                                    class='btn btn-link btn-sm p-0 ms-auto'
                                    title='Center map on this polygon'
                                    @click.prevent='flyToCandidate(p.uid)'
                                >
                                    locate
                                </button>
                            </label>
                            <label class='form-check d-flex align-items-center gap-2 mb-1'>
                                <input
                                    v-model='selectedRemainderUid'
                                    type='radio'
                                    class='form-check-input'
                                    value=''
                                >
                                <span class='form-check-label small text-muted'>No polygon yet</span>
                            </label>
                        </div>
                    </div>
                    <div class='d-flex flex-wrap gap-2 mt-2'>
                        <button
                            class='btn btn-primary btn-sm'
                            :disabled='busy || !splitInputsValid'
                            @click='onSplitYes'
                        >
                            {{ busy ? 'Working…' : 'Split and record' }}
                        </button>
                        <button
                            class='btn btn-outline-secondary btn-sm'
                            :disabled='busy'
                            @click='onSplitNo'
                        >
                            Don't split — record partial coverage
                        </button>
                        <button
                            class='btn btn-link btn-sm'
                            :disabled='busy'
                            @click='splitPrompt = null'
                        >
                            Cancel
                        </button>
                    </div>
                </div>

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
import { addClueToMission, CLUE_AUTHENTICITY_OPTIONS } from '../../../lib/cluePersistence.ts';
import IapBuilder from './IapBuilder.vue';
import { createDebriefStore } from '../../../lib/debriefPersistence.ts';
import Subscription from '../../../../../../src/base/subscription.ts';
import { flyToFeature } from '../../../lib/flyToFeature.ts';
import { areaSqMi, formatSqMi } from '../../../lib/geometryArea.ts';
import { loadSchemaSubscription, schemaMission } from '../../../lib/incidentSubscription.ts';
import { incidentTypeKeyword, parseIncidentTypeFromRecord } from '../../../lib/incidentType.ts';
import { deletePolygonFromMission, pushPolygonToMission } from '../../../lib/missionFeatures.ts';
import { carveSegmentRemainder } from '../../../lib/segmentSplit.ts';
import {
    createAssignmentStore,
    createOpFeaturePublisher,
    createSegmentGeometrySource,
    publishIppToOp,
} from '../../../lib/opAssignmentPersistence.ts';
import { loadResourceAssignmentsFromMission } from '../../../lib/resourceAssignmentPersistence.ts';
import { isActiveResource, type ResourceAssignment } from '../../../lib/resourceAssignments.ts';
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
/**
 * Resource identifiers assigned (in the Resources screen) to the current OP,
 * excluding demobilized/cancelled resources.
 */
const opResourceOptions = computed(() => {
    const op = currentOp.value;
    if (!op) return [];
    return resources.value
        .filter((r) => r.opNumber === op.opNumber && r.resourceIdentifier.trim() && isActiveResource(r))
        .map((r) => r.resourceIdentifier.trim());
});
/** Same idea for the debrief form, but keyed to the OP selected there. */
const debriefResourceOptions = computed(() => resources.value
    .filter((r) => r.opNumber === debriefForm.opNumber && r.resourceIdentifier.trim() && isActiveResource(r))
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
            {
                incidentName: mission.name,
                channels: opChannels.value,
                keywords: mission.incidentType
                    ? [incidentTypeKeyword(mission.incidentType)]
                    : undefined,
            },
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

/** Incident category (search / wildland-fire / disaster) from mission keywords. */
async function incidentCategory(): Promise<string> {
    const mission = activeMission.value;
    if (!mission) return 'search';
    if (mission.incidentType) return mission.incidentType;
    try {
        const sub = await Subscription.load(mission.guid, {
            missiontoken: mission.missionToken ?? '',
            reload: false,
        });
        return parseIncidentTypeFromRecord(sub) || 'search';
    } catch {
        return 'search';
    }
}

/** Open the editable IAP builder for this operational period. */
const iapOp = ref<OpPeriodRegistryEntry | null>(null);
const iapCategory = ref('search');

async function onGenerateIap(op: OpPeriodRegistryEntry): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    error.value = ''; notice.value = '';
    iapCategory.value = await incidentCategory();
    iapOp.value = op;
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

// ── Influence of Clue (ISM 8.17/8.18) ──────────────────────────────────
const CLUE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
/** ISM Table 8.17 — anchor letters have text; B/D/F/H are in-between. */
const CLUE_SCALE: Record<string, string> = {
    A: 'Clue strongly suggests subject is in this segment',
    C: 'Clue suggests subject is in this segment',
    E: 'Clue suggests nothing about the subject being in or out of this segment',
    G: 'Clue suggests subject is not in this segment',
    I: 'Clue strongly suggests subject is not in this segment',
};
const clueFormOpen = ref(false);
const clueForm = reactive({
    description: '',
    authIndex: 0,
    xref: '',
    opNumber: 1,
    letters: { ROW: 'E' } as Record<string, string>,
});
const cluePointOptions = ref<{ uid: string; callsign: string }[]>([]);

/** R.O.W. first, then segments in ascending (numeric-aware) label order. */
const clueLetterRows = computed(() => [
    { key: 'ROW', label: 'R.O.W.' },
    ...segmentUids.value
        .map((uid) => ({ key: uid, label: segmentLabel(uid) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
]);

function clueLetterHint(letter: string): string {
    if (letter === 'A') return 'Clue strongly suggests subject IS in this segment';
    if (letter === 'C') return 'Clue suggests subject is in this segment';
    if (letter === 'E') return 'Clue says nothing about this segment';
    if (letter === 'G') return 'Clue suggests subject is NOT in this segment';
    if (letter === 'I') return 'Clue strongly suggests subject is NOT in this segment';
    return `Between ${String.fromCharCode(letter.charCodeAt(0) - 1)} and ${String.fromCharCode(letter.charCodeAt(0) + 1)}`;
}

function openClueForm(): void {
    const op = currentOp.value;
    if (!op) return;
    clueForm.description = '';
    clueForm.authIndex = 0;
    clueForm.xref = '';
    clueForm.opNumber = op.opNumber;
    clueForm.letters = { ROW: 'E' };
    for (const uid of segmentUids.value) clueForm.letters[uid] = 'E';
    clueFormOpen.value = true;
    void loadCluePoints();
}

/** Point markers in the current OP sync — likely field-reported clues. */
async function loadCluePoints(): Promise<void> {
    const op = currentOp.value;
    if (!op) return;
    try {
        const sub = await Subscription.load(op.guid, {
            missiontoken: op.ownerToken ?? '',
            reload: false,
        });
        const feats = await sub.feature.list({ refresh: true }) as unknown as {
            id?: string | number;
            properties?: { callsign?: string };
            geometry?: { type?: string };
        }[];
        cluePointOptions.value = feats
            .filter((f) => f.geometry?.type === 'Point' && f.properties?.callsign)
            .map((f) => ({ uid: String(f.id ?? ''), callsign: f.properties!.callsign! }));
    } catch {
        cluePointOptions.value = [];
    }
}

function onCluePointPick(event: Event): void {
    const callsign = (event.target as HTMLSelectElement).value;
    if (callsign) clueForm.description = callsign;
}

async function onAcceptClue(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !clueForm.description.trim()) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const auth = CLUE_AUTHENTICITY_OPTIONS[clueForm.authIndex];
        await addClueToMission(mission, {
            opNumber: clueForm.opNumber,
            description: clueForm.description.trim(),
            authenticity: auth.alpha,
            authenticityLabel: auth.label,
            letters: { ...clueForm.letters },
            xref: clueForm.xref.trim() || undefined,
        }, Object.fromEntries(segmentUids.value.map((uid) => [uid, segmentLabel(uid)])));
        notice.value = `Clue influence recorded: "${clueForm.description.trim()}" (${auth.label}). CASIE POAs updated.`;
        clueFormOpen.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

// ── Incomplete-segment split prompt (ISM) ──────────────────────────────
const splitPrompt = ref<{ label: string; completedPct: number } | null>(null);
const splitRetainedPct = ref('');
const splitNewName = ref('');

interface RemainderCandidate {
    uid: string;
    callsign: string;
    source: string;
    sourceGuid: string;
    sourceToken?: string;
    onMgmt: boolean;
    geometry: unknown;
    areaSqMi?: number;
    style?: { stroke?: string; fill?: string };
}

/**
 * Next segment name in numeric sequence: highest integer callsign + 1,
 * zero-padded to the prevailing width (e.g. segments 01–04 → "05").
 */
function nextSegmentName(): string {
    let max = 0;
    let width = 2;
    for (const uid of Object.keys(segments.value)) {
        const callsign = (segments.value[uid]?.callsign ?? '').trim();
        const match = /^(\d+)$/.exec(callsign);
        if (!match) continue;
        const n = Number(match[1]);
        if (n > max) {
            max = n;
            width = match[1].length;
        }
    }
    return String(max + 1).padStart(width, '0');
}

async function flyToCandidate(uid: string): Promise<void> {
    const found = await flyToFeature(uid);
    if (!found) error.value = 'Polygon is not rendered on your map — check its mission overlay is loaded.';
}
const remainderCandidates = ref<RemainderCandidate[]>([]);
const selectedRemainderUid = ref('');
const loadingRemainder = ref(false);

function polyRing(geometry: unknown): [number, number][] | null {
    const geom = geometry as { type?: string; coordinates?: unknown };
    const coords = geom?.type === 'Polygon' ? geom.coordinates
        : geom?.type === 'MultiPolygon' && Array.isArray(geom.coordinates)
            ? (geom.coordinates as unknown[])[0]
            : null;
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
    const ring: [number, number][] = [];
    for (const point of coords[0] as unknown[]) {
        if (!Array.isArray(point) || point.length < 2) return null;
        ring.push([Number(point[0]), Number(point[1])]);
    }
    return ring.length >= 4 ? ring : null;
}

function polyCentroid(ring: [number, number][]): [number, number] {
    let lon = 0; let lat = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return [lon / ring.length, lat / ring.length];
}

/** Unregistered polygons from the common map, MGMT sync, and current OP sync. */
async function loadRemainderCandidates(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    loadingRemainder.value = true;
    try {
        const registered = new Set(segmentUids.value);
        const sources: { label: string; guid: string; token?: string; onMgmt: boolean }[] = [
            { label: 'common map', guid: mission.guid, token: mission.missionToken, onMgmt: false },
            { label: 'MGMT', guid: mission.mgmt.guid, token: mission.mgmt.missionToken, onMgmt: true },
        ];
        if (currentOp.value) {
            sources.push({
                label: currentOp.value.name,
                guid: currentOp.value.guid,
                token: currentOp.value.ownerToken,
                onMgmt: false,
            });
        }
        const found: RemainderCandidate[] = [];
        const seen = new Set<string>();
        for (const source of sources) {
            try {
                const sub = await Subscription.load(source.guid, {
                    missiontoken: source.token ?? '',
                    reload: false,
                });
                const feats = await sub.feature.list({ refresh: true }) as unknown as {
                    id?: string | number;
                    properties?: { callsign?: string; stroke?: string; fill?: string };
                    geometry?: { type?: string };
                }[];
                for (const f of feats) {
                    const uid = String(f.id ?? '');
                    const type = f.geometry?.type;
                    if (!uid || seen.has(uid) || registered.has(uid)) continue;
                    if (type !== 'Polygon' && type !== 'MultiPolygon') continue;
                    seen.add(uid);
                    found.push({
                        uid,
                        callsign: f.properties?.callsign || uid,
                        source: source.label,
                        sourceGuid: source.guid,
                        sourceToken: source.token,
                        onMgmt: source.onMgmt,
                        geometry: f.geometry,
                        areaSqMi: areaSqMi(f.geometry),
                        style: { stroke: f.properties?.stroke, fill: f.properties?.fill },
                    });
                }
            } catch { /* source unreachable — skip */ }
        }
        remainderCandidates.value = found;
    } finally {
        loadingRemainder.value = false;
    }
}

// Selecting a drawn polygon adopts its callsign as the new segment name.
watch(selectedRemainderUid, (uid) => {
    const candidate = remainderCandidates.value.find((c) => c.uid === uid);
    if (candidate) splitNewName.value = candidate.callsign;
});

/**
 * Resolve the remainder segment identity: when a drawn polygon is selected it
 * is moved to the MGMT sync (segments' home) and its uid is used; otherwise a
 * fresh uid registers a polygon-less segment.
 */
async function resolveRemainder(): Promise<{ uid: string; callsign: string }> {
    const mission = activeMission.value!;
    const callsign = splitNewName.value.trim();
    const candidate = remainderCandidates.value.find((c) => c.uid === selectedRemainderUid.value);
    if (!candidate) return { uid: globalThis.crypto.randomUUID(), callsign };
    if (candidate.onMgmt) return { uid: candidate.uid, callsign };

    const ring = polyRing(candidate.geometry);
    if (!ring) return { uid: globalThis.crypto.randomUUID(), callsign };
    const planning = schemaMission(mission);
    const newUid = await pushPolygonToMission({
        missionGuid: planning.guid,
        missionToken: planning.missionToken,
        callsign,
        ring,
        center: polyCentroid(ring),
        style: candidate.style,
    });
    try {
        await deletePolygonFromMission({
            missionGuid: candidate.sourceGuid,
            uid: candidate.uid,
            missiontoken: candidate.sourceToken || undefined,
        });
    } catch { /* stale source copy is cosmetic */ }
    return { uid: newUid, callsign };
}

const splitRemainderPct = computed(() => {
    const retained = Number(splitRetainedPct.value);
    return Number.isFinite(retained) ? Math.round((100 - retained) * 100) / 100 : '—';
});
const splitInputsValid = computed(() => {
    const retained = Number(splitRetainedPct.value);
    return Number.isFinite(retained) && retained > 0 && retained < 100
        && splitNewName.value.trim().length > 0;
});

function buildDebriefRecord(): DebriefRecord {
    const record: DebriefRecord = {
        opNumber: debriefForm.opNumber,
        segmentUid: debriefForm.segmentUid,
        pod: Number(debriefForm.pod),
    };
    const coveragePct = debriefForm.coverage.trim();
    if (coveragePct) record.coverage = Number(coveragePct) / 100;
    if (debriefForm.resource.trim()) record.resource = debriefForm.resource.trim();
    if (debriefForm.notes.trim()) record.notes = debriefForm.notes.trim();
    return record;
}

async function saveDebriefRecord(record: DebriefRecord, note: string): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    await recordDebrief(createDebriefStore(mission), record);
    notice.value = note;
    debriefForm.pod = '';
    debriefForm.coverage = '';
    debriefForm.notes = '';
    debriefs.value = await createDebriefStore(mission).load();
}

async function onRecordDebrief(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;

    // Incomplete segment → ISM split prompt before recording.
    const coveragePct = Number(debriefForm.coverage.trim() || '100');
    if (Number.isFinite(coveragePct) && coveragePct > 0 && coveragePct < 100) {
        const label = segmentLabel(debriefForm.segmentUid);
        splitRetainedPct.value = String(coveragePct);
        splitNewName.value = nextSegmentName();
        selectedRemainderUid.value = '';
        splitPrompt.value = { label, completedPct: coveragePct };
        void loadRemainderCandidates();
        return;
    }

    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const record = buildDebriefRecord();
        await saveDebriefRecord(record, `Recorded POD ${record.pod}% for ${segmentLabel(record.segmentUid)}.`);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

/** Split: parent keeps retained POA + gets the POD at full coverage; remainder becomes a new segment. */
async function onSplitYes(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !splitPrompt.value) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const parentUid = debriefForm.segmentUid;
        const parentLabel = segmentLabel(parentUid);
        const remainder = await resolveRemainder();
        const newName = remainder.callsign;
        await carveSegmentRemainder(mission, parentUid, Number(splitRetainedPct.value) / 100, remainder);
        const record = buildDebriefRecord();
        delete record.coverage; // reduced segment was fully searched
        await saveDebriefRecord(
            record,
            `Split ${parentLabel} (${splitRetainedPct.value}% POA retained, remainder → ${newName}) and recorded POD ${record.pod}%.`,
        );
        splitPrompt.value = null;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

/** No split: record with partial coverage as entered (POD scaled by coverage). */
async function onSplitNo(): Promise<void> {
    if (!splitPrompt.value) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const record = buildDebriefRecord();
        await saveDebriefRecord(
            record,
            `Recorded POD ${record.pod}% over ${splitPrompt.value.completedPct}% of ${segmentLabel(record.segmentUid)}.`,
        );
        splitPrompt.value = null;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

onMounted(refresh);
watch(() => activeMission.value?.guid, refresh);
</script>
