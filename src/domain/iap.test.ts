import assert from 'node:assert/strict';
import { test } from 'node:test';
import { iapFormPlan, isUasLabel, usesExtendedIcsSet } from './iap.ts';

test('iapFormPlan: base SAR set', () => {
    assert.deepEqual(iapFormPlan({ category: 'search', hasUas: false }),
        ['ics202', 'ics203', 'ics204', 'ics205', 'ics208']);
});

test('iapFormPlan: wildland fire and disaster add 207 + 209', () => {
    for (const category of ['wildland-fire', 'disaster']) {
        const plan = iapFormPlan({ category, hasUas: false });
        assert.ok(plan.includes('ics207'), category);
        assert.ok(plan.includes('ics209'), category);
        // 202 always leads; 209 trails the safety message
        assert.equal(plan[0], 'ics202');
        assert.ok(plan.indexOf('ics208') < plan.indexOf('ics209'));
    }
    assert.ok(!iapFormPlan({ category: 'rescue', hasUas: false }).includes('ics207'));
});

test('iapFormPlan: medical plan content pulls in 206', () => {
    const withMed = iapFormPlan({ category: 'search', hasUas: false, hasMedical: true });
    assert.ok(withMed.includes('ics206'));
    assert.ok(withMed.indexOf('ics205') < withMed.indexOf('ics206'));
    assert.ok(!iapFormPlan({ category: 'search', hasUas: false }).includes('ics206'));
});

test('iapFormPlan: UAS resource appends the modified 220', () => {
    const plan = iapFormPlan({ category: 'search', hasUas: true });
    assert.equal(plan.at(-1), 'ics220');
    assert.ok(!iapFormPlan({ category: 'search', hasUas: false }).includes('ics220'));
});

test('iapFormPlan: 205A slots in after the radio plan when included', () => {
    const plan = iapFormPlan({ category: 'search', hasUas: false, hasCommsList: true });
    assert.ok(plan.includes('ics205a'));
    assert.equal(plan.indexOf('ics205a'), plan.indexOf('ics205') + 1);
    assert.ok(!iapFormPlan({ category: 'search', hasUas: false }).includes('ics205a'));
});

test('usesExtendedIcsSet / isUasLabel', () => {
    assert.equal(usesExtendedIcsSet('disaster'), true);
    assert.equal(usesExtendedIcsSet('search'), false);
    assert.equal(isUasLabel('Drone', 'SO UAS 1'), true);
    assert.equal(isUasLabel('Fixed Wing'), false);
    assert.equal(isUasLabel(undefined, 'Team UAV-2'), true);
    assert.equal(isUasLabel('Grid Team', 'GT-4'), false);
});
