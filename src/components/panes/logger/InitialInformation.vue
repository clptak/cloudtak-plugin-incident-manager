<template>
    <div class='row g-3'>
        <div class='col-lg-8'>
            <!-- Incident Information -->
            <div class='card mb-3'>
                <div class='card-header'>
                    <h3 class='card-title mb-0'>
                        Incident Information
                    </h3>
                </div>
                <div class='card-body'>
                    <div class='row g-3'>
                        <div class='col-md-6'>
                            <label class='form-label'>Incident Name</label>
                            <input
                                v-model='incidentForm.incidentName'
                                type='text'
                                class='form-control form-control-sm'
                                placeholder='e.g. Smith Search'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>Activity Number</label>
                            <input
                                v-model='incidentForm.eventId'
                                type='text'
                                class='form-control form-control-sm'
                                placeholder='e.g. A22012345'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>Department Report Number</label>
                            <input
                                v-model='incidentForm.incidentId'
                                type='text'
                                class='form-control form-control-sm'
                                placeholder='e.g. S2201234'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>DEMA Mission Number</label>
                            <input
                                v-model='incidentForm.demaMission'
                                type='text'
                                class='form-control form-control-sm'
                                :class='{ "is-invalid": demaInvalid }'
                                placeholder='e.g. 2025-12345'
                            >
                            <div
                                v-if='demaInvalid'
                                class='invalid-feedback d-block'
                            >
                                Format: 20YY-NNNNN (e.g. 2025-12345)
                            </div>
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>IC Coordinator&apos;s Name</label>
                            <input
                                v-model='incidentForm.icCoordinator'
                                type='text'
                                class='form-control form-control-sm'
                                placeholder='Coordinator name'
                            >
                            <div class='form-text'>
                                Will be populated from your TAK Portal user (future).
                            </div>
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>Incident Conclusion Time</label>
                            <input
                                v-model='incidentForm.incidentConclusionTime'
                                type='datetime-local'
                                class='form-control form-control-sm'
                            >
                        </div>
                    </div>

                    <button
                        class='btn btn-primary btn-sm mt-3'
                        :disabled='!activeMission || savingIncident || demaInvalid'
                        @click='saveIncidentInfo'
                    >
                        {{ savingIncident ? 'Saving…' : 'Save to DataSync' }}
                    </button>
                </div>
            </div>

            <!-- CFS / Call Notes -->
            <div class='card'>
                <div class='card-header'>
                    <h3 class='card-title mb-0'>
                        CFS / Call Notes
                    </h3>
                </div>
                <div class='card-body'>
                    <label class='form-label mb-1'>Paste full CFS text (header + Remarks section)</label>
                    <textarea
                        v-model='cadText'
                        class='form-control'
                        rows='10'
                        placeholder='Paste the full MPS Call Notes here — include the Remarks section with timestamped log entries.'
                    />

                    <div class='mt-3 d-flex flex-wrap gap-2'>
                        <button
                            class='btn btn-primary'
                            @click='parse'
                        >
                            Parse &amp; Build
                        </button>
                        <button
                            class='btn btn-success'
                            :disabled='!selectedCount || !activeMission || posting'
                            @click='postLogs'
                        >
                            {{ posting ? 'Posting…' : `Post ${selectedCount} entr${selectedCount === 1 ? "y" : "ies"} to DataSync` }}
                        </button>
                    </div>

                    <div
                        v-if='!activeMission'
                        class='form-text text-warning mt-2'
                    >
                        No active mission. Select one in Create | Open first.
                    </div>
                    <div
                        v-else
                        class='form-text mt-2'
                    >
                        Active DataSync: <strong>{{ activeMission.name }}</strong>
                    </div>

                    <div
                        v-if='status'
                        class='mt-2 fw-bold'
                        :class='statusError ? "text-danger" : "text-success"'
                    >
                        {{ status }}
                    </div>
                </div>
            </div>
        </div>

        <div class='col-lg-4'>
            <div class='card'>
                <div class='card-header py-2 d-flex align-items-center justify-content-between'>
                    <h3 class='card-title mb-0'>
                        Parsed Entries ({{ selectedCount }}/{{ rows.length }})
                    </h3>
                    <button
                        v-if='rows.length'
                        type='button'
                        class='btn btn-sm btn-link p-0'
                        @click='toggleAll'
                    >
                        {{ allSelected ? 'Deselect all' : 'Select all' }}
                    </button>
                </div>
                <div
                    class='card-body py-2'
                    style='max-height: 360px; overflow:auto;'
                >
                    <div
                        v-if='parsedActivityNumber || parsedReportNumber'
                        class='small text-muted mb-2'
                    >
                        <div v-if='parsedActivityNumber'>
                            Activity: <code>{{ parsedActivityNumber }}</code>
                        </div>
                        <div v-if='parsedReportNumber'>
                            Report: <code>{{ parsedReportNumber }}</code>
                        </div>
                    </div>
                    <div
                        v-if='!rows.length'
                        class='text-muted small'
                    >
                        No entries parsed yet.
                    </div>
                    <label
                        v-for='(r, i) in rows'
                        :key='i'
                        class='border-bottom py-1 small d-flex gap-2'
                        style='cursor: pointer;'
                    >
                        <input
                            v-model='selected[i]'
                            type='checkbox'
                            class='form-check-input mt-1 flex-shrink-0'
                        >
                        <span>
                            <span class='text-muted'>{{ r.dtg }} · {{ r.uid }}</span>
                            <br>
                            {{ r.remark }}
                            <span
                                v-if='r.lat !== "" && r.lon !== ""'
                                class='text-azure d-block'
                            >
                                {{ r.lat }}, {{ r.lon }}
                            </span>
                        </span>
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, reactive, watch, onMounted } from 'vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { getMpsRows } from '../../../lib/mpsParser.ts';
import type { MpsRow } from '../../../lib/mpsParser.ts';
import {
    applyParsedCadToForm,
    blankIncidentInfoForm,
    buildIncidentInfoContent,
    buildIncidentInfoKeywords,
    isValidDemaMission,
    latestIncidentInfoFromLogs,
    suggestIncidentName,
    type IncidentInfoForm,
} from '../../../lib/incidentInfo.ts';
import { SUBJECT_KEYWORD, kwValue } from '../../../lib/subjectInfo.ts';
import {
    applyCadIdsToSchema,
    applyIncidentFormToSchema,
    applyMissionContextToSchema,
    appendMpsRowsToSchema,
    incidentFormFromSchema,
    loadMissionSchema,
    replaceMpsRowsInSchema,
    saveMissionSchema,
    type MissionSchema,
} from '../../../lib/missionSchema.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

const incidentForm = reactive<IncidentInfoForm>(blankIncidentInfoForm());
const missionSchema = ref<MissionSchema | null>(null);
const schemaLogId = ref<string | undefined>();
const savingIncident = ref(false);
const loadingIncident = ref(false);

const cadText = ref('');
const rows = ref<MpsRow[]>([]);
const selected = ref<boolean[]>([]);
const parsedActivityNumber = ref<string | null>(null);
const parsedReportNumber = ref<string | null>(null);
const posting = ref(false);
const status = ref('');
const statusError = ref(false);

const demaInvalid = computed(
    () => !isValidDemaMission(incidentForm.demaMission),
);

const selectedCount = computed(() => selected.value.filter(Boolean).length);
const allSelected = computed(
    () => rows.value.length > 0 && selectedCount.value === rows.value.length,
);

function toggleAll(): void {
    const next = !allSelected.value;
    selected.value = rows.value.map(() => next);
}

function applySubjectNameSuggestion(logs: { keywords?: string[] }[]): void {
    if (incidentForm.incidentName.trim()) return;
    const names: string[] = [];
    for (const log of logs) {
        if (!log.keywords?.includes(SUBJECT_KEYWORD)) continue;
        const name = kwValue(log.keywords, 'name:');
        if (name) names.push(name);
    }
    const suggested = suggestIncidentName(names);
    if (suggested) incidentForm.incidentName = suggested;
}

async function loadIncidentInfo(): Promise<void> {
    if (!activeMission.value) {
        Object.assign(incidentForm, blankIncidentInfoForm());
        incidentForm.logId = undefined;
        missionSchema.value = null;
        schemaLogId.value = undefined;
        return;
    }
    loadingIncident.value = true;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const logs = await sub.log.list({ refresh: true });
        const loaded = await loadMissionSchema(sub);
        missionSchema.value = loaded.schema;
        schemaLogId.value = loaded.logId;
        applyMissionContextToSchema(loaded.schema, activeMission.value.name);

        const saved = latestIncidentInfoFromLogs(logs);
        if (schemaLogId.value) {
            Object.assign(incidentForm, incidentFormFromSchema(loaded.schema));
            incidentForm.logId = saved?.logId;
            if (!incidentForm.incidentName.trim()) applySubjectNameSuggestion(logs);
        } else if (saved) {
            Object.assign(incidentForm, saved.fields);
            incidentForm.logId = saved.logId;
        } else {
            Object.assign(incidentForm, blankIncidentInfoForm());
            incidentForm.logId = undefined;
            applySubjectNameSuggestion(logs);
        }
    } catch {
        Object.assign(incidentForm, blankIncidentInfoForm());
        incidentForm.logId = undefined;
        missionSchema.value = null;
        schemaLogId.value = undefined;
    } finally {
        loadingIncident.value = false;
    }
}

async function saveIncidentInfo(): Promise<void> {
    if (!activeMission.value || demaInvalid.value) return;
    savingIncident.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const schema = missionSchema.value ?? (await loadMissionSchema(sub)).schema;
        applyIncidentFormToSchema(incidentForm, schema);
        applyMissionContextToSchema(schema, activeMission.value.name);
        schemaLogId.value = await saveMissionSchema(sub, schema, schemaLogId.value);
        missionSchema.value = schema;

        const body = {
            dtg: new Date().toISOString(),
            content: buildIncidentInfoContent(incidentForm),
            keywords: buildIncidentInfoKeywords(incidentForm),
        };
        if (incidentForm.logId) {
            await sub.log.update(incidentForm.logId, body);
        } else {
            const created = await sub.log.create(body);
            incidentForm.logId = String(created.id);
        }
        status.value = `Saved incident information and mission schema to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingIncident.value = false;
    }
}

async function syncSchemaFromForm(
    parsed?: { activityNumber: string | null; reportNumber: string | null },
    parsedRows?: MpsRow[],
): Promise<void> {
    if (!activeMission.value) return;
    const sub = await Subscription.load(activeMission.value.guid, {
        token: activeMission.value.token ?? '',
    });
    const schema = missionSchema.value ?? (await loadMissionSchema(sub)).schema;
    applyIncidentFormToSchema(incidentForm, schema);
    if (parsed) applyCadIdsToSchema(schema, parsed);
    if (parsedRows?.length) {
        replaceMpsRowsInSchema(schema, parsedRows, activeMission.value.name);
    }
    applyMissionContextToSchema(schema, activeMission.value.name);
    schemaLogId.value = await saveMissionSchema(sub, schema, schemaLogId.value);
    missionSchema.value = schema;
}

function parse(): void {
    status.value = '';
    statusError.value = false;
    const res = getMpsRows(cadText.value);
    rows.value = res.rows;
    selected.value = res.rows.map(() => true);
    parsedActivityNumber.value = res.activityNumber;
    parsedReportNumber.value = res.reportNumber;
    applyParsedCadToForm(incidentForm, {
        activityNumber: res.activityNumber,
        reportNumber: res.reportNumber,
    });
    void syncSchemaFromForm({
        activityNumber: res.activityNumber,
        reportNumber: res.reportNumber,
    }, res.rows).then(() => {
        if (!rows.value.length) {
            statusError.value = true;
            status.value = res.activityNumber || res.reportNumber
                ? 'Parsed activity/report numbers and updated mission schema; no timestamped Remarks entries found.'
                : 'No timestamped Remarks entries found in the pasted text.';
        } else {
            status.value = 'Parsed call notes and updated mission schema.';
        }
    }).catch((err) => {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    });
}

function toDtg(raw: string): string | undefined {
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

async function postLogs(): Promise<void> {
    if (!activeMission.value) return;
    posting.value = true;
    status.value = '';
    statusError.value = false;

    let ok = 0;
    let failed = 0;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });

        const toPost = rows.value.filter((_, i) => selected.value[i]);
        for (const r of toPost) {
            const coords = (r.lat !== '' && r.lon !== '') ? ` [${r.lat}, ${r.lon}]` : '';
            const keywords = ['source:CAD'];
            if (r.uid) keywords.push(`uid:${r.uid}`);
            try {
                await sub.log.create({
                    dtg: toDtg(r.dtg),
                    content: `${r.remark}${coords}`,
                    keywords,
                });
                ok++;
            } catch {
                failed++;
            }
        }

        statusError.value = failed > 0;
        status.value = `Posted ${ok} log${ok === 1 ? '' : 's'} to ${activeMission.value.name}`
            + (failed ? `, ${failed} failed.` : '.');

        if (ok > 0 && !rows.value.length) {
            const schema = missionSchema.value ?? (await loadMissionSchema(sub)).schema;
            appendMpsRowsToSchema(schema, toPost, activeMission.value.name);
            applyIncidentFormToSchema(incidentForm, schema);
            applyMissionContextToSchema(schema, activeMission.value.name);
            schemaLogId.value = await saveMissionSchema(sub, schema, schemaLogId.value);
            missionSchema.value = schema;
            status.value += ' Mission schema updated.';
        }
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}

onMounted(() => { void loadIncidentInfo(); });
watch(() => activeMission.value?.guid, () => { void loadIncidentInfo(); });
</script>
