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

            <div class='table-responsive urgency-table-wrap'>
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
                            <td>
                                <div class='d-flex align-items-center gap-1'>
                                    <span>{{ f.label }}</span>
                                    <div
                                        :ref='(el) => setHelpRef(f.key, el as HTMLElement | null)'
                                        class='position-relative d-inline-flex'
                                    >
                                        <button
                                            type='button'
                                            class='btn btn-link btn-sm p-0 text-muted lh-1 border-0'
                                            :aria-label='`Scoring guidance for ${f.label}`'
                                            @click.stop='toggleHelp(f.key)'
                                        >
                                            <IconInfoCircle
                                                :size='16'
                                                stroke='1.5'
                                            />
                                        </button>
                                        <div
                                            v-if='openHelpKey === f.key'
                                            class='position-absolute start-0 mt-1 p-2 bg-body border rounded shadow-sm small'
                                            style='z-index:1050; min-width:16rem; top:100%;'
                                            @click.stop
                                        >
                                            <ul class='mb-0 ps-3'>
                                                <li
                                                    v-for='line in f.helpLines'
                                                    :key='line.text'
                                                >
                                                    {{ line.text }} = {{ line.score }}
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </td>
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
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';

interface HelpLine {
    text: string;
    score: string;
}

interface Factor {
    key: string;
    label: string;
    value: number;
    helpLines: HelpLine[];
}

const { activeMission } = useIncident();

const factors = reactive<Factor[]>([
    {
        key: 'age',
        label: 'Subject age / profile',
        value: 1,
        helpLines: [
            { text: 'Very Young', score: '1' },
            { text: 'Very Old', score: '1' },
            { text: 'Other', score: '2–3' },
        ],
    },
    {
        key: 'medical',
        label: 'Medical condition',
        value: 1,
        helpLines: [
            { text: 'Known / Suspected injured, ill, or mental problem', score: '1–2' },
            { text: 'Healthy', score: '3' },
            { text: 'Known Fatality', score: '3' },
        ],
    },
    {
        key: 'number',
        label: 'Number of subjects',
        value: 1,
        helpLines: [
            { text: 'One / Alone', score: '1' },
            { text: 'More Than One (Unless Separated)', score: '2–3' },
        ],
    },
    {
        key: 'experience',
        label: 'Experience / fitness',
        value: 1,
        helpLines: [
            { text: 'Not experienced, does not know the area', score: '1' },
            { text: 'Not experienced, knows the area', score: '1–2' },
            { text: 'Experienced, not familiar with the area', score: '2' },
            { text: 'Experienced, knows the area', score: '3' },
        ],
    },
    {
        key: 'weather',
        label: 'Weather (current & forecast)',
        value: 1,
        helpLines: [
            { text: 'Past and/or existing hazardous weather', score: '1' },
            { text: 'Predicted hazardous weather (less than 8 hours)', score: '1–2' },
            { text: 'Predicted hazardous weather (more than 8 hours)', score: '2' },
            { text: 'No hazardous weather predicted', score: '3' },
        ],
    },
    {
        key: 'equipment',
        label: 'Equipment / clothing',
        value: 1,
        helpLines: [
            { text: 'Inadequate for environment and weather', score: '1' },
            { text: 'Questionable for environment and weather', score: '1–2' },
            { text: 'Adequate for environment and weather', score: '3' },
        ],
    },
    {
        key: 'terrain',
        label: 'Terrain / hazards',
        value: 1,
        helpLines: [
            { text: 'Known hazardous terrain or other hazards', score: '1' },
            { text: 'Few or no hazards', score: '2–3' },
        ],
    },
]);

const openHelpKey = ref<string | null>(null);
const helpRefs: Record<string, HTMLElement | null> = {};

function setHelpRef(key: string, el: HTMLElement | null): void {
    helpRefs[key] = el;
}

function toggleHelp(key: string): void {
    openHelpKey.value = openHelpKey.value === key ? null : key;
}

function onDocumentClick(event: MouseEvent): void {
    if (!openHelpKey.value) return;
    const el = helpRefs[openHelpKey.value];
    if (el && !el.contains(event.target as Node)) {
        openHelpKey.value = null;
    }
}

onMounted(() => {
    document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
    document.removeEventListener('click', onDocumentClick);
});

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

<style scoped>
.urgency-table-wrap {
    overflow: visible;
}
</style>
