import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DebriefRecord, OpAssignment } from './entities.ts';
import { correctedDebrief, debriefRecordFromValue, debriefsForAssignment, ics204aFromValue } from './debrief.ts';

const ground: OpAssignment = { id: 'a1', opNumber: 1, segmentUid: 'seg1', label: '01', team: 'CCSO SAR 01' };
const air: OpAssignment = { id: 'a2', opNumber: 1, segmentUid: 'seg1', label: '01', team: 'Ranger 3' };

test('debriefRecordFromValue keeps the assignment id', () => {
    const r = debriefRecordFromValue({ opNumber: 1, segmentUid: 'seg1', pod: 30, assignmentId: ' a1 ' });
    assert.equal(r?.assignmentId, 'a1');
    assert.equal(debriefRecordFromValue({ opNumber: 1, segmentUid: 'seg1' })?.assignmentId, undefined);
});

test('debriefsForAssignment: two resources on one segment each get their own debriefs', () => {
    const records: DebriefRecord[] = [
        { opNumber: 1, segmentUid: 'seg1', pod: 30, resource: 'CCSO SAR 01', assignmentId: 'a1', recordedAt: '2026-11-09T12:00:00Z' },
        { opNumber: 1, segmentUid: 'seg1', pod: 50, resource: 'Ranger 3', assignmentId: 'a2', recordedAt: '2026-11-09T13:00:00Z' },
        { opNumber: 1, segmentUid: 'seg1', pod: 40, resource: 'CCSO SAR 01', assignmentId: 'a1', recordedAt: '2026-11-09T11:00:00Z' },
    ];
    assert.deepEqual(debriefsForAssignment(ground, records).map((r) => r.pod), [40, 30]);
    assert.deepEqual(debriefsForAssignment(air, records).map((r) => r.pod), [50]);
});

test('debriefsForAssignment: a debrief without an id matches by OP, segment and resource', () => {
    const records: DebriefRecord[] = [
        { opNumber: 1, segmentUid: 'seg1', pod: 30, resource: 'ccso sar 01' },
        { opNumber: 2, segmentUid: 'seg1', pod: 60, resource: 'CCSO SAR 01' },
        { opNumber: 1, segmentUid: 'seg2', pod: 70, resource: 'CCSO SAR 01' },
        { opNumber: 1, segmentUid: 'seg1', pod: 80, resource: 'CCSO SAR 01', assignmentId: 'other' },
    ];
    assert.deepEqual(debriefsForAssignment(ground, records).map((r) => r.pod), [30]);
    const legacy: OpAssignment = { opNumber: 1, segmentUid: 'seg1', label: '01', team: 'CCSO SAR 01' };
    assert.deepEqual(debriefsForAssignment(legacy, records).map((r) => r.pod), [30]);
});

test('correctedDebrief keeps the assignment id unless the correction names one', () => {
    const existing: DebriefRecord = { opNumber: 1, segmentUid: 'seg1', pod: 30, assignmentId: 'a1', recordedAt: 't0' };
    assert.equal(correctedDebrief(existing, { opNumber: 1, segmentUid: 'seg1', pod: 35 }, 't1').assignmentId, 'a1');
    assert.equal(correctedDebrief(existing, { opNumber: 1, segmentUid: 'seg1', pod: 35, assignmentId: 'a2' }, 't1').assignmentId, 'a2');
});

test('ics204aFromValue: trims text, keeps 0–100 PODs, drops empty fields', () => {
    assert.deepEqual(ics204aFromValue({
        taskName: ' Hasty ', hazards: '', podResponsive: '80', podUnresponsive: 140, actions: 'Walked the trail', extra: 'x',
    }), { taskName: 'Hasty', actions: 'Walked the trail', podResponsive: 80 });
    assert.equal(ics204aFromValue({ hazards: '  ' }), null);
    assert.equal(ics204aFromValue(null), null);
});

test('debriefRecordFromValue keeps ICS 204A details; a correction replaces them', () => {
    const r = debriefRecordFromValue({ opNumber: 1, segmentUid: 'seg1', pod: 30, ics204a: { hazards: 'Cliff edge' } });
    assert.deepEqual(r?.ics204a, { hazards: 'Cliff edge' });
    const fixed = correctedDebrief(r!, { opNumber: 1, segmentUid: 'seg1', pod: 30, ics204a: { hazards: 'Cliff edge, loose rock' } }, 't1');
    assert.deepEqual(fixed.ics204a, { hazards: 'Cliff edge, loose rock' });
    assert.equal(correctedDebrief(r!, { opNumber: 1, segmentUid: 'seg1', pod: 30 }, 't1').ics204a, undefined);
});
