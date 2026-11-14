<template>
    <div
        class='modal modal-blur incident-modal show d-block'
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
                        <TablerInput
                            v-model='incidentName'
                            label='Incident Name'
                        />
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
                        <TablerToggle
                            v-model='useMyDocuments'
                            label='Use My Documents Folder'
                        />
                    </div>
                    <div class='mb-3'>
                        <TablerInput
                            v-model='filename'
                            label='Filename (no extension)'
                        />
                    </div>
                    <div class='mb-3'>
                        <label class='form-label'>Number of Segments, (excluding R.O.W.)</label>
                        <input
                            v-model.number='totalSegments'
                            type='number'
                            class='form-control'
                            :min='Math.max(segmentCount, 1)'
                            max='99'
                            :title='`${segmentCount} registered in Segmentation`'
                        >
                        <div class='form-hint'>
                            <template v-if='declareCount > 0'>
                                {{ declareCount }} new segment{{ declareCount === 1 ? '' : 's' }} will be declared
                                (numbered, not drawn). They can be used in this consensus only until their
                                polygons are drawn and linked in Segmentation.
                            </template>
                            <template v-else-if='segmentCount'>
                                {{ segmentCount }} registered in Segmentation. Raise the number to declare
                                more segments that are not drawn yet.
                            </template>
                            <template v-else>
                                No segments drawn yet: enter how many the group sketched to declare them now.
                            </template>
                        </div>
                    </div>
                    <div class='mb-2'>
                        <TablerEnum
                            v-model='respondentCountLabel'
                            label='Number of Respondents'
                            :options='respondentCountOptions'
                        />
                    </div>
                    <TablerInlineAlert
                        v-if='error'
                        severity='danger'
                        title='Error'
                        :description='error'
                    />
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
import { computed, ref, watch } from 'vue';
import {
    TablerEnum,
    TablerInlineAlert,
    TablerInput,
    TablerToggle,
} from '@tak-ps/vue-tabler';
import { MAX_RESPONDENTS } from '../../../../lib/consensus.ts';

export interface SetupResult {
    incidentName: string;
    filename: string;
    useMyDocuments: boolean;
    respondentCount: number;
    /** Segments to declare (not drawn) on top of the registered ones (#29). */
    declareCount: number;
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

const totalSegments = ref(props.segmentCount || 3);
const declareCount = computed(() => {
    const n = Number(totalSegments.value);
    return Number.isInteger(n) ? Math.max(0, n - props.segmentCount) : 0;
});

const respondentCountOptions = Array.from({ length: maxRespondents }, (_, i) => String(i + 1));
const respondentCountLabel = computed({
    get: () => String(respondentCount.value),
    set: (label: string) => { respondentCount.value = Number(label) || 1; },
});

// Keep the filename following the incident name until the user diverges it.
watch(incidentName, (next, prev) => {
    if (filename.value === prev) filename.value = next;
});

function onAccept(): void {
    if (!incidentName.value.trim()) {
        error.value = 'Incident Name is required.';
        return;
    }
    const total = Number(totalSegments.value);
    if (!Number.isInteger(total) || total < Math.max(props.segmentCount, 1) || total > 99) {
        error.value = props.segmentCount
            ? `Number of Segments must be a whole number from ${props.segmentCount} to 99. Remove segments in Segmentation.`
            : 'Number of Segments must be a whole number from 1 to 99.';
        return;
    }
    error.value = '';
    emit('accept', {
        incidentName: incidentName.value.trim(),
        filename: filename.value.trim(),
        useMyDocuments: useMyDocuments.value,
        respondentCount: respondentCount.value,
        declareCount: declareCount.value,
    });
}
</script>
