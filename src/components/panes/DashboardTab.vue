<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>
                Dashboard
            </h3>
            <button
                class='btn btn-outline-primary btn-sm ms-auto'
                :disabled='!activeMission || loading'
                @click='refresh'
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

            <div class='table-responsive'>
                <table class='table table-sm table-vcenter table-striped table-hover mb-0'>
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
                                {{ r.time }}
                            </td>
                            <td>{{ r.content }}</td>
                            <td class='text-nowrap'>
                                {{ displaySource(r.source) }}
                            </td>
                            <td>
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
import Subscription from '../../../../src/base/subscription.ts';
import type { DBSubscriptionLog } from '../../../../src/database.ts';
import { useIncident } from '../../composables/useIncident.ts';

const { activeMission } = useIncident();

interface Row {
    time: string;
    epoch: number;
    content: string;
    source: string;   // raw creatorUid; resolved to a person at render time
    keywords: string[];
}

const rows = ref<Row[]>([]);
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

function fmt(raw?: string): { time: string; epoch: number } {
    if (!raw) return { time: '', epoch: 0 };
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return { time: raw, epoch: 0 };
    return { time: new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + 'Z', epoch: ms };
}

async function refresh(): Promise<void> {
    if (!activeMission.value) return;
    loading.value = true; error.value = '';
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const logs = await sub.log.list({ refresh: true });
        rows.value = logs.map((log: DBSubscriptionLog) => {
            const f = fmt(log.dtg || log.created);
            return {
                time: f.time,
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
    else rows.value = [];
}, { immediate: true });
</script>
