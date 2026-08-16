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
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.dateFrom'
                            label='Date From'
                            placeholder='MM/DD/YYYY'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.timeFrom'
                            label='Time From'
                            placeholder='0800'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.dateTo'
                            label='Date To'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='plan.timeTo'
                            label='Time To'
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
                        <div class='col-12'>
                            <TablerInput
                                v-model='a.specialInstructions'
                                label='Special Instructions'
                            />
                        </div>
                    </div>

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
                    <div class='col-md-9'>
                        <TablerInput
                            v-model='plan.uas.briefingLocation'
                            label='Briefing Location'
                        />
                    </div>
                </div>
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
    blankCommsRow,
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
