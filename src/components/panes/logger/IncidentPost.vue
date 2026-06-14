<template>
    <div>
        <p class='text-muted small mb-3'>
            ICS 234-CG Work Analysis Matrix — each row is one objective with its strategies and
            tactics. Saved to the active DataSync and recalled here; re-saving a row updates it in
            place. (Header fields and signature are filled at PDF export.)
        </p>

        <div
            v-if='loading'
            class='text-muted small mb-2'
        >
            Loading existing entries…
        </div>

        <div
            v-for='i in visibleCount'
            :key='i'
            class='card mb-2'
        >
            <div class='card-header py-1 d-flex align-items-center'>
                <strong>Row {{ i }}</strong>
                <span
                    v-if='rowIsLegacy(i - 1)'
                    class='badge bg-secondary ms-2'
                    title='Originally saved under the old risk-assessment keyword'
                >legacy</span>
            </div>
            <div class='card-body py-2'>
                <div class='row g-2'>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>4 · Objective <span class='text-muted'>(Desired Outcome)</span></label>
                        <textarea
                            v-model='rows[i - 1].objective'
                            class='form-control form-control-sm'
                            rows='4'
                            placeholder='Desired Outcome'
                        />
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>5 · Strategies <span class='text-muted'>(How)</span></label>
                        <textarea
                            v-model='rows[i - 1].strategy'
                            class='form-control form-control-sm'
                            rows='4'
                            placeholder='How'
                        />
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>6 · Tactics / Work Assignments <span class='text-muted'>(Who / What / Where / When)</span></label>
                        <textarea
                            v-model='rows[i - 1].tactic'
                            class='form-control form-control-sm'
                            rows='4'
                            placeholder='Who / What / Where / When'
                        />
                    </div>
                </div>
            </div>
        </div>

        <button
            v-if='visibleCount < MAX_ROWS'
            type='button'
            class='btn btn-outline-primary btn-sm'
            @click='addRow'
        >
            + Add Row {{ visibleCount + 1 }}
        </button>
        <div
            v-else
            class='form-text text-muted'
        >
            Maximum of {{ MAX_ROWS }} rows (one ICS 234-CG page).
        </div>

        <div class='mt-3'>
            <button
                class='btn btn-primary btn-sm'
                :disabled='!activeMission || saving || (!filledRowCount && !pendingDeletions)'
                @click='save'
            >
                {{ saving ? 'Saving…' : `Save ${filledRowCount} row${filledRowCount === 1 ? '' : 's'} to DataSync` }}
            </button>
            <button
                class='btn btn-outline-secondary btn-sm ms-2'
                @click='reset'
            >
                Clear
            </button>
        </div>

        <div
            v-if='!activeMission'
            class='form-text text-warning'
        >
            No active mission. Select one in Create | Open first.
        </div>
        <div
            v-else
            class='form-text'
        >
            Active DataSync: <strong>{{ activeMission.name }}</strong>
        </div>
        <div
            v-if='status'
            class='fw-bold mt-1'
            :class='statusError ? "text-danger" : "text-success"'
        >
            {{ status }}
        </div>

        <!-- Running list: ICS 234-CG matrix reconstructed from DataSync -->
        <div class='card mt-4'>
            <div class='card-header py-2 d-flex align-items-center'>
                <h3 class='card-title mb-0'>
                    Work Analysis Matrix — on DataSync ({{ savedRows.length }})
                </h3>
            </div>
            <div class='card-body py-2'>
                <div
                    v-if='loading'
                    class='text-muted small'
                >
                    Loading…
                </div>
                <div
                    v-else-if='!savedRows.length'
                    class='text-muted small'
                >
                    No entries on DataSync yet. Fill a row above and save.
                </div>
                <div
                    v-else
                    class='table-responsive'
                >
                    <table class='table table-sm table-vcenter table-bordered mb-0'>
                        <thead>
                            <tr>
                                <th style='width:3rem;'>
                                    #
                                </th>
                                <th>4 · Objective (Desired Outcome)</th>
                                <th>5 · Strategies (How)</th>
                                <th>6 · Tactics / Work Assignments (Who / What / Where / When)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for='r in savedRows'
                                :key='r.row'
                            >
                                <td>
                                    {{ r.row }}
                                    <span
                                        v-if='r.legacy'
                                        class='badge bg-secondary'
                                        title='Originally saved under the old risk-assessment keyword'
                                    >L</span>
                                </td>
                                <td style='white-space:pre-wrap;'>
                                    {{ r.objective }}
                                </td>
                                <td style='white-space:pre-wrap;'>
                                    {{ r.strategy }}
                                </td>
                                <td style='white-space:pre-wrap;'>
                                    {{ r.tactic }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

const MAX_ROWS = 8; // one printable ICS 234-CG page
const DEFAULT_OBJECTIVE = 'Provide for safety of incident personnel and public';

// Both keywords identify Incident POST entries: the current one and the legacy
// 'risk-assessment' tag these were saved under before the pane was moved.
const POST_KEYWORDS = ['incident-post', 'risk-assessment'];

// field key -> human label used in the log content (so it stays readable in
// reports and is parseable back into ICS 234-CG columns: <Title> <row>: <text>).
const FIELDS = [
    { key: 'objective', title: 'Objective' },
    { key: 'strategy', title: 'Strategy' },
    { key: 'tactic', title: 'Tactic' },
] as const;
type FieldKey = typeof FIELDS[number]['key'];

interface Row {
    objective: string;
    strategy: string;
    tactic: string;
    ids: Partial<Record<FieldKey, string>>;  // existing log id per field, for upsert
    legacy: boolean;                          // any field came from the legacy keyword
}

function blankRows(): Row[] {
    const rows: Row[] = Array.from({ length: MAX_ROWS }, () => ({
        objective: '', strategy: '', tactic: '', ids: {}, legacy: false,
    }));
    rows[0].objective = DEFAULT_OBJECTIVE;
    return rows;
}

const rows = ref<Row[]>(blankRows());
const visibleCount = ref(1);

/** Read-only snapshot of what's actually on DataSync, for the running list. */
interface SavedRow {
    row: number;
    objective: string;
    strategy: string;
    tactic: string;
    legacy: boolean;
}
const savedRows = ref<SavedRow[]>([]);

const loading = ref(false);
const saving = ref(false);
const status = ref('');
const statusError = ref(false);

const filledRowCount = computed(() => {
    let n = 0;
    for (let i = 0; i < visibleCount.value; i++) {
        const r = rows.value[i];
        if (r.objective.trim() || r.strategy.trim() || r.tactic.trim()) n++;
    }
    return n;
});

/** Cells that were saved before but are now empty — they'll be deleted on save. */
const pendingDeletions = computed(() => {
    let n = 0;
    for (let i = 0; i < visibleCount.value; i++) {
        const r = rows.value[i];
        for (const f of FIELDS) {
            if (!r[f.key].trim() && r.ids[f.key]) n++;
        }
    }
    return n;
});

function rowIsLegacy(i: number): boolean {
    return !!rows.value[i]?.legacy;
}

function addRow(): void {
    if (visibleCount.value < MAX_ROWS) visibleCount.value++;
}

function titleFor(key: FieldKey): string {
    return FIELDS.find((f) => f.key === key)!.title;
}

function stripPrefix(content: string, key: FieldKey): string {
    return content.replace(new RegExp(`^${titleFor(key)}\\s+\\d+:\\s*`), '').trim();
}

/** Load rows from DataSync, recognising both the new and legacy keywords. */
async function loadRows(): Promise<void> {
    if (!activeMission.value) {
        rows.value = blankRows();
        savedRows.value = [];
        return;
    }
    loading.value = true;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const logs = await sub.log.list({ refresh: true });

        const fresh = blankRows();
        // clear the default so a real stored objective:1 wins; restored below if absent.
        fresh[0].objective = '';
        const seenAt: Record<string, number> = {};
        let maxRow = 1;

        for (const log of logs) {
            const kws = Array.isArray(log.keywords) ? log.keywords : [];
            if (!kws.some((k: string) => POST_KEYWORDS.includes(k))) continue;
            const tag = kws.find((k: string) => /^(objective|strategy|tactic):\d+$/.test(k));
            if (!tag) continue;
            const [field, nStr] = tag.split(':') as [FieldKey, string];
            const n = Number(nStr);
            if (!(n >= 1 && n <= MAX_ROWS)) continue;

            const created = Date.parse(log.created || log.dtg || '') || 0;
            const cell = `${field}:${n}`;
            if (seenAt[cell] !== undefined && created < seenAt[cell]) continue; // keep newest
            seenAt[cell] = created;

            const row = fresh[n - 1];
            row[field] = stripPrefix(log.content || '', field);
            row.ids[field] = String(log.id);
            if (!kws.includes('incident-post')) row.legacy = true;
            if (n > maxRow) maxRow = n;
        }

        // Running-list snapshot: only cells actually saved on DataSync (no default fill).
        const saved: SavedRow[] = [];
        for (let i = 0; i < MAX_ROWS; i++) {
            const r = fresh[i];
            if (r.ids.objective || r.ids.strategy || r.ids.tactic) {
                saved.push({
                    row: i + 1,
                    objective: r.ids.objective ? r.objective : '',
                    strategy: r.ids.strategy ? r.strategy : '',
                    tactic: r.ids.tactic ? r.tactic : '',
                    legacy: r.legacy,
                });
            }
        }
        savedRows.value = saved;

        if (!fresh[0].ids.objective && !fresh[0].objective) fresh[0].objective = DEFAULT_OBJECTIVE;

        rows.value = fresh;
        visibleCount.value = Math.max(visibleCount.value, maxRow, 1);
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load entries: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loading.value = false;
    }
}

onMounted(loadRows);
watch(() => activeMission.value?.guid, loadRows);

function reset(): void {
    rows.value = blankRows();
    visibleCount.value = 1;
    status.value = '';
    statusError.value = false;
}

async function save(): Promise<void> {
    if (!activeMission.value || (!filledRowCount.value && !pendingDeletions.value)) return;
    saving.value = true; status.value = ''; statusError.value = false;
    let created = 0; let updated = 0; let deleted = 0; let failed = 0;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        for (let i = 0; i < visibleCount.value; i++) {
            const n = i + 1;
            const row = rows.value[i];
            for (const f of FIELDS) {
                const text = row[f.key].trim();
                const id = row.ids[f.key];
                if (!text) {
                    // Cleared cell: remove its DataSync entry if one existed.
                    if (id) {
                        try {
                            await sub.log.delete(id);
                            delete row.ids[f.key];
                            deleted++;
                        } catch {
                            failed++;
                        }
                    }
                    continue;
                }
                const body = {
                    dtg: new Date().toISOString(),
                    content: `${f.title} ${n}: ${text}`,
                    keywords: ['incident-post', `${f.key}:${n}`],
                };
                try {
                    if (id) {
                        await sub.log.update(id, body);
                        updated++;
                    } else {
                        const res = await sub.log.create(body);
                        row.ids[f.key] = String(res.id);
                        created++;
                    }
                } catch {
                    failed++;
                }
            }
        }
        statusError.value = failed > 0;
        const parts: string[] = [];
        if (created) parts.push(`${created} new`);
        if (updated) parts.push(`${updated} updated`);
        if (deleted) parts.push(`${deleted} removed`);
        status.value = `Saved ${parts.join(', ') || '0'} to ${activeMission.value.name}`
            + (failed ? `, ${failed} failed.` : '.');
        await loadRows();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}
</script>
