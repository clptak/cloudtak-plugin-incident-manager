<template>
    <div
        class='modal modal-blur show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='emit("cancel")'
    >
        <div
            class='modal-dialog modal-sm modal-dialog-centered'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title'>
                        {{ initialName }}
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
                            v-model='name'
                            label='Name'
                        />
                    </div>
                    <label
                        v-for='opt in methodOptions'
                        :key='opt.value'
                        class='form-check'
                    >
                        <input
                            v-model='method'
                            type='radio'
                            class='form-check-input'
                            name='consensus-method'
                            :value='opt.value'
                        >
                        <span class='form-check-label'>{{ opt.label }}</span>
                    </label>
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
                        class='btn btn-primary'
                        @click='onAccept'
                    >
                        Accept
                    </button>
                    <button
                        type='button'
                        class='btn btn-secondary'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div class='modal-backdrop fade show' />
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import type { ConsensusMethod } from '../../../../lib/consensus.ts';

const props = defineProps<{
    initialName: string;
    initialMethod: ConsensusMethod;
}>();

const emit = defineEmits<{
    accept: [result: { name: string; method: ConsensusMethod }];
    cancel: [];
}>();

const methodOptions: Array<{ value: ConsensusMethod; label: string }> = [
    { value: 'mattson', label: 'Mattson Consensus' },
    { value: 'oconnor', label: "O'Connor Consensus" },
    { value: 'proportional', label: 'Proportional Consensus' },
];

const name = ref(props.initialName);
const method = ref<ConsensusMethod>(props.initialMethod);
const error = ref('');

function onAccept(): void {
    if (!name.value.trim()) {
        error.value = 'Name is required.';
        return;
    }
    error.value = '';
    emit('accept', { name: name.value.trim(), method: method.value });
}
</script>
