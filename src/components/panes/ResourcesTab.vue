<template>
    <div class='d-flex flex-column h-100 min-height-0 overflow-hidden'>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2 flex-shrink-0'>
            <h3 class='mb-0'>
                Resources
            </h3>
            <span
                v-if='meta?.fetchedAt'
                class='text-muted small'
            >
                D4H sync {{ formatD4hSyncTime(meta.fetchedAt) }}
            </span>
            <div class='ms-auto'>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm'
                    :disabled='loadingRoster'
                    @click='refreshRoster'
                >
                    {{ loadingRoster ? 'Loading…' : 'Refresh D4H' }}
                </button>
            </div>
        </div>

        <p class='text-muted small mb-2 flex-shrink-0'>
            External agencies from the D4H <strong>External Resource Tracker</strong>
            (Intelligence → Resources). Sync in the <strong>D4H</strong> plugin first, then
            refresh here.
        </p>

        <div
            v-if='!loadingRoster && !meta'
            class='alert alert-info small mb-2 flex-shrink-0'
        >
            No D4H roster in this browser. Open the <strong>D4H</strong> plugin, configure
            Team Manager, and run <strong>Sync now</strong>, then click <strong>Refresh D4H</strong>.
        </div>

        <div
            v-else-if='!loadingRoster && !externalResources.length'
            class='alert alert-warning small mb-2 flex-shrink-0'
        >
            No external resources in the cached D4H roster. Run <strong>Sync now</strong> in the
            D4H plugin (uses the D4H search API), then click <strong>Refresh D4H</strong>.
        </div>

        <div
            v-if='externalResourceWarnings.length'
            class='alert alert-warning small py-2 mb-2 flex-shrink-0'
        >
            <div
                v-for='(warning, i) in externalResourceWarnings'
                :key='`ext-warning-${i}`'
            >
                {{ warning }}
            </div>
        </div>

        <div
            v-if='externalResources.length'
            class='card flex-grow-1 min-height-0 d-flex flex-column'
        >
            <div class='card-header py-2 px-3 d-flex align-items-center gap-2 flex-wrap flex-shrink-0'>
                <span class='small fw-semibold'>
                    External resources ({{ visibleExternalResources.length }}<span
                        v-if='visibleExternalResources.length !== externalResources.length'
                        class='text-muted fw-normal'
                    > of {{ externalResources.length }}</span>)
                </span>
                <input
                    v-model='resourceFilter'
                    type='search'
                    class='form-control form-control-sm ms-auto'
                    style='max-width: 280px;'
                    placeholder='Filter by id or agency name…'
                    autocomplete='off'
                >
            </div>
            <div class='table-responsive flex-grow-1 min-height-0 overflow-auto'>
                <table class='table table-sm table-hover mb-0 small'>
                    <thead class='sticky-top bg-body'>
                        <tr>
                            <th
                                style='width: 88px; cursor: pointer; user-select: none;'
                                @click='toggleResourceSort("id")'
                            >
                                ID
                                <span
                                    v-if='resourceSortBy === "id"'
                                    class='text-muted ms-1'
                                >{{ resourceSortDir === "asc" ? "▲" : "▼" }}</span>
                            </th>
                            <th
                                style='cursor: pointer; user-select: none;'
                                @click='toggleResourceSort("name")'
                            >
                                Agency
                                <span
                                    v-if='resourceSortBy === "name"'
                                    class='text-muted ms-1'
                                >{{ resourceSortDir === "asc" ? "▲" : "▼" }}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='r in visibleExternalResources'
                            :key='r.id'
                        >
                            <td class='font-monospace'>
                                {{ r.id }}
                            </td>
                            <td>{{ r.name }}</td>
                        </tr>
                        <tr v-if='visibleExternalResources.length === 0'>
                            <td
                                colspan='2'
                                class='text-center text-muted py-3'
                            >
                                No resources match the filter.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import {
    filterAndSortExternalResources,
    formatD4hSyncTime,
    loadD4hMeta,
    loadD4hRoster,
} from '../../lib/d4hRoster.ts';
import type { D4HExternalResource, D4HRosterMeta } from '../../lib/d4hTypes.ts';

const loadingRoster = ref(false);
const meta = ref<D4HRosterMeta | null>(null);
const externalResources = ref<D4HExternalResource[]>([]);
const resourceFilter = ref('');
const resourceSortBy = ref<'id' | 'name'>('name');
const resourceSortDir = ref<'asc' | 'desc'>('asc');

const visibleExternalResources = computed(() =>
    filterAndSortExternalResources(
        externalResources.value,
        resourceFilter.value,
        resourceSortBy.value,
        resourceSortDir.value,
    ),
);

const externalResourceWarnings = computed(() => {
    const warnings = meta.value?.warnings ?? [];
    return warnings.filter((w) => /external resource/i.test(w));
});

function toggleResourceSort(key: 'id' | 'name'): void {
    if (resourceSortBy.value === key) {
        resourceSortDir.value = resourceSortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        resourceSortBy.value = key;
        resourceSortDir.value = 'asc';
    }
}

async function refreshRoster(): Promise<void> {
    loadingRoster.value = true;
    try {
        const roster = await loadD4hRoster();
        meta.value = roster?.meta ?? await loadD4hMeta();
        externalResources.value = roster?.externalResources ?? [];
    } finally {
        loadingRoster.value = false;
    }
}

onMounted(() => {
    void refreshRoster();
});
</script>
