import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClueRecord, DebriefRecord } from './entities.ts';
import { buildPoaLock, poaLockFromValue, poaLockStaleness, type PoaLockInputs } from './poaLock.ts';

const NOW = () => new Date('2026-10-11T22:00:00Z');

function inputs(extra: Partial<PoaLockInputs> = {}): PoaLockInputs {
    const records: DebriefRecord[] = [
        { opNumber: 1, segmentUid: 'A', pod: 50, resource: 'GT1', recordedAt: '2026-10-11T16:28:29.951Z' },
    ];
    return {
        segments: [{ uid: 'A', poa: 40 }, { uid: 'B', poa: 40 }],
        rowPoa: 20,
        records,
        clues: [],
        segmentLabels: { A: '01', B: '02' },
        ...extra,
    };
}

test('buildPoaLock: POA entering OP2 is the shift after OP1 debriefs', () => {
    const lock = buildPoaLock(inputs(), 2, { now: NOW });
    // weights A 40*(1-0.5)=20, B 40, ROW 20 -> total 80
    assert.equal(lock.poa.A, 25);
    assert.equal(lock.poa.B, 50);
    assert.equal(lock.rowPoa, 25);
    assert.equal(lock.throughOp, 1);
    assert.equal(lock.lockedAt, '2026-10-11T22:00:00.000Z');
    assert.deepEqual(lock.labels, { A: '01', B: '02' });
    assert.equal(Object.keys(lock.basis.debriefs).length, 1);
});

test('buildPoaLock: debriefs from the locked OP itself or later are not used', () => {
    const later: DebriefRecord = { opNumber: 2, segmentUid: 'B', pod: 90, resource: 'GT5', recordedAt: '2026-10-11T23:00:00Z' };
    const lock = buildPoaLock(inputs({ records: [...inputs().records, later] }), 2, { now: NOW });
    assert.equal(lock.poa.B, 50);
    assert.equal(Object.keys(lock.basis.debriefs).length, 1);
});

test('staleness: current until an input it used changes', () => {
    const base = inputs();
    const lock = buildPoaLock(base, 2, { now: NOW });
    assert.deepEqual(poaLockStaleness(lock, base), { stale: false, reasons: [] });

    // A track attached or a correction with the same values: still current.
    const tracked = { ...base.records[0], tracks: [{ uid: 't', name: 'T', source: 'map', points: 1, lengthMi: 1 }], correctedAt: 'x' };
    assert.equal(poaLockStaleness(lock, { ...base, records: [tracked] }).stale, false);

    // A corrected POD: stale.
    const corrected = { ...base.records[0], pod: 30, correctedAt: '2026-10-11T22:05:00Z' };
    assert.deepEqual(poaLockStaleness(lock, { ...base, records: [corrected] }).reasons, ['1 debrief changed']);

    // A late OP1 debrief and a deletion.
    const late: DebriefRecord = { opNumber: 1, segmentUid: 'B', pod: 20, resource: 'GT2', recordedAt: '2026-10-11T22:10:00Z' };
    assert.deepEqual(poaLockStaleness(lock, { ...base, records: [late] }).reasons, ['1 debrief added', '1 debrief deleted']);

    // Debriefs for the locked OP itself do not matter.
    const sameOp: DebriefRecord = { opNumber: 2, segmentUid: 'B', pod: 20, resource: 'GT2', recordedAt: '2026-10-11T22:10:00Z' };
    assert.equal(poaLockStaleness(lock, { ...base, records: [...base.records, sameOp] }).stale, false);
});

test('staleness: consensus and clue changes are reported', () => {
    const clue: ClueRecord = { opNumber: 1, description: 'boot print', authenticity: 0.8, letters: { A: 'B' }, recordedAt: '2026-10-11T20:00:00Z' };
    const base = inputs({ clues: [clue] });
    const lock = buildPoaLock(base, 2, { now: NOW });
    const changed = poaLockStaleness(lock, {
        ...base,
        segments: [{ uid: 'A', poa: 50 }, { uid: 'B', poa: 30 }],
        clues: [{ ...clue, authenticity: 0.5 }],
    });
    assert.deepEqual(changed.reasons, ['the Initial Consensus or segments changed', '1 clue changed']);
});

test('buildPoaLock: refuses OP 0 and incidents without segments', () => {
    assert.throws(() => buildPoaLock(inputs(), 0), /1 or more/);
    assert.throws(() => buildPoaLock(inputs({ segments: [] }), 2), /Initial Consensus/);
});

test('poaLockFromValue: round-trips through JSON and rejects junk', () => {
    const lock = buildPoaLock(inputs(), 2, { now: NOW, lockedBy: 'paul' });
    assert.deepEqual(poaLockFromValue(JSON.parse(JSON.stringify(lock))), lock);
    assert.equal(poaLockFromValue({ opNumber: 'x' }), null);
    assert.equal(poaLockFromValue(null), null);
});
