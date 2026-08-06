/**
 * Domain entities for multi-operational-period search management.
 *
 * Clean Architecture inner layer: NO imports from src/lib, CloudTAK, or Vue.
 * Conventions match src/lib/consensus.ts and FindEm/ISM search theory:
 * POA and POD are percentages (0–100); R.O.W. (Rest of World) is the
 * probability mass outside all segments and is never searched.
 *
 * NOTE: keep this file erasable-TypeScript only (no enums/namespaces) so the
 * unit tests run under Node's native type stripping (`npm test`).
 */

export type OpStatus = 'open' | 'debriefing' | 'closed';

/**
 * One entry of the incident registry persisted in the management sync's
 * mission_schema.json `tak_missions[]` (see docs/multi-op-datasync-architecture.md §3).
 */
export interface OpPeriodRegistryEntry {
    /** 1-based operational period number (0 = initial response / common map). */
    opNumber: number;
    name: string;
    guid: string;
    status: OpStatus;
    /** Channels the OP sync was created with. */
    channels: string[];
    /**
     * Owner subscription token from mission create — required for privileged
     * ops (role changes, group changes, delete) on role-enabled missions
     * (Phase 0 finding). Lives Sworn-side only.
     */
    ownerToken?: string;
    /** ISO timestamps. */
    openedAt?: string;
    closedAt?: string;
}

/** A search segment (or split child) known to the incident. */
export interface SegmentState {
    /** CoT/DataSync uid of the segment polygon. */
    uid: string;
    label?: string;
    /** Present on children created by SplitSegment; references the parent uid. */
    parentUid?: string;
    /** Current-consensus POA percent (0–100) for this segment. */
    poa: number;
}

/** POD reported at debrief for (a completed portion of) a segment in one OP. */
export interface DebriefRecord {
    opNumber: number;
    segmentUid: string;
    /** Probability of detection percent (0–100) for the searched portion. */
    pod: number;
    /**
     * Fraction of the segment actually completed, 0–1. Defaults to 1.
     * Incomplete segments should normally be split per ISM instead of
     * relying on coverage scaling.
     */
    coverage?: number;
    resource?: string;
    notes?: string;
    /** ISO timestamp. */
    recordedAt?: string;
}

/** Per-segment rollup across all closed/debriefed OPs. */
export interface SegmentRollup {
    uid: string;
    /** Number of debrief records contributing. */
    searches: number;
    /** Cumulative POD percent across searches: 100·(1 − Π(1 − podᵢ)). */
    cumulativePod: number;
    /** Prior (current consensus) POA percent. */
    initialPoa: number;
    /** Posterior POA percent after shifting + renormalization. */
    adjustedPoa: number;
    /** Probability of success percent: initialPoa · cumulativePod / 100. */
    pos: number;
}

export interface RollupResult {
    segments: SegmentRollup[];
    row: {
        initialPoa: number;
        adjustedPoa: number;
    };
    /** Overall cumulative POS percent: Σ segment POS. */
    cumulativePos: number;
    /** ISO timestamp of computation. */
    computedAt: string;
}
