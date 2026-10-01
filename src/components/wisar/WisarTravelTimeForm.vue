<template>
    <div class='wisar-tt-form'>
        <p class='text-uppercase text-white-50 small mb-1 mt-3'>
            Flat-Ground Travel Speed
        </p>
        <div class='d-flex gap-2 align-items-center'>
            <input
                v-model='speedText'
                type='number'
                class='form-control form-control-sm'
                :placeholder='unit === "kmh" ? "1.6" : "1.0"'
                step='0.1'
                min='0.1'
                :max='unit === "kmh" ? 20 : 12.4'
                aria-label='Travel speed'
            >
            <div
                class='btn-group btn-group-sm'
                role='group'
                aria-label='Speed unit'
            >
                <button
                    v-for='u in UNITS'
                    :key='u'
                    type='button'
                    class='btn'
                    :class='unit === u ? "btn-primary" : "btn-outline-secondary"'
                    @click='setUnit(u)'
                >
                    {{ unitLabel(u) }}
                </button>
            </div>
        </div>
        <div class='form-text'>
            Assumed speed on flat, unobstructed terrain. The model adjusts for slope,
            land cover, and trail networks.
        </div>

        <div class='d-flex flex-wrap gap-2 mt-2'>
            <button
                v-for='p in SPEED_PRESETS'
                :key='p.label'
                type='button'
                class='btn btn-sm btn-outline-secondary wisar-preset'
                @click='applyPreset(p.mph)'
            >
                {{ p.mph.toFixed(1) }} mph<br><span class='small text-muted'>{{ p.label }}</span>
            </button>
        </div>

        <p class='text-uppercase text-white-50 small mb-1 mt-3'>
            Time Intervals (hours)
        </p>
        <div class='d-flex flex-wrap gap-3'>
            <label
                v-for='h in INTERVAL_OPTIONS'
                :key='h'
                class='form-check form-check-inline mb-0'
            >
                <input
                    v-model='intervals'
                    type='checkbox'
                    class='form-check-input'
                    :value='h'
                >
                <span class='form-check-label'>{{ h }}h</span>
            </label>
        </div>
        <div class='form-text'>
            Each interval generates a contour showing the outer boundary of where the
            subject could physically be after that amount of time.
        </div>

        <div class='d-flex gap-2 mt-3'>
            <button
                type='button'
                class='btn btn-primary flex-grow-1'
                :disabled='!!problem || busy'
                @click='runAnalysis'
            >
                {{ busy ? 'Running…' : 'Run Travel Time Analysis' }}
            </button>
            <button
                v-if='busy'
                type='button'
                class='btn btn-outline-secondary'
                @click='cancel'
            >
                Cancel
            </button>
        </div>
        <div
            v-if='problem && !busy'
            class='form-text text-center'
        >
            {{ problem }}
        </div>

        <div
            v-if='phase !== "idle"'
            class='mt-2 small'
            role='status'
        >
            <span v-if='phase === "submitting"'>Sending to WiSAR…</span>
            <span v-else-if='phase === "queued"'>
                Queued at WiSAR<span v-if='job?.queue_position'> — position {{ job.queue_position }}</span> · {{ elapsed }}
            </span>
            <span v-else-if='phase === "running"'>
                Running on WiSAR · {{ elapsed }} (typically one to a few minutes)
            </span>
            <span
                v-else-if='phase === "succeeded"'
                class='text-success'
            >
                Done in {{ elapsed }} — {{ job?.result?.contour_count ?? 0 }} contour(s).
            </span>
            <span
                v-else-if='phase === "cancelled"'
                class='text-muted'
            >Cancelled.</span>
            <span
                v-else
                class='text-danger'
            >{{ error }}</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { useWisarJob } from '../../composables/useWisarJob.ts';
import type { Job } from '../../lib/wisar.ts';
import type { WisarIppOption } from '../../lib/wisarIpp.ts';
import {
    INTERVAL_OPTIONS,
    SPEED_PRESETS,
    convertSpeedText,
    formatElapsed,
    travelTimeProblem,
    travelTimeRequest,
    unitLabel,
    type SpeedUnit,
} from '../../lib/wisarTravelTime.ts';

const props = defineProps<{
    ipp: WisarIppOption | null;
}>();

const emit = defineEmits<{
    /** A finished, succeeded job. */
    result: [job: Job];
}>();

const UNITS: SpeedUnit[] = ['mph', 'kmh'];

const speedText = ref('');
const unit = ref<SpeedUnit>('mph');
const intervals = ref<number[]>([...INTERVAL_OPTIONS]);

const { job, phase, error, startedAt, now, run, cancel } = useWisarJob();

const busy = computed(() => ['submitting', 'queued', 'running'].includes(phase.value));
const problem = computed(() => travelTimeProblem(props.ipp, String(speedText.value ?? ''), unit.value, intervals.value));
const elapsed = computed(() => formatElapsed(now.value - startedAt.value));

function setUnit(next: SpeedUnit): void {
    speedText.value = convertSpeedText(String(speedText.value ?? ''), unit.value, next);
    unit.value = next;
}

function applyPreset(mph: number): void {
    unit.value = 'mph';
    speedText.value = mph.toFixed(1);
}

async function runAnalysis(): Promise<void> {
    const ipp = props.ipp;
    if (problem.value || !ipp) return;
    const body = travelTimeRequest(ipp, String(speedText.value), unit.value, intervals.value);
    const final = await run((c, signal) => c.submitTravelTime(body, signal));
    if (final?.status === 'succeeded') emit('result', final);
}
</script>

<style scoped>
.wisar-preset {
    line-height: 1.2;
    min-width: 5.5rem;
}
</style>
