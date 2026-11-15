import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blankResourceAssignmentForm, type ResourceAssignment } from './resourceAssignments.ts';
import { blankWorkAssignmentForm, type WorkAssignment } from './workAssignments.ts';
import {
    legacyResourceNotes,
    refreshAutoNotes,
    resourceNotes,
    workStatusText,
} from './ics201ResourceNotes.ts';

const AGENCY = 'Bubba Jones Police Department';

function res(patch: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return { ...blankResourceAssignmentForm(), id: 'r1', resourceIdentifier: 'GROUND TEAM 5', agency: AGENCY, status: 'have', ...patch };
}

function work(patch: Partial<WorkAssignment> = {}): WorkAssignment {
    return {
        ...blankWorkAssignmentForm(),
        id: 'w1',
        teamResourceAssignmentId: 'r1',
        assignmentNumber: 4,
        assignmentCallsign: '02',
        instructions: 'Go looking over there.',
        ...patch,
    };
}

test('work status reads Completed / In progress / Not started with the time', () => {
    assert.equal(workStatusText(work({ started: '2026-11-15T08:38', completed: '2026-11-15T08:39' })), 'Completed 11/15 08:39');
    assert.equal(workStatusText(work({ started: '2026-11-15T07:55' })), 'In progress since 11/15 07:55');
    assert.equal(workStatusText(work()), 'Not started');
});

test('notes lead with the assignment and its status; agency last (#38)', () => {
    const done = work({ started: '2026-11-15T08:38', completed: '2026-11-15T08:39' });
    assert.equal(resourceNotes(res(), [done]), `#4 02 (Completed 11/15 08:39); ${AGENCY}`);
    const needed = res({ id: 'r2', status: 'need', resourceIdentifier: 'Investigator' });
    assert.equal(resourceNotes(needed, [done]), `Status: Need; ${AGENCY}`);
    const noMap = work({ assignmentCallsign: '', assignmentUid: '', instructions: 'Interview the RP' });
    assert.equal(resourceNotes(res(), [noMap]), `#4 Interview the RP (Not started); ${AGENCY}`);
});

test('untouched notes follow the board; edited notes are kept', () => {
    const fresh = [
        { identifier: 'GROUND TEAM 5', notes: 'new 5' },
        { identifier: 'RESQ 3', notes: 'new 3' },
        { identifier: 'ATV', notes: 'new atv' },
        { identifier: 'Investigator', notes: 'new inv' },
    ];
    const legacy = new Map([['ground team 5', `${AGENCY}; Assignment: #4 02`]]);
    const out = refreshAutoNotes([
        { identifier: 'Ground Team 5', notes: `${AGENCY}; Assignment: #4 02` }, // old auto text
        { identifier: 'RESQ 3', notes: 'old auto', autoNotes: 'old auto' },   // untouched
        { identifier: 'ATV', notes: 'Fuel low', autoNotes: 'old auto' },      // edited
        { identifier: 'Investigator', notes: '' },                            // blank
        { identifier: 'Dog Team', notes: 'hand-entered' },                    // not on the board
    ], fresh, legacy);
    assert.deepEqual(out.map((r) => r.notes), ['new 5', 'new 3', 'Fuel low', 'new inv', 'hand-entered']);
    assert.equal(out[0].autoNotes, 'new 5');
    assert.equal(out[2].autoNotes, 'old auto');
});

test('the old format is reproduced for recognising saved forms', () => {
    assert.equal(legacyResourceNotes(res(), [work()]), `${AGENCY}; Assignment: #4 02`);
});
