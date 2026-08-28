/**
 * SPE Model risk assessment (Severity × Probability × Exposure).
 * Severity (1-5) × Probability (1-5) × Exposure (1-4), max 100.
 * See docs-archive/risk-assessment_spe-model.md and Table 18.1 SPE Guidance Table.
 */

import type { FactorOption, RiskBand, RiskLevel } from './complacencyRisk.ts';

export type { FactorOption, RiskBand, RiskLevel };

export const SEVERITY_OPTIONS: FactorOption[] = [
    { value: 1, label: 'Negligible' },
    { value: 2, label: 'Minimal' },
    { value: 3, label: 'Significant' },
    { value: 4, label: 'Major' },
    { value: 5, label: 'Catastrophic' },
];

export const PROBABILITY_OPTIONS: FactorOption[] = [
    { value: 1, label: 'Impossible or remote under any conditions' },
    { value: 2, label: 'Unlikely under normal conditions' },
    { value: 3, label: 'About 50/50' },
    { value: 4, label: 'Greater than 50%' },
    { value: 5, label: 'Very likely to happen' },
];

export const EXPOSURE_OPTIONS: FactorOption[] = [
    { value: 1, label: 'None or below average' },
    { value: 2, label: 'Average' },
    { value: 3, label: 'Above average' },
    { value: 4, label: 'Great' },
];

/** SPE Guidance Table (Table 18.1). */
export function speLevelForScore(score: number): RiskLevel {
    if (score < 20) {
        return {
            label: 'Slight',
            recommendation: 'Probably Acceptable',
            band: 'green',
        };
    }
    if (score < 40) {
        return {
            label: 'Possible',
            recommendation: 'Attention Needed',
            band: 'amber',
        };
    }
    if (score < 60) {
        return {
            label: 'Substantial',
            recommendation: 'Correction Required',
            band: 'red',
        };
    }
    if (score < 80) {
        return {
            label: 'High',
            recommendation: 'Correct Immediately',
            band: 'red',
        };
    }
    return {
        label: 'Very High',
        recommendation: 'Discontinue, Stop',
        band: 'red',
    };
}

/** One person's SPE assessment of a tactic. */
export interface SpeRiskRespondent {
    id: string;
    name: string;
    severity: number;
    probability: number;
    exposure: number;
    score: number;
    level: string;
    recommendation: string;
    band: RiskBand;
    assessedAt: string;
}

function normalizeFactor(value: unknown, max: number): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) return null;
    return n;
}

export function normalizeSpeRespondent(raw: unknown): SpeRiskRespondent | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const severity = normalizeFactor(r.severity, 5);
    const probability = normalizeFactor(r.probability, 5);
    const exposure = normalizeFactor(r.exposure, 4);
    if (severity == null || probability == null || exposure == null) return null;

    const score = severity * probability * exposure;
    const level = speLevelForScore(score);

    return {
        id: String(r.id ?? '').trim() || crypto.randomUUID(),
        name: String(r.name ?? '').trim(),
        severity,
        probability,
        exposure,
        score,
        level: level.label,
        recommendation: level.recommendation,
        band: level.band,
        assessedAt: String(r.assessedAt ?? '').trim(),
    };
}
