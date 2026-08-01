<template>
    <div
        class='modal modal-blur show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='emit("cancel")'
    >
        <div
            class='modal-dialog modal-dialog-centered'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title'>
                        New Consensus
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='emit("cancel")'
                    />
                </div>
                <div class='modal-body'>
                    <div class='mb-3'>
                        <label class='form-label'>Incident Name</label>
                        <input
                            v-model='incidentName'
                            type='text'
                            class='form-control'
                        >
                    </div>
                    <div class='mb-3 d-flex align-items-center gap-2'>
                        <!-- Placeholder for future WinC.A.S.I.E. III local-file export. -->
                        <button
                            type='button'
                            class='btn btn-outline-secondary btn-sm'
                            title='Local folder selection is not available yet'
                        >
                            Folder:
                        </button>
                        <span class='text-muted small text-truncate'>Saved to the active DataSync mission</span>
                    </div>
                    <div class='mb-3'>
                        <label class='form-check'>
                            <input
                                v-model='useMyDocuments'
                                type='checkbox'
                                class='form-check-input'
                            >
                            <span class='form-check-label'>Use My Documents Folder</span>
                        </label>
                    </div>
                    <div class='mb-3'>
                        <label class='form-label'>Filename (no extension)</label>
                        <input
                            v-model='filename'
                            type='text'
                            class='form-control'
                        >
                    </div>
                    <div class='mb-3 row align-items-center'>
                        <label class='col-8 col-form-label'>Number of segments, (excluding R.O.W.)</label>
                        <div class='col-4'>
                            <input
                                :value='segmentCount'
                                type='text'
                                class='form-control'
                                readonly
                                title='Count of segments registered in Segmentation'
                            >
                        </div>
                    </div>
                    <div class='mb-2 row align-items-center'>
                        <label class='col-8 col-form-label'>Number of respondents</label>
                        <div class='col-4'>
                            <select
                                v-model.number='respondentCount'
                                class='form-select'
                            >
                                <option
                                    v-for='n in maxRespondents'
                                    :key='n'
                                    :value='n'
                                >
                                    {{ n }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div
                        v-if='error'
                        class='text-danger small'
                    >
                        {{ error }}
                    </div>
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn btn-primary'
                        :disabled='saving'
                        @click='onAccept'
                    >
                        {{ saving ? 'Saving…' : 'Accept' }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-secondary'
                        :disabled='saving'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        class='btn btn-outline-secondary'
                        title='Help is not available yet'
                    >
                        Help
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div class='modal-backdrop fade show' />
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { MAX_RESPONDENTS } from '../../../../lib/consensus.ts';

export interface SetupResult {
    incidentName: string;
    filename: string;
    useMyDocuments: boolean;
    respondentCount: number;
}

const props = defineProps<{
    initialIncidentName: string;
    initialFilename: string;
    initialUseMyDocuments: boolean;
    initialRespondentCount: number;
    segmentCount: number;
    saving: boolean;
}>();

const emit = defineEmits<{
    accept: [result: SetupResult];
    cancel: [];
}>();

const maxRespondents = MAX_RESPONDENTS;

const incidentName = ref(props.initialIncidentName);
const filename = ref(props.initialFilename || props.initialIncidentName);
const useMyDocuments = ref(props.initialUseMyDocuments);
const respondentCount = ref(
    Math.min(Math.max(props.initialRespondentCount, 1), MAX_RESPONDENTS),
);
const error = ref('');

// Keep the filename following the incident name until the user diverges it.
watch(incidentName, (next, prev) => {
    if (filename.value === prev) filename.value = next;
});

function onAccept(): void {
    if (!incidentName.value.trim()) {
        error.value = 'Incident Name is required.';
        return;
    }
    error.value = '';
    emit('accept', {
        incidentName: incidentName.value.trim(),
        filename: filename.value.trim(),
        useMyDocuments: useMyDocuments.value,
        respondentCount: respondentCount.value,
    });
}
</script>
