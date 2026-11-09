import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSearchScenario, duplicateRanks, moveItem, orderByRank, ranksFromOrder, scenarioFieldsForSave } from './searchScenarios.ts';

test('orderByRank: ranked by rank, unranked last, ties by letter', () => {
    assert.deepEqual(orderByRank([
        { key: 'C', rank: null }, { key: 'B', rank: 2 }, { key: 'A', rank: null }, { key: 'D', rank: 1 }, { key: 'E', rank: 2 },
    ]), ['D', 'B', 'E', 'A', 'C']);
});

test('moveItem and ranksFromOrder: a drag renumbers 1..N', () => {
    const order = moveItem(['A', 'B', 'C', 'D'], 3, 0);
    assert.deepEqual(order, ['D', 'A', 'B', 'C']);
    assert.deepEqual(moveItem(['A', 'B', 'C'], 0, 2), ['B', 'C', 'A']);
    assert.deepEqual(ranksFromOrder(order), { D: 1, A: 2, B: 3, C: 4 });
});

test('duplicateRanks: reports ties only', () => {
    assert.deepEqual(duplicateRanks([
        { key: 'B', rank: 1 }, { key: 'A', rank: 1 }, { key: 'C', rank: 2 }, { key: 'D', rank: null },
    ]), [{ rank: 1, keys: ['A', 'B'] }]);
    assert.deepEqual(duplicateRanks([{ key: 'A', rank: 1 }, { key: 'B', rank: 2 }]), []);
});

test('priority accepts ranks 1-6 (letters A-F) and rejects others', () => {
    const mk = (priority: unknown) => buildSearchScenario('F', { description: 'x', priority: priority as number }).priority;
    assert.equal(mk(6), 6);
    assert.equal(mk(7), null);
    assert.equal(mk(0), null);
    assert.equal(mk(null), null);
});

test('scenarioFieldsForSave: a sent scenario uses its sent fields, not a stale draft copy (#22)', () => {
    const drafts = {
        A: { description: 'Separated, medical', priority: 1 },
        B: { description: 'Items for B', priority: 1 },
        C: { description: 'New one', priority: 3 },
        D: { description: '', priority: null },
    };
    const sent = [
        { key: 'A', fields: { description: 'Separated, medical', priority: 2 } },
        { key: 'B', fields: { description: 'Items for B', priority: 1 } },
    ];
    const out = scenarioFieldsForSave(['A', 'B', 'C', 'D'], drafts, sent);
    assert.deepEqual(out.map((o) => [o.letter, o.fields.priority]), [['A', 2], ['B', 1], ['C', 3]]);
});
