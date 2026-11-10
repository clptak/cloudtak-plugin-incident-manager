import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scaleRgb, scaleTextOn, scaleTone } from './scaleTone.ts';

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

test('scaleRgb: GAR 0–10 runs green (0) → amber (5) → red (10) (#24)', () => {
    assert.equal(scaleRgb(0, 11), '47, 179, 68');
    assert.equal(scaleRgb(5, 11), '245, 159, 0');
    assert.equal(scaleRgb(10, 11), '214, 57, 57');
    assert.equal(scaleRgb(0, 11, true), '214, 57, 57');
});

test('scaleTextOn: dark text on amber, white on green and red', () => {
    assert.equal(scaleTextOn(scaleRgb(5, 11)), '#1d273b');
    assert.equal(scaleTextOn(scaleRgb(10, 11)), '#fff');
    assert.equal(scaleTextOn(scaleRgb(0, 11)), '#fff');
});
