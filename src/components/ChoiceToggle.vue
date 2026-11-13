<template>
    <div>
        <div
            v-if='label'
            class='form-label mb-1'
        >
            {{ label }}
        </div>
        <div
            class='choice-toggle'
            role='radiogroup'
            :aria-label='label'
            @keydown='onKey'
        >
            <button
                v-for='(o, i) in options'
                :key='o.value'
                ref='buttons'
                type='button'
                role='radio'
                class='btn choice-toggle-btn'
                :class='[`choice-tone-${o.tone}`, { "is-selected": o.value === modelValue }]'
                :aria-checked='o.value === modelValue'
                :tabindex='o.value === modelValue || (!hasValue && i === 0) ? 0 : -1'
                :title='o.value === modelValue ? `${o.label} (click again to clear)` : o.label'
                :disabled='disabled'
                @click='pick(o.value)'
            >
                <component
                    :is='o.icon'
                    v-if='o.icon'
                    :size='20'
                    stroke='1.75'
                    class='me-2 flex-shrink-0'
                />
                <span class='fw-bold'>{{ o.label }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
/**
 * A few mutually exclusive choices as side-by-side buttons, each with its own
 * colour and icon. Clicking the selected one clears it (`''`).
 */
import { computed, ref, type Component } from 'vue';

export interface ChoiceToggleOption {
    value: string;
    label: string;
    tone: 'green' | 'azure' | 'orange' | 'red' | 'secondary';
    icon?: Component;
}

const props = withDefaults(defineProps<{
    modelValue: string;
    options: ChoiceToggleOption[];
    label?: string;
    disabled?: boolean;
}>(), {
    label: '',
    disabled: false,
});

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const buttons = ref<HTMLButtonElement[]>([]);
const hasValue = computed(() => props.options.some((o) => o.value === props.modelValue));

function pick(value: string): void {
    emit('update:modelValue', value === props.modelValue ? '' : value);
}

function onKey(e: KeyboardEvent): void {
    const step = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1
        : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!step || props.disabled) return;
    e.preventDefault();
    const at = props.options.findIndex((o) => o.value === props.modelValue);
    const next = Math.max(0, Math.min(props.options.length - 1, (at < 0 ? -step : at) + step));
    emit('update:modelValue', props.options[next].value);
    buttons.value[next]?.focus();
}
</script>

<style scoped>
.choice-toggle {
    display: flex;
    gap: 0.5rem;
}

.choice-toggle-btn {
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
    white-space: nowrap;
}

.choice-tone-green { --choice-rgb: var(--tblr-green-rgb, 47, 179, 68); }
.choice-tone-azure { --choice-rgb: var(--tblr-azure-rgb, 69, 170, 242); }
.choice-tone-orange { --choice-rgb: var(--tblr-orange-rgb, 247, 103, 7); }
.choice-tone-red { --choice-rgb: var(--tblr-red-rgb, 214, 57, 57); }
.choice-tone-secondary { --choice-rgb: var(--tblr-secondary-rgb, 98, 105, 118); }

.choice-toggle-btn,
.choice-toggle-btn:hover,
.choice-toggle-btn:focus {
    background-color: rgba(var(--choice-rgb), 0.12);
    border: 1px solid rgba(var(--choice-rgb), 0.6);
    color: inherit;
}

.choice-toggle-btn:hover {
    background-color: rgba(var(--choice-rgb), 0.3);
}

.choice-toggle-btn.is-selected,
.choice-toggle-btn.is-selected:hover,
.choice-toggle-btn.is-selected:focus {
    background-color: rgb(var(--choice-rgb));
    border-color: rgb(var(--choice-rgb));
    color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
}
</style>
