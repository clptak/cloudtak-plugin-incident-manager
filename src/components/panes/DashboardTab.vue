<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>
                Dashboard
            </h3>
            <button
                class='btn btn-outline-secondary btn-sm ms-auto'
                :disabled='!canExport'
                @click='exportCsv'
            >
                Export CSV
            </button>
            <button
                class='btn btn-outline-secondary btn-sm'
                :disabled='!canExport'
                @click='exportPdf'
            >
                Export PDF
            </button>
            <button
                class='btn btn-outline-primary btn-sm'
                :disabled='loading'
                @click='onRefresh'
            >
                {{ loading ? 'Loading…' : 'Refresh' }}
            </button>
        </div>

        <div
            v-if='!activeMission'
            class='text-muted small'
        >
            Select a mission in Create | Open to load the combined log table.
        </div>

        <template v-else>
            <!-- Keyword filter -->
            <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
                <span class='small text-muted me-1'>Filter:</span>
                <label
                    v-for='f in FILTERS'
                    :key='f.id'
                    class='form-check form-check-inline mb-0 me-2'
                >
                    <input
                        v-model='selected[f.id]'
                        type='checkbox'
                        class='form-check-input'
                    >
                    <span class='form-check-label small'>{{ f.label }}</span>
                </label>
                <label class='form-check form-check-inline mb-0 me-2'>
                    <input
                        v-model='selected.other'
                        type='checkbox'
                        class='form-check-input'
                    >
                    <span class='form-check-label small'>Other</span>
                </label>
                <button
                    class='btn btn-link btn-sm p-0 ms-1'
                    @click='setAll(true)'
                >
                    Select all
                </button>
                <span class='text-muted'>·</span>
                <button
                    class='btn btn-link btn-sm p-0'
                    @click='setAll(false)'
                >
                    Deselect all
                </button>
            </div>

            <div class='small text-muted mb-2'>
                {{ activeMission.name }} — showing {{ displayRows.length }} of {{ rows.length }} entr{{ rows.length === 1 ? 'y' : 'ies' }}
            </div>
            <div
                v-if='error'
                class='text-danger small mb-2'
            >
                {{ error }}
            </div>

            <div
                v-if='showInfoPanels'
                class='row mb-3'
            >
                <div
                    v-if='initialInfoRows.length'
                    class='col-lg-6'
                >
                    <h4 class='h5 mb-2'>
                        Initial Information
                    </h4>
                    <div class='card'>
                        <div class='card-body py-2'>
                            <dl class='row mb-0 small'>
                                <template
                                    v-for='row in initialInfoRows'
                                    :key='row.label'
                                >
                                    <dt class='col-sm-4 text-muted'>
                                        {{ row.label }}
                                    </dt>
                                    <dd class='col-sm-8 mb-1'>
                                        {{ row.value }}
                                    </dd>
                                </template>
                            </dl>
                        </div>
                    </div>
                </div>
                <div
                    v-if='subjects.length'
                    :class='initialInfoRows.length ? "col-lg-6" : "col-12"'
                >
                    <h4 class='h5 mb-2'>
                        Subject Information
                    </h4>
                    <div
                        v-for='s in subjects'
                        :key='s.subjectCaseID'
                        class='card mb-2'
                    >
                        <div class='card-header py-2'>
                            <strong>Subject {{ displaySubjectNumber(s.subjectCaseID) }}</strong>
                            <span
                                v-if='s.subjectName'
                                class='text-muted ms-2'
                            >{{ s.subjectName }}</span>
                        </div>
                        <div class='card-body py-2'>
                            <dl class='row mb-0 small'>
                                <template
                                    v-for='row in subjectDetailRows(s)'
                                    :key='row.label'
                                >
                                    <dt class='col-sm-4 text-muted'>
                                        {{ row.label }}
                                    </dt>
                                    <dd class='col-sm-8 mb-1'>
                                        {{ row.value }}
                                    </dd>
                                </template>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if='teams.length'
                class='card mb-3'
            >
                <div
                    class='card-header py-2 d-flex align-items-center cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='teamsExpanded'
                    @click='teamsExpanded = !teamsExpanded'
                    @keydown.enter.prevent='teamsExpanded = !teamsExpanded'
                    @keydown.space.prevent='teamsExpanded = !teamsExpanded'
                >
                    <h4 class='h5 mb-0'>
                        Teams
                    </h4>
                    <span class='text-muted small ms-2'>({{ teams.length }})</span>
                    <IconChevronDown
                        class='ms-auto transition-transform'
                        :class='{ "rotate-180": !teamsExpanded }'
                        :size='18'
                        stroke='1.5'
                    />
                </div>
                <div
                    v-show='teamsExpanded'
                    class='card-body py-2'
                >
                    <div
                        v-for='team in teams'
                        :key='team.title'
                        class='card mb-2'
                    >
                        <div class='card-header py-2'>
                            <strong>{{ team.title }}</strong>
                            <span
                                v-if='team.assignmentCallsign'
                                class='text-muted ms-2'
                            >{{ team.assignmentCallsign }}</span>
                        </div>
                        <div class='card-body py-2'>
                            <div
                                v-if='team.description'
                                class='text-muted small mb-2'
                            >
                                {{ team.description }}
                            </div>
                            <ul
                                v-if='team.children.length'
                                class='list-unstyled mb-0 small'
                            >
                                <li
                                    v-for='(child, childIndex) in team.children'
                                    :key='`${team.title}-${childIndex}`'
                                >
                                    {{ formatTeamRosterChild(child) }}
                                </li>
                            </ul>
                            <div
                                v-else
                                class='text-muted small'
                            >
                                No roster entries on the org chart.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if='resourceAssignments.length'
                class='card mb-3'
            >
                <div
                    class='card-header py-2 d-flex align-items-center cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='resourceAssignmentsExpanded'
                    @click='resourceAssignmentsExpanded = !resourceAssignmentsExpanded'
                    @keydown.enter.prevent='resourceAssignmentsExpanded = !resourceAssignmentsExpanded'
                    @keydown.space.prevent='resourceAssignmentsExpanded = !resourceAssignmentsExpanded'
                >
                    <h4 class='h5 mb-0'>
                        Resource Assignments
                    </h4>
                    <span class='text-muted small ms-2'>({{ resourceAssignments.length }})</span>
                    <IconChevronDown
                        class='ms-auto transition-transform'
                        :class='{ "rotate-180": !resourceAssignmentsExpanded }'
                        :size='18'
                        stroke='1.5'
                    />
                </div>
                <div
                    v-show='resourceAssignmentsExpanded'
                    class='card-body py-2'
                >
                    <div
                        v-for='assignment in resourceAssignments'
                        :key='assignment.id'
                        class='card mb-2'
                    >
                        <div class='card-header py-2'>
                            <strong>{{ assignment.resourceIdentifier }}</strong>
                        </div>
                        <div class='card-body py-2'>
                            <dl class='row mb-0 small'>
                                <template
                                    v-for='row in resourceAssignmentDetailRows(assignment)'
                                    :key='row.label'
                                >
                                    <dt class='col-sm-4 text-muted'>
                                        {{ row.label }}
                                    </dt>
                                    <dd class='col-sm-8 mb-1'>
                                        {{ row.value }}
                                    </dd>
                                </template>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if='workAssignments.length'
                class='card mb-3'
            >
                <div
                    class='card-header py-2 d-flex align-items-center cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='workAssignmentsExpanded'
                    @click='workAssignmentsExpanded = !workAssignmentsExpanded'
                    @keydown.enter.prevent='workAssignmentsExpanded = !workAssignmentsExpanded'
                    @keydown.space.prevent='workAssignmentsExpanded = !workAssignmentsExpanded'
                >
                    <h4 class='h5 mb-0'>
                        Work Assignments
                    </h4>
                    <span class='text-muted small ms-2'>({{ workAssignments.length }})</span>
                    <IconChevronDown
                        class='ms-auto transition-transform'
                        :class='{ "rotate-180": !workAssignmentsExpanded }'
                        :size='18'
                        stroke='1.5'
                    />
                </div>
                <div
                    v-show='workAssignmentsExpanded'
                    class='card-body py-2'
                >
                    <div
                        v-for='assignment in workAssignments'
                        :key='assignment.id'
                        class='card mb-2'
                    >
                        <div class='card-header py-2'>
                            <strong>Assignment {{ assignment.assignmentNumber }}</strong>
                            <span
                                v-if='assignment.teamLabel'
                                class='text-muted ms-2'
                            >{{ assignment.teamLabel }}</span>
                        </div>
                        <div class='card-body py-2'>
                            <dl class='row mb-0 small'>
                                <template
                                    v-for='row in workAssignmentDetailRows(assignment)'
                                    :key='row.label'
                                >
                                    <dt class='col-sm-4 text-muted'>
                                        {{ row.label }}
                                    </dt>
                                    <dd class='col-sm-8 mb-1'>
                                        {{ row.value }}
                                    </dd>
                                </template>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div class='table-responsive'>
                <table class='table table-sm table-vcenter table-striped table-hover mb-0 dashboard-log-table'>
                    <colgroup>
                        <col class='dashboard-log-col-time'>
                        <col class='dashboard-log-col-entry'>
                        <col class='dashboard-log-col-source'>
                        <col class='dashboard-log-col-keywords'>
                    </colgroup>
                    <thead>
                        <tr>
                            <th
                                class='cursor-pointer'
                                @click='sortBy()'
                            >
                                Time {{ sortIndicator() }}
                            </th>
                            <th>Entry</th>
                            <th>Source</th>
                            <th>Keywords</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='(r, i) in displayRows'
                            :key='i'
                        >
                            <td class='text-nowrap'>
                                {{ formatLocalTime(r.epoch, r.rawTime) }}
                            </td>
                            <td class='dashboard-log-entry-cell'>
                                {{ r.content }}
                            </td>
                            <td class='text-nowrap'>
                                {{ displaySource(r.source) }}
                            </td>
                            <td class='dashboard-log-keywords-cell'>
                                <span
                                    v-for='k in r.keywords'
                                    :key='k'
                                    class='badge bg-blue-lt me-1'
                                >{{ k }}</span>
                            </td>
                        </tr>
                        <tr v-if='!displayRows.length'>
                            <td
                                colspan='4'
                                class='text-muted text-center'
                            >
                                No matching log entries.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import type { DBSubscriptionLog } from '../../../../../src/database.ts';
import { useIncident } from '../../composables/useIncident.ts';
import { loadIncidentSubscription } from '../../lib/incidentSubscription.ts';
import {
    exportDashboardCsv,
    exportDashboardPdf,
    formatLocalTime,
} from '../../lib/dashboardExport.ts';
import {
    dashboardTeamsFromOrgChart,
    formatTeamRosterChild,
    resourceAssignmentDetailRows,
    workAssignmentDetailRows,
    type DashboardTeamRoster,
} from '../../lib/dashboardPanels.ts';
import { loadD4hRoster } from '../../lib/d4hRoster.ts';
import {
    initialInfoDetailRows,
    type IncidentInfoForm,
} from '../../lib/incidentInfo.ts';
import { loadMissionSchema, resolveIncidentInfoForm } from '../../lib/missionSchema.ts';
import { loadOrgChartFromMission } from '../../lib/orgChartPersistence.ts';
import { loadResourceAssignmentsFromMission } from '../../lib/resourceAssignmentPersistence.ts';
import type { ResourceAssignment } from '../../lib/resourceAssignments.ts';
import {
    displaySubjectNumber,
    parseSubjectsFromLogs,
    subjectDetailRows,
    SUBJECT_KEYWORD,
    type ParsedSubject,
} from '../../lib/subjectInfo.ts';
import { loadWorkAssignmentsFromMission } from '../../lib/workAssignmentPersistence.ts';
import type { WorkAssignment } from '../../lib/workAssignments.ts';

const { activeMission, requireActiveMission } = useIncident();

interface Row {
    rawTime: string;
    epoch: number;
    content: string;
    source: string;   // raw creatorUid; resolved to a person at render time
    keywords: string[];
}

const rows = ref<Row[]>([]);
const subjects = ref<ParsedSubject[]>([]);
const initialInfo = ref<IncidentInfoForm | null>(null);
const teams = ref<DashboardTeamRoster[]>([]);
const resourceAssignments = ref<ResourceAssignment[]>([]);
const workAssignments = ref<WorkAssignment[]>([]);
const teamsExpanded = ref(true);
const resourceAssignmentsExpanded = ref(true);
const workAssignmentsExpanded = ref(true);
const loading = ref(false);
const error = ref('');
const sortAsc = ref(true);

// ---- Keyword filters (exact match or regex prefix) ------------------------

interface KeywordFilter {
    id: string;
    label: string;
    test: (keywords: string[]) => boolean;
}

const FILTERS: KeywordFilter[] = [
    { id: 'cad', label: 'CAD', test: (k) => k.includes('source:CAD') },
    { id: 'urgency', label: 'Search Urgency', test: (k) => k.includes('search-urgency') },
    { id: 'area', label: 'Search Area', test: (k) => k.includes('search-area') },
    { id: 'segment', label: 'Area Segment', test: (k) => k.some((w) => /^area:segment:/.test(w)) },
    { id: 'post', label: 'Incident POST', test: (k) => k.includes('incident-post') },
    // Regex/prefix filters — match any keyword beginning with the token:
    { id: 'objective', label: 'Objectives', test: (k) => k.some((w) => /^objective:/.test(w)) },
    { id: 'strategy', label: 'Strategies', test: (k) => k.some((w) => /^strategy:/.test(w)) },
    { id: 'tactic', label: 'Tactics', test: (k) => k.some((w) => /^tactic:/.test(w)) },
];

const ALL_IDS = [...FILTERS.map((f) => f.id), 'other'];
const selected = reactive<Record<string, boolean>>(
    Object.fromEntries(ALL_IDS.map((id) => [id, true])),
);

function setAll(v: boolean): void {
    for (const id of ALL_IDS) selected[id] = v;
}

function rowMatches(keywords: string[]): boolean {
    const anySelected = ALL_IDS.some((id) => selected[id]);
    if (!anySelected) return true; // nothing checked → no filtering, show all
    for (const f of FILTERS) {
        if (selected[f.id] && f.test(keywords)) return true;
    }
    if (selected.other && !FILTERS.some((f) => f.test(keywords))) return true;
    return false;
}

const sortedRows = computed(() => {
    const copy = [...rows.value];
    copy.sort((a, b) => (sortAsc.value ? a.epoch - b.epoch : b.epoch - a.epoch));
    return copy;
});

const displayRows = computed(() => sortedRows.value.filter((r) => rowMatches(r.keywords)));

const initialInfoRows = computed(() => (
    initialInfo.value ? initialInfoDetailRows(initialInfo.value) : []
));

const showInfoPanels = computed(
    () => initialInfoRows.value.length > 0 || subjects.value.length > 0,
);

const canExport = computed(
    () => showInfoPanels.value
        || teams.value.length > 0
        || resourceAssignments.value.length > 0
        || workAssignments.value.length > 0
        || displayRows.value.length > 0,
);

function sortBy(): void {
    sortAsc.value = !sortAsc.value;
}
function sortIndicator(): string {
    return sortAsc.value ? '▲' : '▼';
}

// ---- Source → person name (from TAK Portal directory) ---------------------

// TAK Portal user-search endpoint, exposed cross-origin via Caddy (CORS +
// credentials) behind Authentik forward_auth. TAK Portal itself authorizes:
// global/agency admins get the directory (200), everyone else gets 403. Leave
// blank to disable name resolution (source shows the raw creatorUid).
const PORTAL_DIRECTORY_URL = ''; // e.g. 'https://takportal.example.org/api/users/search?pageSize=1000&sortKey=name&sortDir=asc'

const userMap = ref<Record<string, string>>({});
// true once the portal returns the directory (i.e. the current user is an admin).
const directoryAccess = ref(false);

function emailFromUid(uid: string): string {
    return (uid || '').replace(/^ANDROID-CloudTAK-/i, '').replace(/^ANDROID-/i, '');
}

/** TAK Portal's `name` is "Last, First" → render as "Last, F". */
function formatPortalName(name: string): string {
    const s = String(name || '').trim();
    const [last, first] = s.split(',', 2).map((x) => x.trim());
    if (last && first) return `${last}, ${first[0].toUpperCase()}`;
    return s;
}

/**
 * Resolve a log's creatorUid to a person. Only admins (who got the directory)
 * see names; everyone else sees the cleaned creatorUid as before.
 */
function displaySource(uid: string): string {
    if (!uid) return '';
    if (directoryAccess.value) {
        const key = emailFromUid(uid).toLowerCase();
        if (userMap.value[key]) return userMap.value[key];
    }
    return emailFromUid(uid);
}

interface DirectoryUser { username?: string; email?: string; name?: string }

async function loadDirectory(): Promise<void> {
    if (!PORTAL_DIRECTORY_URL) { directoryAccess.value = false; return; }
    try {
        const res = await fetch(PORTAL_DIRECTORY_URL, { credentials: 'include' });
        if (!res.ok) {
            // 401/403 → not an admin (or no portal session): hide names.
            directoryAccess.value = false;
            userMap.value = {};
            return;
        }
        const data = await res.json() as { users?: DirectoryUser[] } | DirectoryUser[];
        const items = Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : []);
        const map: Record<string, string> = {};
        for (const u of items) {
            const display = formatPortalName(u.name || '') || u.username || '';
            if (!display) continue;
            if (u.username) map[u.username.toLowerCase()] = display;
            if (u.email) map[u.email.toLowerCase()] = display;
        }
        userMap.value = map;
        directoryAccess.value = true;
    } catch {
        // CORS / redirect-to-login / network → treat as no access.
        directoryAccess.value = false;
        userMap.value = {};
    }
}

// ---- Mission log load ------------------------------------------------------

function parseTime(raw?: string): { rawTime: string; epoch: number } {
    if (!raw) return { rawTime: '', epoch: 0 };
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return { rawTime: raw, epoch: 0 };
    return { rawTime: raw, epoch: ms };
}

function exportRows() {
    return displayRows.value.map((r) => ({
        epoch: r.epoch,
        content: r.content,
        source: displaySource(r.source),
        keywords: r.keywords,
    }));
}

function exportCsv(): void {
    if (!requireActiveMission()) return;
    if (!canExport.value) return;
    exportDashboardCsv(
        exportRows(),
        activeMission.value.name,
        subjects.value,
        teams.value,
        resourceAssignments.value,
        workAssignments.value,
    );
}

async function exportPdf(): Promise<void> {
    if (!requireActiveMission()) return;
    if (!canExport.value) return;
    try {
        let info = initialInfo.value;
        if (!info) {
            const sub = await loadIncidentSubscription(activeMission.value);
            const { schema } = await loadMissionSchema(sub);
            const logs = await sub.log.list({ refresh: true });
            info = resolveIncidentInfoForm(schema, logs);
        }
        exportDashboardPdf(
            exportRows(),
            activeMission.value.name,
            subjects.value,
            info,
            teams.value,
            resourceAssignments.value,
            workAssignments.value,
        );
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    }
}

async function onRefresh(): Promise<void> {
    if (!requireActiveMission()) return;
    await refresh();
}

async function refresh(): Promise<void> {
    if (!activeMission.value) return;
    loading.value = true; error.value = '';
    try {
        const mission = activeMission.value;
        const sub = await loadIncidentSubscription(mission);
        const { schema } = await loadMissionSchema(sub);
        const logs = await sub.log.list({ refresh: true });
        const [orgChartLoaded, resourceLoaded, workLoaded, roster] = await Promise.all([
            loadOrgChartFromMission(mission),
            loadResourceAssignmentsFromMission(mission),
            loadWorkAssignmentsFromMission(mission),
            loadD4hRoster(),
        ]);

        initialInfo.value = resolveIncidentInfoForm(schema, logs);
        subjects.value = parseSubjectsFromLogs(logs);
        teams.value = dashboardTeamsFromOrgChart(
            orgChartLoaded.tree,
            roster?.members ?? [],
        );
        resourceAssignments.value = resourceLoaded.assignments;
        workAssignments.value = workLoaded.assignments;
        rows.value = logs
            .filter((log: DBSubscriptionLog) => {
                const kws = Array.isArray(log.keywords) ? log.keywords : [];
                return !kws.includes(SUBJECT_KEYWORD);
            })
            .map((log: DBSubscriptionLog) => {
            const f = parseTime(log.dtg || log.created);
            return {
                rawTime: f.rawTime,
                epoch: f.epoch,
                content: log.content || '',
                source: log.creatorUid || '',
                keywords: Array.isArray(log.keywords) ? log.keywords : [],
            };
        });
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

onMounted(loadDirectory);

// Auto-load when an active mission appears / changes.
watch(activeMission, (m) => {
    if (m) refresh();
    else {
        rows.value = [];
        subjects.value = [];
        initialInfo.value = null;
        teams.value = [];
        resourceAssignments.value = [];
        workAssignments.value = [];
    }
}, { immediate: true });
</script>

<style scoped>
.transition-transform {
    transition: transform 0.2s ease;
}

.rotate-180 {
    transform: rotate(180deg);
}

.dashboard-log-table {
    table-layout: fixed;
    width: 100%;
}

.dashboard-log-col-time {
    width: 12%;
}

.dashboard-log-col-entry {
    width: 58%;
}

.dashboard-log-col-source {
    width: 14%;
}

.dashboard-log-col-keywords {
    width: 16%;
}

.dashboard-log-entry-cell {
    overflow-wrap: anywhere;
    word-break: break-word;
}

.dashboard-log-keywords-cell {
    overflow-wrap: anywhere;
}

/* Enforce default visual proportions across header/body cells. */
.dashboard-log-table :is(th, td):nth-child(2) {
    width: 58%;
}

.dashboard-log-table :is(th, td):nth-child(4) {
    width: 16%;
}
</style>
