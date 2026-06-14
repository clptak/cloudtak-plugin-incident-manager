<template>
    <div class='card'>
        <div class='card-header'>
            <h3 class='card-title mb-0'>
                Search Urgency Rating
            </h3>
        </div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Score each factor 1 (most urgent) to 3 (least urgent).
            </p>

            <div class='table-responsive'>
                <table class='table table-sm table-vcenter mb-0'>
                    <thead>
                        <tr>
                            <th>Factor</th><th style='width:90px;'>
                                Rating (1–3)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='f in factors'
                            :key='f.key'
                        >
                            <td>{{ f.label }}</td>
                            <td>
                                <input
                                    v-model.number='f.value'
                                    type='number'
                                    min='1'
                                    max='3'
                                    class='form-control form-control-sm'
                                >
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class='text-end fw-bold'>
                                Total
                            </td>
                            <td class='fw-bold'>
                                {{ total }}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class='d-flex align-items-center gap-2 mt-2'>
                <progress
                    :value='Math.max(7, Math.min(21, total))'
                    max='21'
                    style='flex:1;'
                />
                <span
                    class='badge'
                    :class='level.cls'
                >{{ level.label }}</span>
            </div>

            <div class='mt-3'>
                <button
                    class='btn btn-primary btn-sm'
                    :disabled='!activeMission || posting || !valid'
                    @click='send'
                >
                    {{ posting ? 'Sending…' : 'Send to DataSync' }}
                </button>
                <button
                    class='btn btn-outline-secondary btn-sm ms-2'
                    @click='reset'
                >
                    Clear
                </button>
            </div>

            <div
                v-if='!valid'
                class='form-text text-danger'
            >
                Each rating must be 1, 2, or 3.
            </div>
            <div
                v-if='!activeMission'
                class='form-text text-warning'
            >
                No active mission. Select one in Create | Open first.
            </div>
            <div
                v-else
                class='form-text'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
            </div>
            <div
                v-if='status'
                class='fw-bold mt-1'
                :class='statusError ? "text-danger" : "text-success"'
            >
                {{ status }}
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { reactive, ref, computed } from 'vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

const factors = reactive([
    { key: 'age', label: 'Subject age / profile', value: 1 },
    { key: 'medical', label: 'Medical condition', value: 1 },
    { key: 'number', label: 'Number of subjects', value: 1 },
    { key: 'experience', label: 'Experience / fitness', value: 1 },
    { key: 'weather', label: 'Weather (current & forecast)', value: 1 },
    { key: 'equipment', label: 'Equipment / clothing', value: 1 },
    { key: 'terrain', label: 'Terrain / hazards', value: 1 },
]);

const total = computed(() => factors.reduce((s, f) => s + (Number(f.value) || 0), 0));
const valid = computed(() => factors.every((f) => [1, 2, 3].includes(Number(f.value))));

const level = computed(() => {
    if (total.value <= 10) return { label: 'High', cls: 'bg-danger-lt text-danger' };
    if (total.value <= 16) return { label: 'Moderate', cls: 'bg-yellow-lt text-yellow' };
    return { label: 'Lower', cls: 'bg-green-lt text-green' };
});

const posting = ref(false);
const status = ref('');
const statusError = ref(false);

function reset(): void {
    factors.forEach((f) => (f.value = 1));
    status.value = '';
}

async function send(): Promise<void> {
    if (!activeMission.value || !valid.value) return;
    posting.value = true; status.value = ''; statusError.value = false;
    try {
        const breakdown = factors.map((f) => `${f.label}: ${f.value}`).join('; ');
        const content = `Search Urgency: ${level.value.label} (total ${total.value}/21). ${breakdown}`;
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        await sub.log.create({
            content,
            keywords: ['search-urgency', `urgency:${level.value.label}`, `total:${total.value}`],
        });
        status.value = `Sent urgency rating (${level.value.label}) to ${activeMission.value.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}
</script>
