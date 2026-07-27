/**
 * Shared tactic risk assessments: GAR Model + Complacency Model respondents
 * keyed by assignment CoT uid (or `tactic:<uuid>`).
 * See docs/GARModelWorksheet_v20230103.pdf and docs/risk-assessment_complancy-model.md.
 */

import {
    normalizeComplacencyRespondent,
    type ComplacencyRiskRespondent,
    type RiskBand,
    type RiskLevel,
} from './complacencyRisk.ts';

export type { RiskBand, RiskLevel, ComplacencyRiskRespondent };
export {
    CONFIDENCE_OPTIONS,
    EXPERIENCE_OPTIONS,
    REPETITION_OPTIONS,
    riskLevelForScore,
    type FactorOption,
} from './complacencyRisk.ts';

export type GarFactorKey =
    | 'supervision'
    | 'planning'
    | 'contingencyResources'
    | 'communication'
    | 'teamSelection'
    | 'teamFitness'
    | 'environment'
    | 'taskComplexity';

export interface GarFactorDef {
    key: GarFactorKey;
    label: string;
    help: string;
}

export const GAR_FACTORS: GarFactorDef[] = [
    {
        key: 'supervision',
        label: 'Supervision',
        help: 'Leadership and Supervisors are actively engaged, involved and accessible for all teams and personnel. There is a clear chain of command.',
    },
    {
        key: 'planning',
        label: 'Planning',
        help: 'There is adequate information and proper planning time. JHAs are current and have been reviewed and signed by all levels. All required equipment, training and PPE had been provided.',
    },
    {
        key: 'contingencyResources',
        label: 'Contingency Resources',
        help: 'Local emergency services can be contacted, available and respond in a reasonable amount of time. Has an emergency Evacuation Plan been prepared and is crew briefed?',
    },
    {
        key: 'communication',
        label: 'Communication',
        help: 'There is established Two-Way Radio (VHF or Emergency Dispatch) communication throughout the area of operation. EPIRB/PLB, GPS-linked, Satellite Phone, Position/Location Resources (e.g., AIS, Chart Plotters, Mobile Apps).',
    },
    {
        key: 'teamSelection',
        label: 'Team Selection',
        help: 'Level of individual training, qualifications, experience, familiarity with area of operations and equipment. Cohesiveness and atmosphere that values input and self-critique.',
    },
    {
        key: 'teamFitness',
        label: 'Team Fitness',
        help: 'Physical and mental fitness. Team members are rested, engaged and overall morale is good. The team is mindful and has a high degree of situational awareness. Illness, Medications, Stress, Alcohol, Fatigue & Food, Emotion, Rehydration (IMSAFER).',
    },
    {
        key: 'environment',
        label: 'Environment',
        help: 'Weather Forecast & Advisories, Wind, Seas, Tides, Depths, Currents, River Discharge, Debris/Ice, Surf, Rocks, Reefs, Traffic, Uncharted Water, Remoteness, Security (personnel and/or equipment).',
    },
    {
        key: 'taskComplexity',
        label: 'Task Complexity',
        help: 'Severity, probability, and exposure of mishap. The potential for incident that would tax the current team level. (New Location or Operation, Route Complexity, Vessel Maneuverability, Time Constraints, Task Load, Number of People &/or Organizations Involved).',
    },
];

export const GAR_SCORE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** GAR Evaluation Scale (GREEN-AMBER-RED). Score 0 treated as Green. */
export function garLevelForScore(score: number): RiskLevel {
    if (score <= 35) {
        return {
            label: 'GREEN',
            recommendation: 'Low risk — avoid becoming complacent',
            band: 'green',
        };
    }
    if (score <= 60) {
        return {
            label: 'AMBER',
            recommendation: 'Consider adopting procedures to minimize the risk',
            band: 'amber',
        };
    }
    return {
        label: 'RED',
        recommendation: 'STOP — apply measures to reduce the risk prior to starting',
        band: 'red',
    };
}

export type GarMitigations = Partial<Record<GarFactorKey, string>>;

export interface GarRiskRespondent {
    id: string;
    name: string;
    supervision: number;
    planning: number;
    contingencyResources: number;
    communication: number;
    teamSelection: number;
    teamFitness: number;
    environment: number;
    taskComplexity: number;
    mitigations: GarMitigations;
    score: number;
    level: string;
    recommendation: string;
    band: RiskBand;
    assessedAt: string;
}

/** Shared tactic entry keyed by assignment CoT uid (or `tactic:<uuid>`). */
export interface TacticRiskEntry {
    assignmentUid: string;
    tacticAssignmentId: string;
    tacticLabel: string;
    description: string;
    complacencyRespondents: ComplacencyRiskRespondent[];
    garRespondents: GarRiskRespondent[];
}

export type TacticRiskMap = Record<string, TacticRiskEntry>;

export function newTacticKey(): string {
    return `tactic:${crypto.randomUUID()}`;
}

function normalizeGarFactor(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 10) return null;
    return n;
}

export function garScoreFromFactors(r: Pick<
    GarRiskRespondent,
    GarFactorKey
>): number {
    return (
        r.supervision
        + r.planning
        + r.contingencyResources
        + r.communication
        + r.teamSelection
        + r.teamFitness
        + r.environment
        + r.taskComplexity
    );
}

function normalizeMitigations(raw: unknown): GarMitigations {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const src = raw as Record<string, unknown>;
    const out: GarMitigations = {};
    for (const { key } of GAR_FACTORS) {
        const text = String(src[key] ?? '').trim();
        if (text) out[key] = text;
    }
    return out;
}

export function normalizeGarRespondent(raw: unknown): GarRiskRespondent | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const supervision = normalizeGarFactor(r.supervision);
    const planning = normalizeGarFactor(r.planning);
    const contingencyResources = normalizeGarFactor(r.contingencyResources);
    const communication = normalizeGarFactor(r.communication);
    const teamSelection = normalizeGarFactor(r.teamSelection);
    const teamFitness = normalizeGarFactor(r.teamFitness);
    const environment = normalizeGarFactor(r.environment);
    const taskComplexity = normalizeGarFactor(r.taskComplexity);
    if (
        supervision == null
        || planning == null
        || contingencyResources == null
        || communication == null
        || teamSelection == null
        || teamFitness == null
        || environment == null
        || taskComplexity == null
    ) {
        return null;
    }

    const factors = {
        supervision,
        planning,
        contingencyResources,
        communication,
        teamSelection,
        teamFitness,
        environment,
        taskComplexity,
    };
    const score = garScoreFromFactors(factors);
    const level = garLevelForScore(score);

    return {
        id: String(r.id ?? '').trim() || crypto.randomUUID(),
        name: String(r.name ?? '').trim(),
        ...factors,
        mitigations: normalizeMitigations(r.mitigations),
        score,
        level: level.label,
        recommendation: level.recommendation,
        band: level.band,
        assessedAt: String(r.assessedAt ?? '').trim(),
    };
}

/** Factors rated ≥ 5 with blank mitigation text (PDF note). */
export function factorsNeedingMitigation(
    respondent: Pick<GarRiskRespondent, GarFactorKey | 'mitigations'>,
): GarFactorKey[] {
    const needed: GarFactorKey[] = [];
    for (const { key } of GAR_FACTORS) {
        if (respondent[key] >= 5 && !(respondent.mitigations[key] ?? '').trim()) {
            needed.push(key);
        }
    }
    return needed;
}

export function garFactorLabel(key: GarFactorKey): string {
    return GAR_FACTORS.find((f) => f.key === key)?.label ?? key;
}

function normalizeComplacencyList(raw: unknown): ComplacencyRiskRespondent[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(normalizeComplacencyRespondent)
        .filter((x): x is ComplacencyRiskRespondent => x != null);
}

function normalizeGarList(raw: unknown): GarRiskRespondent[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(normalizeGarRespondent)
        .filter((x): x is GarRiskRespondent => x != null);
}

/**
 * Accepts shared shape (complacency_respondents / gar_respondents) and legacy
 * complacency-only entries (respondents or top-level factors).
 */
export function normalizeTacticRiskEntry(raw: unknown): TacticRiskEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    let complacencyRespondents = normalizeComplacencyList(
        r.complacency_respondents ?? r.complacencyRespondents,
    );
    const garRespondents = normalizeGarList(r.gar_respondents ?? r.garRespondents);

    if (!complacencyRespondents.length) {
        if (Array.isArray(r.respondents)) {
            complacencyRespondents = normalizeComplacencyList(r.respondents);
        } else {
            const legacy = normalizeComplacencyRespondent(r);
            if (legacy) complacencyRespondents = [legacy];
        }
    }

    if (!complacencyRespondents.length && !garRespondents.length) return null;

    return {
        assignmentUid: String(r.assignmentUid ?? '').trim(),
        tacticAssignmentId: String(r.tacticAssignmentId ?? '').trim(),
        tacticLabel: String(r.tacticLabel ?? '').trim(),
        description: String(r.description ?? '').trim(),
        complacencyRespondents,
        garRespondents,
    };
}

export function tacticAssessmentsFromSchemaValue(value: unknown): TacticRiskMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: TacticRiskMap = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const normalized = normalizeTacticRiskEntry(raw);
        if (key.trim() && normalized) out[key.trim()] = normalized;
    }
    return out;
}

/** Merge legacy risk.complacency_assessments into the canonical map (does not overwrite). */
export function mergeLegacyComplacencyAssessments(
    current: TacticRiskMap,
    legacyValue: unknown,
): TacticRiskMap {
    const legacy = tacticAssessmentsFromSchemaValue(legacyValue);
    const out: TacticRiskMap = { ...current };
    for (const [key, entry] of Object.entries(legacy)) {
        if (out[key]) {
            const existingIds = new Set(out[key].complacencyRespondents.map((r) => r.id));
            const merged = [...out[key].complacencyRespondents];
            for (const r of entry.complacencyRespondents) {
                if (!existingIds.has(r.id)) merged.push(r);
            }
            out[key] = {
                ...out[key],
                complacencyRespondents: merged,
                garRespondents: out[key].garRespondents.length
                    ? out[key].garRespondents
                    : entry.garRespondents,
            };
        } else {
            out[key] = entry;
        }
    }
    return out;
}

/** Schema record shape (snake_case arrays). */
export function tacticEntryToSchemaRecord(entry: TacticRiskEntry): Record<string, unknown> {
    return {
        assignmentUid: entry.assignmentUid,
        tacticAssignmentId: entry.tacticAssignmentId,
        tacticLabel: entry.tacticLabel,
        description: entry.description,
        complacency_respondents: entry.complacencyRespondents,
        gar_respondents: entry.garRespondents,
    };
}

const BAND_SEVERITY: Record<RiskBand, number> = { green: 0, amber: 1, red: 2 };
const SAFETY_ZONE_CENTER = 50;

function complacencySeverity(r: ComplacencyRiskRespondent): [number, number] {
    return [BAND_SEVERITY[r.band], Math.abs(r.score - SAFETY_ZONE_CENTER)];
}

export function worstComplacencyRespondent(
    entry: TacticRiskEntry,
): ComplacencyRiskRespondent | null {
    let worst: ComplacencyRiskRespondent | null = null;
    for (const r of entry.complacencyRespondents) {
        if (!worst) {
            worst = r;
            continue;
        }
        const [band, dist] = complacencySeverity(r);
        const [worstBand, worstDist] = complacencySeverity(worst);
        if (band > worstBand || (band === worstBand && dist > worstDist)) {
            worst = r;
        }
    }
    return worst;
}

/** Higher band wins; within band, higher score is worse for GAR. */
export function worstGarRespondent(entry: TacticRiskEntry): GarRiskRespondent | null {
    let worst: GarRiskRespondent | null = null;
    for (const r of entry.garRespondents) {
        if (!worst) {
            worst = r;
            continue;
        }
        const band = BAND_SEVERITY[r.band];
        const worstBand = BAND_SEVERITY[worst.band];
        if (band > worstBand || (band === worstBand && r.score > worst.score)) {
            worst = r;
        }
    }
    return worst;
}

export function entryHasRespondents(entry: TacticRiskEntry): boolean {
    return entry.complacencyRespondents.length > 0 || entry.garRespondents.length > 0;
}
