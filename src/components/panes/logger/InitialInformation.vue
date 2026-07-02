<template>
    <div>
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
                    <div class='col-md-8'>
                        <label class='form-label'>Assignment</label>
                        <textarea
                            v-model='incidentForm.assignmentText'
                            class='form-control form-control-sm'
                            rows='3'
                            placeholder='Assignment details'
                        />
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label'>Assignment Date/Time</label>
                        <input
                            v-model='incidentForm.assignmentDateTime'
                            type='datetime-local'
                            class='form-control form-control-sm'
                        >
                    </div>
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
                    v-if='demaInvalid'
                    class='form-text text-warning mt-2'
                >
                    Fix the DEMA mission number format before saving.
                </div>

                <button
                    class='btn btn-primary btn-sm mt-3'
                    :disabled='!activeMission || savingIncident || demaInvalid'
                    @click='saveIncidentInfo'
                >
                    {{ savingIncident ? 'Saving…' : 'Save to DataSync' }}
                </button>

                <div
                    v-if='incidentStatus'
                    class='mt-2 fw-bold'
                    :class='incidentStatusError ? "text-danger" : "text-success"'
                >
                    {{ incidentStatus }}
                </div>
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

                <div class='mt-3'>
                    <button
                        class='btn btn-primary'
                        @click='parse'
                    >
                        Parse &amp; Build
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

        <div
            v-if='showParsedModal'
            class='modal modal-blur show d-block'
            tabindex='-1'
            role='dialog'
            @click.self='closeParsedModal'
        >
            <div
                class='modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable'
                role='document'
            >
                <div class='modal-content'>
                    <div class='modal-header'>
                        <h5 class='modal-title'>
                            Parsed Information ({{ selectedCount }}/{{ rows.length }})
                        </h5>
                        <button
                            type='button'
                            class='btn-close'
                            aria-label='Close'
                            @click='closeParsedModal'
                        />
                    </div>
                    <div class='modal-body'>
                        <div class='d-flex align-items-center justify-content-between mb-2'>
                            <span class='text-muted small'>
                                Review parsed call-note entries before posting to DataSync.
                            </span>
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
                            v-if='parsedActivityNumber || parsedReportNumber'
                            class='small text-muted mb-3'
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

                        <div
                            v-else
                            style='max-height: 50vh; overflow: auto;'
                        >
                            <label
                                v-for='(r, i) in rows'
                                :key='i'
                                class='border-bottom py-2 small d-flex gap-2'
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

                        <div
                            v-if='status'
                            class='mt-3 fw-bold'
                            :class='statusError ? "text-danger" : "text-success"'
                        >
                            {{ status }}
                        </div>

                        <div
                            v-if='!activeMission'
                            class='form-text text-warning mt-2'
                        >
                            No active mission. Select one in Create | Open first.
                        </div>
                    </div>
                    <div class='modal-footer'>
                        <button
                            type='button'
                            class='btn btn-secondary'
                            :disabled='posting'
                            @click='closeParsedModal'
                        >
                            Close
                        </button>
                        <button
                            type='button'
                            class='btn btn-success'
                            :disabled='!selectedCount || !activeMission || posting'
                            @click='postLogs'
                        >
                            {{ posting ? 'Posting…' : `Post ${selectedCount} entr${selectedCount === 1 ? "y" : "ies"} to DataSync` }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if='showParsedModal'
            class='modal-backdrop fade show'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, reactive, watch, onMounted } from 'vue';
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
import {
    loadIncidentSubscription,
    subscriptionMissionToken,
} from '../../../lib/incidentSubscription.ts';
import { SUBJECT_KEYWORD, kwValue } from '../../../lib/subjectInfo.ts';
import {
    applyCadIdsToSchema,
    applyIncidentFormToSchema,
    applyMissionContextToSchema,
    appendMpsRowsToSchema,
    incidentFormFromSchema,
    loadMissionSchema,
    mergeAssignmentIntoForm,
    replaceMpsRowsInSchema,
    saveMissionSchema,
    type MissionSchema,
} from '../../../lib/missionSchema.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission, setActiveMission } = useIncident();

const incidentForm = reactive<IncidentInfoForm>(blankIncidentInfoForm());
const missionSchema = ref<MissionSchema | null>(null);
const schemaContentHash = ref<string | undefined>();
const legacySchemaLogId = ref<string | undefined>();
const savingIncident = ref(false);
const loadingIncident = ref(false);

const cadText = ref('');
const rows = ref<MpsRow[]>([]);
const selected = ref<boolean[]>([]);
const parsedActivityNumber = ref<string | null>(null);
const parsedReportNumber = ref<string | null>(null);
const posting = ref(false);
const showParsedModal = ref(false);
const status = ref('');
const statusError = ref(false);
const incidentStatus = ref('');
const incidentStatusError = ref(false);

function syncMissionToken(missionToken: string): void {
    if (!activeMission.value) return;
    setActiveMission({ ...activeMission.value, missionToken });
}

function loadSub() {
    if (!activeMission.value) throw new Error('No active mission');
    return loadIncidentSubscription(activeMission.value, { onMissionToken: syncMissionToken });
}

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

function closeParsedModal(): void {
    showParsedModal.value = false;
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
        schemaContentHash.value = undefined;
        legacySchemaLogId.value = undefined;
        return;
    }
    loadingIncident.value = true;
    incidentStatus.value = '';
    incidentStatusError.value = false;
    try {
        const sub = await loadSub();
        const logs = await sub.log.list({ refresh: true });
        const loaded = await loadMissionSchema(sub);
        missionSchema.value = loaded.schema;
        schemaContentHash.value = loaded.contentHash;
        legacySchemaLogId.value = loaded.legacyLogId;
        applyMissionContextToSchema(loaded.schema, activeMission.value.name);

        const saved = latestIncidentInfoFromLogs(logs);
        if (schemaContentHash.value || legacySchemaLogId.value) {
            Object.assign(incidentForm, incidentFormFromSchema(loaded.schema));
            mergeAssignmentIntoForm(
                incidentForm,
                loaded.schema,
                saved?.keywords,
                saved?.content,
            );
            incidentForm.logId = saved?.logId;
            if (!incidentForm.incidentName.trim()) applySubjectNameSuggestion(logs);
        } else if (saved) {
            Object.assign(incidentForm, saved.fields);
            mergeAssignmentIntoForm(
                incidentForm,
                loaded.schema,
                saved.keywords,
                saved.content,
            );
            incidentForm.logId = saved.logId;
        } else {
            Object.assign(incidentForm, blankIncidentInfoForm());
            incidentForm.logId = undefined;
            applySubjectNameSuggestion(logs);
        }
    } catch (err) {
        incidentStatusError.value = true;
        incidentStatus.value = err instanceof Error ? err.message : String(err);
        if (!incidentForm.incidentName.trim() && !incidentForm.assignmentText.trim()) {
            Object.assign(incidentForm, blankIncidentInfoForm());
            incidentForm.logId = undefined;
            missionSchema.value = null;
            schemaContentHash.value = undefined;
            legacySchemaLogId.value = undefined;
        }
    } finally {
        loadingIncident.value = false;
    }
}

async function saveIncidentInfo(): Promise<void> {
    if (!activeMission.value || demaInvalid.value) return;
    savingIncident.value = true;
    incidentStatus.value = '';
    incidentStatusError.value = false;
    try {
        const sub = await loadSub();
        const missionToken = subscriptionMissionToken(sub, activeMission.value);
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

        try {
            let schema = missionSchema.value;
            if (!schema) {
                const loaded = await loadMissionSchema(sub);
                schema = loaded.schema;
                schemaContentHash.value = loaded.contentHash ?? schemaContentHash.value;
                legacySchemaLogId.value = loaded.legacyLogId ?? legacySchemaLogId.value;
            }
            applyIncidentFormToSchema(incidentForm, schema);
            applyMissionContextToSchema(schema, activeMission.value.name);
            const savedSchema = await saveMissionSchema(sub, schema, {
                contentHash: schemaContentHash.value,
                legacyLogId: legacySchemaLogId.value,
                missionToken,
            });
            schemaContentHash.value = savedSchema.contentHash;
            legacySchemaLogId.value = undefined;
            missionSchema.value = schema;
            incidentStatus.value = `Saved incident information and mission_schema.json to ${activeMission.value.name}.`;
        } catch (schemaErr) {
            incidentStatusError.value = true;
            const detail = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
            incidentStatus.value = `Saved incident log to ${activeMission.value.name}, but mission_schema.json failed: ${detail}`;
        }
    } catch (err) {
        incidentStatusError.value = true;
        incidentStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingIncident.value = false;
    }
}

async function syncSchemaFromForm(
    parsed?: { activityNumber: string | null; reportNumber: string | null },
    parsedRows?: MpsRow[],
): Promise<void> {
    if (!activeMission.value) return;
    const sub = await loadSub();
    let schema = missionSchema.value;
    if (!schema) {
        const loaded = await loadMissionSchema(sub);
        schema = loaded.schema;
        missionSchema.value = schema;
        schemaContentHash.value = loaded.contentHash ?? schemaContentHash.value;
        legacySchemaLogId.value = loaded.legacyLogId ?? legacySchemaLogId.value;
    }
    applyIncidentFormToSchema(incidentForm, schema, { preserveEmptyAssignment: true });
    if (parsed) applyCadIdsToSchema(schema, parsed);
    if (parsedRows?.length) {
        replaceMpsRowsInSchema(schema, parsedRows, activeMission.value.name);
    }
    applyMissionContextToSchema(schema, activeMission.value.name);
    const savedSchema = await saveMissionSchema(sub, schema, {
        contentHash: schemaContentHash.value,
        legacyLogId: legacySchemaLogId.value,
        missionToken: subscriptionMissionToken(sub, activeMission.value),
    });
    schemaContentHash.value = savedSchema.contentHash;
    legacySchemaLogId.value = undefined;
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
    showParsedModal.value = true;
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
        const sub = await loadSub();

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
            const savedSchema = await saveMissionSchema(sub, schema, {
                contentHash: schemaContentHash.value,
                legacyLogId: legacySchemaLogId.value,
                missionToken: subscriptionMissionToken(sub, activeMission.value),
            });
            schemaContentHash.value = savedSchema.contentHash;
            legacySchemaLogId.value = undefined;
            missionSchema.value = schema;
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
