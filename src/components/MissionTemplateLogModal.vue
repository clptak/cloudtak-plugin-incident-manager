<template>
    <Teleport to='body'>
        <div
            class='modal modal-blur incident-modal show d-block'
            tabindex='-1'
            role='dialog'
            @click.self='onDismiss'
        >
            <div
                class='modal-dialog modal-dialog-centered modal-dialog-scrollable'
                role='document'
            >
                <div class='modal-content'>
                    <div class='modal-header'>
                        <h5 class='modal-title'>
                            {{ log.name }}
                        </h5>
                        <button
                            type='button'
                            class='btn-close'
                            aria-label='Close'
                            :disabled='busy'
                            @click='onDismiss'
                        />
                    </div>
                    <div class='modal-body'>
                        <p class='mb-2 text-secondary small'>
                            Submitting to {{ destinationLabel }}
                        </p>
                        <TablerSchema
                            v-model='values'
                            :schema='formSchema'
                            :disabled='busy'
                        />
                        <TablerInlineAlert
                            v-if='error'
                            class='mt-2'
                            severity='danger'
                            title='Error'
                            :description='error'
                        />
                    </div>
                    <div class='modal-footer'>
                        <button
                            type='button'
                            class='btn btn-secondary'
                            :disabled='busy'
                            @click='onDismiss'
                        >
                            Cancel
                        </button>
                        <button
                            type='button'
                            class='btn btn-primary'
                            :disabled='busy'
                            @click='onSubmit'
                        >
                            {{ busy ? 'Submitting…' : 'Submit' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class='modal-backdrop fade show' />
    </Teleport>
</template>

<script setup lang='ts'>
import { onMounted, ref } from 'vue';
import { TablerInlineAlert, TablerSchema } from '@tak-ps/vue-tabler';
import type { ActiveMission } from '../composables/useIncident.ts';
import type { MissionTemplateLogItem } from '../lib/missionTemplates.ts';
import {
    resolveTemplateLogTarget,
    submitMissionTemplateLog,
} from '../lib/missionTemplateLogSubmit.ts';
import './incidentModal.css';

const EMPTY_SCHEMA = {
    type: 'object',
    properties: {},
    required: [] as string[],
};

const props = defineProps<{
    log: MissionTemplateLogItem;
    mission: ActiveMission;
}>();

const emit = defineEmits<{
    close: [];
}>();

const values = ref<Record<string, unknown>>({});
const destinationLabel = ref(props.mission.name);
const busy = ref(false);
const error = ref('');

const formSchema = schemaObject(props.log.schema);

function schemaObject(schema: unknown): Record<string, unknown> {
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
        const obj = schema as Record<string, unknown>;
        if (obj.properties && typeof obj.properties === 'object') return obj;
    }
    return EMPTY_SCHEMA;
}

function onDismiss(): void {
    if (busy.value) return;
    emit('close');
}

onMounted(() => {
    void resolveTemplateLogTarget(props.mission).then((target) => {
        destinationLabel.value = target.label;
    }).catch(() => {
        /* keep the common-mission label; submit surfaces failures */
    });
});

async function onSubmit(): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
        await submitMissionTemplateLog({
            mission: props.mission,
            log: props.log,
            values: values.value,
        });
        emit('close');
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}
</script>
