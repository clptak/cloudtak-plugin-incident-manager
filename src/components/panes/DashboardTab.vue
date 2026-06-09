<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>Dashboard</h3>
            <button
                class='btn btn-outline-primary btn-sm ms-auto'
                :disabled='!activeMission || loading'
                @click='refresh'
            >
                {{ loading ? 'Loading…' : 'Refresh' }}
            </button>
        </div>

        <div v-if='!activeMission' class='text-muted small'>
            Select a mission in Create | Open to load the combined log table.
        </div>

        <template v-else>
            <div class='small text-muted mb-2'>
                {{ activeMission.name }} — {{ rows.length }} log entr{{ rows.length === 1 ? 'y' : 'ies' }}
            </div>
            <div v-if='error' class='text-danger small mb-2'>{{ error }}</div>

            <div class='table-responsive'>
                <table class='table table-sm table-vcenter table-striped table-hover mb-0'>
                    <thead>
                        <tr>
                            <th class='cursor-pointer' @click='sortBy("time")'>Time {{ sortIndicator('time') }}</th>
                            <th>Entry</th>
                            <th>Source</th>
                            <th>Keywords</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for='(r, i) in sortedRows' :key='i'>
                            <td class='text-nowrap'>{{ r.time }}</td>
                            <td>{{ r.content }}</td>
                            <td class='text-nowrap'>{{ r.source }}</td>
                            <td>
                                <span
                                    v-for='k in r.keywords'
                                    :key='k'
                                    class='badge bg-blue-lt me-1'
                                >{{ k }}</span>
                            </td>
                        </tr>
                        <tr v-if='!rows.length'>
                            <td colspan='4' class='text-muted text-center'>No log entries.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import Subscription from '@/base/subscription.ts';
import { useIncident } from '../../composables/useIncident.ts';

const { activeMission } = useIncident();

interface Row {
    time: string;
    epoch: number;
    content: string;
    source: string;
    keywords: string[];
}

const rows = ref<Row[]>([]);
const loading = ref(false);
const error = ref('');
const sortAsc = ref(true);

function fmt(raw?: string): { time: string; epoch: number } {
    if (!raw) return { time: '', epoch: 0 };
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return { time: raw, epoch: 0 };
    return { time: new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + 'Z', epoch: ms };
}

const sortedRows = computed(() => {
    const copy = [...rows.value];
    copy.sort((a, b) => (sortAsc.value ? a.epoch - b.epoch : b.epoch - a.epoch));
    return copy;
});

function sortBy(_key: 'time'): void {
    sortAsc.value = !sortAsc.value;
}
function sortIndicator(_key: 'time'): string {
    return sortAsc.value ? '▲' : '▼';
}

async function refresh(): Promise<void> {
    if (!activeMission.value) return;
    loading.value = true; error.value = '';
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const logs = await sub.log.list({ refresh: true });
        rows.value = logs.map((log) => {
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

// Auto-load when an active mission appears / changes.
watch(activeMission, (m) => {
    if (m) refresh();
    else rows.value = [];
}, { immediate: true });
</script>
