import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scaleTone } from './scaleTone.ts';

const tones = (count: number, lowIsRed = false) => Array.from({ length: count }, (_, i) => scaleTone(i, count, lowIsRed));

test('scaleTone: 1–5 and 1–4 run green → amber → red (#27)', () => {
    assert.deepEqual(tones(5), ['green', 'lime', 'yellow', 'orange', 'red']);
    assert.deepEqual(tones(4), ['green', 'yellow', 'orange', 'red']);
});

test('scaleTone: reversed for Complacency 1–5 / 1–4 (#27)', () => {
    assert.deepEqual(tones(5, true), ['red', 'orange', 'yellow', 'lime', 'green']);
    assert.deepEqual(tones(4, true), ['red', 'orange', 'yellow', 'green']);
});

test('scaleTone: Search Urgency 1–3 is red, amber, green (#26)', () => {
    assert.deepEqual(tones(3, true), ['red', 'yellow', 'green']);
});
