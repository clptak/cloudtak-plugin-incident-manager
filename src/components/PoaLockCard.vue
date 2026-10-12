<template>
    <TablerBorder
        class='cloudtak-accent text-white mb-3'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0'>
                POA lock — planning
            </p>
        </template>

        <div
            v-if='!supported'
            class='text-muted small'
        >
            POA locks need the incident stored as Mission Properties
            (Dashboard → Move to Mission Properties).
        </div>
        <template v-else>
            <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
                <label class='small text-white-50 mb-0'>POA for</label>
                <select
                    v-model.number='targetOp'
                    class='form-select form-select-sm w-auto'
                >
                    <option
                        v-for='op in targetOptions'
                        :key='op.opNumber'
                        :value='op.opNumber'
                    >
                        OP{{ op.opNumber }}{{ op.note ? ` (${op.note})` : '' }}
                    </option>
                </select>
                <span class='small text-white-50'>
                    from the Initial Consensus, debriefs and clues through
                    {{ targetOp > 1 ? `OP${targetOp - 1}` : 'the Initial Consensus' }}
                </span>
                <button
                    class='btn btn-sm ms-auto'
                    :class='latest && !staleness.stale ? "btn-outline-primary" : "btn-primary"'
                    :disabled='busy || !preview'
                    @click='onLock'
                >
                    {{ busy ? 'Locking…' : latest ? `Re-lock POA for OP${targetOp}` : `Lock POA for OP${targetOp}` }}
                </button>
            </div>

            <TablerInlineAlert
                v-if='error'
                class='mb-2'
                severity='danger'
                title='Error'
                :description='error'
            />

            <div
                v-if='latest'
                class='small mb-2'
            >
                <span
                    class='badge me-1'
                    :class='staleness.stale ? "bg-warning-lt text-warning" : "bg-success-lt text-success"'
                >{{ staleness.stale ? 'stale' : 'locked' }}</span>
                Locked {{ shortDt(latest.lockedAt) }}<span v-if='latest.lockedBy'> by {{ latest.lockedBy }}</span>
                <span
                    v-if='locks.length > 1'
                    class='text-white-50'
                > · {{ locks.length - 1 }} earlier lock{{ locks.length > 2 ? 's' : '' }} kept</span>
                <div
                    v-if='staleness.stale'
                    class='text-warning mt-1'
                >
                    Based on inputs that changed since it was locked: {{ staleness.reasons.join(', ') }}.
                    The locked values are unchanged — re-lock to plan on the current numbers.
                </div>
            </div>
            <div
                v-else
                class='small text-white-50 mb-2'
            >
                Not locked yet. The values below are live and will move as debriefs and clues arrive.
            </div>

            <table
                v-if='preview'
                class='table table-sm table-borderless text-white mb-0 small'
            >
                <thead>
                    <tr class='text-white-50'>
                        <th>Segment</th>
                        <th
                            v-if='latest'
                            class='text-end'
                        >
                            Locked POA %
                        </th>
                        <th class='text-end'>
                            {{ latest ? 'Current' : 'POA %' }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='uid in rowUids'
                        :key='uid'
                    >
                        <td>{{ labelFor(uid) }}</td>
                        <td
                            v-if='latest'
                            class='text-end'
                        >
                            {{ fmt(latest.poa[uid]) }}
                        </td>
                        <td
                            class='text-end'
                            :class='latest && differs(latest.poa[uid], preview.poa[uid]) ? "text-warning" : ""'
                        >
                            {{ fmt(preview.poa[uid]) }}
                        </td>
                    </tr>
                    <tr>
                        <td>R.O.W.</td>
                        <td
                            v-if='latest'
                            class='text-end'
                        >
                            {{ fmt(latest.rowPoa) }}
                        </td>
                        <td
                            class='text-end'
                            :class='latest && differs(latest.rowPoa, preview.rowPoa) ? "text-warning" : ""'
                        >
                            {{ fmt(preview.rowPoa) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </template>
    </TablerBorder>
</template>

<script setup lang='ts'>
/**
 * POA lock (ADR-003): planning fixes the POA the next OP is planned on.
 * Locks are never edited; a correction to an input marks the lock stale and
 * planning decides whether to re-lock (a new lock, the old one is kept).
 */
import { computed, ref, watch } from 'vue';
import { TablerBorder, TablerInlineAlert } from '@tak-ps/vue-tabler';
import { useIncident } from '../composables/useIncident.ts';
import { buildPoaLock, poaLockStaleness, type PoaLock, type PoaLockInputs } from '../domain/poaLock.ts';
import { nextOpNumber, planningOpPeriod } from '../domain/registry.ts';
import type { RollupInputs } from '../lib/rollupPersistence.ts';
import { listPoaLocks, poaLocksSupported, savePoaLock } from '../lib/poaLockPersistence.ts';

const props = defineProps<{ inputs: RollupInputs }>();

const { activeMission } = useIncident();

const supported = ref(true);
const locks = ref<PoaLock[]>([]);
const busy = ref(false);
const error = ref('');

/** OPs a lock can be for: the one being planned, open ones, and the next number. */
const targetOptions = computed(() => {
    const options = new Map<number, string>();
    for (const op of props.inputs.registry) {
        if (op.status === 'planning') options.set(op.opNumber, 'planning');
        else if (op.status !== 'closed') options.set(op.opNumber, 'open');
    }
    const next = nextOpNumber(props.inputs.registry);
    if (!options.has(next)) options.set(next, 'next');
    return [...options].sort(([a], [b]) => a - b).map(([opNumber, note]) => ({ opNumber, note }));
});

function defaultTarget(): number {
    return planningOpPeriod(props.inputs.registry)?.opNumber ?? nextOpNumber(props.inputs.registry);
}

const targetOp = ref(defaultTarget());

const lockInputs = computed<PoaLockInputs>(() => ({
    segments: props.inputs.segments,
    rowPoa: props.inputs.rowPoa,
    records: props.inputs.records,
    clues: props.inputs.clues,
    segmentLabels: props.inputs.segmentLabels,
}));

const preview = computed(() => {
    try {
        return buildPoaLock(lockInputs.value, targetOp.value);
    } catch {
        return null;
    }
});

const latest = computed(() => locks.value[locks.value.length - 1] ?? null);
const staleness = computed(() => (latest.value
    ? poaLockStaleness(latest.value, lockInputs.value)
    : { stale: false, reasons: [] as string[] }));

/** Current segments plus any the lock had that have since gone. */
const rowUids = computed(() => {
    const uids = props.inputs.segments.map((s) => s.uid);
    for (const uid of Object.keys(latest.value?.poa ?? {})) if (!uids.includes(uid)) uids.push(uid);
    return uids;
});

function labelFor(uid: string): string {
    return props.inputs.segmentLabels[uid] ?? latest.value?.labels[uid] ?? uid;
}

function fmt(value: number | undefined): string {
    return value === undefined ? '—' : value.toFixed(1);
}

function differs(a: number | undefined, b: number | undefined): boolean {
    return Math.abs((a ?? 0) - (b ?? 0)) >= 0.05;
}

function shortDt(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
}

async function loadLocks(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    error.value = '';
    try {
        supported.value = await poaLocksSupported(mission);
        locks.value = supported.value ? await listPoaLocks(mission, targetOp.value) : [];
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    }
}

async function onLock(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    busy.value = true;
    error.value = '';
    try {
        await savePoaLock(mission, buildPoaLock(lockInputs.value, targetOp.value));
        locks.value = await listPoaLocks(mission, targetOp.value);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

watch(() => props.inputs.registry, () => {
    if (!targetOptions.value.some((o) => o.opNumber === targetOp.value)) targetOp.value = defaultTarget();
});
watch([targetOp, () => activeMission.value?.guid], () => void loadLocks(), { immediate: true });
</script>
