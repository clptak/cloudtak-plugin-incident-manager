<template>
    <TablerBorder
        class='cloudtak-accent text-white'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0'>
                Consensus
            </p>
        </template>
        <template #header>
            <span class='text-danger fw-bold small'>Click on the column header to edit the column</span>
        </template>

        <div>
            <div class='table-responsive'>
                <table class='table table-sm table-bordered table-vcenter mb-0 consensus-table'>
                    <thead>
                        <tr>
                            <th class='bg-transparent' />
                            <th
                                v-for='(resp, idx) in respondents'
                                :key='idx'
                                class='text-center text-primary editable-header'
                                role='button'
                                title='Click to edit this respondent'
                                @click='openMethod(idx)'
                            >
                                Responder {{ idx + 1 }}
                            </th>
                            <th class='text-center'>
                                Consensus
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th class='text-body'>
                                Name:
                            </th>
                            <td
                                v-for='(resp, idx) in respondents'
                                :key='idx'
                                class='text-center text-primary'
                            >
                                {{ resp.name }}
                            </td>
                            <td />
                        </tr>
                        <tr>
                            <th class='text-body'>
                                Method:
                            </th>
                            <td
                                v-for='(resp, idx) in respondents'
                                :key='idx'
                                class='text-center text-primary'
                            >
                                {{ methodLabel(resp.method) }}
                            </td>
                            <td />
                        </tr>
                        <tr>
                            <th class='text-success'>
                                R.O.W.
                            </th>
                            <td
                                v-for='(resp, idx) in respondents'
                                :key='idx'
                                class='text-end text-primary'
                            >
                                {{ formatPoa(resp.row) }}
                            </td>
                            <td class='text-end text-success'>
                                {{ formatPoa(consensusRow(respondents)) }}
                            </td>
                        </tr>
                        <tr
                            v-for='seg in segments'
                            :key='seg.uid'
                        >
                            <th class='text-success'>
                                Seg. {{ seg.callsign }}
                            </th>
                            <td
                                v-for='(resp, idx) in respondents'
                                :key='idx'
                                class='text-end text-primary'
                            >
                                <span
                                    v-if='resp.method === "oconnor" && resp.letters[seg.uid]'
                                    class='text-secondary me-1'
                                >({{ resp.letters[seg.uid] }})</span>{{ formatPoa(resp.values[seg.uid] ?? 0) }}
                            </td>
                            <td class='text-end text-success'>
                                {{ formatPoa(consensusForSegment(respondents, seg.uid)) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <TablerInlineAlert
                v-if='status'
                class='mt-2'
                :severity='statusError ? "danger" : "success"'
                :title='statusError ? "Error" : "Status"'
                :description='status'
            />

            <div class='d-flex gap-2 mt-3'>
                <button
                    type='button'
                    class='btn btn-primary'
                    :disabled='saving'
                    @click='emit("accept")'
                >
                    {{ saving ? 'Saving…' : 'Accept' }}
                </button>
                <button
                    type='button'
                    class='btn btn-secondary'
                    :disabled='saving'
                    @click='emit("back")'
                >
                    Back
                </button>
                <button
                    type='button'
                    class='btn btn-secondary'
                    :disabled='saving'
                    @click='emit("cancel")'
                >
                    Cancel
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary'
                    title='Help is not available yet'
                >
                    Help
                </button>
            </div>
        </div>
    </TablerBorder>

    <ResponderMethodModal
        v-if='methodIndex !== null'
        :initial-name='respondents[methodIndex].name'
        :initial-method='respondents[methodIndex].method'
        @accept='onMethodAccept'
        @cancel='methodIndex = null'
    />

    <ResponderEntryModal
        v-if='entryIndex !== null'
        :respondent='respondents[entryIndex]'
        :segments='segments'
        @accept='onEntryAccept'
        @cancel='entryIndex = null'
    />
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { TablerBorder, TablerInlineAlert } from '@tak-ps/vue-tabler';
import ResponderMethodModal from './ResponderMethodModal.vue';
import ResponderEntryModal from './ResponderEntryModal.vue';
import type { SegmentRef } from './ResponderEntryModal.vue';
import {
    consensusForSegment,
    consensusRow,
    formatPoa,
    methodLabel,
    type ConsensusMethod,
    type ConsensusRespondent,
    type OconnorLetter,
} from '../../../../lib/consensus.ts';

const props = defineProps<{
    respondents: ConsensusRespondent[];
    segments: SegmentRef[];
    saving: boolean;
    status: string;
    statusError: boolean;
}>();

const emit = defineEmits<{
    updateRespondent: [index: number, respondent: ConsensusRespondent];
    accept: [];
    back: [];
    cancel: [];
}>();

const methodIndex = ref<number | null>(null);
const entryIndex = ref<number | null>(null);

function openMethod(idx: number): void {
    methodIndex.value = idx;
}

function onMethodAccept(result: { name: string; method: ConsensusMethod }): void {
    const idx = methodIndex.value;
    if (idx === null) return;
    const current = props.respondents[idx];
    const methodChanged = current.method !== result.method;
    const updated: ConsensusRespondent = {
        ...current,
        name: result.name,
        method: result.method,
        // Switching methods invalidates prior values/letters; reset to defaults.
        row: methodChanged ? 100 : current.row,
        letters: methodChanged ? {} : { ...current.letters },
        values: methodChanged
            ? Object.fromEntries(props.segments.map((s) => [s.uid, 0]))
            : { ...current.values },
    };
    emit('updateRespondent', idx, updated);
    methodIndex.value = null;
    entryIndex.value = idx;
}

function onEntryAccept(result: {
    row: number;
    letters: Record<string, OconnorLetter>;
    ratings: Record<string, number>;
    values: Record<string, number>;
}): void {
    const idx = entryIndex.value;
    if (idx === null) return;
    const current = props.respondents[idx];
    emit('updateRespondent', idx, {
        ...current,
        row: result.row,
        letters: result.letters,
        ratings: result.ratings,
        values: result.values,
    });
    entryIndex.value = null;
}
</script>

<style scoped>
.editable-header {
    cursor: pointer;
}
.consensus-table th,
.consensus-table td {
    white-space: nowrap;
}
</style>
