<template>
    <div>
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

        <div
            v-if='loading'
            class='text-muted small'
        >
            Loading IAP…
        </div>

        <template v-else-if='plan'>
            <div class='d-flex flex-wrap align-items-center gap-2 mb-3'>
                <h4 class='mb-0'>
                    IAP — OP{{ plan.opNumber }}
                </h4>
                <span class='text-muted small'>{{ formsLabel }}</span>
                <label class='form-check mb-0 ms-2'>
                    <input
                        v-model='plan.includeForms.ics207'
                        type='checkbox'
                        class='form-check-input'
                    >
                    <span class='form-check-label small'>207</span>
                </label>
                <label class='form-check mb-0'>
                    <input
                        v-model='plan.includeForms.ics209'
                        type='checkbox'
                        class='form-check-input'
                    >
                    <span class='form-check-label small'>209</span>
                </label>
                <div class='ms-auto d-flex gap-2'>
                    <button
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='onReprefill'
                    >
                        Re-pull from incident
                    </button>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='busy'
                        @click='onSave'
                    >
                        {{ busy ? 'Saving…' : 'Save' }}
                    </button>
                    <button
                        class='btn btn-success btn-sm'
                        :disabled='busy'
                        @click='onGenerate'
                    >
                        Generate PDF
                    </button>
                    <button
                        class='btn btn-link btn-sm'
                        @click='emit("close")'
                    >
                        Close
                    </button>
                </div>
            </div>

            <!-- Header / 202 -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 202 — Objectives &amp; Header
                    </p>
                </template>

                <div class='row g-2'>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='opFrom'
                            label='Operational Period — From'
                            type='datetime-local'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='opTo'
                            label='Operational Period — To'
                            type='datetime-local'
                        />
                    </div>
                </div>

                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    Objectives
                </p>
                <div
                    v-for='(_, i) in plan.objectives'
                    :key='`obj-${i}`'
                    class='d-flex gap-2 mb-1'
                >
                    <span class='text-muted small pt-2'>{{ i + 1 }}</span>
                    <div class='flex-grow-1'>
                        <TablerInput v-model='plan.objectives[i]' />
                    </div>
                    <button
                        class='btn btn-outline-danger btn-sm'
                        @click='plan.objectives.splice(i, 1)'
                    >
                        ×
                    </button>
                </div>
                <button
                    class='btn btn-outline-primary btn-sm mt-1'
                    @click='plan.objectives.push("")'
                >
                    + Objective
                </button>

                <div class='row g-2 mt-2'>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='plan.commandEmphasis'
                            label='Command Emphasis'
                            :rows='3'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='plan.situationalAwareness'
                            label='General Situational Awareness'
                            :rows='3'
                        />
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label'>Site Safety Plan Required</label>
                        <select
                            v-model='plan.siteSafetyRequired'
                            class='form-select form-select-sm'
                        >
                            <option value='' />
                            <option value='yes'>
                                Yes
                            </option>
                            <option value='no'>
                                No
                            </option>
                        </select>
                    </div>
                    <div class='col-md-9'>
                        <TablerInput
                            v-model='plan.siteSafetyLocation'
                            label='Site Safety Plan Location'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='plan.preparedBy'
                            label='Prepared By'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='plan.preparedByPosition'
                            label='Position / Title'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='plan.approvedBy'
                            label='Approved By (IC)'
                        />
                    </div>
                </div>
            </TablerBorder>

            <!-- 203 organization -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 203 / 207 — Organization
                    </p>
                </template>
                <div class='row g-2'>
                    <div
                        v-for='row in orgFields'
                        :key='row.key'
                        class='col-md-4'
                    >
                        <TablerInput
                            v-model='plan.org[row.key]'
                            :label='row.label'
                        />
                    </div>
                </div>

                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    Divisions / Groups
                </p>
                <p class='form-text mt-0'>
                    These become the Division/Group rows on ICS-203, and each assignment
                    picks one to fill §3 of its ICS-204.
                </p>
                <div
                    v-for='(d, i) in plan.divisions'
                    :key='d.id'
                    class='row g-2 mb-1'
                >
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='d.name'
                            :label='i === 0 ? "Division / Group" : undefined'
                        />
                    </div>
                    <div class='col-md-7'>
                        <TablerInput
                            v-model='d.supervisor'
                            :label='i === 0 ? "Supervisor" : undefined'
                        />
                    </div>
                    <div class='col-md-2 d-flex align-items-end'>
                        <button
                            class='btn btn-outline-danger btn-sm'
                            @click='plan.divisions.splice(i, 1)'
                        >
                            Remove
                        </button>
                    </div>
                </div>
                <button
                    class='btn btn-outline-primary btn-sm mt-1'
                    @click='plan.divisions.push(blankDivision(plan.divisions.length))'
                >
                    + Division
                </button>
            </TablerBorder>

            <!-- 204 assignments -->
            <TablerBorder
                v-if='plan.assignments.length'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 204 — Assignments ({{ plan.assignments.length }})
                    </p>
                </template>

                <div
                    v-for='(a, ai) in plan.assignments'
                    :key='a.segmentUid'
                    class='cloudtak-accent border rounded-3 mb-2 p-2'
                >
                    <div class='row g-2'>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='a.label'
                                label='Division / Segment'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='a.supervisor'
                                label='Supervisor / Team'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='a.workAssignment'
                                label='Work Assignment'
                            />
                        </div>
                        <div class='col-md-3'>
                            <label class='form-label'>Division / Group</label>
                            <select
                                v-model='a.divisionId'
                                class='form-select form-select-sm'
                            >
                                <option value='' />
                                <option
                                    v-for='d in plan.divisions'
                                    :key='d.id'
                                    :value='d.id'
                                >
                                    {{ d.name }}{{ d.supervisor ? ` — ${d.supervisor}` : '' }}
                                </option>
                            </select>
                        </div>
                        <div class='col-12'>
                            <TablerInput
                                v-model='a.specialInstructions'
                                label='Special Instructions'
                            />
                        </div>
                    </div>

                    <p class='text-uppercase text-white-50 small mb-1 mt-2'>
                        §8 Communications — Name / Function &amp; Contact
                    </p>
                    <div
                        v-for='(c, ci) in a.contacts'
                        :key='`ct-${ai}-${ci}`'
                        class='row g-1 mb-1'
                    >
                        <div class='col-md-5'>
                            <TablerInput
                                v-model='c.nameFunction'
                                :label='ci === 0 ? "Name / Function" : undefined'
                                placeholder='e.g. Team 3 Leader — J. Smith'
                            />
                        </div>
                        <div class='col-md-5'>
                            <TablerInput
                                v-model='c.contact'
                                :label='ci === 0 ? "Primary Contact (cell / radio)" : undefined'
                            />
                        </div>
                        <div class='col-md-2 d-flex align-items-end'>
                            <button
                                class='btn btn-outline-danger btn-sm'
                                @click='a.contacts.splice(ci, 1)'
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <button
                        class='btn btn-outline-primary btn-sm mb-2'
                        :disabled='a.contacts.length >= 4'
                        @click='a.contacts.push(blankContactRow())'
                    >
                        + Contact
                    </button>
                    <p
                        v-if='a.contacts.length >= 4'
                        class='form-text mt-0'
                    >
                        ICS-204 §8 holds four rows.
                    </p>

                    <p class='text-uppercase text-white-50 small mb-1 mt-2'>
                        Resources
                    </p>
                    <div
                        v-for='(r, ri) in a.resources'
                        :key='`res-${ai}-${ri}`'
                        class='row g-1 mb-1'
                    >
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='r.identifier'
                                :label='ri === 0 ? "Identifier" : undefined'
                            />
                        </div>
                        <div class='col-md-2'>
                            <TablerInput
                                v-model='r.leader'
                                :label='ri === 0 ? "Leader" : undefined'
                            />
                        </div>
                        <div class='col-md-1'>
                            <TablerInput
                                v-model='r.persons'
                                :label='ri === 0 ? "#" : undefined'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='r.contact'
                                :label='ri === 0 ? "Contact" : undefined'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='r.reporting'
                                :label='ri === 0 ? "Reporting location / notes" : undefined'
                            />
                        </div>
                    </div>
                    <button
                        class='btn btn-outline-primary btn-sm'
                        @click='a.resources.push({ identifier: "", leader: "", persons: "", contact: "", reporting: "" })'
                    >
                        + Resource
                    </button>
                </div>
            </TablerBorder>

            <!-- 205 comms -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 205 — Communications Plan
                    </p>
                </template>
                <p class='form-text mt-0'>
                    Carried forward from the previous operational period when available.
                    The official form holds 8 channel rows.
                </p>
                <div class='table-responsive'>
                    <table class='table table-sm small mb-0'>
                        <thead>
                            <tr>
                                <th>Zone/Grp</th><th>Ch</th><th>Function</th><th>Channel Name</th>
                                <th>Assignment</th><th>RX Freq</th><th>RX Tone</th>
                                <th>TX Freq</th><th>TX Tone</th><th>Mode</th><th>Remarks</th><th />
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='(c, i) in plan.comms'
                                :key='`c-${i}`'
                            >
                                <td><TablerInput v-model='c.zone' /></td>
                                <td><TablerInput v-model='c.ch' /></td>
                                <td><TablerInput v-model='c.func' /></td>
                                <td><TablerInput v-model='c.channelName' /></td>
                                <td><TablerInput v-model='c.assignment' /></td>
                                <td><TablerInput v-model='c.rxFreq' /></td>
                                <td><TablerInput v-model='c.rxTone' /></td>
                                <td><TablerInput v-model='c.txFreq' /></td>
                                <td><TablerInput v-model='c.txTone' /></td>
                                <td><TablerInput v-model='c.mode' /></td>
                                <td><TablerInput v-model='c.remarks' /></td>
                                <td>
                                    <button
                                        class='btn btn-outline-danger btn-sm'
                                        @click='plan.comms.splice(i, 1)'
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <button
                    class='btn btn-outline-primary btn-sm mt-2'
                    :disabled='plan.comms.length >= 8'
                    @click='plan.comms.push(blankCommsRow())'
                >
                    + Channel
                </button>
                <div class='row g-2 mt-1'>
                    <div class='col-md-8'>
                        <TablerInput
                            v-model='plan.commsSpecialInstructions'
                            label='Special Instructions (ICS-205 §5)'
                            :rows='2'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='plan.preparers.ics205'
                            label='Prepared by — Comms Unit Leader'
                            :placeholder='plan.preparedBy'
                        />
                    </div>
                </div>
            </TablerBorder>

            <!-- 205A communications list -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 205A — Communications List
                    </p>
                </template>
                <label class='form-check d-flex align-items-center gap-2 mb-2'>
                    <input
                        v-model='plan.includeForms.ics205a'
                        type='checkbox'
                        class='form-check-input'
                    >
                    <span class='form-check-label'>Include ICS 205A in this IAP</span>
                </label>
                <template v-if='plan.includeForms.ics205a'>
                    <p class='form-text mt-0'>
                        Who is on the incident and how to reach them — seeded from the
                        command staff, carried forward between operational periods.
                        The official form holds 34 rows.
                    </p>
                    <div
                        v-for='(row, i) in plan.commsList'
                        :key='`cl-${i}`'
                        class='row g-1 mb-1'
                    >
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='row.position'
                                :label='i === 0 ? "Incident Assigned Position" : undefined'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='row.name'
                                :label='i === 0 ? "Name" : undefined'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='row.contact'
                                :label='i === 0 ? "Method(s) of Contact" : undefined'
                            />
                        </div>
                        <div class='col-md-1 d-flex align-items-end'>
                            <button
                                class='btn btn-outline-danger btn-sm'
                                @click='plan.commsList.splice(i, 1)'
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div class='d-flex gap-2 mt-2'>
                        <button
                            class='btn btn-outline-primary btn-sm'
                            :disabled='plan.commsList.length >= 34'
                            @click='plan.commsList.push(blankCommsListRow())'
                        >
                            + Contact
                        </button>
                        <button
                            class='btn btn-outline-secondary btn-sm'
                            @click='addAssignmentContacts'
                        >
                            Add assignment contacts
                        </button>
                    </div>
                </template>
            </TablerBorder>

            <!-- 206 medical + 208 safety -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 206 Medical &amp; ICS 208 Safety
                    </p>
                </template>
                <div class='row g-2'>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='plan.medical.aidStations'
                            label='Medical Aid Stations'
                            :rows='2'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='plan.medical.transportation'
                            label='Transportation / Ambulance'
                            :rows='2'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='plan.medical.hospitals'
                            label='Hospitals'
                            :rows='2'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='plan.medical.emergencyProcedures'
                            label='Special Medical Emergency Procedures'
                            :rows='2'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='plan.preparers.ics206'
                            label='Prepared by — Medical Unit Leader'
                            :placeholder='plan.preparedBy'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='plan.safetyMessage'
                            label='Safety Message (ICS 208)'
                            :rows='4'
                        />
                    </div>
                </div>
                <p class='form-text mb-0'>
                    ICS 206 is included in the IAP only when the medical plan has content.
                </p>
            </TablerBorder>

            <!-- 220 UAS -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        ICS 220 — UAS Operations
                    </p>
                </template>
                <label class='form-check d-flex align-items-center gap-2 mb-2'>
                    <input
                        v-model='plan.uas.include'
                        type='checkbox'
                        class='form-check-input'
                    >
                    <span class='form-check-label'>
                        Include ICS 220 in this IAP
                        <span
                            v-if='hasUas'
                            class='text-muted'
                        >(a UAS resource is assigned to this OP)</span>
                    </span>
                </label>
                <div
                    v-if='plan.uas.include'
                    class='row g-2'
                >
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.uas.sunrise'
                            label='Sunrise'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.uas.sunset'
                            label='Sunset'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.uas.tfrAltitude'
                            label='TFR Altitude'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.uas.tfrCenter'
                            label='TFR Center Point'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.uas.briefingTime'
                            label='Briefing Time'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='plan.preparers.ics220'
                            label='Prepared by — Air Ops'
                            :placeholder='plan.preparedBy'
                        />
                    </div>
                    <div class='col-md-9'>
                        <TablerInput
                            v-model='plan.uas.briefingLocation'
                            label='Briefing Location'
                        />
                    </div>
                </div>

                <template v-if='plan.uas.include'>
                    <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                        §10 Aircraft
                    </p>
                    <p class='form-text mt-0'>
                        Five per page — additional aircraft continue on repeat ICS-220 pages
                        appended to the IAP.
                    </p>
                    <div class='table-responsive'>
                        <table class='table table-sm small mb-0'>
                            <thead>
                                <tr>
                                    <th>FAA N# / ID</th><th>Category/Kind/Type</th><th>Make/Model</th>
                                    <th>Base / Owner</th><th>Available</th><th>Start</th>
                                    <th>Remarks</th><th />
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for='(ac, i) in plan.uas.aircraft'
                                    :key='`ac-${i}`'
                                >
                                    <td><TablerInput v-model='ac.faaId' /></td>
                                    <td><TablerInput v-model='ac.category' /></td>
                                    <td><TablerInput v-model='ac.makeModel' /></td>
                                    <td><TablerInput v-model='ac.baseOwner' /></td>
                                    <td><TablerInput v-model='ac.available' /></td>
                                    <td><TablerInput v-model='ac.start' /></td>
                                    <td><TablerInput v-model='ac.remarks' /></td>
                                    <td>
                                        <button
                                            class='btn btn-outline-danger btn-sm'
                                            @click='plan.uas.aircraft.splice(i, 1)'
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <button
                        class='btn btn-outline-primary btn-sm mt-2'
                        @click='plan.uas.aircraft.push(blankAircraftRow())'
                    >
                        + Aircraft
                    </button>
                    <span
                        v-if='plan.uas.aircraft.length > 5'
                        class='form-text ms-2'
                    >
                        {{ Math.ceil(plan.uas.aircraft.length / 5) }} ICS-220 pages will be generated.
                    </span>
                </template>
            </TablerBorder>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import { TablerBorder, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import { useIncident } from '../../../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../../../domain/entities.ts';
import {
    buildIapSections,
    iapFormPlanFor,
    loadIapInputs,
    type IapContext,
} from '../../../lib/iapData.ts';
import { buildIapPdf, saveIapPdf } from '../../../lib/iapPdf.ts';
import {
    blankAircraftRow,
    blankCommsListRow,
    blankCommsRow,
    blankContactRow,
    blankDivision,
    loadIapPlan,
    loadPreviousIapPlan,
    prefillIapPlan,
    saveIapPlan,
    type IapPlan,
} from '../../../lib/iapPlanPersistence.ts';

const props = defineProps<{
    op: OpPeriodRegistryEntry;
    registry: OpPeriodRegistryEntry[];
    category: string;
}>();

const emit = defineEmits<{ close: [] }>();

const { activeMission } = useIncident();

const plan = ref<IapPlan | null>(null);
const ctx = ref<IapContext>({ incidentName: '', incidentNumber: '', category: props.category });
const hasUas = ref(false);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');

/** ICS forms print MM/DD/YYYY + HHMM; the UI edits one datetime-local value. */
function toLocalInput(date: string, time: string): string {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
    if (!m) return '';
    const hhmm = time.trim().padStart(4, '0');
    return `${m[3]}-${m[1]}-${m[2]}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

function fromLocalInput(value: string): { date: string; time: string } {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!m) return { date: '', time: '' };
    return { date: `${m[2]}/${m[3]}/${m[1]}`, time: `${m[4]}${m[5]}` };
}

const opFrom = computed({
    get: () => (plan.value ? toLocalInput(plan.value.dateFrom, plan.value.timeFrom) : ''),
    set: (value: string) => {
        if (!plan.value) return;
        const { date, time } = fromLocalInput(value);
        plan.value.dateFrom = date;
        plan.value.timeFrom = time;
    },
});

const opTo = computed({
    get: () => (plan.value ? toLocalInput(plan.value.dateTo, plan.value.timeTo) : ''),
    set: (value: string) => {
        if (!plan.value) return;
        const { date, time } = fromLocalInput(value);
        plan.value.dateTo = date;
        plan.value.timeTo = time;
    },
});

const orgFields = [
    { key: 'incidentCommander', label: 'Incident Commander' },
    { key: 'deputy', label: 'Deputy' },
    { key: 'safetyOfficer', label: 'Safety Officer' },
    { key: 'publicInformationOfficer', label: 'Public Information Officer' },
    { key: 'liaisonOfficer', label: 'Liaison Officer' },
    { key: 'operationsChief', label: 'Operations Section Chief' },
    { key: 'planningChief', label: 'Planning Section Chief' },
    { key: 'logisticsChief', label: 'Logistics Section Chief' },
    { key: 'financeChief', label: 'Finance / Admin Chief' },
] as const;

const formsLabel = computed(() => {
    if (!plan.value) return '';
    return iapFormPlanFor(plan.value, ctx.value, hasUas.value)
        .map((id) => id.replace('ics', 'ICS-').toUpperCase().replace('ICS-220', 'ICS-220 UAS'))
        .join(' · ');
});

async function load(prefer: 'saved' | 'prefill' = 'saved'): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    loading.value = true;
    error.value = '';
    try {
        const inputs = await loadIapInputs(mission, props.op, { category: props.category });
        ctx.value = {
            incidentName: inputs.incidentName,
            incidentNumber: inputs.incidentNumber,
            category: props.category,
        };
        hasUas.value = inputs.hasUas;

        const saved = prefer === 'saved' ? await loadIapPlan(mission, props.op.opNumber) : null;
        if (saved) {
            plan.value = saved;
        } else {
            const previous = await loadPreviousIapPlan(mission, props.op.opNumber, props.registry);
            plan.value = prefillIapPlan(inputs, previous);
            notice.value = previous
                ? `Prefilled from incident data and OP${previous.opNumber}'s plan — review before generating.`
                : 'Prefilled from incident data — review and fill in comms, medical, and safety.';
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

/** Pull each assignment's contact into the 205A list (skipping duplicates). */
function addAssignmentContacts(): void {
    if (!plan.value) return;
    for (const a of plan.value.assignments) {
        for (const c of a.contacts) {
            const name = c.nameFunction.trim();
            if (!name) continue;
            if (plan.value.commsList.some((r) => r.name.trim() === name)) continue;
            plan.value.commsList.push({
                position: a.label,
                name,
                contact: c.contact,
            });
        }
    }
}

async function onSave(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !plan.value) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        await saveIapPlan(mission, plan.value);
        notice.value = `Saved IAP for OP${plan.value.opNumber}.`;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

/** Discard edits and rebuild from current incident data. */
async function onReprefill(): Promise<void> {
    if (!window.confirm('Replace this IAP with fresh data from the incident? Unsaved edits are lost.')) return;
    await load('prefill');
}

async function onGenerate(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !plan.value) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        await saveIapPlan(mission, plan.value);
        const bytes = await buildIapPdf(buildIapSections(plan.value, ctx.value, hasUas.value));
        const safe = `${ctx.value.incidentName}-OP${plan.value.opNumber}-IAP`.replace(/[^\w.-]+/g, '_');
        const where = await saveIapPdf(bytes, `${safe}.pdf`, ctx.value.incidentName);
        notice.value = `${where} (${formsLabel.value})`;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

onMounted(() => void load('saved'));
</script>
