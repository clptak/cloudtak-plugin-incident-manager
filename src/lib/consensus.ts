/**
 * CASIE Initial Consensus math and validation.
 *
 * Methods:
 * - Mattson: each respondent distributes exactly 100 points across R.O.W. + segments.
 * - O'Connor: R.O.W. is a percentage; each segment gets a letter A–I (A = very
 *   likely … I = very unlikely). Letters map to weights A=9 … I=1 and the
 *   remaining (100 − R.O.W.) percent is split proportionally to the weights.
 * - Proportional: R.O.W. is a percentage; each segment gets a relative
 *   likelihood rating (1–1000, not a percentage) and the remaining
 *   (100 − R.O.W.) percent is split proportionally to the ratings.
 *
 * The consensus column is the arithmetic mean across respondents per row.
 */

export type ConsensusMethod = 'mattson' | 'oconnor' | 'proportional';

export const OCONNOR_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export type OconnorLetter = (typeof OCONNOR_LETTERS)[number];

/** A=9 down to I=1. */
export const OCONNOR_WEIGHTS: Record<OconnorLetter, number> = {
    A: 9, B: 8, C: 7, D: 6, E: 5, F: 4, G: 3, H: 2, I: 1,
};

export const MAX_RESPONDENTS = 10;

export interface ConsensusRespondent {
    /** Display name; defaults to "Responder N". */
    name: string;
    method: ConsensusMethod;
    /** Rest of the World percentage (0–100). */
    row: number;
    /** O'Connor letter per segment UID (only meaningful when method is oconnor). */
    letters: Record<string, OconnorLetter>;
    /**
     * Proportional raw ratings (1–1000 relative weights) per segment UID —
     * only meaningful when method is proportional (WinCASIE III semantics).
     */
    ratings?: Record<string, number>;
    /** POA value per segment UID (derived from letters/ratings for O'Connor/proportional). */
    values: Record<string, number>;
}

export interface InitialConsensusState {
    /** Mirrors incident_response.incident_name at last save. */
    incident_name: string;
    /** WinC.A.S.I.E. III export placeholder fields. */
    filename: string;
    use_my_documents: boolean;
    respondents: ConsensusRespondent[];
    accepted: boolean;
    updated: string;
}

export function methodLabel(method: ConsensusMethod): string {
    if (method === 'mattson') return 'Mattson';
    if (method === 'oconnor') return "O'Connor";
    return 'Proportional';
}

export function defaultRespondent(index: number, segmentUids: string[]): ConsensusRespondent {
    const values: Record<string, number> = {};
    for (const uid of segmentUids) values[uid] = 0;
    return {
        name: `Responder ${index + 1}`,
        method: 'mattson',
        row: 100,
        letters: {},
        values,
    };
}

export function defaultConsensusState(
    incidentName: string,
    segmentUids: string[],
    respondentCount: number,
): InitialConsensusState {
    const respondents: ConsensusRespondent[] = [];
    for (let i = 0; i < respondentCount; i++) {
        respondents.push(defaultRespondent(i, segmentUids));
    }
    return {
        incident_name: incidentName,
        filename: incidentName,
        use_my_documents: false,
        respondents,
        accepted: false,
        updated: new Date().toISOString(),
    };
}

/** Grow/shrink the respondent list, preserving existing entries. */
export function resizeRespondents(
    respondents: ConsensusRespondent[],
    count: number,
    segmentUids: string[],
): ConsensusRespondent[] {
    const next = respondents.slice(0, count);
    while (next.length < count) {
        next.push(defaultRespondent(next.length, segmentUids));
    }
    return next;
}

/** Ensure every segment UID has a value entry; drop values for removed segments. */
export function alignRespondentToSegments(
    resp: ConsensusRespondent,
    segmentUids: string[],
): void {
    const values: Record<string, number> = {};
    const letters: Record<string, OconnorLetter> = {};
    for (const uid of segmentUids) {
        values[uid] = typeof resp.values[uid] === 'number' ? resp.values[uid] : 0;
        if (resp.letters[uid]) letters[uid] = resp.letters[uid];
    }
    resp.values = values;
    resp.letters = letters;
}

/** Derive O'Connor segment POAs from R.O.W. + letters. */
export function oconnorValues(
    row: number,
    letters: Record<string, OconnorLetter>,
    segmentUids: string[],
): Record<string, number> {
    // WinCASIE III semantics (verified against a WC3 trail.txt): weights are
    // REBASED per respondent so their worst-used letter weighs 1, preserving
    // letter spacing. E.g. letters {A,C,E,G} → weights 7:5:3:1 (not 9:7:5:3),
    // while {A,D,F,I} → 9:6:4:1 (I is already the floor).
    const used = segmentUids
        .map((uid) => letters[uid])
        .filter((l): l is OconnorLetter => Boolean(l));
    const worstWeight = used.length ? Math.min(...used.map((l) => OCONNOR_WEIGHTS[l])) : 1;
    const rebased = (letter: OconnorLetter): number => OCONNOR_WEIGHTS[letter] - worstWeight + 1;

    const out: Record<string, number> = {};
    let totalWeight = 0;
    for (const uid of segmentUids) {
        const letter = letters[uid];
        totalWeight += letter ? rebased(letter) : 0;
    }
    const remaining = 100 - row;
    for (const uid of segmentUids) {
        const letter = letters[uid];
        out[uid] = letter && totalWeight > 0
            ? (remaining * rebased(letter)) / totalWeight
            : 0;
    }
    return out;
}

function mean(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Proportional (WinCASIE III): ROW is a percentage; segment ratings are
 * relative weights (1–1000). The remaining (100 − ROW) percent is split in
 * proportion to the ratings. Verified against WC3: ROW 15 with ratings
 * 100/25/50/75 → 34.00 / 8.50 / 17.00 / 25.50.
 */
export function proportionalValues(
    row: number,
    ratings: Record<string, number>,
    segmentUids: string[],
): Record<string, number> {
    const total = segmentUids.reduce((sum, uid) => sum + (ratings[uid] ?? 0), 0);
    const remaining = 100 - row;
    const out: Record<string, number> = {};
    for (const uid of segmentUids) {
        out[uid] = total > 0 ? (remaining * (ratings[uid] ?? 0)) / total : 0;
    }
    return out;
}

export function consensusRow(respondents: ConsensusRespondent[]): number {
    return mean(respondents.map((r) => r.row));
}

export function consensusForSegment(
    respondents: ConsensusRespondent[],
    uid: string,
): number {
    return mean(respondents.map((r) => r.values[uid] ?? 0));
}

export function formatPoa(value: number): string {
    return value.toFixed(2);
}

const SUM_TOLERANCE = 0.005;

/** Returns an error message when the respondent's entry is invalid, else null. */
export function validateRespondentEntry(
    resp: ConsensusRespondent,
    segmentUids: string[],
): string | null {
    if (!Number.isFinite(resp.row) || resp.row < 0 || resp.row > 100) {
        return 'R.O.W. must be a number between 0 and 100.';
    }
    if (resp.method === 'oconnor') {
        for (const uid of segmentUids) {
            if (!resp.letters[uid]) {
                return 'Every segment requires a letter (A–I).';
            }
        }
        return null;
    }
    if (resp.method === 'proportional') {
        for (const uid of segmentUids) {
            const rating = resp.ratings?.[uid];
            if (!Number.isFinite(rating) || (rating as number) < 1 || (rating as number) > 1000) {
                return 'Every segment requires a positive number from 1 to 1000 (relative likelihood, not a percentage).';
            }
        }
        return null;
    }
    for (const uid of segmentUids) {
        const v = resp.values[uid];
        if (!Number.isFinite(v) || v < 0 || v > 100) {
            return 'Every segment requires a number between 0 and 100.';
        }
    }
    if (resp.method === 'mattson') {
        const total = resp.row + segmentUids.reduce((sum, uid) => sum + (resp.values[uid] ?? 0), 0);
        if (Math.abs(total - 100) > SUM_TOLERANCE) {
            return `All 100 points must be used: R.O.W. + segments currently total ${total.toFixed(2)}.`;
        }
    }
    return null;
}
