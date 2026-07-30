<template>
    <div>
        <!-- CFS / Call Notes -->
        <div class='card mb-3'>
            <div
                class='card-header d-flex align-items-center cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='cfsExpanded'
                @click='cfsExpanded = !cfsExpanded'
                @keydown.enter.prevent='cfsExpanded = !cfsExpanded'
                @keydown.space.prevent='cfsExpanded = !cfsExpanded'
            >
                <h3 class='card-title mb-0'>
                    CFS / Call Notes
                </h3>
                <IconChevronDown
                    class='ms-auto transition-transform'
                    :class='{ "rotate-180": !cfsExpanded }'
                    :size='20'
                    stroke='1.5'
                />
            </div>
            <div
                v-show='cfsExpanded'
                class='card-body'
            >
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

        <!-- Incident Information -->
        <div class='card'>
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
                            placeholder='e.g. A12345678'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label'>Department Report Number</label>
                        <input
                            v-model='incidentForm.incidentId'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='e.g. R1234567'
                        >
                    </div>
                    <div class='col-md-6'>
                        <label class='form-label'>State Mission Number</label>
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

                <p class='text-muted small mt-2 mb-0'>
                    Save stores fields in <strong>mission_schema.json</strong>;
                    Send to DataSync posts a mission log entry.
                </p>

                <div
                    v-if='demaInvalid'
                    class='form-text text-warning mt-2'
                >
                    Fix the state mission number format before saving.
                </div>

                <div class='d-flex flex-wrap gap-2 mt-3'>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='savingIncident || sendingIncident || demaInvalid'
                        @click='onSaveIncidentInfo'
                    >
                        {{ savingIncident ? 'Saving…' : 'Save' }}
                    </button>
                    <button
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='sendingIncident || savingIncident || demaInvalid'
                        @click='onSendIncidentInfo'
                    >
                        {{ sendingIncident ? 'Sending…' : 'Send to DataSync' }}
                    </button>
                </div>

                <div
                    v-if='incidentStatus'
                    class='mt-2 fw-bold'
                    :class='incidentStatusError ? "text-danger" : "text-success"'
                >
                    {{ incidentStatus }}
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
                            :disabled='!selectedCount || posting'
                            @click='onPostLogs'
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
import { IconChevronDown } from '@tabler/icons-vue';
import { getMpsRows } from '../../../lib/mpsParser.ts';
import type { MpsRow } from '../../../lib/mpsParser.ts';
import {
    applyParsedCadToForm,
    blankIncidentInfoForm,
    buildIncidentInfoContent,
    buildIncidentInfoKeywords,
    isValidDemaMission,
    latestIncidentInfoFromLogs,
    parseCfsHeaderFields,
    suggestIncidentName,
    type IncidentInfoForm,
} from '../../../lib/incidentInfo.ts';
import {
    loadIncidentSubscription,
    subscriptionMissionToken,
} from '../../../lib/incidentSubscription.ts';
import { pushPointToMission } from '../../../lib/missionFeatures.ts';
import { SUBJECT_KEYWORD, kwValue } from '../../../lib/subjectInfo.ts';
import {
    applyCadIdsToSchema,
    applyCfsTimestampsToSchema,
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

const { activeMission, setActiveMission, requireActiveMission } = useIncident();

const incidentForm = reactive<IncidentInfoForm>(blankIncidentInfoForm());
const missionSchema = ref<MissionSchema | null>(null);
const schemaContentHash = ref<string | undefined>();
const legacySchemaLogId = ref<string | undefined>();
const savingIncident = ref(false);
const sendingIncident = ref(false);
const loadingIncident = ref(false);

const cfsExpanded = ref(false);
const cadText = ref('');
const rows = ref<MpsRow[]>([]);
const selected = ref<boolean[]>([]);
const parsedActivityNumber = ref<string | null>(null);
const parsedReportNumber = ref<string | null>(null);
const lastCfsTimestamps = ref<{
    callCreated: string | null;
    callDispatched: string | null;
}>({ callCreated: null, callDispatched: null });
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
        const fromSchema = incidentFormFromSchema(loaded.schema);
        const schemaHasInfo = !!(
            fromSchema.incidentName.trim()
            || fromSchema.eventId.trim()
            || fromSchema.incidentId.trim()
            || fromSchema.demaMission.trim()
            || fromSchema.icCoordinator.trim()
            || fromSchema.incidentConclusionTime.trim()
            || fromSchema.assignmentText.trim()
        );
        // Prefer mission_schema.json; fall back to initial-information log only when schema has no fields yet.
        if (schemaContentHash.value || legacySchemaLogId.value || schemaHasInfo) {
            Object.assign(incidentForm, fromSchema);
            mergeAssignmentIntoForm(
                incidentForm,
                loaded.schema,
                schemaHasInfo ? undefined : saved?.keywords,
                schemaHasInfo ? undefined : saved?.content,
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

async function onSaveIncidentInfo(): Promise<void> {
    if (!requireActiveMission()) return;
    await saveIncidentInfo();
}

async function onSendIncidentInfo(): Promise<void> {
    if (!requireActiveMission()) return;
    await sendIncidentInfoToDataSync();
}

async function saveIncidentInfo(): Promise<void> {
    if (!activeMission.value || demaInvalid.value) return;
    savingIncident.value = true;
    incidentStatus.value = '';
    incidentStatusError.value = false;
    try {
        const sub = await loadSub();
        const missionToken = subscriptionMissionToken(sub, activeMission.value);
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
        incidentStatus.value = `Saved incident information to mission_schema.json on ${activeMission.value.name}.`;
    } catch (err) {
        incidentStatusError.value = true;
        incidentStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        savingIncident.value = false;
    }
}

async function sendIncidentInfoToDataSync(): Promise<void> {
    if (!activeMission.value || demaInvalid.value) return;
    sendingIncident.value = true;
    incidentStatus.value = '';
    incidentStatusError.value = false;
    try {
        const sub = await loadSub();
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
        incidentStatus.value = `Sent incident information log to ${activeMission.value.name}.`;
    } catch (err) {
        incidentStatusError.value = true;
        incidentStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        sendingIncident.value = false;
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
    applyCfsTimestampsToSchema(schema, {
        callCreated: lastCfsTimestamps.value.callCreated,
        callDispatched: lastCfsTimestamps.value.callDispatched,
    });
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

async function parse(): Promise<void> {
    status.value = '';
    statusError.value = false;
    const header = parseCfsHeaderFields(cadText.value);
    const res = getMpsRows(cadText.value);
    const activityNumber = header.activityNumber ?? res.activityNumber;
    const reportNumber = header.reportNumber ?? res.reportNumber;
    rows.value = res.rows;
    selected.value = res.rows.map(() => true);
    parsedActivityNumber.value = activityNumber;
    parsedReportNumber.value = reportNumber;
    lastCfsTimestamps.value = {
        callCreated: header.callCreated,
        callDispatched: header.assignmentDateTime,
    };
    applyParsedCadToForm(incidentForm, {
        activityNumber,
        reportNumber,
        assignmentDateTime: header.assignmentDateTime,
    });
    showParsedModal.value = true;

    const locationMsg = await maybeAddCallLocation(header, activityNumber);
    if (statusError.value) return;

    try {
        await syncSchemaFromForm({
            activityNumber,
            reportNumber,
        }, res.rows);
        if (!rows.value.length) {
            statusError.value = true;
            status.value = activityNumber || reportNumber
                ? 'Parsed activity/report numbers and updated mission schema; no timestamped Remarks entries found.'
                : 'No timestamped Remarks entries found in the pasted text.';
        } else {
            status.value = 'Parsed call notes and updated mission schema.';
        }
        if (locationMsg) {
            status.value = `${status.value} ${locationMsg}`;
        }
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    }
}

/** Prompt and push Address LL marker. Returns a short status suffix, or null. */
async function maybeAddCallLocation(
    header: ReturnType<typeof parseCfsHeaderFields>,
    activityNumber: string | null,
): Promise<string | null> {
    if (!header.callLocation || !activeMission.value) return null;
    const callsign = (activityNumber || incidentForm.eventId || 'CFS').trim();
    const { lat, lng } = header.callLocation;
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    const ok = window.confirm(
        `Add call location ${callsign} at ${latStr}, ${lngStr} to the mission map?`,
    );
    if (!ok) return null;
    try {
        await pushPointToMission({
            missionGuid: activeMission.value.guid,
            missionToken: activeMission.value.missionToken ?? activeMission.value.token,
            callsign,
            point: [lng, lat],
            type: '13064000001100000000',
            icon: '2525E:13064000001100000000',
        });
        return `Added call location ${callsign} to the map.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
        return null;
    }
}

function toDtg(raw: string): string | undefined {
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

async function onPostLogs(): Promise<void> {
    if (!requireActiveMission()) return;
    await postLogs();
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

<style scoped>
.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}

.cursor-pointer {
    cursor: pointer;
}
</style>
