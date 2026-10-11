<template>
    <div
        v-if='changedLabels.length'
        class='cloudtak-accent border border-warning rounded-3 mb-2 px-3 py-2 d-flex flex-wrap align-items-center gap-2'
        role='status'
    >
        <span class='small text-warning flex-grow-1'>
            Another manager updated {{ changedLabels.join(', ') }} on this screen.
            Reload to see it. Anything you haven't saved here will be cleared.
        </span>
        <button
            class='btn btn-warning btn-sm'
            @click='onReload'
        >
            Reload
        </button>
        <button
            class='btn btn-link btn-sm text-white-50'
            @click='changed.clear()'
        >
            Dismiss
        </button>
    </div>
</template>

<script setup lang='ts'>
/**
 * "Updated by another manager" notice for form screens. Shown only when
 * someone else changes what the open screen edits (screenKeys.ts); never
 * reloads by itself, so nothing being typed is overwritten.
 */
import { computed, reactive, watch } from 'vue';
import { useIncident } from '../composables/useIncident.ts';
import { useIncidentChanges } from '../composables/useIncidentChanges.ts';
import { keyLabels, screenChangedKeys, screenId } from '../lib/screenKeys.ts';

const emit = defineEmits<{ (e: 'reload'): void }>();

const { activeKey, activeHTab } = useIncident();
const screen = computed(() => screenId(activeKey.value, activeHTab.value));
const changed = reactive(new Set<string>());
const changedLabels = computed(() => keyLabels(changed));

useIncidentChanges((changes) => {
    for (const key of screenChangedKeys(screen.value, changes.map((c) => c.key))) changed.add(key);
});

// A different screen loads fresh data, so the notice no longer applies.
watch(screen, () => changed.clear());

function onReload(): void {
    changed.clear();
    emit('reload');
}
</script>
