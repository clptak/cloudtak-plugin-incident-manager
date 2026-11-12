import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DebriefRecord, OpAssignment } from '../domain/entities.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';
import type { WorkAssignment } from './workAssignments.ts';
import {
    boardResources, boardSummary, nextAssignmentNumber, opWorkFor, orphanOpWork, orphanWork, workFor, workRunning,
} from './resourceBoard.ts';

function res(id: string, ident: string, over: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return { id, resourceIdentifier: ident, resource: 'Ground', agency: 'CCSO', timeOrdered: '', eta: null, status: 'have', timeArrived: '', ...over };
}
function work(id: string, team: string, n: number, over: Partial<WorkAssignment> = {}): WorkAssignment {
    return { id, assignmentNumber: n, teamResourceAssignmentId: team, teamLabel: '', assignmentUid: `u-${id}`, assignmentCallsign: 'PLS', instructions: '', started: '', completed: '', ...over };
}

const resources = [
    res('r1', 'CCSO GROUND 2'),
    res('r2', 'DPS RANGER 3', { status: 'requested', eta: 1 }),
    res('r3', 'CCSO GROUND 10', { status: 'need' }),
    res('r4', 'CCSO GROUND 1'),
    res('r5', 'OLD TEAM', { status: 'demobilized' }),
    res('r6', 'OP2 TEAM', { opNumber: 2 }),
];

test('boardResources: Initial Response only, Have → Requested → Need, natural identifier order', () => {
    const b = boardResources(resources, null);
    assert.deepEqual(b.active.map((r) => r.id), ['r4', 'r1', 'r2', 'r3']);
    assert.deepEqual(b.inactive.map((r) => r.id), ['r5']);
    assert.deepEqual(boardResources(resources, 2).active.map((r) => r.id), ['r6']);
});

test('workFor / orphanWork: work under its resource; deleted or OP teams go to "No resource"', () => {
    const w = [work('w2', 'r1', 2), work('w1', 'r1', 1), work('w3', 'gone', 3), work('w4', 'r6', 4)];
    assert.deepEqual(workFor(resources[0], w).map((x) => x.id), ['w1', 'w2']);
    assert.deepEqual(orphanWork(resources, w).map((x) => x.id), ['w3', 'w4']);
    assert.equal(nextAssignmentNumber(w), 5);
    assert.equal(nextAssignmentNumber([]), 1);
});

test('workRunning: started and not completed', () => {
    assert.equal(workRunning(work('a', 'r1', 1, { started: '2026-11-12T08:00' })), true);
    assert.equal(workRunning(work('a', 'r1', 1, { started: '2026-11-12T08:00', completed: '2026-11-12T10:00' })), false);
    assert.equal(workRunning(work('a', 'r1', 1)), false);
});

const opAssignments: OpAssignment[] = [
    { id: 'a1', opNumber: 2, segmentUid: 's4', label: '04', team: 'op2 team' },
    { id: 'a2', opNumber: 2, segmentUid: 's1', label: '01', team: 'OP2 TEAM' },
    { id: 'a3', opNumber: 2, segmentUid: 's2', label: '02' },
    { id: 'a4', opNumber: 1, segmentUid: 's1', label: '01', team: 'OP2 TEAM' },
];
const debriefs: DebriefRecord[] = [{ opNumber: 2, segmentUid: 's1', resource: 'OP2 TEAM', assignmentId: 'a2', pod: 60 }];

test('opWorkFor / orphanOpWork: this OP only, team matched ignoring case, debriefs attached', () => {
    const mine = opWorkFor(resources[5], 2, opAssignments, debriefs);
    assert.deepEqual(mine.map((x) => x.assignment.id), ['a2', 'a1']);
    assert.equal(mine[0].debriefs.length, 1);
    assert.equal(mine[1].debriefs.length, 0);
    assert.deepEqual(orphanOpWork(resources, 2, opAssignments, debriefs).map((x) => x.assignment.id), ['a3']);
});

test('boardSummary: counts for the picked OP; running is started work or undebriefed OP assignments', () => {
    const w = [work('w1', 'r1', 1, { started: 'x' }), work('w2', 'r4', 2, { started: 'x', completed: 'y' })];
    assert.deepEqual(boardSummary(resources, null, w, opAssignments, debriefs), {
        need: 1, requested: 1, have: 2, demobilized: 1, running: 1,
    });
    assert.deepEqual(boardSummary(resources, 2, w, opAssignments, debriefs), {
        need: 0, requested: 0, have: 1, demobilized: 0, running: 2,
    });
});
