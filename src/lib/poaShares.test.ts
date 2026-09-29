import assert from 'node:assert/strict';
import test from 'node:test';
import {
    allocateParentValue,
    defaultPoaShares,
    poaSharesMatchSource,
    sumPoaShares,
} from './poaShares.ts';

test('defaultPoaShares: even split stays exact', () => {
    assert.deepEqual(defaultPoaShares(12, 3), [4, 4, 4]);
    assert.equal(sumPoaShares(defaultPoaShares(12, 3)), 12);
});

test('defaultPoaShares: last share absorbs the rounding remainder', () => {
    const shares = defaultPoaShares(10, 3);
    assert.deepEqual(shares, [3.33, 3.33, 3.34]);
    assert.equal(sumPoaShares(shares), 10);

    const tiny = defaultPoaShares(1, 3);
    assert.deepEqual(tiny, [0.33, 0.33, 0.34]);
    assert.equal(sumPoaShares(tiny), 1);
});

test('poaSharesMatchSource: requires the shares to total the source POA', () => {
    assert.equal(poaSharesMatchSource([4, 4, 4], 12), true);
    assert.equal(poaSharesMatchSource([3.33, 3.33, 3.34], 10), true);
    assert.equal(poaSharesMatchSource([4, 4, 3.9], 12), false);
    assert.equal(poaSharesMatchSource([6, 6.02], 12), false);
    assert.equal(poaSharesMatchSource(defaultPoaShares(12.25, 4), 12.25), true);
});

test('allocateParentValue: last part keeps the respondent total unchanged', () => {
    const parts = allocateParentValue(10, [3.33, 3.33, 3.34], 10);
    assert.equal(sumPoaShares(parts), 10);
    assert.equal(parts[0], 3.33);
    assert.equal(parts[2], 3.34);

    const uneven = allocateParentValue(12, [6, 3, 3], 12);
    assert.deepEqual(uneven, [6, 3, 3]);
});
