/** Search urgency rating stored in mission_schema.json (incident_response.urgency_rating). */

export const URGENCY_FACTOR_KEYS = [
    'age',
    'medical',
    'number',
    'experience',
    'weather',
    'equipment',
    'terrain',
] as const;

export type UrgencyFactorKey = (typeof URGENCY_FACTOR_KEYS)[number];

export type UrgencyLevelLabel = 'High' | 'Moderate' | 'Lower';

export interface UrgencyRating {
    factors: Record<UrgencyFactorKey, number>;
    total: number;
    level: UrgencyLevelLabel;
    updated_at: string;
}

export function urgencyLevelFromTotal(total: number): UrgencyLevelLabel {
    if (total <= 10) return 'High';
    if (total <= 16) return 'Moderate';
    return 'Lower';
}

function clampFactor(value: unknown): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    if (![1, 2, 3].includes(n)) return null;
    return n;
}

export function defaultUrgencyFactors(): Record<UrgencyFactorKey, number> {
    return {
        age: 1,
        medical: 1,
        number: 1,
        experience: 1,
        weather: 1,
        equipment: 1,
        terrain: 1,
    };
}

/** Build a rating from factor scores; recomputes total/level. */
export function buildUrgencyRating(
    factors: Record<UrgencyFactorKey, number>,
    updatedAt = new Date().toISOString(),
): UrgencyRating {
    const total = URGENCY_FACTOR_KEYS.reduce((sum, key) => sum + (Number(factors[key]) || 0), 0);
    return {
        factors: { ...factors },
        total,
        level: urgencyLevelFromTotal(total),
        updated_at: updatedAt,
    };
}

/**
 * Safe parse of empty/`{}`/partial schema values.
 * Returns null when no valid factor scores are present (nothing to recall).
 */
export function urgencyRatingFromSchemaValue(raw: unknown): UrgencyRating | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const obj = raw as Record<string, unknown>;
    const factorsRaw = (obj.factors && typeof obj.factors === 'object' && !Array.isArray(obj.factors))
        ? obj.factors as Record<string, unknown>
        : obj;

    const factors = defaultUrgencyFactors();
    let found = 0;
    for (const key of URGENCY_FACTOR_KEYS) {
        const score = clampFactor(factorsRaw[key]);
        if (score == null) continue;
        factors[key] = score;
        found += 1;
    }
    if (found === 0) return null;

    const updatedAt = typeof obj.updated_at === 'string' && obj.updated_at.trim()
        ? obj.updated_at.trim()
        : '';

    return buildUrgencyRating(factors, updatedAt || new Date().toISOString());
}

export function urgencyRatingToSchemaRecord(rating: UrgencyRating): Record<string, unknown> {
    return {
        factors: { ...rating.factors },
        total: rating.total,
        level: rating.level,
        updated_at: rating.updated_at,
    };
}
