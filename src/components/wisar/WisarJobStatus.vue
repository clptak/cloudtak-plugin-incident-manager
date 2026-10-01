<template>
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
            Done in {{ elapsed }} — {{ job?.result?.contour_count ?? 0 }} contour(s).<slot name='done' />
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
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { WisarJobPhase } from '../../composables/useWisarJob.ts';
import type { Job } from '../../lib/wisar.ts';
import { formatElapsed } from '../../lib/wisarTravelTime.ts';

const props = defineProps<{
    phase: WisarJobPhase;
    job: Job | null;
    error: string;
    startedAt: number;
    now: number;
}>();

const elapsed = computed(() => formatElapsed(props.now - props.startedAt));
</script>
