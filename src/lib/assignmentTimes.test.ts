import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    demobTimeFor,
    normalizeResourceAssignment,
    resourceAssignmentToSchemaRecord,
} from './resourceAssignments.ts';
import { blankWorkAssignmentForm, stampPhaseTime, workAssignmentState, type WorkAssignment } from './workAssignments.ts';
import { workRunning } from './resourceBoard.ts';

const NOW = '2026-11-15T08:30';

function work(patch: Partial<WorkAssignment> = {}): WorkAssignment {
    return { ...blankWorkAssignmentForm(), id: 'w1', teamResourceAssignmentId: 'r1', ...patch };
}

test('Complete stamps the completion time when none was entered (#37)', () => {
    const started = work({ started: '2026-11-15T07:00' });
    const done = stampPhaseTime(started, 'completed', NOW);
    assert.equal(done.completed, NOW);
    assert.equal(done.started, '2026-11-15T07:00');
    assert.equal(workAssignmentState(done), 'completed');
    assert.equal(workRunning(done), false);
});

test('a time already entered is kept', () => {
    const w = work({ started: '2026-11-15T07:00', completed: '2026-11-15T08:00' });
    assert.equal(stampPhaseTime(w, 'completed', NOW), w);
    assert.equal(stampPhaseTime(work(), 'started', NOW).started, NOW);
});

test('work state follows its times', () => {
    assert.equal(workAssignmentState(work()), 'not-started');
    assert.equal(workAssignmentState(work({ started: NOW })), 'started');
});

test('Demobilized gets a time; other statuses drop it (#37)', () => {
    assert.equal(demobTimeFor('demobilized', '', NOW), NOW);
    assert.equal(demobTimeFor('demobilized', '2026-11-15T06:00', NOW), '2026-11-15T06:00');
    assert.equal(demobTimeFor('have', '2026-11-15T06:00', NOW), '');
});

test('demobilization time round-trips through the schema record', () => {
    const r = normalizeResourceAssignment({
        id: 'r1', resourceIdentifier: 'RESQ 10', status: 'demobilized', timeDemobilized: '2026-11-15T09:00',
    });
    assert.equal(r?.timeDemobilized, '2026-11-15T09:00');
    assert.equal(resourceAssignmentToSchemaRecord(r!).timeDemobilized, '2026-11-15T09:00');
    const legacy = normalizeResourceAssignment({ id: 'r2', resourceIdentifier: 'GT 1' });
    assert.equal(legacy?.timeDemobilized, undefined);
});
