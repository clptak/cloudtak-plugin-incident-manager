/**
 * TARR Subject Profile logic (decisions 15 and 16), mirroring the WiSAR web
 * tool's onCategoryChange / onEcoChange / applyLPB for Koester, plus the
 * Arizona (IM LPB table) source. Pure, so node:test can run it.
 */
import {
    distancesProblem,
    type Calibration,
    type Multipliers,
    type ProfileCategory,
    type ProfileDataset,
    type ProfileVariant,
    type TarrJobRequest,
} from './wisar.ts';

export type TarrSource = 'arizona' | 'koester';

/** Label for the "no eco region / terrain" choice, as in the web tool. */
export const OTHER_DEFAULT = 'Other/Default';

/** The parts of an IM LPB table row the TARR form uses (25/50/75/90 % in miles). */
export interface ArizonaRow {
    category: string;
    cases: number;
    qAmi: number;
    qBmi: number;
    qCmi: number;
    qDmi: number;
}

export interface Percentiles {
    p25: number;
    p50: number;
    p75: number;
    /** Arizona 90% (`qDmi`). Sent as p90 when it can form a ring (see p90Status). */
    p90?: number;
}

/** Why an Arizona row can't be sent to WiSAR, or null. */
export function arizonaRowProblem(row: ArizonaRow): string | null {
    if (!(row.cases > 0)) return 'The table has no cases for this category.';
    const p = distancesProblem({ p25: row.qAmi, p50: row.qBmi, p75: row.qCmi });
    return p ? `${p} The table's values can't form rings.` : null;
}

export function arizonaPercentiles(row: ArizonaRow): Percentiles {
    return { p25: row.qAmi, p50: row.qBmi, p75: row.qCmi, p90: row.qDmi };
}

// ---- Koester (WiSAR /profiles) ---------------------------------------------

export function findCategory(ds: ProfileDataset | null | undefined, name: string): ProfileCategory | undefined {
    return ds?.categories.find((c) => c.name === name);
}

/** Eco Region buttons: distinct named eco regions, then Other/Default when a null-eco variant exists. Empty = no eco choice. */
export function ecoOptions(cat: ProfileCategory | undefined): string[] {
    if (!cat) return [];
    const ecos: string[] = [];
    for (const v of cat.variants) if (v.eco_region && !ecos.includes(v.eco_region)) ecos.push(v.eco_region);
    if (!ecos.length) return [];
    if (cat.variants.some((v) => v.eco_region === null)) ecos.push(OTHER_DEFAULT);
    return ecos;
}

/** Terrain buttons for an eco region (null = Other/Default). Empty = no terrain choice. */
export function terrainOptions(cat: ProfileCategory | undefined, eco: string | null): string[] {
    if (!cat) return [];
    const entries = cat.variants.filter((v) => v.eco_region === eco);
    const terrains: string[] = [];
    for (const v of entries) if (v.terrain && !terrains.includes(v.terrain)) terrains.push(v.terrain);
    if (!terrains.length) return [];
    if (entries.some((v) => v.terrain === null)) terrains.push(OTHER_DEFAULT);
    return terrains;
}

/** Same fallback as the web tool's applyLPB: exact, eco + default terrain, category default, last entry. */
export function resolveVariant(cat: ProfileCategory | undefined, eco: string | null, terrain: string | null): ProfileVariant | undefined {
    if (!cat?.variants.length) return undefined;
    const v = cat.variants;
    return v.find((e) => e.eco_region === eco && e.terrain === terrain)
        ?? v.find((e) => e.eco_region === eco && e.terrain === null)
        ?? v.find((e) => e.eco_region === null && e.terrain === null)
        ?? v[v.length - 1];
}

/** Multipliers WiSAR applies with calibration "auto" for a listed subject, and whether they are category-specific. */
export function categoryCalibration(ds: ProfileDataset | null | undefined, cat: ProfileCategory | undefined): { mult: Multipliers; profileSpecific: boolean } | null {
    if (cat?.calibration) return { mult: cat.calibration, profileSpecific: true };
    if (ds?.default_calibration) return { mult: ds.default_calibration, profileSpecific: false };
    return null;
}

export function formatMultipliers(m: Multipliers): string {
    return `×${m.m25.toFixed(2)} / ×${m.m50.toFixed(2)} / ×${m.m75.toFixed(2)}`;
}

// ---- the Arizona 90% ring --------------------------------------------------

export interface P90Status {
    /** Value to send as p90; undefined = no 90% ring. */
    send?: number;
    /** Note for the form, or null. */
    note: string | null;
    /** Show the note as a warning (no ring expected) rather than information. */
    warn: boolean;
}

/**
 * The Arizona 90% ring (Paul, 2026-10-04). Only Arizona sends a 90%. A blank
 * or zero value, or one not above 75%, is left out and the run goes ahead with
 * 25/50/75. WiSAR never calibrates p90; with global calibration it drops the
 * ring when the calibrated 75% reaches it. This predicts that for the form;
 * WiSAR's `p90` warning in the results is what counts.
 */
export function p90Status(
    state: Pick<TarrFormState, 'source' | 'globalCalibration'>,
    values: Percentiles | null,
    m75?: number,
): P90Status {
    if (state.source !== 'arizona' || !values) return { note: null, warn: false };
    const mi = (v: number) => `${v.toFixed(2)} mi`;
    const p90 = values.p90;
    if (typeof p90 !== 'number' || !Number.isFinite(p90) || p90 <= 0) {
        return { note: 'No 90% ring: the 90% distance is blank.', warn: true };
    }
    if (!(p90 > values.p75)) {
        return { note: `No 90% ring: the 90% distance must be greater than 75% (${mi(values.p75)}).`, warn: true };
    }
    if (state.globalCalibration && m75) {
        const cal75 = values.p75 * m75;
        if (cal75 >= p90) {
            return {
                send: p90,
                note: `No 90% ring expected: calibration moves 75% to ${mi(cal75)}, past the uncalibrated 90% (${mi(p90)}).`,
                warn: true,
            };
        }
        return { send: p90, note: `The 90% ring isn't calibrated (there is no Coconino 90% multiplier); it stays at ${mi(p90)}.`, warn: false };
    }
    return { send: p90, note: null, warn: false };
}

// ---- request ---------------------------------------------------------------

export interface TarrFormState {
    source: TarrSource;
    /** Category name (Arizona table row or Koester category). */
    category: string;
    /** Koester only; null = Other/Default. */
    eco: string | null;
    terrain: string | null;
    /** Dataset id for Koester (from /profiles). */
    dataset: string;
    /** User-edited percentiles (Edit / custom), or null to use the source values. */
    edited: Percentiles | null;
    /** Arizona or edited values: apply the dataset's global calibration (decision 16, default off). */
    globalCalibration: boolean;
}

/** Percentile unit shown and sent for each source: miles for Arizona, km for Koester (as the web tool). */
export function sourceUnit(source: TarrSource): 'mi' | 'km' {
    return source === 'arizona' ? 'mi' : 'km';
}

/** Why the TARR can't run yet, or null. `values` are the percentiles shown on the form. */
export function tarrProblem(
    ipp: { lat: number; lon: number } | null,
    state: TarrFormState,
    values: Percentiles | null,
    arizonaRow: ArizonaRow | undefined,
): string | null {
    if (!ipp) return 'Choose an IPP.';
    if (!state.category) return 'Choose a subject profile.';
    if (state.source === 'arizona' && !state.edited && arizonaRow) {
        const p = arizonaRowProblem(arizonaRow);
        if (p) return p;
    }
    if (!values) return 'This profile has no distances.';
    return distancesProblem(values);
}

/**
 * The job body. Unedited Koester profiles go as a listed subject so WiSAR
 * applies its Coconino calibration ("auto"); Arizona rows and edited values go
 * as a custom subject, calibrated only when the checkbox is on. Arizona adds
 * its 90% distance when it can form a ring (p90Status).
 */
export function tarrRequest(ipp: { lat: number; lon: number }, state: TarrFormState, values: Percentiles): TarrJobRequest {
    const base = { ipp: { lat: ipp.lat, lon: ipp.lon } };
    if (state.source === 'koester' && !state.edited) {
        return {
            ...base,
            dataset: state.dataset,
            subject: { kind: 'listed', category: state.category, eco_region: state.eco, terrain: state.terrain },
            calibration: 'auto',
        };
    }
    const calibration: Calibration = state.globalCalibration ? 'global' : 'none';
    const suffix = state.source === 'arizona' ? (state.edited ? 'AZ, edited' : 'AZ') : 'edited';
    const p90 = p90Status(state, values).send;
    return {
        ...base,
        ...(state.globalCalibration ? { dataset: state.dataset } : {}),
        subject: {
            kind: 'custom',
            name: `${state.category} (${suffix})`.slice(0, 80),
            distances: {
                p25: values.p25,
                p50: values.p50,
                p75: values.p75,
                ...(p90 !== undefined ? { p90 } : {}),
                unit: sourceUnit(state.source),
            },
        },
        calibration,
    };
}
