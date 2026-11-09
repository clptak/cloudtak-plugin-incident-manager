import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSearchScenario, duplicateRanks, rankChoices } from './searchScenarios.ts';

test('rankChoices: ranks run 1..N and mark ones other scenarios hold', () => {
    const scen = [{ key: 'A', rank: 1 }, { key: 'B', rank: null }, { key: 'C', rank: 3 }];
    assert.deepEqual(rankChoices(scen, 'B'), [
        { rank: 1, takenBy: 'A' },
        { rank: 2 },
        { rank: 3, takenBy: 'C' },
    ]);
    // A scenario's own rank is not "taken" for itself
    assert.deepEqual(rankChoices(scen, 'A')[0], { rank: 1 });
});

test('rankChoices: a single scenario can only be rank 1; a stored rank above N stays', () => {
    assert.deepEqual(rankChoices([{ key: 'A', rank: null }], 'A'), [{ rank: 1 }]);
    assert.equal(rankChoices([{ key: 'A', rank: 4 }], 'A').length, 4);
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
