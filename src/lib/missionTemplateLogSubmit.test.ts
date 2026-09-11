import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import { templateLogTarget } from './missionTemplateLogSubmit.ts';

function mission(partial: Partial<ActiveMission> = {}): ActiveMission {
    return {
        guid: 'common-guid',
        name: 'Incident Alpha',
        missionToken: 'common-token',
        ...partial,
    };
}

function op(partial: Partial<OpPeriodRegistryEntry> & { opNumber: number; guid: string }): OpPeriodRegistryEntry {
    return {
        name: `Incident Alpha - OP${partial.opNumber}`,
        status: 'open',
        channels: [],
        ...partial,
    };
}

test('templateLogTarget uses the current open OP', () => {
    const target = templateLogTarget(mission(), [
        op({ opNumber: 1, guid: 'op1', status: 'closed' }),
        op({ opNumber: 2, guid: 'op2', ownerToken: 'op2-token' }),
    ]);
    assert.deepEqual(target, {
        guid: 'op2',
        token: 'op2-token',
        label: 'Incident Alpha - OP2',
    });
});

test('templateLogTarget prefers the highest non-closed OP', () => {
    const target = templateLogTarget(mission(), [
        op({ opNumber: 2, guid: 'op2', status: 'debriefing', ownerToken: 't2' }),
        op({ opNumber: 3, guid: 'op3', ownerToken: 't3' }),
        op({ opNumber: 1, guid: 'op1', ownerToken: 't1' }),
    ]);
    assert.equal(target.guid, 'op3');
    assert.equal(target.token, 't3');
});

test('templateLogTarget falls back to the common incident when no OP is open', () => {
    const target = templateLogTarget(mission(), [
        op({ opNumber: 1, guid: 'op1', status: 'closed' }),
    ]);
    assert.deepEqual(target, {
        guid: 'common-guid',
        token: 'common-token',
        label: 'Incident Alpha',
    });
});

test('templateLogTarget falls back when the registry is empty', () => {
    const target = templateLogTarget(mission({ token: 'legacy' }), []);
    assert.equal(target.guid, 'common-guid');
    assert.equal(target.token, 'common-token');
    assert.equal(target.label, 'Incident Alpha');
});

test('templateLogTarget uses deprecated token when missionToken is absent', () => {
    const target = templateLogTarget(mission({ missionToken: undefined, token: 'legacy' }), []);
    assert.equal(target.token, 'legacy');
});
