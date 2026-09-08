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
 * mission_schema.json `tak_missions[]` (see docs-archive/multi-op-datasync-architecture.md §3).
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

/**
 * A GPS track log filed under an OP sync's "Track Logs" folder and bound to the
 * completed search assignment it evidences.
 *
 * Reference + summary only (Paul, 2026-08-30): the polyline itself stays a CoT
 * in the OP DataSync — a real shift track is thousands of fixes and would bloat
 * the mission schema — but the numbers a reader needs (how far, how long, how
 * many fixes) are carried here so the schema, and anything reading it
 * standalone, can report coverage without resolving the mission archive.
 */
export interface TrackLogRef {
    /** CoT uid of the LineString in the OP sync's Track Logs folder. */
    uid: string;
    /** Callsign shown on the map. */
    name: string;
    /** Source filename, or 'map' when picked from an existing line. */
    source: string;
    /** Vertices in the published line (after thinning). */
    points: number;
    /** Vertices in the original file, when thinning reduced it. */
    sourcePoints?: number;
    /** Track length in statute miles. */
    lengthMi: number;
    /** ISO timestamps of the first and last fix, when the source had them. */
    startedAt?: string;
    endedAt?: string;
    /** ISO timestamp of attachment. */
    attachedAt?: string;
}

/**
 * A completed assignment in one OP: what was worked, by whom, and — on a
 * search — how thoroughly.
 *
 * Used by every incident type. On non-search incidents (rescue, wildland fire,
 * disaster) there is no probability of detection to report, so `pod` is absent
 * and the CASIE rollup is not reachable in the UI at all. It is left ABSENT
 * rather than stored as 0, so a standalone reader of the schema can tell "not
 * applicable" from "searched and found nothing".
 */
export interface DebriefRecord {
    opNumber: number;
    /**
     * The uid of what was worked. On a search this is a registered segment
     * polygon; on other incident types it is any CoT on the incident map
     * (Paul, 2026-08-30) — a structure marker, a division polygon, a road line.
     */
    segmentUid: string;
    /**
     * Callsign captured when the record was written. Non-search targets have
     * no registry behind them, so the CoT can be renamed or deleted later —
     * without this the case file loses what was actually worked.
     */
    label?: string;
    /**
     * Probability of detection percent (0–100) for the searched portion.
     * Search incidents only; absent everywhere else.
     */
    pod?: number;
    /**
     * Fraction of the segment actually completed, 0–1. Defaults to 1.
     * Incomplete segments should normally be split per ISM instead of
     * relying on coverage scaling.
     */
    coverage?: number;
    resource?: string;
    notes?: string;
    /** GPS track logs evidencing this search. */
    tracks?: TrackLogRef[];
    /** ISO timestamp. */
    recordedAt?: string;
}

/**
 * An assignment published to an OP sync: a segment (or portion) tasked to a
 * resource for one operational period. The polygon is re-published INTO the
 * OP sync (new feature uid) so volunteers receive it via their channel.
 */
export interface OpAssignment {
    opNumber: number;
    segmentUid: string;
    /** Feature uid of the polygon copy living in the OP sync. */
    opFeatureUid?: string;
    /** Human label shown to volunteers (defaults to the segment callsign). */
    label: string;
    /** Resource/team tasked (may be assigned at briefing). */
    team?: string;
    notes?: string;
    createdAt?: string;
}

/**
 * Influence of a clue (ISM Table 8.17/8.18, WinCASIE "Add Influence of Clue").
 * Letters A–I per segment AND ROW express what the clue suggests if authentic;
 * authenticity discounts the update: final = α·bayes + (1−α)·prior.
 */
export interface ClueRecord {
    /** OP during which the clue was found; 0 = right after Initial Consensus. */
    opNumber: number;
    description: string;
    /** Authenticity probability α in [0,1]. */
    authenticity: number;
    /** Human label for the authenticity choice (for history display). */
    authenticityLabel?: string;
    /** Letter A–I per segment uid; 'ROW' key covers the Rest of the World. */
    letters: Record<string, string>;
    /** X-reference to paperwork (clue log number etc.). */
    xref?: string;
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
