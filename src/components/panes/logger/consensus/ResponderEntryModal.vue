<template>
    <div
        class='modal modal-blur show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='emit("cancel")'
    >
        <div
            class='modal-dialog modal-lg modal-dialog-centered'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title'>
                        {{ respondent.name }} : {{ methodTitle }}
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='emit("cancel")'
                    />
                </div>
                <div class='modal-body'>
                    <div class='row g-3'>
                        <div class='col-md-6'>
                            <table class='table table-sm table-bordered mb-0'>
                                <thead>
                                    <tr>
                                        <th />
                                        <th class='text-center'>
                                            {{ respondent.name }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <th class='text-end'>
                                            R.O.W.
                                        </th>
                                        <td>
                                            <input
                                                v-model.number='row'
                                                type='number'
                                                step='0.01'
                                                min='0'
                                                max='100'
                                                class='form-control form-control-sm text-end'
                                            >
                                        </td>
                                    </tr>
                                    <tr
                                        v-for='seg in segments'
                                        :key='seg.uid'
                                    >
                                        <th class='text-end'>
                                            Seg. {{ seg.callsign }}
                                        </th>
                                        <td>
                                            <select
                                                v-if='isOconnor'
                                                v-model='letters[seg.uid]'
                                                class='form-select form-select-sm'
                                            >
                                                <option value=''>
                                                    —
                                                </option>
                                                <option
                                                    v-for='l in letterOptions'
                                                    :key='l'
                                                    :value='l'
                                                >
                                                    {{ l }}
                                                </option>
                                            </select>
                                            <input
                                                v-else
                                                v-model.number='values[seg.uid]'
                                                type='number'
                                                step='0.01'
                                                min='0'
                                                max='100'
                                                class='form-control form-control-sm text-end'
                                            >
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class='col-md-6'>
                            <div class='card'>
                                <div class='card-header py-2'>
                                    <h4 class='card-title mb-0'>
                                        Instructions
                                    </h4>
                                </div>
                                <div class='card-body py-2 small text-primary'>
                                    <template v-if='isOconnor'>
                                        <p class='mb-1'>
                                            The R.O.W. requires a percentage.
                                        </p>
                                        <p class='mb-1'>
                                            Each segment requires a letter according to the following scheme:
                                        </p>
                                        <div>A - very likely</div>
                                        <div>B</div>
                                        <div>C - likely</div>
                                        <div>D</div>
                                        <div>E - even chance</div>
                                        <div>F</div>
                                        <div>G - unlikely</div>
                                        <div>H</div>
                                        <div>I - very unlikely</div>
                                    </template>
                                    <template v-else-if='isMattson'>
                                        <p class='mb-1'>
                                            Each evaluator is allotted 100 points.
                                        </p>
                                        <p class='mb-1'>
                                            Assign points to R.O.W. and each segment so that all 100 points are
                                            used. Higher probability areas should get more points.
                                        </p>
                                        <p class='mb-0'>
                                            Current total: {{ mattsonTotal.toFixed(2) }} / 100
                                        </p>
                                    </template>
                                    <template v-else>
                                        <p class='mb-1'>
                                            Rank R.O.W. and each segment on a scale of 0 to 100.
                                        </p>
                                        <p class='mb-0'>
                                            Values are independent and do not need to total 100.
                                        </p>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        v-if='error'
                        class='text-danger small mt-2'
                    >
                        {{ error }}
                    </div>
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn btn-primary'
                        @click='onAccept'
                    >
                        Accept
                    </button>
                    <button
                        type='button'
                        class='btn btn-secondary'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div class='modal-backdrop fade show' />
</template>

<script setup lang='ts'>
import { computed, reactive, ref } from 'vue';
import {
    OCONNOR_LETTERS,
    methodLabel,
    oconnorValues,
    validateRespondentEntry,
    type ConsensusRespondent,
    type OconnorLetter,
} from '../../../../lib/consensus.ts';

export interface SegmentRef {
    uid: string;
    callsign: string;
}

const props = defineProps<{
    respondent: ConsensusRespondent;
    segments: SegmentRef[];
}>();

const emit = defineEmits<{
    accept: [result: { row: number; letters: Record<string, OconnorLetter>; values: Record<string, number> }];
    cancel: [];
}>();

const letterOptions = OCONNOR_LETTERS;

const isOconnor = computed(() => props.respondent.method === 'oconnor');
const isMattson = computed(() => props.respondent.method === 'mattson');
const methodTitle = computed(() => `${methodLabel(props.respondent.method)} Consensus`);

const row = ref<number>(props.respondent.row);
const letters = reactive<Record<string, OconnorLetter | ''>>({});
const values = reactive<Record<string, number>>({});
for (const seg of props.segments) {
    letters[seg.uid] = props.respondent.letters[seg.uid] ?? '';
    values[seg.uid] = props.respondent.values[seg.uid] ?? 0;
}

const error = ref('');

const mattsonTotal = computed(() =>
    props.segments.reduce((sum, seg) => sum + (Number(values[seg.uid]) || 0), (Number(row.value) || 0)),
);

function onAccept(): void {
    const uids = props.segments.map((s) => s.uid);
    const cleanLetters: Record<string, OconnorLetter> = {};
    for (const uid of uids) {
        if (letters[uid]) cleanLetters[uid] = letters[uid] as OconnorLetter;
    }

    const rowNum = Number(row.value) || 0;
    const finalValues: Record<string, number> = isOconnor.value
        ? oconnorValues(rowNum, cleanLetters, uids)
        : Object.fromEntries(uids.map((uid) => [uid, Number(values[uid]) || 0]));

    const candidate: ConsensusRespondent = {
        ...props.respondent,
        row: rowNum,
        letters: cleanLetters,
        values: finalValues,
    };

    const message = validateRespondentEntry(candidate, uids);
    if (message) {
        error.value = message;
        return;
    }
    error.value = '';
    emit('accept', { row: rowNum, letters: cleanLetters, values: finalValues });
}
</script>
