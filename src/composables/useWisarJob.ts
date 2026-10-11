import { onBeforeUnmount, ref } from 'vue';
import { WisarError, problemMessage, type Job, type WisarClient } from '../lib/wisar.ts';
import { useWisar } from './useWisar.ts';

export type WisarJobPhase = 'idle' | 'submitting' | 'queued' | 'running' | 'succeeded' | 'failed' | 'error' | 'cancelled';

/**
 * Submit one WiSAR job and follow it to the end: queue position, running
 * time, and the finished job (or why it failed). Leaving the page stops the
 * polling; the job itself keeps running on WiSAR.
 */
export function useWisarJob() {
    const { client } = useWisar();
    const job = ref<Job | null>(null);
    const phase = ref<WisarJobPhase>('idle');
    const error = ref('');
    const startedAt = ref(0);
    const now = ref(Date.now());

    let controller: AbortController | null = null;
    let ticker: ReturnType<typeof setInterval> | null = null;
    let active: WisarClient | null = null;

    function stopTicker(): void {
        if (ticker) clearInterval(ticker);
        ticker = null;
    }

    function track(j: Job): void {
        job.value = j;
        if (j.status === 'queued' || j.status === 'running') phase.value = j.status;
    }

    async function run(submit: (c: WisarClient, signal: AbortSignal) => Promise<Job>): Promise<Job | null> {
        controller?.abort();
        controller = new AbortController();
        const { signal } = controller;
        active = client.value;
        job.value = null;
        error.value = '';
        phase.value = 'submitting';
        startedAt.value = Date.now();
        now.value = startedAt.value;
        stopTicker();
        ticker = setInterval(() => { now.value = Date.now(); }, 1000);
        try {
            const submitted = await submit(active, signal);
            track(submitted);
            const final = await active.waitForJob(submitted, { signal, onUpdate: track });
            job.value = final;
            if (final.status === 'succeeded') {
                phase.value = 'succeeded';
            } else {
                phase.value = 'failed';
                error.value = problemMessage(final.error, 'The analysis failed on WiSAR.');
            }
            return final;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                phase.value = 'cancelled';
            } else {
                phase.value = 'error';
                error.value = err instanceof WisarError || err instanceof Error ? err.message : String(err);
            }
            return null;
        } finally {
            now.value = Date.now();
            stopTicker();
        }
    }

    /** Stop waiting. A job still in the queue is removed; a running one finishes on WiSAR. */
    async function cancel(): Promise<void> {
        const queued = job.value?.status === 'queued' ? job.value.id : null;
        controller?.abort();
        if (queued && active) {
            try {
                await active.deleteJob(queued);
            } catch {
                // already started or gone; nothing to undo
            }
        }
    }

    onBeforeUnmount(() => {
        controller?.abort();
        stopTicker();
    });

    return { job, phase, error, startedAt, now, run, cancel };
}
