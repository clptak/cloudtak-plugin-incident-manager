<template>
    <div class='row g-3'>
        <div class='col-lg-8'>
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
                        v-if='eventId'
                        class='small text-muted mb-2'
                    >
                        Event ID: <code>{{ eventId }}</code>
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
import { ref, computed } from 'vue';
import Subscription from '../../../../../src/base/subscription.ts';
import { getMpsRows } from '../../../lib/mpsParser.ts';
import type { MpsRow } from '../../../lib/mpsParser.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

const cadText = ref('');
const rows = ref<MpsRow[]>([]);
const selected = ref<boolean[]>([]);
const eventId = ref<string | null>(null);
const posting = ref(false);
const status = ref('');
const statusError = ref(false);

const selectedCount = computed(() => selected.value.filter(Boolean).length);
const allSelected = computed(
    () => rows.value.length > 0 && selectedCount.value === rows.value.length,
);

function toggleAll(): void {
    const next = !allSelected.value;
    selected.value = rows.value.map(() => next);
}

function parse(): void {
    status.value = '';
    statusError.value = false;
    const res = getMpsRows(cadText.value);
    rows.value = res.rows;
    selected.value = res.rows.map(() => true);
    eventId.value = res.eventId;
    if (!rows.value.length) {
        statusError.value = true;
        status.value = 'No timestamped Remarks entries found in the pasted text.';
    }
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
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}
</script>
