/**
 * Per-OP rollup history and What-if scenarios (WinCASIE conventions).
 * Pure — no I/O. Everything derives from (initial consensus, ordered
 * DebriefRecord[]): history is a replay, a known-good fork is a truncated
 * replay, and a What-if is a truncated replay plus hypothetical records.
 *
 * Sequential math (per operational period k):
 *   podEff(k,i)  = 100·(1 − Π miss) over OP-k records for segment i
 *   OPOS(k)      = Σᵢ POA(k−1,i) · podEff(k,i)/100          (period POS)
 *   POA(k,i)     = renormalized POA(k−1,i)·(1 − podEff(k,i)/100), with ROW
 *   cumPOS(k)    = 100·(1 − Π_{j≤k} (1 − OPOS(j)/100))
 * The renormalized sequential replay composes exactly to the single-shot
 * `computeRollup` (verified by unit test), so no intermediate POA snapshot is
 * ever authoritative data.
 */

import type { DebriefRecord, SegmentState } from './entities.ts';
import { cumulativePod } from './rollup.ts';

export interface OpHistoryStep {
    /** 0 = initial consensus (no searching). */
    opNumber: number;
    /** POA percent per segment uid AFTER this OP (normalized incl. ROW). */
    poa: Record<string, number>;
    rowPoa: number;
    /** Effective POD percent applied to each segment during this OP. */
    podEff: Record<string, number>;
    /** This period's probability of success (percent). 0 for step 0. */
    opos: number;
    /** Cumulative POS percent through this OP. */
    cumulativePos: number;
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
): OpHistory {
    const uids = segments.map((s) => s.uid);
    const known = new Set(uids);

    let poa: Record<string, number> = {};
    for (const s of segments) poa[s.uid] = clampPct(s.poa);
    let row = clampPct(rowPoa);

    const step0: OpHistoryStep = {
        opNumber: 0,
        poa: { ...poa },
        rowPoa: row,
        podEff: {},
        opos: 0,
        cumulativePos: 0,
    };
    const steps: OpHistoryStep[] = [step0];

    let missProduct = 1; // Π (1 − OPOS/100)
    for (const opNumber of opNumbersIn(records)) {
        const opRecords = records.filter((r) => r.opNumber === opNumber && known.has(r.segmentUid));

        const podEff: Record<string, number> = {};
        for (const uid of uids) {
            const segRecords = opRecords.filter((r) => r.segmentUid === uid);
            if (segRecords.length) podEff[uid] = cumulativePod(segRecords);
        }

        // Period POS on the entering POA
        const opos = uids.reduce(
            (acc, uid) => acc + (poa[uid] ?? 0) * ((podEff[uid] ?? 0) / 100),
            0,
        );

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

        missProduct *= 1 - opos / 100;

        poa = next;
        row = nextRow;
        steps.push({
            opNumber,
            poa: { ...poa },
            rowPoa: row,
            podEff: Object.fromEntries(Object.entries(podEff).map(([k, v]) => [k, round2(v)])),
            opos: round2(opos),
            cumulativePos: round2(100 * (1 - missProduct)),
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
): OpHistory {
    const base = records.filter((r) => r.opNumber <= scenario.throughOp);
    return computeOpHistory(segments, rowPoa, [...base, ...scenario.hypotheticals]);
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
