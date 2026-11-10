/**
 * Per-OP rollup history and What-if scenarios (WinCASIE conventions).
 * Pure — no I/O. Everything derives from (initial consensus, ordered
 * DebriefRecord[]): history is a replay, a known-good fork is a truncated
 * replay, and a What-if is a truncated replay plus hypothetical records.
 *
 * Sequential math (per operational period k):
 *   podEff(k,i)  = 100·(1 − Π miss) over OP-k records for segment i
 *   POA(k,i)     = renormalized POA(k−1,i)·(1 − podEff(k,i)/100), with ROW
 *   CPOD(k,i)    = 100·(1 − Π miss) over ALL records for segment i through OP k
 * These match Find'Em ch. 8.5–8.6 / Win CASIE III (POA "shift" and CPOD).
 * The renormalized sequential replay composes exactly to the single-shot
 * `computeRollup` (verified by unit test), so no intermediate POA snapshot is
 * ever authoritative data.
 */

import type { ClueRecord, DebriefRecord, SegmentState } from './entities.ts';
import { cumulativePod } from './rollup.ts';

/**
 * Clue-significance letter weights, as Win CASIE III uses them: each letter
 * is worth √2 times the next (A=16, C=8, E=4, G=2, I=1). Only ratios matter.
 * Fitted exactly to WC3 runs on issue #9.
 */
const CLUE_LETTERS = 'ABCDEFGHI';
function letterWeight(letter: string | undefined): number {
    const i = CLUE_LETTERS.indexOf((letter ?? 'E').toUpperCase());
    return 2 ** ((8 - (i < 0 ? 4 : i)) / 2);
}

/**
 * The power authenticity puts on a clue's letter weights (WC3): almost surely
 * authentic 1, probably 0.75, chances even 0.5, probably not 0.25, almost
 * surely not 0 (no effect). Clues saved before this used 0.95 and 0.05 for
 * the two "almost surely" choices; those read as 1 and 0.
 */
export function clueExponent(authenticity: number): number {
    if (Math.abs(authenticity - 0.95) < 1e-9) return 1;
    if (Math.abs(authenticity - 0.05) < 1e-9) return 0;
    return Math.min(1, Math.max(0, authenticity));
}

/**
 * Apply one clue to a POA state (percentages summing to ~100 incl. ROW),
 * Win CASIE III eq. D.23: POA ∝ prior × IOC, renormalized with the R.O.W.,
 * where IOC = letterWeight ^ authenticity. Missing letters default to E.
 * Matches WC3 to the hundredth of a percent (issue #9).
 */
export function applyClue(
    poa: Record<string, number>,
    rowPoa: number,
    clue: ClueRecord,
): { poa: Record<string, number>; rowPoa: number } {
    const power = clueExponent(clue.authenticity);
    const weightOf = (key: string): number => letterWeight(clue.letters[key]) ** power;

    let total = rowPoa * weightOf('ROW');
    const weighted: Record<string, number> = {};
    for (const [uid, value] of Object.entries(poa)) {
        weighted[uid] = value * weightOf(uid);
        total += weighted[uid];
    }
    if (total <= 0) return { poa: { ...poa }, rowPoa };

    const out: Record<string, number> = {};
    for (const uid of Object.keys(poa)) {
        out[uid] = Math.round((10000 * weighted[uid]) / total) / 100;
    }
    return {
        poa: out,
        rowPoa: Math.round((10000 * rowPoa * weightOf('ROW')) / total) / 100,
    };
}

export interface OpHistoryStep {
    /** 0 = initial consensus (no searching). */
    opNumber: number;
    /** POA percent per segment uid AFTER this OP (normalized incl. ROW). */
    poa: Record<string, number>;
    rowPoa: number;
    /** Effective POD percent applied to each segment during this OP. */
    podEff: Record<string, number>;
    /**
     * Cumulative POD percent per segment uid through this OP (Find'Em 8.5 /
     * Win CASIE III Incident Status): 100·(1 − Π(1 − PODᵢ)) over every
     * search of the segment so far, across all OPs. 0 = never searched.
     */
    cpod: Record<string, number>;
}

export interface OpHistory {
    steps: OpHistoryStep[];
    /** Final step (current state) for convenience. */
    final: OpHistoryStep;
}

/** A named What-if fork: replay through an OP, then apply hypotheticals. */
export interface Scenario {
    name: string;
    /** Replay real records with opNumber <= throughOp (0 = consensus only). */
    throughOp: number;
    /** Hypothetical debriefs applied after the fork point. */
    hypotheticals: DebriefRecord[];
    createdAt?: string;
    notes?: string;
}

function clampPct(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Distinct OP numbers present in the records, ascending. */
export function opNumbersIn(records: DebriefRecord[]): number[] {
    return [...new Set(records.map((r) => r.opNumber))]
        .filter((n) => Number.isInteger(n) && n > 0)
        .sort((a, b) => a - b);
}

/**
 * Replay the incident OP by OP. `segments` carry the INITIAL consensus POA;
 * records for unknown segment uids are ignored.
 */
export function computeOpHistory(
    segments: SegmentState[],
    rowPoa: number,
    records: DebriefRecord[],
    clues: ClueRecord[] = [],
): OpHistory {
    const uids = segments.map((s) => s.uid);
    const known = new Set(uids);

    let poa: Record<string, number> = {};
    for (const s of segments) poa[s.uid] = clampPct(s.poa);
    let row = clampPct(rowPoa);

    // Clues found right after the Initial Consensus (opNumber 0) apply to step 0.
    const cluesFor = (op: number) => clues
        .filter((c) => c.opNumber === op)
        .sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));
    for (const clue of cluesFor(0)) {
        const applied = applyClue(poa, row, clue);
        poa = applied.poa;
        row = applied.rowPoa;
    }

    const step0: OpHistoryStep = {
        opNumber: 0,
        poa: { ...poa },
        rowPoa: row,
        podEff: {},
        cpod: Object.fromEntries(uids.map((uid) => [uid, 0])),
    };
    const steps: OpHistoryStep[] = [step0];

    // OPs come from debriefs AND clue records (a clue may be the only event).
    const opNumbers = [...new Set([
        ...opNumbersIn(records),
        ...clues.map((c) => c.opNumber).filter((n) => Number.isInteger(n) && n > 0),
    ])].sort((a, b) => a - b);

    // Per-segment running miss probability, Π (1 − POD/100) across all OPs.
    const segMiss: Record<string, number> = Object.fromEntries(uids.map((uid) => [uid, 1]));
    for (const opNumber of opNumbers) {
        const opRecords = records.filter((r) => r.opNumber === opNumber && known.has(r.segmentUid));

        const podEff: Record<string, number> = {};
        for (const uid of uids) {
            const segRecords = opRecords.filter((r) => r.segmentUid === uid);
            if (segRecords.length) {
                podEff[uid] = cumulativePod(segRecords);
                segMiss[uid] *= 1 - podEff[uid] / 100;
            }
        }

        // Shift + renormalize (ROW is never searched)
        const weights: Record<string, number> = {};
        let total = row;
        for (const uid of uids) {
            const w = (poa[uid] ?? 0) * (1 - (podEff[uid] ?? 0) / 100);
            weights[uid] = w;
            total += w;
        }
        const next: Record<string, number> = {};
        for (const uid of uids) {
            next[uid] = total > 0 ? round2((100 * weights[uid]) / total) : 0;
        }
        const nextRow = total > 0 ? round2((100 * row) / total) : 0;

        poa = next;
        row = nextRow;

        // Clues found during this OP apply after its POD shift.
        for (const clue of cluesFor(opNumber)) {
            const applied = applyClue(poa, row, clue);
            poa = applied.poa;
            row = applied.rowPoa;
        }

        steps.push({
            opNumber,
            poa: { ...poa },
            rowPoa: row,
            podEff: Object.fromEntries(Object.entries(podEff).map(([k, v]) => [k, round2(v)])),
            cpod: Object.fromEntries(uids.map((uid) => [uid, round2(100 * (1 - segMiss[uid]))])),
        });
    }

    return { steps, final: steps[steps.length - 1] };
}

/**
 * What-if: replay real records through `scenario.throughOp`, then apply the
 * scenario's hypothetical records as one further period each (their own
 * opNumbers are respected, so multi-period hypotheticals work).
 */
export function computeScenario(
    segments: SegmentState[],
    rowPoa: number,
    records: DebriefRecord[],
    scenario: Scenario,
    clues: ClueRecord[] = [],
): OpHistory {
    const base = records.filter((r) => r.opNumber <= scenario.throughOp);
    const baseClues = clues.filter((c) => c.opNumber <= scenario.throughOp);
    return computeOpHistory(segments, rowPoa, [...base, ...scenario.hypotheticals], baseClues);
}

/** Parse persisted scenarios (schema value) tolerantly. */
export function scenariosFromValue(value: unknown): Scenario[] {
    if (!Array.isArray(value)) return [];
    const out: Scenario[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const rec = raw as Record<string, unknown>;
        const name = typeof rec.name === 'string' ? rec.name.trim() : '';
        const throughOp = Number(rec.throughOp);
        if (!name || !Number.isInteger(throughOp) || throughOp < 0) continue;
        const hypotheticals: DebriefRecord[] = [];
        if (Array.isArray(rec.hypotheticals)) {
            for (const h of rec.hypotheticals) {
                if (!h || typeof h !== 'object') continue;
                const hr = h as Record<string, unknown>;
                const segmentUid = typeof hr.segmentUid === 'string' ? hr.segmentUid.trim() : '';
                const pod = Number(hr.pod);
                const opNumber = Number(hr.opNumber);
                if (!segmentUid || !Number.isFinite(pod) || !Number.isInteger(opNumber)) continue;
                const record: DebriefRecord = { opNumber, segmentUid, pod };
                if (typeof hr.coverage === 'number' && Number.isFinite(hr.coverage)) record.coverage = hr.coverage;
                if (typeof hr.resource === 'string' && hr.resource.trim()) record.resource = hr.resource.trim();
                hypotheticals.push(record);
            }
        }
        const scenario: Scenario = { name, throughOp, hypotheticals };
        if (typeof rec.createdAt === 'string' && rec.createdAt.trim()) scenario.createdAt = rec.createdAt;
        if (typeof rec.notes === 'string' && rec.notes.trim()) scenario.notes = rec.notes.trim();
        out.push(scenario);
    }
    return out;
}
