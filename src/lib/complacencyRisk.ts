/**
 * Complacency Model risk assessment (Craig E. Geis, California Training Institute).
 * Risk = Repetition (1-5) x Confidence (1-5) x Experience (1-4), max 100.
 * See docs/risk-assessment_complancy-model.md.
 */

export interface FactorOption {
    value: number;
    label: string;
}

export const REPETITION_OPTIONS: FactorOption[] = [
    { value: 1, label: 'I Rarely Do It' },
    { value: 2, label: 'I Seldom Do It' },
    { value: 3, label: 'I Do It Occasionally' },
    { value: 4, label: 'I Do It Often' },
    { value: 5, label: 'I Do It All The Time' },
];

export const CONFIDENCE_OPTIONS: FactorOption[] = [
    { value: 1, label: 'I Am Very Concerned' },
    { value: 2, label: 'I Am Nervous About The Task' },
    { value: 3, label: "So, So. I've Had Close Calls Before" },
    { value: 4, label: "I'm Pretty Sure It Won't Be A Problem" },
    { value: 5, label: 'Positive, Never Had A Problem Before' },
];

export const EXPERIENCE_OPTIONS: FactorOption[] = [
    { value: 1, label: 'Less Than 3 Years' },
    { value: 2, label: 'From 3 To 5 Years' },
    { value: 3, label: 'From 6 To 15 Years' },
    { value: 4, label: 'Greater Than 15 Years' },
];

export type RiskBand = 'green' | 'amber' | 'red';

export interface RiskLevel {
    label: string;
    recommendation: string;
    band: RiskBand;
}

/** Complacency Risk Values Table. */
export function riskLevelForScore(score: number): RiskLevel {
    if (score < 20) return { label: 'LOW SKILL', recommendation: 'Stop and get help', band: 'red' };
    if (score < 40) return { label: 'MODERATE SKILL', recommendation: 'Review Procedures', band: 'amber' };
    if (score < 60) return { label: 'SAFETY ZONE', recommendation: 'Proceed', band: 'green' };
    if (score < 80) return { label: 'MODERATE COMPLACENCY', recommendation: 'Review Procedures', band: 'amber' };
    return { label: 'HIGH COMPLACENCY', recommendation: 'Stop and Think', band: 'red' };
}

export interface ComplacencyRiskAssessment {
    /** CoT uid of the assignment map object; empty for free-text (new) tactics. */
    assignmentUid: string;
    /** Work assignment record id from incident_response.work_assignments. */
    tacticAssignmentId: string;
    tacticLabel: string;
    description: string;
    repetition: number;
    confidence: number;
    experience: number;
    score: number;
    level: string;
    recommendation: string;
    band: RiskBand;
    assessedAt: string;
}

/** Storage key inside risk.complacency_assessments for a new (non-assignment) tactic. */
export function newTacticKey(): string {
    return `tactic:${crypto.randomUUID()}`;
}

function normalizeFactor(value: unknown, max: number): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) return null;
    return n;
}

export function normalizeRiskAssessment(raw: unknown): ComplacencyRiskAssessment | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const repetition = normalizeFactor(r.repetition, 5);
    const confidence = normalizeFactor(r.confidence, 5);
    const experience = normalizeFactor(r.experience, 4);
    if (repetition == null || confidence == null || experience == null) return null;

    const score = repetition * confidence * experience;
    const level = riskLevelForScore(score);

    return {
        assignmentUid: String(r.assignmentUid ?? '').trim(),
        tacticAssignmentId: String(r.tacticAssignmentId ?? '').trim(),
        tacticLabel: String(r.tacticLabel ?? '').trim(),
        description: String(r.description ?? '').trim(),
        repetition,
        confidence,
        experience,
        score,
        level: level.label,
        recommendation: level.recommendation,
        band: level.band,
        assessedAt: String(r.assessedAt ?? '').trim(),
    };
}

/** Map keyed by assignment CoT uid (or `tactic:<uuid>` for free-text tactics). */
export type ComplacencyRiskMap = Record<string, ComplacencyRiskAssessment>;

export function riskAssessmentsFromSchemaValue(value: unknown): ComplacencyRiskMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: ComplacencyRiskMap = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const normalized = normalizeRiskAssessment(raw);
        if (key.trim() && normalized) out[key.trim()] = normalized;
    }
    return out;
}
