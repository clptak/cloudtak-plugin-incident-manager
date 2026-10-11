import assert from 'node:assert/strict';
import test from 'node:test';
import { letterScaleClass, letterScaleLegendClass } from './letterScale.ts';

test('letterScaleClass: E stays Bootstrap primary/secondary', () => {
    assert.equal(letterScaleClass('E', false), 'btn-outline-secondary');
    assert.equal(letterScaleClass('E', true), 'btn-primary');
    assert.equal(letterScaleClass('E', true, 'secondary'), 'btn-secondary');
});

test('letterScaleClass: A–D / F–I get tint classes and a selected ring', () => {
    assert.equal(letterScaleClass('A', false), 'letter-scale-btn letter-scale-A');
    assert.equal(letterScaleClass('D', true), 'letter-scale-btn letter-scale-D is-selected');
    assert.equal(letterScaleClass('F', false), 'letter-scale-btn letter-scale-F');
    assert.equal(letterScaleClass('I', true), 'letter-scale-btn letter-scale-I is-selected');
});

test('letterScaleLegendClass: E is unstyled', () => {
    assert.equal(letterScaleLegendClass('E'), '');
    assert.equal(letterScaleLegendClass('A'), 'letter-scale-legend letter-scale-A');
    assert.equal(letterScaleLegendClass('I'), 'letter-scale-legend letter-scale-I');
});
