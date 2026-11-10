<template>
    <div
        class='scale-choice'
        :class='layout === "list" ? "scale-choice-list" : "scale-choice-row"'
        role='radiogroup'
        :aria-label='label'
        @keydown='onKey'
    >
        <div
            v-if='label && layout === "list"'
            class='form-label mb-1'
        >
            {{ label }}
        </div>
        <button
            v-for='(o, i) in options'
            :key='o.value'
            ref='buttons'
            type='button'
            role='radio'
            class='btn btn-sm scale-choice-btn'
            :class='[toneClass(i), { "is-selected": o.value === modelValue }]'
            :style='toneStyle(i)'
            :aria-checked='o.value === modelValue'
            :tabindex='o.value === modelValue || (!hasValue && i === 0) ? 0 : -1'
            :title='o.label ? `${o.value} — ${o.label}` : String(o.value)'
            :disabled='disabled'
            @click='emit("update:modelValue", o.value)'
        >
            <span class='fw-bold'>{{ o.value }}</span>
            <span
                v-if='layout === "list" && o.label'
                class='ms-2 text-start'
            >{{ o.label }}</span>
        </button>
    </div>
</template>

<script setup lang='ts'>
/**
 * A numbered scale as colour-coded buttons: a row of boxes or a stacked list
 * with each option's wording. Arrow keys move the choice.
 */
import { computed, ref } from 'vue';
import { scaleRgb, scaleTextOn, scaleTone } from '../lib/scaleTone.ts';

const props = withDefaults(defineProps<{
    modelValue: number;
    options: { value: number; label?: string }[];
    layout?: 'row' | 'list';
    /** First option red, last green (Search Urgency, Complacency). Default is green first. */
    lowIsRed?: boolean;
    label?: string;
    disabled?: boolean;
}>(), {
    layout: 'row',
    lowIsRed: false,
    label: '',
    disabled: false,
});

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>();

const buttons = ref<HTMLButtonElement[]>([]);
const hasValue = computed(() => props.options.some((o) => o.value === props.modelValue));

/** Up to five steps use fixed Tabler tones; longer scales (GAR 0–10) blend. */
const blended = computed(() => props.options.length > 5);

function toneClass(i: number): string {
    return blended.value ? '' : `scale-tone-${scaleTone(i, props.options.length, props.lowIsRed)}`;
}

function toneStyle(i: number): Record<string, string> | undefined {
    if (!blended.value) return undefined;
    const rgb = scaleRgb(i, props.options.length, props.lowIsRed);
    return { '--scale-rgb': rgb, '--scale-text': scaleTextOn(rgb) };
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
.scale-choice-row {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.scale-choice-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    height: 100%;
    padding: 0.5rem;
    border: 1px solid rgba(var(--tblr-body-color-rgb, 255, 255, 255), 0.14);
    border-radius: var(--tblr-border-radius, 4px);
    background-color: rgba(var(--tblr-body-color-rgb, 255, 255, 255), 0.02);
}

.scale-choice-list .scale-choice-btn {
    justify-content: flex-start;
    text-align: left;
    white-space: normal;
}

.scale-choice-row .scale-choice-btn {
    min-width: 2.25rem;
}

.scale-choice-btn { --scale-text: #fff; }
.scale-tone-green { --scale-rgb: var(--tblr-green-rgb, 47, 179, 68); }
/* White text is hard to read on bright lime and amber. */
.scale-tone-lime { --scale-rgb: var(--tblr-lime-rgb, 116, 184, 22); --scale-text: #1d273b; }
.scale-tone-yellow { --scale-rgb: var(--tblr-yellow-rgb, 245, 159, 0); --scale-text: #1d273b; }
.scale-tone-orange { --scale-rgb: var(--tblr-orange-rgb, 247, 103, 7); }
.scale-tone-red { --scale-rgb: var(--tblr-red-rgb, 214, 57, 57); }

.scale-choice-btn,
.scale-choice-btn:hover,
.scale-choice-btn:focus {
    background-color: rgba(var(--scale-rgb), 0.3);
    border: 1px solid rgba(var(--scale-rgb), 0.85);
    color: inherit;
}

.scale-choice-btn:hover {
    background-color: rgba(var(--scale-rgb), 0.5);
}

.scale-choice-btn.is-selected,
.scale-choice-btn.is-selected:hover,
.scale-choice-btn.is-selected:focus {
    background-color: rgb(var(--scale-rgb));
    border-color: rgb(var(--scale-rgb));
    color: var(--scale-text);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
    z-index: 1;
}
</style>
