import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PDFDocument } from '../vendor/pdf-lib.esm.min.js';
import type { DebriefRecord } from '../domain/entities.ts';
import { ics204aFilename, ics204aPdfData } from './ics204a.ts';
import { buildIcs204aPdf } from './ics204aPdf.ts';

const record: DebriefRecord = {
    opNumber: 1, segmentUid: 'seg1', label: '01', pod: 30, coverage: 0.5, resource: 'CCSO SAR 01',
    recordedAt: '2026-11-09T18:42:31.000Z', tracks: [{ uid: 't1', name: 'Track', lengthMi: 2, points: 10 } as never],
    ics204a: {
        taskNumber: 'T-7', taskName: 'Hasty search of trail', teamLeader: 'J. Smith', debriefedBy: '064-ccso-cno',
        completedAt: '2026-11-09T18:00:00.000Z', podResponsive: 80, podUnresponsive: 40,
        actions: 'Walked the trail', clues: 'Boot print · 35.20000, -111.65000 — size 10', hazards: 'Cliff band',
    },
};

test('ics204aPdfData: debrief fields fill the form', () => {
    const d = ics204aPdfData(record, 'Hiker - Slide Rock', '01');
    assert.equal(d.opNumber, '1');
    assert.equal(d.assignmentNumber, '01');
    assert.equal(d.teamName, 'CCSO SAR 01');
    assert.equal(d.estimatedPod, '30% (50% of segment completed)');
    assert.equal(d.podResponsive, '80%');
    assert.equal(d.mapAttached, true);
    assert.match(d.dateCompleted, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(d.timeCompleted, /^\d{2}:\d{2}$/);
    const bare = ics204aPdfData({ opNumber: 2, segmentUid: 's', pod: 70 }, '', 'Seg 9');
    assert.equal(bare.assignmentNumber, 'Seg 9');
    assert.equal(bare.estimatedPod, '70%');
    assert.equal(bare.mapAttached, false);
    assert.equal(bare.dateCompleted, '');
});

test('ics204aFilename names the OP, assignment, team and time', () => {
    assert.equal(ics204aFilename(record, '01'), 'ICS-204A_OP1_01_CCSO-SAR-01_202611091842.pdf');
    assert.equal(ics204aFilename({ opNumber: 3, segmentUid: 's' }, 'Seg / 4'), 'ICS-204A_OP3_Seg-4.pdf');
});

test('buildIcs204aPdf: one page normally; long text continues on another page', async () => {
    const one = await PDFDocument.load(await buildIcs204aPdf(ics204aPdfData(record, 'Hiker', '01')));
    assert.equal(one.getPageCount(), 1);
    const long = { ...record, ics204a: { ...record.ics204a, actions: 'Searched along the drainage and back. '.repeat(400) } };
    const many = await PDFDocument.load(await buildIcs204aPdf(ics204aPdfData(long, 'Hiker', '01')));
    assert.ok(many.getPageCount() > 1, String(many.getPageCount()));
});
