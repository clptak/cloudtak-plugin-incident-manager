<template>
    <div
        v-if='storage === "file"'
        class='card card-sm mb-2'
    >
        <div class='card-body py-2'>
            <div class='d-flex flex-wrap align-items-center gap-2'>
                <div class='small'>
                    <strong>Planning data:</strong> mission_schema.json.
                    This TAK Server supports Mission Properties, which keep simultaneous edits by different managers from overwriting each other.
                </div>
                <template v-if='!confirming'>
                    <button
                        class='btn btn-outline-primary btn-sm ms-auto'
                        :disabled='busy'
                        @click='confirming = true'
                    >
                        Move to Mission Properties
                    </button>
                </template>
                <template v-else>
                    <span class='small text-muted ms-auto'>
                        Every manager switches over; the file is kept as a backup but no longer updated.
                    </span>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='busy'
                        @click='migrate'
                    >
                        {{ busy ? 'Moving…' : 'Confirm move' }}
                    </button>
                    <button
                        class='btn btn-link btn-sm'
                        :disabled='busy'
                        @click='confirming = false'
                    >
                        Cancel
                    </button>
                </template>
            </div>
            <TablerInlineAlert
                v-if='error'
                class='mt-2'
                severity='danger'
                title='Could not move to Mission Properties'
                :description='error'
            />
        </div>
    </div>
    <div
        v-else-if='storage === "keys"'
        class='small text-muted mb-2'
    >
        Planning data: Mission Properties{{ migratedKeys ? ` (moved, ${migratedKeys} keys)` : '' }}
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { TablerInlineAlert } from '@tak-ps/vue-tabler';
import type { ActiveMission } from '../composables/useIncident.ts';
import { incidentSchemaStorage, migrateIncidentSchema } from '../lib/schemaMigration.ts';
import type { SchemaStorage } from '../lib/schemaPropertyBackend.ts';

const props = defineProps<{
    mission: ActiveMission | null;
}>();

const emit = defineEmits<{
    (e: 'migrated'): void;
}>();

const storage = ref<SchemaStorage | null>(null);
const confirming = ref(false);
const busy = ref(false);
const error = ref('');
const migratedKeys = ref(0);

async function check(): Promise<void> {
    storage.value = null;
    error.value = '';
    confirming.value = false;
    migratedKeys.value = 0;
    if (!props.mission) return;
    try {
        storage.value = await incidentSchemaStorage(props.mission);
    } catch {
        // No access to the management sync: nothing to offer.
        storage.value = null;
    }
}

async function migrate(): Promise<void> {
    if (!props.mission) return;
    busy.value = true;
    error.value = '';
    try {
        const { keys } = await migrateIncidentSchema(props.mission);
        migratedKeys.value = keys;
        storage.value = 'keys';
        confirming.value = false;
        emit('migrated');
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        storage.value = await incidentSchemaStorage(props.mission).catch(() => storage.value);
    } finally {
        busy.value = false;
    }
}

watch(() => props.mission?.mgmt?.guid, check, { immediate: true });
</script>
