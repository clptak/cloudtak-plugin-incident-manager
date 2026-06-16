<template>
    <div>
        <label class='form-label small mb-1'>
            5 · Strategies <span class='text-muted'>(How)</span>
        </label>

        <div
            v-for='(strategy, si) in strategies'
            :key='si'
            class='strategy-block border rounded p-2 mb-2'
        >
            <div class='input-group input-group-sm mb-2'>
                <span class='input-group-text text-muted'>
                    {{ si + 1 }}
                </span>
                <input
                    v-model='strategy.text'
                    type='text'
                    class='form-control form-control-sm'
                    :placeholder='`Strategy ${si + 1}`'
                >
                <button
                    v-if='strategies.length > 1'
                    type='button'
                    class='btn btn-outline-danger btn-sm'
                    :aria-label='`Remove strategy ${si + 1}`'
                    @click='removeStrategy(si)'
                >
                    <IconX
                        :size='16'
                        stroke='1.5'
                    />
                </button>
            </div>

            <div class='tactics-nested ms-2 ps-2 border-start'>
                <label class='form-label small mb-1 text-muted'>
                    6 · Tactics / Work Assignments <span class='text-muted'>(Who / What / Where / When)</span>
                </label>

                <div
                    v-for='(tactic, ti) in strategy.tactics'
                    :key='ti'
                    class='input-group input-group-sm mb-2'
                >
                    <span class='input-group-text text-muted'>
                        {{ si + 1 }}.{{ ti + 1 }}
                    </span>
                    <input
                        v-model='tactic.text'
                        type='text'
                        class='form-control form-control-sm'
                        :placeholder='`Tactic ${si + 1}.${ti + 1}`'
                    >
                    <button
                        v-if='strategy.tactics.length > 1'
                        type='button'
                        class='btn btn-outline-danger btn-sm'
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
                    class='form-text text-muted mb-0'
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
            class='form-text text-muted'
        >
            Maximum of {{ MAX_STRATEGIES_PER_OBJECTIVE }} strategies per objective.
        </div>
    </div>
</template>

<script setup lang='ts'>
import { IconPlus, IconX } from '@tabler/icons-vue';
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
