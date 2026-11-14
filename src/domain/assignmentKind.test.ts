import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    assignmentKind,
    countsInSearchMath,
    isDebriefable,
    workAssignmentText,
} from './assignmentKind.ts';
import { addTaskAssignment, publishAssignments } from './usecases.ts';
import type { OpAssignment, OpPeriodRegistryEntry } from './entities.ts';
import { encodeSchema } from '../lib/schemaCodec.ts';

const op = { opNumber: 2, status: 'active', name: 'OP2', guid: 'g' } as unknown as OpPeriodRegistryEntry;

function memoryStore(): { list: OpAssignment[]; load(): Promise<OpAssignment[]>; upsert(a: OpAssignment): Promise<void> } {
    const list: OpAssignment[] = [];
    return {
        list,
        async load() { return [...list]; },
        async upsert(a) { list.push(a); },
    };
}

test('assignments saved before #35 are search work', () => {
    assert.equal(assignmentKind({}), 'search');
    assert.ok(countsInSearchMath({ segmentUid: 'seg-1' }));
});

test('only search work on a segment counts in the math', () => {
    assert.ok(!countsInSearchMath({ kind: 'investigation', segmentUid: 'feat-1' }));
    assert.ok(!countsInSearchMath({ kind: 'investigation', segmentUid: '' }));
    assert.ok(!countsInSearchMath({ kind: 'search', segmentUid: '' }));
});

test('work with no map object cannot be debriefed', () => {
    assert.ok(!isDebriefable({ segmentUid: '' }));
    assert.ok(isDebriefable({ segmentUid: 'feat-1' }));
});

test('204 work assignment line by type', () => {
    assert.equal(workAssignmentText({ segmentUid: 's', label: 'A3', notes: 'Grid' }), 'Search segment A3. Grid');
    assert.equal(workAssignmentText({ kind: 'investigation', segmentUid: '', label: 'Interview RP' }), 'Investigation: Interview RP');
    assert.equal(workAssignmentText({ kind: 'other', segmentUid: '', label: 'Records check' }), 'Records check');
    assert.equal(workAssignmentText({ kind: 'containment', segmentUid: 'f', label: 'TH kiosk', notes: 'Log all' }), 'Containment: TH kiosk Log all');
});

test('addTaskAssignment stores work with no segment, by id', async () => {
    const store = memoryStore();
    const a = await addTaskAssignment({ assignments: store, now: () => new Date(0) }, op, {
        kind: 'investigation', label: ' Interview RP ', team: 'DET 1',
    });
    assert.equal(a.segmentUid, '');
    assert.equal(a.kind, 'investigation');
    assert.equal(a.label, 'Interview RP');
    assert.equal(a.team, 'DET 1');
    assert.ok(a.id);
    await assert.rejects(addTaskAssignment({ assignments: store }, op, { kind: 'search', label: 'x' }));
    await assert.rejects(addTaskAssignment({ assignments: store }, op, { kind: 'other', label: '  ' }));
});

test('publishAssignments records a non-search type, and leaves search untyped', async () => {
    const store = memoryStore();
    const deps = {
        geometry: { getFeature: async (uid: string) => ({ uid, callsign: uid.toUpperCase() }) },
        publisher: { publishFeature: async () => 'op-copy' },
        assignments: store,
    } as unknown as Parameters<typeof publishAssignments>[0];
    const [search] = await publishAssignments(deps, op, { segmentUids: ['seg-1'], kind: 'search' });
    const [contain] = await publishAssignments(deps, op, { segmentUids: ['kiosk'], kind: 'containment' });
    assert.equal(search.kind, undefined);
    assert.equal(contain.kind, 'containment');
});

test('no-map assignments get their own property key', () => {
    const schema = {
        incident_response: {
            op_assignments: [
                { id: 'a1', opNumber: 2, segmentUid: '', kind: 'investigation', label: 'Interview RP' },
                { id: 'a2', opNumber: 2, segmentUid: 'seg-1', label: 'A3' },
            ],
        },
    } as unknown as Parameters<typeof encodeSchema>[0];
    const keys = [...encodeSchema(schema).keys()].filter((k) => k.startsWith('c.op-assignments.'));
    assert.equal(keys.length, 2);
    assert.ok(keys.some((k) => k.includes('task')));
});
