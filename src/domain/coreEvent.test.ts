import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    DEFAULT_EVENT_TYPE,
    buildFieldEvent,
    buildMgmtEvent,
    cadTimeToIso,
    cadTypeCode,
    columnsToNominate,
    createFormFromEvent,
    eventIconMapFromValue,
    eventStyleFor,
    externalIdChanges,
    findEventForCad,
    locationFromCad,
    mergeMissions,
    pickableEvents,
    priorityFromCad,
    type EventSummary,
} from './coreEvent.ts';

const FIELDS: Record<string, string> = {
    Type: 'SUICIDAL SUBJECT STAGE MEDICS (SUICEMS)',
    Address: 'LL(-110:45:16.9850,35:00:43.3943): EST 123 EXAMPLE LN TESTVILLE 86011',
    'Xstreet 1': 'N FIRST ST',
    'Xstreet 2': 'E SECOND AVE',
    Priority: '2',
    Created: '12:01:02  03/04/26',
    Dispatched: '12:05:30  03/04/26',
};

test('cadTypeCode: code in parentheses, else the whole line, upper case', () => {
    assert.equal(cadTypeCode('SUICIDAL SUBJECT STAGE MEDICS (SUICEMS)'), 'SUICEMS');
    assert.equal(cadTypeCode('Missing person'), 'MISSING PERSON');
    assert.equal(cadTypeCode(' lost hiker (lost) '), 'LOST');
});

test('priorityFromCad: 1 critical … 4-5 low, anything else none', () => {
    assert.deepEqual(['1', '2', '3', '4', '5', '', 'x', '9'].map(priorityFromCad),
        ['critical', 'high', 'medium', 'low', 'low', 'none', 'none', 'none']);
    assert.equal(priorityFromCad(undefined), 'none');
});

test('locationFromCad: cross streets, one street, or the address text', () => {
    assert.equal(locationFromCad(FIELDS), 'N FIRST ST and E SECOND AVE');
    assert.equal(locationFromCad({ ...FIELDS, 'Xstreet 2': '' }), 'N FIRST ST');
    assert.equal(locationFromCad({ Address: FIELDS.Address }), 'EST 123 EXAMPLE LN TESTVILLE 86011');
    assert.equal(locationFromCad({}), '');
});

test('cadTimeToIso: CAD time with seconds and offset', () => {
    assert.equal(cadTimeToIso('12:05:30  03/04/26'), '2026-03-04T12:05:30-07:00');
    assert.equal(cadTimeToIso('7:05:30 03/04/26', '-06:00'), '2026-03-04T07:05:30-06:00');
    assert.equal(cadTimeToIso(''), null);
});

test('icon map: unusable input ignored; byCode, then default, then built-in', () => {
    assert.deepEqual(eventIconMapFromValue('nope'), { default: {}, byCode: {} });
    const map = eventIconMapFromValue({
        default: { 'marker-color': '#FF0000', bogus: 1 },
        byCode: { suicems: { type: 'a-f-G', icon: 'x/y.png' }, '': { type: 'z' } },
    });
    assert.deepEqual(Object.keys(map.byCode), ['SUICEMS']);
    assert.deepEqual(eventStyleFor(map, FIELDS.Type), { type: 'a-f-G', icon: 'x/y.png', 'marker-color': '#FF0000' });
    assert.deepEqual(eventStyleFor(map, 'OTHER'), { type: DEFAULT_EVENT_TYPE, icon: '', 'marker-color': '#FF0000' });
    assert.deepEqual(eventStyleFor(eventIconMapFromValue(null), null),
        { type: DEFAULT_EVENT_TYPE, icon: '', 'marker-color': '#FFFFFF' });
});

test('buildMgmtEvent: CAD body; Case Number names it and is set after create', () => {
    const plan = buildMgmtEvent({
        fields: FIELDS, cadId: 'E123', caseNumber: 'C26-9', lat: 35.01, lng: -110.75,
        subjectProfile: 'hiker', channels: [3, 3, 5], missions: [{ guid: 'g1', name: 'M1' }],
    });
    assert.equal(plan.body.name, 'C26-9 - SUICIDAL SUBJECT STAGE MEDICS (SUICEMS)');
    assert.equal(plan.body.remarks, plan.body.name);
    assert.equal(plan.body.type, DEFAULT_EVENT_TYPE);
    assert.deepEqual(plan.body.geometry.coordinates, [-110.75, 35.01]);
    assert.equal(plan.body.started, '2026-03-04T12:05:30-07:00');
    assert.equal(plan.body.priority, 'high');
    assert.deepEqual(plan.body.channels, [3, 5]);
    assert.deepEqual(plan.body.external_id, { system: 'CAD', value: 'E123' });
    assert.deepEqual(plan.body.metadata, { role: 'mgmt', subjectProfile: 'hiker' });
    assert.deepEqual(plan.laterExternalIds, [{ system: 'Case_Number', value: 'C26-9' }]);
});

test('buildMgmtEvent: Event ID names it; Created when no Dispatched; channels required', () => {
    const plan = buildMgmtEvent({
        fields: { ...FIELDS, Dispatched: '' }, cadId: 'E123', caseNumber: null, lat: 1, lng: 2, channels: [1],
    });
    assert.ok(plan.body.name.startsWith('E123 - '));
    assert.equal(plan.body.started, '2026-03-04T12:01:02-07:00');
    assert.deepEqual(plan.laterExternalIds, []);
    assert.throws(() => buildMgmtEvent({ fields: FIELDS, cadId: 'E', caseNumber: null, lat: 1, lng: 2, channels: [] }));
});

test('buildFieldEvent: operational only, no CAD type, OP external id', () => {
    const body = buildFieldEvent({
        incidentId: 'E123', opNumber: 2, opMission: { guid: 'op2', name: 'E123-OP2' }, mgmtEventId: 'ev1',
        lat: 1, lng: 2, location: 'A and B', priority: 'high', channels: [7], started: '2026-03-05T08:00:00Z',
        iconMap: eventIconMapFromValue({ byCode: { SUICEMS: { type: 'special' } } }),
    });
    assert.equal(body.name, 'E123 - OP2');
    assert.equal(body.type, DEFAULT_EVENT_TYPE);
    assert.equal(body.remarks, '');
    assert.deepEqual(body.metadata, { role: 'field', incidentEvent: 'ev1', opNumber: 2 });
    assert.deepEqual(body.external_id, { system: 'OP', value: 'op2' });
    assert.deepEqual(body.missions, [{ guid: 'op2', name: 'E123-OP2' }]);
});

const EVENTS: EventSummary[] = [
    { id: 'a', name: 'old', active: true, started: '2026-01-01', external_ids: { CAD: 'E1' } },
    { id: 'b', name: 'new', active: true, started: '2026-02-01', external_ids: { CAD: 'E1' } },
    { id: 'c', name: 'ended', active: false, started: '2026-03-01', external_ids: { CAD: 'E2' } },
    { id: 'd', name: 'field', active: true, started: '2026-04-01', metadata: { role: 'field' } },
];

test('pickableEvents / findEventForCad: active MGMT events, newest first', () => {
    assert.deepEqual(pickableEvents(EVENTS).map((e) => e.id), ['b', 'a']);
    assert.equal(findEventForCad(EVENTS, 'E1')?.id, 'b');
    assert.equal(findEventForCad(EVENTS, 'E2'), null);
    assert.equal(findEventForCad(EVENTS, null), null);
});

test('mergeMissions: dedupes by guid and keeps existing entries', () => {
    assert.deepEqual(mergeMissions([{ guid: 'g1', name: 'A' }], [{ guid: 'g1', name: 'B' }, { guid: 'g2', name: 'C' }, { guid: 'g2', name: 'C' }]),
        [{ guid: 'g1', name: 'A' }, { guid: 'g2', name: 'C' }]);
});

test('columnsToNominate: nominated column of each board not yet placed', () => {
    assert.deepEqual(columnsToNominate({
        id: 'x', name: 'x', active: true,
        boards: [
            { id: 'b1', channel: 1, column: null, columns: [{ id: 'c1', type: 'custom' }, { id: 'c2', type: 'nominated' }] },
            { id: 'b2', channel: 2, column: 'c9', columns: [{ id: 'c3', type: 'nominated' }] },
            { id: 'b3', channel: 3, column: null, columns: [{ id: 'c4', type: 'custom' }] },
        ],
    }), ['c2']);
});

test('createFormFromEvent: Case Number over CAD ID, date, lat/lng', () => {
    assert.deepEqual(createFormFromEvent({
        id: 'x', name: 'x', active: true, started: '2026-03-04T12:05:30-07:00',
        external_ids: { CAD: 'E1', Case_Number: 'C9' }, geometry: { coordinates: [-110.754, 35.0121] },
    }), { activityNumber: 'C9', date: '2026-03-04', coords: '35.01210, -110.75400' });
    assert.deepEqual(createFormFromEvent({ id: 'x', name: 'x', active: true }),
        { activityNumber: null, date: null, coords: null });
});

test('externalIdChanges: only what differs; blank removes', () => {
    assert.deepEqual(externalIdChanges({ CAD: 'E1', Case_Number: 'C1' }, { Case_Number: 'C1', DEMA: 'D7' }),
        [{ system: 'DEMA', value: 'D7' }]);
    assert.deepEqual(externalIdChanges({ Case_Number: 'C1' }, { Case_Number: '' }),
        [{ system: 'Case_Number', value: '' }]);
});
