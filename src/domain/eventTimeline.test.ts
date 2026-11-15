import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    TIMELINE_SOURCE,
    logTimelineEntry,
    pickTimelineEvent,
    resourceStatusChanged,
    resourceTimelineEntry,
    supportsTimeline,
    workAssignmentTimelineEntry,
} from './eventTimeline.ts';

test('supportsTimeline: 13.122.0 and later', () => {
    assert.equal(supportsTimeline('13.122.0'), true);
    assert.equal(supportsTimeline('v13.122.8'), true);
    assert.equal(supportsTimeline('13.123.0'), true);
    assert.equal(supportsTimeline('14.0.0'), true);
    assert.equal(supportsTimeline('13.121.9'), false);
    assert.equal(supportsTimeline('12.999.0'), false);
    assert.equal(supportsTimeline(''), false);
    assert.equal(supportsTimeline(undefined), false);
});

const ops = [
    { guid: 'op1', opNumber: 1, fieldEventId: 'field-1' },
    { guid: 'op2', opNumber: 2 },
];

test('pickTimelineEvent: the OP field event by sync, else by OP number, else MGMT', () => {
    assert.equal(pickTimelineEvent({ mgmtEventId: 'mgmt', ops, syncGuid: 'op1' }), 'field-1');
    assert.equal(pickTimelineEvent({ mgmtEventId: 'mgmt', ops, opNumber: 1 }), 'field-1');
    // OP 2 has no field event yet: MGMT.
    assert.equal(pickTimelineEvent({ mgmtEventId: 'mgmt', ops, syncGuid: 'op2' }), 'mgmt');
    // The MGMT sync itself, or an unknown one: MGMT.
    assert.equal(pickTimelineEvent({ mgmtEventId: 'mgmt', ops, syncGuid: 'mgmt-sync' }), 'mgmt');
    assert.equal(pickTimelineEvent({ mgmtEventId: 'mgmt', ops }), 'mgmt');
});

test('pickTimelineEvent: a known sync wins over the OP number', () => {
    assert.equal(pickTimelineEvent({ mgmtEventId: 'mgmt', ops, syncGuid: 'op2', opNumber: 1 }), 'mgmt');
});

test('pickTimelineEvent: no event linked at all', () => {
    assert.equal(pickTimelineEvent({ mgmtEventId: null, ops: [] }), null);
    assert.equal(pickTimelineEvent({ ops: [{ guid: 'op1', opNumber: 1 }], syncGuid: 'op1' }), null);
});

test('workAssignmentTimelineEntry: one keyed status entry per phase', () => {
    const a = {
        id: 'a1',
        assignmentNumber: 4,
        teamLabel: 'Team Alpha',
        assignmentCallsign: 'Seg 12',
        assignmentUid: 'uid-1',
        instructions: 'Grid north half',
        occurred: '2026-11-15T10:00:00Z',
        logId: 'log-9',
    };
    const started = workAssignmentTimelineEntry(a, 'started', 'K7ABC');
    assert.equal(started.type, 'status');
    assert.equal(started.external_id, 'wa:a1:started');
    assert.equal(started.occurred, '2026-11-15T10:00:00.000Z');
    assert.equal(started.author, 'K7ABC');
    assert.equal(
        started.body,
        '**Assignment 4 started**\nTeam: Team Alpha\nMap object: Seg 12\nInstructions: Grid north half',
    );
    assert.deepEqual(started.metadata, {
        source: TIMELINE_SOURCE,
        kind: 'work-assignment',
        phase: 'started',
        assignmentId: 'a1',
        assignmentNumber: 4,
        assignmentUid: 'uid-1',
        logId: 'log-9',
    });

    const done = workAssignmentTimelineEntry(a, 'completed');
    assert.equal(done.external_id, 'wa:a1:completed');
    assert.ok(!done.body.includes('Instructions'));
});

test('workAssignmentTimelineEntry: no map object, no time', () => {
    const e = workAssignmentTimelineEntry({ id: 'a2', assignmentNumber: 1 }, 'created');
    assert.equal(e.body, '**Assignment 1 created**');
    assert.equal(e.occurred, undefined);
    assert.deepEqual(e.metadata, { source: TIMELINE_SOURCE, kind: 'work-assignment', phase: 'created', assignmentId: 'a2', assignmentNumber: 1 });
});

test('workAssignmentTimelineEntry: an unparseable time is dropped, not sent', () => {
    const e = workAssignmentTimelineEntry({ id: 'a3', assignmentNumber: 2, occurred: 'soon' }, 'started');
    assert.equal(e.occurred, undefined);
});

test('resourceTimelineEntry: added, then one row per status', () => {
    const r = {
        id: 'r1',
        resourceIdentifier: 'SAR 21',
        resource: 'Ground Team',
        agency: 'CCSO',
        status: 'have',
        statusLabel: 'Have',
        opNumber: 2,
    };
    const added = resourceTimelineEntry(r, 'added', 'IC');
    assert.equal(added.type, 'unit');
    assert.equal(added.external_id, 'ra:r1:added');
    assert.equal(added.body, '**Resource added: SAR 21 - Ground Team** (Have)\nAgency: CCSO\nOP 2');

    const demob = resourceTimelineEntry({ ...r, status: 'demobilized', statusLabel: 'Demobilized' }, 'status');
    assert.equal(demob.external_id, 'ra:r1:demobilized');
    assert.equal(demob.body.split('\n')[0], '**Resource SAR 21 - Ground Team: Demobilized**');
    assert.equal(demob.metadata.status, 'demobilized');
});

test('resourceTimelineEntry: no identifier falls back to "Resource"', () => {
    const e = resourceTimelineEntry({ id: 'r2', resourceIdentifier: ' ', status: 'requested', statusLabel: 'Requested' }, 'added');
    assert.equal(e.body, '**Resource added: Resource** (Requested)');
});

test('resourceStatusChanged', () => {
    assert.equal(resourceStatusChanged({ status: 'have' }, { status: 'have' }), false);
    assert.equal(resourceStatusChanged({ status: 'have' }, { status: 'demobilized' }), true);
});

test('logTimelineEntry: keyed by log id, title and sync shown', () => {
    const e = logTimelineEntry({
        logId: 'L1',
        title: 'Search Urgency',
        content: 'Search Urgency: High (total 6/21).',
        dtg: '2026-11-15T12:30:00Z',
        type: 'status',
        syncName: 'MGMT-1234',
        keywords: ['search-urgency'],
    }, 'Planning');
    assert.ok(e);
    assert.equal(e.external_id, 'log:L1');
    assert.equal(e.type, 'status');
    assert.equal(e.body, '**Search Urgency**\nSearch Urgency: High (total 6/21).\n_DataSync: MGMT-1234_');
    assert.deepEqual(e.metadata, {
        source: TIMELINE_SOURCE,
        kind: 'datasync-log',
        logId: 'L1',
        syncName: 'MGMT-1234',
        keywords: ['search-urgency'],
    });
});

test('logTimelineEntry: defaults to a comment; empty logs are skipped', () => {
    const e = logTimelineEntry({ logId: 'L2', content: 'Caller reports lights' });
    assert.equal(e?.type, 'comment');
    assert.equal(e?.body, 'Caller reports lights');
    assert.equal(logTimelineEntry({ logId: 'L3', content: '  ' }), null);
    assert.equal(logTimelineEntry({ logId: '', content: 'x' }), null);
});
