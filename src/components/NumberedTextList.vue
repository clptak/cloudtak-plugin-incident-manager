<template>
    <div>
        <div
            v-for='(entry, index) in model'
            :key='index'
            class='input-group mb-2'
        >
            <span class='input-group-text text-muted'>
                {{ index + 1 }}
            </span>
            <input
                v-model='model[index]'
                type='text'
                class='form-control'
                :placeholder='`${itemLabel} ${index + 1}`'
            >
            <button
                type='button'
                class='btn btn-outline-danger'
                :aria-label='`Remove ${itemLabel.toLowerCase()} ${index + 1}`'
                @click='remove(index)'
            >
                <IconX
                    :size='16'
                    stroke='1.5'
                />
            </button>
        </div>

        <button
            type='button'
            class='btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1'
            :disabled='model.length >= max'
            @click='add'
        >
            <IconPlus
                :size='16'
                stroke='1.5'
            />
            Add
        </button>

        <div
            v-if='model.length >= max'
            class='form-hint mt-2 mb-0'
        >
            {{ maxHint || `Maximum of ${max} entries.` }}
        </div>
    </div>
</template>

<script setup lang='ts'>
import { IconPlus, IconX } from '@tabler/icons-vue';

const model = defineModel<string[]>({ required: true });

const props = withDefaults(defineProps<{
    max?: number;
    itemLabel?: string;
    maxHint?: string;
}>(), {
    max: 10,
    itemLabel: 'Entry',
    maxHint: '',
});

function add(): void {
    if (model.value.length >= props.max) return;
    model.value.push('');
}

function remove(index: number): void {
    model.value.splice(index, 1);
}
</script>
