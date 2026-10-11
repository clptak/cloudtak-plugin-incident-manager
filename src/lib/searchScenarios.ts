/** Search scenarios stored in mission_schema.json (incident_response.scenarios). */

export const SCENARIO_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type ScenarioLetter = (typeof SCENARIO_LETTERS)[number];

export type ScenarioMobility = '' | 'mobile' | 'immobile';
export type ScenarioResponsiveness = '' | 'responsive' | 'unresponsive';

export interface SearchScenario {
    letter: ScenarioLetter;
    description: string;
    mobility: ScenarioMobility;
    responsiveness: ScenarioResponsiveness;
    priority: number | null;
    updated_at: string;
}

export function isScenarioLetter(value: unknown): value is ScenarioLetter {
    return typeof value === 'string' && (SCENARIO_LETTERS as readonly string[]).includes(value);
}

function parseMobility(raw: unknown): ScenarioMobility {
    if (raw === 'mobile' || raw === 'immobile') return raw;
    if (raw === true) return 'mobile';
    if (raw === false) return 'immobile';
    return '';
}

function parseResponsiveness(raw: unknown): ScenarioResponsiveness {
    if (raw === 'responsive' || raw === 'unresponsive') return raw;
    if (raw === true) return 'responsive';
    if (raw === false) return 'unresponsive';
    return '';
}

function parsePriority(raw: unknown): number | null {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (![1, 2, 3, 4, 5].includes(n)) return null;
    return n;
}

/** Tolerant parse of one schema row; null if no letter + description. */
export function searchScenarioFromSchemaValue(raw: unknown): SearchScenario | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;

    const letterRaw = obj.letter ?? obj.scenario_id;
    const letter = typeof letterRaw === 'string' ? letterRaw.trim().toUpperCase() : '';
    if (!isScenarioLetter(letter)) return null;

    const description = String(
        obj.description ?? obj.scenario_description ?? '',
    ).trim();
    if (!description) return null;

    const updatedAt = typeof obj.updated_at === 'string' && obj.updated_at.trim()
        ? obj.updated_at.trim()
        : new Date().toISOString();

    return {
        letter,
        description,
        mobility: parseMobility(obj.mobility ?? obj.scenario_mobility),
        responsiveness: parseResponsiveness(obj.responsiveness ?? obj.search_responsiveness),
        priority: parsePriority(obj.priority ?? obj.search_priority),
        updated_at: updatedAt,
    };
}

/** Parse schema array; keeps newest row per letter; ignores empty/invalid. */
export function searchScenariosFromSchemaValue(raw: unknown): SearchScenario[] {
    if (!Array.isArray(raw)) return [];
    const byLetter = new Map<ScenarioLetter, SearchScenario>();
    for (const row of raw) {
        const parsed = searchScenarioFromSchemaValue(row);
        if (!parsed) continue;
        const prev = byLetter.get(parsed.letter);
        if (!prev || Date.parse(parsed.updated_at) >= Date.parse(prev.updated_at)) {
            byLetter.set(parsed.letter, parsed);
        }
    }
    return SCENARIO_LETTERS
        .filter((l) => byLetter.has(l))
        .map((l) => byLetter.get(l)!);
}

export function searchScenarioToSchemaRecord(scenario: SearchScenario): Record<string, unknown> {
    return {
        letter: scenario.letter,
        description: scenario.description,
        mobility: scenario.mobility,
        responsiveness: scenario.responsiveness,
        priority: scenario.priority,
        updated_at: scenario.updated_at,
    };
}

export function searchScenariosToSchemaRecords(
    scenarios: SearchScenario[],
): Record<string, unknown>[] {
    return scenarios
        .filter((s) => s.description.trim())
        .map((s) => searchScenarioToSchemaRecord({
            ...s,
            description: s.description.trim(),
        }));
}

export function buildSearchScenario(
    letter: ScenarioLetter,
    fields: {
        description: string;
        mobility?: string;
        responsiveness?: string;
        priority?: number | null;
    },
    updatedAt = new Date().toISOString(),
): SearchScenario {
    return {
        letter,
        description: fields.description.trim(),
        mobility: parseMobility(fields.mobility ?? ''),
        responsiveness: parseResponsiveness(fields.responsiveness ?? ''),
        priority: parsePriority(fields.priority ?? null),
        updated_at: updatedAt,
    };
}

/** Priority ascending (1→5); missing priority last; ties by letter A–F. */
export function sortScenariosByPriority(scenarios: SearchScenario[]): SearchScenario[] {
    return [...scenarios].sort((a, b) => {
        const ap = a.priority;
        const bp = b.priority;
        if (ap == null && bp == null) return a.letter.localeCompare(b.letter);
        if (ap == null) return 1;
        if (bp == null) return -1;
        if (ap !== bp) return ap - bp;
        return a.letter.localeCompare(b.letter);
    });
}
