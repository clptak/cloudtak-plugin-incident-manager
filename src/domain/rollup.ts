/**
 * Pure search-theory rollup math (FindEm / ISM / CASIE conventions).
 * No I/O, no framework imports — fully unit-testable (`npm test`).
 *
 * Formulas:
 * - Cumulative POD over k searches of one segment:
 *     PODcum = 100 · (1 − Π(1 − podᵢ/100 · coverageᵢ))
 * - Shifted (posterior) POA, Bayesian update, renormalized over segments + ROW:
 *     wᵢ = POAᵢ · (1 − PODcumᵢ/100);  wROW = POAROW
 *     POAᵢ' = 100 · wᵢ / Σw
 * - POS per segment: POAᵢ · PODcumᵢ / 100; cumulative POS = Σ.
 */

import type {
    DebriefRecord,
    RollupResult,
    SegmentRollup,
    SegmentState,
} from './entities.ts';

function clampPct(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

function clampFraction(value: number | undefined, fallback = 1): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(1, Math.max(0, value));
}

/** Effective single-search miss probability (0–1) given POD% and coverage 0–1. */
function missProbability(record: DebriefRecord): number {
    const pod = clampPct(record.pod) / 100;
    const coverage = clampFraction(record.coverage);
    return 1 - pod * coverage;
}

/** Cumulative POD percent for a set of debriefs of the SAME segment. */
export function cumulativePod(records: DebriefRecord[]): number {
    if (!records.length) return 0;
    const miss = records.reduce((acc, r) => acc * missProbability(r), 1);
    return clampPct(100 * (1 - miss));
}

/** Group debrief records by segment uid. */
export function debriefsBySegment(records: DebriefRecord[]): Map<string, DebriefRecord[]> {
    const map = new Map<string, DebriefRecord[]>();
    for (const record of records) {
        const list = map.get(record.segmentUid);
        if (list) list.push(record);
        else map.set(record.segmentUid, [record]);
    }
    return map;
}

/**
 * Compute the full rollup: cumulative POD per segment, shifted POA
 * (renormalized with ROW), and POS.
 *
 * `segments` carries the current-consensus POA per segment; `rowPoa` is the
 * R.O.W. percentage from the same consensus. Debriefs referencing unknown
 * segment uids are ignored (they belong to deleted/renamed segments —
 * callers should surface that separately).
 */
export function computeRollup(
    segments: SegmentState[],
    rowPoa: number,
    records: DebriefRecord[],
    now: () => Date = () => new Date(),
): RollupResult {
    const bySegment = debriefsBySegment(records);

    const partial = segments.map((segment) => {
        const segRecords = bySegment.get(segment.uid) ?? [];
        const cumPod = cumulativePod(segRecords);
        const initialPoa = clampPct(segment.poa);
        return {
            uid: segment.uid,
            searches: segRecords.length,
            cumulativePod: cumPod,
            initialPoa,
            weight: initialPoa * (1 - cumPod / 100),
            pos: initialPoa * (cumPod / 100),
        };
    });

    const rowInitial = clampPct(rowPoa);
    const totalWeight = partial.reduce((acc, s) => acc + s.weight, 0) + rowInitial;

    const normalize = (weight: number): number =>
        totalWeight > 0 ? (100 * weight) / totalWeight : 0;

    const segmentRollups: SegmentRollup[] = partial.map((s) => ({
        uid: s.uid,
        searches: s.searches,
        cumulativePod: round2(s.cumulativePod),
        initialPoa: round2(s.initialPoa),
        adjustedPoa: round2(normalize(s.weight)),
        pos: round2(s.pos),
    }));

    return {
        segments: segmentRollups,
        row: {
            initialPoa: round2(rowInitial),
            adjustedPoa: round2(normalize(rowInitial)),
        },
        cumulativePos: round2(partial.reduce((acc, s) => acc + s.pos, 0)),
        computedAt: now().toISOString(),
    };
}

/**
 * Split a segment per ISM: children partition the parent; each child inherits
 * `fraction` of the parent's POA. Fractions must sum to ~1. Returns the new
 * segment list (parent removed, children appended with parentUid lineage).
 */
export function splitSegment(
    segments: SegmentState[],
    parentUid: string,
    children: { uid: string; label?: string; fraction: number }[],
): SegmentState[] {
    const parent = segments.find((s) => s.uid === parentUid);
    if (!parent) throw new Error(`splitSegment: unknown parent segment ${parentUid}`);
    if (children.length < 2) throw new Error('splitSegment: need at least 2 children');

    const fractions = children.map((c) => c.fraction);
    if (fractions.some((f) => !Number.isFinite(f) || f <= 0)) {
        throw new Error('splitSegment: child fractions must be > 0');
    }
    const total = fractions.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.001) {
        throw new Error(`splitSegment: child fractions must sum to 1 (got ${total.toFixed(3)})`);
    }
    const uids = new Set(segments.map((s) => s.uid));
    for (const child of children) {
        if (uids.has(child.uid)) {
            throw new Error(`splitSegment: child uid ${child.uid} already exists`);
        }
    }

    return [
        ...segments.filter((s) => s.uid !== parentUid),
        ...children.map((child) => ({
            uid: child.uid,
            label: child.label,
            parentUid,
            poa: round2(parent.poa * child.fraction),
        })),
    ];
}

/**
 * Rewrite debrief history for a segment split: each record of the parent
 * becomes one record per child with the SAME pod/coverage/op. A uniform
 * search of the parent applies equally to every child, so the replayed POA
 * mass is preserved exactly (children start at fraction·parentPOA and shift
 * by the same factor). Records for other segments pass through untouched.
 */
export function splitDebriefRecords(
    records: DebriefRecord[],
    parentUid: string,
    childUids: string[],
): DebriefRecord[] {
    if (childUids.length < 2) throw new Error('splitDebriefRecords: need at least 2 children');
    const out: DebriefRecord[] = [];
    for (const record of records) {
        if (record.segmentUid !== parentUid) {
            out.push(record);
            continue;
        }
        for (const childUid of childUids) {
            out.push({ ...record, segmentUid: childUid });
        }
    }
    return out;
}

/** Area-proportional fractions (normalized) for split children. */
export function fractionsFromAreas(areas: number[]): number[] {
    if (areas.some((a) => !Number.isFinite(a) || a <= 0)) {
        throw new Error('fractionsFromAreas: every child needs a positive area');
    }
    const total = areas.reduce((a, b) => a + b, 0);
    return areas.map((a) => a / total);
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
