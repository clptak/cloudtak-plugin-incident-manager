<template>
    <div>
        <p class='text-uppercase text-white-50 small mb-1'>
            5 · Strategies <span class='text-white-50'>(How)</span>
        </p>

        <div
            v-for='(strategy, si) in strategies'
            :key='si'
            class='strategy-block border border-white-50 rounded-3 p-2 mb-2'
        >
            <div class='d-flex align-items-start gap-2 mb-2'>
                <span
                    class='text-white-50 small pt-2'
                    style='min-width: 1.5rem;'
                >
                    {{ si + 1 }}
                </span>
                <div class='flex-grow-1'>
                    <TablerInput
                        v-model='strategy.text'
                        :placeholder='`Strategy ${si + 1}`'
                    />
                </div>
                <button
                    v-if='strategies.length > 1'
                    type='button'
                    class='btn btn-outline-danger btn-sm mt-1'
                    :aria-label='`Remove strategy ${si + 1}`'
                    @click='removeStrategy(si)'
                >
                    <IconX
                        :size='16'
                        stroke='1.5'
                    />
                </button>
            </div>

            <div class='tactics-nested ms-2 ps-2 border-start border-white-50'>
                <p class='text-uppercase text-white-50 small mb-1'>
                    6 · Tactics / Work Assignments <span class='text-white-50'>(Who / What / Where / When)</span>
                </p>

                <div
                    v-for='(tactic, ti) in strategy.tactics'
                    :key='ti'
                    class='d-flex align-items-start gap-2 mb-2'
                >
                    <span
                        class='text-white-50 small pt-2'
                        style='min-width: 2.25rem;'
                    >
                        {{ si + 1 }}.{{ ti + 1 }}
                    </span>
                    <div class='flex-grow-1'>
                        <TablerInput
                            v-model='tactic.text'
                            :placeholder='`Tactic ${si + 1}.${ti + 1}`'
                        />
                    </div>
                    <button
                        v-if='strategy.tactics.length > 1'
                        type='button'
                        class='btn btn-outline-danger btn-sm mt-1'
                        :aria-label='`Remove tactic ${si + 1}.${ti + 1}`'
                        @click='removeTactic(si, ti)'
                    >
                        <IconX
                            :size='16'
                            stroke='1.5'
                        />
                    </button>
                </div>

                <button
                    v-if='strategy.tactics.length < MAX_TACTICS_PER_STRATEGY'
                    type='button'
                    class='btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 mb-1'
                    @click='addTactic(si)'
                >
                    <IconPlus
                        :size='16'
                        stroke='1.5'
                    />
                    Add tactic
                </button>
                <div
                    v-else
                    class='form-text text-white-50 mb-0'
                >
                    Maximum of {{ MAX_TACTICS_PER_STRATEGY }} tactics per strategy.
                </div>
            </div>
        </div>

        <button
            v-if='strategies.length < MAX_STRATEGIES_PER_OBJECTIVE'
            type='button'
            class='btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1'
            @click='addStrategy'
        >
            <IconPlus
                :size='16'
                stroke='1.5'
            />
            Add strategy
        </button>
        <div
            v-else
            class='form-text text-white-50'
        >
            Maximum of {{ MAX_STRATEGIES_PER_OBJECTIVE }} strategies per objective.
        </div>
    </div>
</template>

<script setup lang='ts'>
import { IconPlus, IconX } from '@tabler/icons-vue';
import { TablerInput } from '@tak-ps/vue-tabler';
import {
    MAX_STRATEGIES_PER_OBJECTIVE,
    MAX_TACTICS_PER_STRATEGY,
    blankStrategy,
    blankTactic,
    type StrategyCell,
} from '../../../lib/incidentPost.ts';

const strategies = defineModel<StrategyCell[]>({ required: true });

const emit = defineEmits<{
    deleteId: [id: string];
}>();

function queueDelete(id: string | undefined): void {
    if (id) emit('deleteId', id);
}

function addStrategy(): void {
    if (strategies.value.length >= MAX_STRATEGIES_PER_OBJECTIVE) return;
    strategies.value.push(blankStrategy());
}

function removeStrategy(index: number): void {
    if (strategies.value.length <= 1) return;
    const strategy = strategies.value[index];
    queueDelete(strategy.id);
    for (const tactic of strategy.tactics) queueDelete(tactic.id);
    strategies.value.splice(index, 1);
}

function addTactic(strategyIndex: number): void {
    const strategy = strategies.value[strategyIndex];
    if (strategy.tactics.length >= MAX_TACTICS_PER_STRATEGY) return;
    strategy.tactics.push(blankTactic());
}

function removeTactic(strategyIndex: number, tacticIndex: number): void {
    const strategy = strategies.value[strategyIndex];
    if (strategy.tactics.length <= 1) return;
    queueDelete(strategy.tactics[tacticIndex].id);
    strategy.tactics.splice(tacticIndex, 1);
}
</script>
