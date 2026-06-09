<template>
    <div class='card'>
        <div class='card-header'><h3 class='card-title mb-0'>Search Scenarios Worksheet</h3></div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Describe likely scenarios. Each filled scenario is sent as a log entry to the active DataSync.
            </p>

            <div v-for='s in scenarios' :key='s.key' class='border rounded p-2 mb-2'>
                <div class='fw-bold mb-2'>Scenario {{ s.key }}</div>
                <textarea
                    v-model='s.description'
                    class='form-control form-control-sm mb-2'
                    rows='2'
                    :placeholder='`Description for Scenario ${s.key}`'
                />
                <div class='row g-2'>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Mobility</label>
                        <select v-model='s.mobility' class='form-select form-select-sm'>
                            <option value=''>—</option>
                            <option value='mobile'>Mobile</option>
                            <option value='immobile'>Immobile</option>
                        </select>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Responsiveness</label>
                        <select v-model='s.responsiveness' class='form-select form-select-sm'>
                            <option value=''>—</option>
                            <option value='responsive'>Responsive</option>
                            <option value='unresponsive'>Unresponsive</option>
                        </select>
                    </div>
                    <div class='col-md-4'>
                        <label class='form-label small mb-1'>Priority</label>
                        <input v-model.number='s.priority' type='number' min='1' max='5' class='form-control form-control-sm'>
                    </div>
                </div>
            </div>

            <button
                class='btn btn-primary btn-sm mt-2'
                :disabled='!activeMission || posting || !filledCount'
                @click='send'
            >
                {{ posting ? 'Sending…' : `Send ${filledCount} scenario${filledCount === 1 ? "" : "s"} to DataSync` }}
            </button>
            <button class='btn btn-outline-secondary btn-sm ms-2' @click='reset'>Clear</button>

            <div v-if='!activeMission' class='form-text text-warning'>
                No active mission. Select one in Create | Open first.
            </div>
            <div v-else class='form-text'>Active DataSync: <strong>{{ activeMission.name }}</strong></div>
            <div v-if='status' class='fw-bold mt-1' :class='statusError ? "text-danger" : "text-success"'>
                {{ status }}
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, computed } from 'vue';
import Subscription from '@/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

interface Scenario {
    key: string;
    description: string;
    mobility: string;
    responsiveness: string;
    priority: number | null;
}

function blank(): Scenario[] {
    return ['A', 'B', 'C', 'D', 'E'].map((key) => ({
        key, description: '', mobility: '', responsiveness: '', priority: null,
    }));
}

const scenarios = reactive<Scenario[]>(blank());

const filled = computed(() => scenarios.filter((s) => s.description.trim()));
const filledCount = computed(() => filled.value.length);

const posting = ref(false);
const status = ref('');
const statusError = ref(false);

function reset(): void {
    Object.assign(scenarios, blank());
    status.value = '';
}

function summarize(s: Scenario): string {
    const bits = [`Scenario ${s.key}: ${s.description.trim()}`];
    if (s.mobility) bits.push(`mobility=${s.mobility}`);
    if (s.responsiveness) bits.push(`responsiveness=${s.responsiveness}`);
    if (s.priority != null) bits.push(`priority=${s.priority}`);
    return bits.join('; ');
}

async function send(): Promise<void> {
    if (!activeMission.value || !filledCount.value) return;
    posting.value = true; status.value = ''; statusError.value = false;
    let ok = 0, failed = 0;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        for (const s of filled.value) {
            try {
                await sub.log.create({
                    content: summarize(s),
                    keywords: ['search-scenario', `scenario:${s.key}`],
                });
                ok++;
            } catch {
                failed++;
            }
        }
        statusError.value = failed > 0;
        status.value = `Sent ${ok} scenario${ok === 1 ? '' : 's'} to ${activeMission.value.name}`
            + (failed ? `, ${failed} failed.` : '.');
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}
</script>
