import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { OpAssignment } from '../domain/entities.ts';
import type { IapAssignmentPlan } from './iapPlanPersistence.ts';
import { fromLocalInput, prefillIcs204a, toLocalInput } from './ics204a.ts';

function plan(over: Partial<IapAssignmentPlan>): IapAssignmentPlan {
    return {
        segmentUid: 'seg1', label: '01', supervisor: '', workAssignment: '', specialInstructions: '',
        resources: [], divisionId: '', contacts: [], ...over,
    };
}
const row = (identifier: string, leader: string) => ({ identifier, leader, persons: '', contact: '', reporting: '' });
const ground: OpAssignment = { id: 'a1', opNumber: 1, segmentUid: 'seg1', label: '01', team: 'CCSO SAR 01', notes: 'Some notes' };
const NOW = '2026-11-09T18:00:00.000Z';

test('prefillIcs204a: task name and team leader from this assignment\'s 204', () => {
    const plans = [
        plan({ assignmentId: 'a1', workAssignment: 'Hasty search of trail', resources: [row('Ranger 3', 'Pilot'), row('CCSO SAR 01', 'J. Smith')] }),
        plan({ assignmentId: 'a2', workAssignment: 'Look from the air' }),
    ];
    assert.deepEqual(prefillIcs204a(ground, plans, ' 064-ccso-cno ', NOW), {
        completedAt: NOW, taskName: 'Hasty search of trail', teamLeader: 'J. Smith', debriefedBy: '064-ccso-cno',
    });
});

test('prefillIcs204a: no 204 yet falls back to the assignment notes', () => {
    assert.deepEqual(prefillIcs204a(ground, [], '', NOW), { completedAt: NOW, taskName: 'Some notes' });
});

test('prefillIcs204a: a single resource row is the team leader even if named differently', () => {
    const plans = [plan({ assignmentId: 'a1', resources: [row('', 'K. Lee')] })];
    assert.equal(prefillIcs204a(ground, plans, '', NOW).teamLeader, 'K. Lee');
});

test('toLocalInput / fromLocalInput round-trip to the minute', () => {
    const local = toLocalInput('2026-11-09T18:42:31.000Z');
    assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(fromLocalInput(local), '2026-11-09T18:42:00.000Z');
    assert.equal(toLocalInput('not a date'), '');
    assert.equal(fromLocalInput(''), '');
});
