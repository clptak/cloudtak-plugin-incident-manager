/**
 * POA lock (ADR-003): planning fixes the POA an upcoming OP is planned on.
 *
 * A lock for OP n holds the POA entering OP n - the replay of the Initial
 * Consensus, debriefs and clues through OP n-1 - plus a fingerprint of every
 * input it used. Debriefs and clues may still be corrected, added or deleted
 * afterwards; the lock never changes, it becomes *stale* and says why, and
 * planning decides whether to re-lock.
 *
 * Pure: no I/O, no framework imports.
 */

import type { ClueRecord, DebriefRecord, SegmentState } from './entities.ts';
import { computeOpHistory } from './history.ts';
import { debriefKey } from './trackLog.ts';

export interface PoaLock {
    /** The OP this POA is for. */
    opNumber: number;
    /** Inputs used: everything recorded for OPs up to and including this one. */
    throughOp: number;
    lockedAt: string;
    lockedBy?: string;
    /** POA percent per segment uid, normalized with ROW. */
    poa: Record<string, number>;
    rowPoa: number;
    cumulativePos: number;
    /** Segment names at lock time, so the lock still reads if segments are renamed. */
    labels: Record<string, string>;
    basis: {
        consensus: string;
        debriefs: Record<string, string>;
        clues: Record<string, string>;
    };
}

export interface PoaLockInputs {
    /** Initial-consensus POA per segment. */
    segments: SegmentState[];
    rowPoa: number;
    records: DebriefRecord[];
    clues: ClueRecord[];
    segmentLabels: Record<string, string>;
}

/** JSON with sorted object keys, so equal data always gives equal text. */
function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

/** 32-bit FNV-1a, 8 hex chars. */
function hash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * What about a debrief moves the POA. Attaching a track, renaming the label
 * or a correction that keeps the same values does not make a lock stale.
 */
function debriefFingerprint(r: DebriefRecord): string {
    return hash(stableJson({ op: r.opNumber, seg: r.segmentUid, pod: r.pod, coverage: r.coverage }));
}

function clueKey(c: ClueRecord): string {
    return `${c.opNumber}|${c.recordedAt ?? ''}|${c.description}`;
}

function clueFingerprint(c: ClueRecord): string {
    return hash(stableJson({ op: c.opNumber, a: c.authenticity, letters: c.letters }));
}

function consensusFingerprint(segments: SegmentState[], rowPoa: number): string {
    const poa = Object.fromEntries(segments.map((s) => [s.uid, s.poa]));
    return hash(stableJson({ poa, row: rowPoa }));
}

function basisFor(inputs: PoaLockInputs, throughOp: number): PoaLock['basis'] {
    const debriefs: Record<string, string> = {};
    for (const r of inputs.records) {
        if (r.opNumber <= throughOp) debriefs[debriefKey(r)] = debriefFingerprint(r);
    }
    const clues: Record<string, string> = {};
    for (const c of inputs.clues) {
        if (c.opNumber <= throughOp) clues[clueKey(c)] = clueFingerprint(c);
    }
    return { consensus: consensusFingerprint(inputs.segments, inputs.rowPoa), debriefs, clues };
}

/** The POA entering `opNumber`, from everything recorded for earlier OPs. */
export function buildPoaLock(
    inputs: PoaLockInputs,
    opNumber: number,
    opts: { now?: () => Date; lockedBy?: string } = {},
): PoaLock {
    if (!Number.isInteger(opNumber) || opNumber < 1) throw new Error('POA lock: OP number must be 1 or more');
    if (!inputs.segments.length) throw new Error('POA lock: no segments - complete the Initial Consensus first');
    const throughOp = opNumber - 1;
    const history = computeOpHistory(
        inputs.segments,
        inputs.rowPoa,
        inputs.records.filter((r) => r.opNumber <= throughOp),
        inputs.clues.filter((c) => c.opNumber <= throughOp),
    );
    const labels: Record<string, string> = {};
    for (const s of inputs.segments) labels[s.uid] = inputs.segmentLabels[s.uid] ?? s.label ?? s.uid;

    const lock: PoaLock = {
        opNumber,
        throughOp,
        lockedAt: (opts.now?.() ?? new Date()).toISOString(),
        poa: { ...history.final.poa },
        rowPoa: history.final.rowPoa,
        cumulativePos: history.final.cumulativePos,
        labels,
        basis: basisFor(inputs, throughOp),
    };
    if (opts.lockedBy) lock.lockedBy = opts.lockedBy;
    return lock;
}

export interface PoaLockStaleness {
    stale: boolean;
    /** Plain-language reasons, empty when current. */
    reasons: string[];
}

function compare(locked: Record<string, string>, now: Record<string, string>) {
    let added = 0;
    let changed = 0;
    let removed = 0;
    for (const [key, fp] of Object.entries(now)) {
        if (!(key in locked)) added++;
        else if (locked[key] !== fp) changed++;
    }
    for (const key of Object.keys(locked)) if (!(key in now)) removed++;
    return { added, changed, removed };
}

function describe(noun: string, d: { added: number; changed: number; removed: number }): string[] {
    const plural = (n: number) => (n === 1 ? noun : `${noun}s`);
    const out: string[] = [];
    if (d.changed) out.push(`${d.changed} ${plural(d.changed)} changed`);
    if (d.added) out.push(`${d.added} ${plural(d.added)} added`);
    if (d.removed) out.push(`${d.removed} ${plural(d.removed)} deleted`);
    return out;
}

/** Whether the inputs a lock used have changed since it was taken. */
export function poaLockStaleness(lock: PoaLock, inputs: PoaLockInputs): PoaLockStaleness {
    const now = basisFor(inputs, lock.throughOp);
    const reasons: string[] = [];
    if (now.consensus !== lock.basis.consensus) reasons.push('the Initial Consensus or segments changed');
    reasons.push(...describe('debrief', compare(lock.basis.debriefs, now.debriefs)));
    reasons.push(...describe('clue', compare(lock.basis.clues, now.clues)));
    return { stale: reasons.length > 0, reasons };
}

/** Parse a stored lock; null when the shape is unusable. */
export function poaLockFromValue(value: unknown): PoaLock | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const opNumber = Number(v.opNumber);
    const throughOp = Number(v.throughOp);
    if (!Number.isInteger(opNumber) || !Number.isInteger(throughOp)) return null;
    if (typeof v.lockedAt !== 'string' || !v.poa || typeof v.poa !== 'object') return null;
    const basis = (v.basis && typeof v.basis === 'object' ? v.basis : {}) as Record<string, unknown>;
    const record = (x: unknown) => (x && typeof x === 'object' ? x as Record<string, string> : {});
    const lock: PoaLock = {
        opNumber,
        throughOp,
        lockedAt: v.lockedAt,
        poa: v.poa as Record<string, number>,
        rowPoa: Number(v.rowPoa) || 0,
        cumulativePos: Number(v.cumulativePos) || 0,
        labels: record(v.labels),
        basis: {
            consensus: typeof basis.consensus === 'string' ? basis.consensus : '',
            debriefs: record(basis.debriefs),
            clues: record(basis.clues),
        },
    };
    if (typeof v.lockedBy === 'string' && v.lockedBy) lock.lockedBy = v.lockedBy;
    return lock;
}
