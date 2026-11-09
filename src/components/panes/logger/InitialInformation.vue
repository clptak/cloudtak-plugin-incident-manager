<template>
    <div>
        <!-- CFS / Call Notes -->
        <div
            v-if='!cfsExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='cfsExpanded = true'
            @keydown.enter.prevent='cfsExpanded = true'
            @keydown.space.prevent='cfsExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                CFS / Call Notes
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='cfsExpanded = false'
                    @keydown.enter.prevent='cfsExpanded = false'
                    @keydown.space.prevent='cfsExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        CFS / Call Notes
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <TablerInput
                v-model='cadText'
                label='Paste full CFS text (header + Remarks section)'
                :rows='10'
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

            <TablerInlineAlert
                v-if='!activeMission'
                class='mt-3'
                severity='warning'
                title='Mission Required'
                description='No active mission. Select one in Create | Open first.'
            />
            <p
                v-else
                class='form-text mt-2'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
            </p>

            <TablerInlineAlert
                v-if='status'
                class='mt-2'
                :severity='statusError ? "danger" : "success"'
                :title='statusError ? "Error" : "Success"'
                :description='status'
            />
        </TablerBorder>

        <!-- Incident Information -->
        <TablerBorder
            class='cloudtak-accent text-white'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Incident Information
                </p>
            </template>

            <div class='row g-3'>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='incidentForm.incidentName'
                        label='Incident Name'
                        placeholder='e.g. Smith Search'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='incidentForm.eventId'
                        label='Activity Number'
                        placeholder='e.g. A12345678'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='incidentForm.incidentId'
                        label='Department Report Number'
                        placeholder='e.g. R1234567'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='incidentForm.demaMission'
                        label='State Mission Number'
                        placeholder='e.g. 2025-12345'
                        :error='demaInvalid ? "Format: 20YY-NNNNN (e.g. 2025-12345)" : ""'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='incidentForm.icCoordinator'
                        label='IC Coordinator&apos;s Name'
                        placeholder='Coordinator name'
                        description='Will be populated from your TAK Portal user (future).'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='incidentForm.incidentConclusionTime'
                        label='Incident Conclusion Time'
                        type='datetime-local'
                    />
                </div>
                <div class='col-md-8'>
                    <TablerInput
                        v-model='incidentForm.assignmentText'
                        label='Assignment'
                        :rows='3'
                        placeholder='Assignment details'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='incidentForm.assignmentDateTime'
                        label='Assignment Date/Time'
                        type='datetime-local'
                    />
                </div>
            </div>

            <TablerInlineAlert
                v-if='!activeMission'
                class='mt-3'
                severity='warning'
                title='Mission Required'
                description='No active mission. Select one in Create | Open first.'
            />
            <p
                v-else
                class='form-text mt-2'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
            </p>


            <TablerInlineAlert
                v-if='demaInvalid'
                class='mt-2'
                severity='warning'
                title='Invalid Format'
                description='Fix the state mission number format before saving.'
            />

            <div class='d-flex flex-wrap gap-2 mt-3'>
                <button
                    class='btn btn-primary btn-sm'
                    :disabled='savingIncident || sendingIncident || demaInvalid'
                    @click='onSaveIncidentInfo'
                >
                    {{ savingIncident ? 'Saving…' : 'Save to MGMT Only' }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='sendingIncident || savingIncident || demaInvalid'
                    @click='onSendIncidentInfo'
                >
                    {{ sendingIncident ? 'Adding…' : 'Add to FIELD DataSync Log' }}
                </button>
            </div>
            <p class='form-text mt-1 mb-0'>
                Team members in the field will see incident information added to the FIELD DataSync Log.
            </p>

            <TablerInlineAlert
                v-if='incidentStatus'
                class='mt-2'
                :severity='incidentStatusError ? "danger" : "success"'
                :title='incidentStatusError ? "Error" : "Success"'
                :description='incidentStatus'
            />
        </TablerBorder>

        <div
            v-if='showParsedModal'
            class='modal modal-blur incident-modal show d-block'
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
                        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
                            <span class='text-muted small me-auto'>
                                Choose FIELD or MGMT for each entry to log. Click a choice again to clear it.
                            </span>
                            <template v-if='rows.length'>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-outline-azure'
                                    @click='setAllDests("field")'
                                >
                                    All FIELD
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-outline-purple'
                                    :disabled='!activeMission?.mgmt'
                                    @click='setAllDests("mgmt")'
                                >
                                    All MGMT
                                </button>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-link p-0'
                                    @click='setAllDests(null)'
                                >
                                    Clear
                                </button>
                            </template>
                        </div>
                        <div
                            v-if='checkingDuplicates'
                            class='small text-muted mb-2'
                        >
                            Checking for entries already logged…
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
                            <div
                                v-for='(r, i) in rows'
                                :key='i'
                                class='border-bottom py-2 small d-flex gap-2'
                            >
                                <div
                                    class='btn-group btn-group-sm flex-shrink-0 align-self-start'
                                    role='group'
                                    :aria-label='`Destination for entry ${i + 1}`'
                                >
                                    <button
                                        type='button'
                                        class='btn'
                                        :class='dests[i] === "field" ? "btn-azure" : "btn-outline-azure"'
                                        :aria-pressed='dests[i] === "field"'
                                        @click='pickDest(i, "field")'
                                    >
                                        FIELD
                                    </button>
                                    <button
                                        type='button'
                                        class='btn'
                                        :class='dests[i] === "mgmt" ? "btn-purple" : "btn-outline-purple"'
                                        :aria-pressed='dests[i] === "mgmt"'
                                        :disabled='!activeMission?.mgmt'
                                        @click='pickDest(i, "mgmt")'
                                    >
                                        MGMT
                                    </button>
                                </div>
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
                                    <span
                                        v-if='duplicates[i]?.field || duplicates[i]?.mgmt'
                                        class='text-warning d-block'
                                    >
                                        Already logged in {{ [duplicates[i].field ? 'FIELD' : '', duplicates[i].mgmt ? 'MGMT' : ''].filter(Boolean).join(' and ') }}
                                    </span>
                                </span>
                            </div>
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
                            {{ posting ? 'Adding…' : 'Add Logs to DataSync(s)' }}
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
import { syncIncidentEventIds } from '../../../lib/coreEvents.ts';
import { IconChevronDown } from '@tabler/icons-vue';
import {
    TablerBorder,
    TablerInput,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { parseCadImport, type CadImport, type MpsRow } from '../../../lib/mpsParser.ts';
import {
    callNoteContent,
    callNoteDuplicates,
    toggleDest,
    type CallNoteDest,
    type CallNoteDuplicate,
} from '../../../lib/callNoteRouting.ts';
import { applyCadToSchema, takeCadText } from '../../../lib/cadImport.ts';
import {
    applyParsedCadToForm,
    blankIncidentInfoForm,
    buildIncidentInfoContent,
    buildIncidentInfoKeywords,
    isValidDemaMission,
    latestIncidentInfoFromLogs,
    type CfsHeaderFields,
    suggestIncidentName,
    type IncidentInfoForm,
} from '../../../lib/incidentInfo.ts';
import {
    loadIncidentSubscription,
    loadSchemaSubscription,
    schemaMissionToken,
} from '../../../lib/incidentSubscription.ts';
import { pushPointToMission } from '../../../lib/missionFeatures.ts';
import { SUBJECT_KEYWORD, kwValue } from '../../../lib/subjectInfo.ts';
import {
    applyIncidentFormToSchema,
    applyMissionContextToSchema,
    appendMpsRowsToSchema,
    incidentFormFromSchema,
    loadMissionSchema,
    mergeAssignmentIntoForm,
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
const dests = ref<CallNoteDest[]>([]);
const duplicates = ref<CallNoteDuplicate[]>([]);
const checkingDuplicates = ref(false);
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

/** Subscription for mission_schema.json I/O — mgmt sync on dual-sync incidents. */
function loadSchemaSub() {
    if (!activeMission.value) throw new Error('No active mission');
    return loadSchemaSubscription(activeMission.value);
}

const demaInvalid = computed(
    () => !isValidDemaMission(incidentForm.demaMission),
);

const selectedCount = computed(() => dests.value.filter(Boolean).length);

function pickDest(i: number, picked: 'field' | 'mgmt'): void {
    dests.value[i] = toggleDest(dests.value[i] ?? null, picked);
}

function setAllDests(dest: CallNoteDest): void {
    dests.value = rows.value.map(() => dest);
}

/** Flag parsed entries whose wording is already logged on FIELD or MGMT. */
async function checkDuplicates(): Promise<void> {
    const mission = activeMission.value;
    duplicates.value = [];
    if (!mission || !rows.value.length) return;
    checkingDuplicates.value = true;
    const contents = async (load: () => ReturnType<typeof loadSub>): Promise<string[]> => {
        try {
            const logs = await (await load()).log.list({ refresh: true });
            return logs.map((l) => String(l.content ?? ''));
        } catch {
            return [];
        }
    };
    try {
        const [field, mgmt] = await Promise.all([
            contents(loadSub),
            mission.mgmt ? contents(loadSchemaSub) : Promise.resolve([]),
        ]);
        duplicates.value = callNoteDuplicates(rows.value, { field, mgmt });
    } finally {
        checkingDuplicates.value = false;
    }
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
        const schemaSub = await loadSchemaSub();
        const loaded = await loadMissionSchema(schemaSub);
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
        const sub = await loadSchemaSub();
        const missionToken = schemaMissionToken(sub, activeMission.value);
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
        incidentStatus.value = `Saved incident information to the MGMT DataSync.`;
        // Case Number and DEMA number onto the incident event (ADR-004). The
        // incident is saved either way; an event problem is only reported.
        try {
            if (await syncIncidentEventIds(activeMission.value, {
                caseNumber: incidentForm.incidentId,
                dema: incidentForm.demaMission,
            })) incidentStatus.value += ' Incident event updated.';
        } catch (eventErr) {
            incidentStatus.value += ` The incident event was not updated: ${eventErr instanceof Error ? eventErr.message : String(eventErr)}`;
        }
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
        incidentStatus.value = `Added incident information to the FIELD DataSync Log on ${activeMission.value.name}.`;
    } catch (err) {
        incidentStatusError.value = true;
        incidentStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        sendingIncident.value = false;
    }
}

async function syncSchemaFromForm(cad?: CadImport): Promise<void> {
    if (!activeMission.value) return;
    const sub = await loadSchemaSub();
    let schema = missionSchema.value;
    if (!schema) {
        const loaded = await loadMissionSchema(sub);
        schema = loaded.schema;
        missionSchema.value = schema;
        schemaContentHash.value = loaded.contentHash ?? schemaContentHash.value;
        legacySchemaLogId.value = loaded.legacyLogId ?? legacySchemaLogId.value;
    }
    applyIncidentFormToSchema(incidentForm, schema, { preserveEmptyAssignment: true });
    if (cad) applyCadToSchema(schema, cad, activeMission.value.name);
    applyMissionContextToSchema(schema, activeMission.value.name);
    const savedSchema = await saveMissionSchema(sub, schema, {
        contentHash: schemaContentHash.value,
        legacyLogId: legacySchemaLogId.value,
        missionToken: schemaMissionToken(sub, activeMission.value),
    });
    schemaContentHash.value = savedSchema.contentHash;
    legacySchemaLogId.value = undefined;
    missionSchema.value = schema;
}

async function parse(): Promise<void> {
    status.value = '';
    statusError.value = false;
    const cad = parseCadImport(cadText.value);
    const { header, activityNumber, reportNumber } = cad;
    rows.value = cad.rows;
    dests.value = cad.rows.map(() => null);
    void checkDuplicates();
    parsedActivityNumber.value = activityNumber;
    parsedReportNumber.value = reportNumber;
    applyParsedCadToForm(incidentForm, {
        activityNumber,
        reportNumber,
        assignmentDateTime: header.assignmentDateTime,
        closed: header.closed,
    });
    showParsedModal.value = true;

    const locationMsg = await maybeAddCallLocation(header, activityNumber);
    if (statusError.value) return;

    try {
        await syncSchemaFromForm(cad);
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
    header: CfsHeaderFields,
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

    const counts = { field: 0, mgmt: 0 };
    let failed = 0;
    try {
        const toPost = rows.value.filter((_, i) => dests.value[i]);
        for (const target of ['field', 'mgmt'] as const) {
            const batch = rows.value.filter((_, i) => dests.value[i] === target);
            if (!batch.length) continue;
            const sub = target === 'mgmt' ? await loadSchemaSub() : await loadSub();
            for (const r of batch) {
                const keywords = ['source:CAD'];
                if (r.uid) keywords.push(`uid:${r.uid}`);
                try {
                    await sub.log.create({
                        dtg: toDtg(r.dtg),
                        content: callNoteContent(r),
                        keywords,
                    });
                    counts[target]++;
                } catch {
                    failed++;
                }
            }
        }
        const ok = counts.field + counts.mgmt;

        statusError.value = failed > 0;
        const parts: string[] = [];
        if (counts.field) parts.push(`${counts.field} to FIELD (${activeMission.value.name})`);
        if (counts.mgmt) parts.push(`${counts.mgmt} to MGMT (${activeMission.value.mgmt?.name ?? 'MGMT'})`);
        status.value = `Added ${ok} log${ok === 1 ? '' : 's'}${parts.length ? `: ${parts.join(', ')}` : ''}`
            + (failed ? `; ${failed} failed.` : '.');
        if (ok) void checkDuplicates();

        if (ok > 0 && !rows.value.length) {
            const schemaSub = await loadSchemaSub();
            const schema = missionSchema.value ?? (await loadMissionSchema(schemaSub)).schema;
            appendMpsRowsToSchema(schema, toPost, activeMission.value.name);
            applyIncidentFormToSchema(incidentForm, schema);
            applyMissionContextToSchema(schema, activeMission.value.name);
            const savedSchema = await saveMissionSchema(schemaSub, schema, {
                contentHash: schemaContentHash.value,
                legacyLogId: legacySchemaLogId.value,
                missionToken: schemaMissionToken(schemaSub, activeMission.value),
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

/** Text pasted on Create Mission for this incident lands in the CFS box once. */
function takePendingCadText(): void {
    const guid = activeMission.value?.guid;
    if (!guid || cadText.value.trim()) return;
    const text = takeCadText(guid);
    if (text) {
        cadText.value = text;
        cfsExpanded.value = true;
    }
}

onMounted(() => { takePendingCadText(); void loadIncidentInfo(); });
watch(() => activeMission.value?.guid, () => { takePendingCadText(); void loadIncidentInfo(); });
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
