import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { OpAssignment } from '../domain/entities.ts';
import type { IapAssignmentPlan } from './iapPlanPersistence.ts';
import { appendIcs204aLine, fromLocalInput, ics204aLine, ics204aMapItems, prefillIcs204a, toLocalInput } from './ics204a.ts';

function plan(over: Partial<IapAssignmentPlan>): IapAssignmentPlan {
    return {
        segmentUid: 'seg1', label: '01', supervisor: '', workAssignment: '', specialInstructions: '',
        resources: [], divisionId: '', contacts: [], ...over,
    };
}
const row = (identifier: string, leader: string) => ({ identifier, leader, persons: '', contact: '', reporting: '' });
const ground: OpAssignment = { id: 'a1', opNumber: 1, segmentUid: 'seg1', label: '01', team: 'CCSO SAR 01', notes: 'Some notes' };
const NOW = '2026-11-09T18:00:00.000Z';

test('prefillIcs204a: task name from this assignment\'s 204; team leader left blank', () => {
    const plans = [
        plan({ assignmentId: 'a1', workAssignment: 'Hasty search of trail', resources: [row('Ranger 3', 'Pilot'), row('CCSO SAR 01', 'J. Smith')] }),
        plan({ assignmentId: 'a2', workAssignment: 'Look from the air' }),
    ];
    assert.deepEqual(prefillIcs204a(ground, plans, ' 064-ccso-cno ', NOW), {
        completedAt: NOW, taskName: 'Hasty search of trail', debriefedBy: '064-ccso-cno',
    });
});

test('prefillIcs204a: no 204 yet falls back to the assignment notes', () => {
    assert.deepEqual(prefillIcs204a(ground, [], '', NOW), { completedAt: NOW, taskName: 'Some notes' });
});

test('toLocalInput / fromLocalInput round-trip to the minute', () => {
    const local = toLocalInput('2026-11-09T18:42:31.000Z');
    assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(fromLocalInput(local), '2026-11-09T18:42:00.000Z');
    assert.equal(toLocalInput('not a date'), '');
    assert.equal(fromLocalInput(''), '');
});

test('ics204aMapItems: named markers and areas, newest first; segments, tracks and lines left out', () => {
    const items = ics204aMapItems([
        { id: 'm1', properties: { callsign: 'Boot print', time: '2026-11-09T15:00:00Z' }, geometry: { type: 'Point', coordinates: [-111.65, 35.2] } },
        { id: 'a1', properties: { callsign: 'Cliff band', time: '2026-11-09T16:00:00Z' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
        { id: 'seg', properties: { callsign: '01' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
        { id: 'trk', properties: { callsign: 'Track' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
        { id: 'noname', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
        { id: 'bad', properties: { callsign: 'Bad' }, geometry: { type: 'Point', coordinates: [] } },
    ], new Set(['seg']));
    assert.deepEqual(items.map((i) => [i.uid, i.kind]), [['a1', 'area'], ['m1', 'marker']]);
    assert.deepEqual([items[0].lat, items[0].lon], [1, 1]);
    assert.deepEqual([items[1].lat, items[1].lon], [35.2, -111.65]);
});

test('ics204aLine and appendIcs204aLine', () => {
    const marker = { uid: 'm1', callsign: 'Boot print', kind: 'marker' as const, lat: 35.2, lon: -111.65 };
    assert.equal(ics204aLine(marker, '11/09 15:00', ' size 10, heading N '), 'Boot print · 11/09 15:00 · 35.20000, -111.65000 — size 10, heading N');
    assert.equal(ics204aLine({ ...marker, kind: 'area' }, '', ''), 'Boot print · area centred 35.20000, -111.65000');
    assert.equal(appendIcs204aLine('', 'one'), 'one');
    assert.equal(appendIcs204aLine('one\n', 'two'), 'one\ntwo');
});
