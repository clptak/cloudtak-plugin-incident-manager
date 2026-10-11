import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    archivableSources,
    buildManifest,
    defaultDemobOptions,
    retainedSources,
    type DemobSourceRef,
} from './demob.ts';

const SOURCES: DemobSourceRef[] = [
    { kind: 'op', label: 'OP2', guid: 'g-op2', opNumber: 2 },
    { kind: 'mgmt', label: 'MGMT', guid: 'g-mgmt' },
    { kind: 'op', label: 'OP1', guid: 'g-op1', opNumber: 1 },
    { kind: 'common', label: 'BAKER', guid: 'g-common' },
];

test('archivableSources: everything archived, ordered common → mgmt → OPs', () => {
    const ordered = archivableSources(SOURCES);
    assert.deepEqual(ordered.map((s) => s.label), ['BAKER', 'MGMT', 'OP1', 'OP2']);
    assert.equal(ordered.length, SOURCES.length);
});

test('retainedSources: only the common map, only under limited continuous search', () => {
    assert.deepEqual(retainedSources(SOURCES, 'closed'), []);
    const retained = retainedSources(SOURCES, 'limited-continuous');
    assert.deepEqual(retained.map((s) => s.label), ['BAKER']);
});

test('defaultDemobOptions: full package, closed variant', () => {
    const opts = defaultDemobOptions();
    assert.equal(opts.variant, 'closed');
    assert.ok(opts.includeArchives && opts.includeIaps && opts.includeCasieExport && opts.includeReport);
});

test('buildManifest: states the closeout and flags live syncs', () => {
    const closed = buildManifest({
        incidentName: 'BAKER', incidentNumber: '26-123',
        generatedAt: '2026-08-16T18:00:00Z', variant: 'closed',
        entries: [{ path: 'archives/OP1.zip', description: 'OP1 mission archive' }],
        retained: [],
    });
    assert.ok(closed.includes('Report #: 26-123'));
    assert.ok(closed.includes('all DataSyncs archived'));
    assert.ok(closed.includes('archives/OP1.zip'));
    assert.ok(!closed.includes('LEFT ACTIVE'));

    const lcs = buildManifest({
        incidentName: 'BAKER', incidentNumber: '',
        generatedAt: '2026-08-16T18:00:00Z', variant: 'limited-continuous',
        entries: [],
        retained: [{ kind: 'common', label: 'BAKER', guid: 'g-common' }],
    });
    assert.ok(lcs.includes('LIMITED CONTINUOUS SEARCH'));
    assert.ok(lcs.includes('LEFT ACTIVE'));
    assert.ok(lcs.includes('g-common'));
    assert.ok(!lcs.includes('Report #:'));
});
