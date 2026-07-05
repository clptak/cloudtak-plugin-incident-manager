<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-3'>
            <h3 class='mb-0'>
                Resources
            </h3>
            <button
                class='btn btn-outline-primary btn-sm ms-auto'
                :disabled='loading'
                @click='refresh'
            >
                {{ loading ? 'Loading…' : 'Refresh' }}
            </button>
        </div>

        <div
            v-if='!roster'
            class='alert alert-info small mb-3'
        >
            No D4H roster in this browser. Open the <strong>D4H</strong> plugin, configure
            Team Manager, and run <strong>Sync now</strong>, then refresh here.
        </div>

        <template v-else>
            <div class='text-muted small mb-3'>
                From D4H sync
                <span v-if='meta?.fetchedAt'> · {{ formatD4hSyncTime(meta.fetchedAt) }}</span>
                · {{ roster.members.length }} personnel · {{ roster.equipment.length }} equipment
            </div>

            <ul class='nav nav-tabs mb-3'>
                <li class='nav-item'>
                    <button
                        type='button'
                        class='nav-link'
                        :class='{ active: tab === "personnel" }'
                        @click='tab = "personnel"'
                    >
                        Personnel ({{ roster.members.length }})
                    </button>
                </li>
                <li class='nav-item'>
                    <button
                        type='button'
                        class='nav-link'
                        :class='{ active: tab === "equipment" }'
                        @click='tab = "equipment"'
                    >
                        Equipment ({{ roster.equipment.length }})
                    </button>
                </li>
            </ul>

            <div
                v-if='tab === "personnel"'
                class='table-responsive'
            >
                <table class='table table-sm table-hover align-middle mb-0'>
                    <thead>
                        <tr>
                            <th>Badge</th>
                            <th>Name</th>
                            <th>Position</th>
                            <th>Mobile</th>
                            <th>Qualifications</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='m in roster.members'
                            :key='m.id'
                        >
                            <td class='text-muted'>
                                {{ m.ref || '—' }}
                            </td>
                            <td>{{ m.name }}</td>
                            <td>{{ m.position || '—' }}</td>
                            <td>{{ m.mobile || m.phone || '—' }}</td>
                            <td class='small text-muted'>
                                {{ qualSummary(m) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                v-else
                class='table-responsive'
            >
                <table class='table table-sm table-hover align-middle mb-0'>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Type</th>
                            <th>Make</th>
                            <th>Model</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='e in roster.equipment'
                            :key='e.id'
                        >
                            <td class='text-muted'>
                                {{ e.ref || '—' }}
                            </td>
                            <td>{{ e.name }}</td>
                            <td>{{ e.make || '—' }}</td>
                            <td>{{ e.model || '—' }}</td>
                            <td>{{ e.category || '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { formatD4hSyncTime, loadD4hMeta, loadD4hRoster } from '../../lib/d4hRoster.ts';
import type { D4HMember, D4HRoster, D4HRosterMeta } from '../../lib/d4hTypes.ts';

const tab = ref<'personnel' | 'equipment'>('personnel');
const loading = ref(false);
const roster = ref<D4HRoster | null>(null);
const meta = ref<D4HRosterMeta | null>(null);

function qualSummary(m: D4HMember): string {
    const names = (m.qualifications || []).map((q) => q.name).filter(Boolean);
    return names.length ? names.join(', ') : '—';
}

async function refresh(): Promise<void> {
    loading.value = true;
    try {
        roster.value = await loadD4hRoster();
        meta.value = await loadD4hMeta();
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    void refresh();
});
</script>
