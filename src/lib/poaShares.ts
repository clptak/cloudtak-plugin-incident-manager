/** Entered "% of POA" shares must match the source POA within this tolerance. */
export const POA_SHARE_TOLERANCE = 0.01;

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Equal shares of `sourcePoa` across `count` parts.
 * The last share absorbs rounding so the parts sum to `sourcePoa`.
 */
export function defaultPoaShares(sourcePoa: number, count: number): number[] {
    if (!(count >= 1) || !Number.isFinite(sourcePoa) || sourcePoa < 0) return [];
    const share = Math.floor((sourcePoa / count) * 100) / 100;
    const shares = Array.from({ length: count - 1 }, () => share);
    shares.push(round2(sourcePoa - share * (count - 1)));
    return shares;
}

export function sumPoaShares(shares: number[]): number {
    return round2(shares.reduce((total, share) => total + (Number.isFinite(share) ? share : 0), 0));
}

/** True when the shares add up to the segment POA being split. */
export function poaSharesMatchSource(shares: number[], sourcePoa: number): boolean {
    return Math.abs(sumPoaShares(shares) - sourcePoa) <= POA_SHARE_TOLERANCE;
}

/**
 * Split one respondent's stored parent value in the same proportions as
 * `shares` of `sourcePoa`. The last part absorbs rounding so the parts sum
 * to `parentValue` (total probability mass is unchanged).
 */
export function allocateParentValue(
    parentValue: number,
    shares: number[],
    sourcePoa: number,
): number[] {
    if (!shares.length) return [];
    if (!(sourcePoa > 0) || !Number.isFinite(parentValue)) return shares.map(() => 0);
    const out: number[] = [];
    let used = 0;
    for (let i = 0; i < shares.length; i++) {
        if (i === shares.length - 1) {
            out.push(round2(parentValue - used));
        } else {
            const part = round2(parentValue * (shares[i] / sourcePoa));
            out.push(part);
            used += part;
        }
    }
    return out;
}
