import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyParsedCadToForm,
    blankIncidentInfoForm,
    createMissionFieldsFromCfs,
    parseCfsHeaderFields,
    readCfsFields,
} from './incidentInfo.ts';

/** Synthetic CAD call in the CFS layout (no real data). */
function cfs(over: { caseNumbers?: string; dispatched?: string; created?: string; closed?: string; address?: string; eventId?: string } = {}): string {
    return [
        'Type', 'WELFARE CHECK (WELF) ', '', '',
        'SubType', 'default ', '', '',
        'Address', `${over.address ?? 'LL(-110:45:16.9850,35:00:43.3943): EST 123 EXAMPLE LN TESTVILLE 86011'} `, '', '',
        'Xstreet 1', '', 'Xstreet 2', ' ', '', '',
        'Priority', '1 ', '', '',
        'Beat', 'FLAG ', '', '',
        'Instructions', ' ', '',
        '-'.repeat(80), '', '',
        'Caller Name', 'TEST CALLER ', '',
        'Caller Number', '555-555-0100 ', '', '',
        'Caller Address', '1 EXAMPLE AVE TESTVILLE ', '',
        'Caller Source', 'ANI/ALI ', '',
        '-'.repeat(80), '', '',
        'Event ID', `${over.eventId ?? 'A26046123'} `, '',
        'Agency', 'CCSO  ', '',
        'DGroup', 'FLG  ', '',
        'Geofences', ' ', '',
        'Case Numbers', `${over.caseNumbers ?? ''} `, '', '',
        'Created', `${over.created ?? '16:05:45  10/18/26'} `, '',
        'Dispatched', `${over.dispatched ?? '16:06:20  10/18/26'} `, '',
        'Closed', `${over.closed ?? ''} `, '', '',
        'Dispositions', '',
    ].join('\n');
}

test('the CAD call: Event ID, Created, Dispatched and Address LL', () => {
    const h = parseCfsHeaderFields(cfs());
    assert.equal(h.activityNumber, 'A26046123');
    assert.equal(h.reportNumber, null);
    assert.equal(h.callCreated, '2026-10-18T16:05');
    assert.equal(h.assignmentDateTime, '2026-10-18T16:06');
    assert.equal(h.closed, null);
    assert.equal(h.callLocation?.lat.toFixed(5), '35.01205');
    assert.equal(h.callLocation?.lng.toFixed(5), '-110.75472');
});

test('every labelled field is read; blank fields are empty, multi-line values kept', () => {
    const f = readCfsFields(cfs());
    assert.equal(f.Type, 'WELFARE CHECK (WELF)');
    assert.equal(f['Xstreet 1'], '');
    assert.equal(f.Beat, 'FLAG');
    assert.equal(f['Caller Source'], 'ANI/ALI');
    assert.equal(f.Agency, 'CCSO');
    assert.equal(f.Geofences, '');
    assert.equal(f.Dispositions, '');
    const multi = readCfsFields('Instructions\nline one\nline two\n\nPriority\n2\n');
    assert.equal(multi.Instructions, 'line one\nline two');
    assert.equal(multi.Priority, '2');
});

test('blank labelled lines never borrow a later value', () => {
    const h = parseCfsHeaderFields(cfs({ eventId: '', caseNumbers: '', closed: '' }));
    assert.equal(h.activityNumber, null);
    assert.equal(h.reportNumber, null);
    assert.equal(h.closed, null);
});

test('Case Numbers: first S-number when several are listed', () => {
    assert.equal(parseCfsHeaderFields(cfs({ caseNumbers: 'S2601234, S2601235' })).reportNumber, 'S2601234');
});

test('one space between time and date, and CRLF line endings, both parse', () => {
    assert.equal(parseCfsHeaderFields(cfs({ dispatched: '16:06:20 10/18/26' })).assignmentDateTime, '2026-10-18T16:06');
    const crlf = parseCfsHeaderFields(cfs().replace(/\n/g, '\r\n'));
    assert.equal(crlf.activityNumber, 'A26046123');
    assert.equal(crlf.assignmentDateTime, '2026-10-18T16:06');
});

test('Closed becomes Incident Conclusion Time', () => {
    const h = parseCfsHeaderFields(cfs({ closed: '21:40:02  10/18/26' }));
    assert.equal(h.closed, '2026-10-18T21:40');
    const form = blankIncidentInfoForm();
    applyParsedCadToForm(form, h);
    assert.equal(form.incidentConclusionTime, '2026-10-18T21:40');
    assert.equal(form.eventId, 'A26046123');
    assert.equal(form.assignmentDateTime, '2026-10-18T16:06');
});

test('Create Mission: Case Number names the mission when present, else Event ID', () => {
    assert.deepEqual(createMissionFieldsFromCfs(parseCfsHeaderFields(cfs())), {
        activityNumber: 'A26046123',
        date: '2026-10-18',
        coords: '35.01205, -110.75472',
    });
    assert.equal(createMissionFieldsFromCfs(parseCfsHeaderFields(cfs({ caseNumbers: 'S2601234' }))).activityNumber, 'S2601234');
});

test('Create Mission: Date falls back to Created; no LL leaves coordinates alone', () => {
    const fields = createMissionFieldsFromCfs(parseCfsHeaderFields(cfs({ dispatched: '', created: '23:59:10  10/17/26', address: '123 EXAMPLE LN TESTVILLE' })));
    assert.equal(fields.date, '2026-10-17');
    assert.equal(fields.coords, null);
});

test('Initial Information keeps Event ID and Case Number in their own fields', () => {
    const form = blankIncidentInfoForm();
    applyParsedCadToForm(form, parseCfsHeaderFields(cfs({ caseNumbers: 'S2601234' })));
    assert.equal(form.eventId, 'A26046123');
    assert.equal(form.incidentId, 'S2601234');
});

test('text laid out without one-label-per-line still uses the older patterns', () => {
    const h = parseCfsHeaderFields('Notes: Event ID\nA26046123\n Dispatched\n16:06:20  10/18/26');
    assert.equal(h.activityNumber, 'A26046123');
    assert.equal(h.assignmentDateTime, '2026-10-18T16:06');
});
