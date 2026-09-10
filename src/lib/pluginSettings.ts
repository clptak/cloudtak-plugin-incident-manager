/** Browser-local plugin preferences (subject types, custom LPB table). */

import {
    DEFAULT_SUBJECT_TYPES,
    normalizeSubjectTypes,
    type ParseResult,
} from './subjectTypes.ts';

export const PLUGIN_SETTINGS_KEY = 'incident-manager:settings';

export interface AzlpbEntry {
    category: string;
    cases: number;
    qAmi: number;
    qBmi: number;
    qCmi: number;
    qDmi: number;
    [key: string]: unknown;
}

export interface PluginSettings {
    subjectTypes: string[];
    /** `null` means use the bundled Arizona LPB table. */
    lpbTable: AzlpbEntry[] | null;
    yourAgency: string;
    /** When true, Resources Agency options come from D4H External Resources. */
    useD4hAidingAgencies: boolean;
    aidingAgencies: string[];
}

export function defaultPluginSettings(): PluginSettings {
    return {
        subjectTypes: [...DEFAULT_SUBJECT_TYPES],
        lpbTable: null,
        yourAgency: '',
        useD4hAidingAgencies: true,
        aidingAgencies: [],
    };
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function parseLpbEntry(raw: unknown, index: number): ParseResult<AzlpbEntry> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: `Row ${index + 1} is not an object.` };
    }
    const rec = raw as Record<string, unknown>;
    if (typeof rec.category !== 'string' || !rec.category.trim()) {
        return { ok: false, error: `Row ${index + 1} is missing a category name.` };
    }
    const category = rec.category.trim();
    const cases = rec.cases;
    const qAmi = rec.qAmi;
    const qBmi = rec.qBmi;
    const qCmi = rec.qCmi;
    const qDmi = rec.qDmi;
    if (!isFiniteNumber(cases)) {
        return { ok: false, error: `Row ${index + 1} (${category}) is missing numeric cases.` };
    }
    if (!isFiniteNumber(qAmi)) {
        return { ok: false, error: `Row ${index + 1} (${category}) is missing numeric qAmi.` };
    }
    if (!isFiniteNumber(qBmi)) {
        return { ok: false, error: `Row ${index + 1} (${category}) is missing numeric qBmi.` };
    }
    if (!isFiniteNumber(qCmi)) {
        return { ok: false, error: `Row ${index + 1} (${category}) is missing numeric qCmi.` };
    }
    if (!isFiniteNumber(qDmi)) {
        return { ok: false, error: `Row ${index + 1} (${category}) is missing numeric qDmi.` };
    }
    return {
        ok: true,
        value: {
            ...rec,
            category,
            cases,
            qAmi,
            qBmi,
            qCmi,
            qDmi,
        },
    };
}

export function parseLpbTable(raw: unknown): ParseResult<AzlpbEntry[]> {
    if (!Array.isArray(raw)) {
        return { ok: false, error: 'LPB JSON must be an array of category rows.' };
    }
    if (!raw.length) {
        return { ok: false, error: 'LPB JSON array is empty.' };
    }
    const table: AzlpbEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
        const parsed = parseLpbEntry(raw[i], i);
        if (!parsed.ok) return parsed;
        table.push(parsed.value);
    }
    return { ok: true, value: table };
}

export function parseLpbTableJson(text: string): ParseResult<AzlpbEntry[]> {
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    if (!trimmed) {
        return { ok: false, error: 'File is empty.' };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return { ok: false, error: 'File is not valid JSON.' };
    }
    return parseLpbTable(parsed);
}

export function parseStoredPluginSettings(raw: unknown): PluginSettings {
    const defaults = defaultPluginSettings();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
    const rec = raw as Record<string, unknown>;

    if (Array.isArray(rec.subjectTypes)) {
        const strings = rec.subjectTypes.filter((item): item is string => typeof item === 'string');
        defaults.subjectTypes = normalizeSubjectTypes(strings);
    }

    if (rec.lpbTable === null) {
        defaults.lpbTable = null;
    } else if (rec.lpbTable !== undefined) {
        const parsed = parseLpbTable(rec.lpbTable);
        defaults.lpbTable = parsed.ok ? parsed.value : null;
    }

    if (typeof rec.yourAgency === 'string') {
        defaults.yourAgency = rec.yourAgency.trim();
    }

    if (typeof rec.useD4hAidingAgencies === 'boolean') {
        defaults.useD4hAidingAgencies = rec.useD4hAidingAgencies;
    }

    if (Array.isArray(rec.aidingAgencies)) {
        const strings = rec.aidingAgencies.filter((item): item is string => typeof item === 'string');
        defaults.aidingAgencies = normalizeSubjectTypes(strings);
    }

    return defaults;
}

function readStorage(): Storage | null {
    try {
        if (typeof localStorage === 'undefined') return null;
        return localStorage;
    } catch {
        return null;
    }
}

export function loadPluginSettings(): PluginSettings {
    const storage = readStorage();
    if (!storage) return defaultPluginSettings();
    try {
        const raw = storage.getItem(PLUGIN_SETTINGS_KEY);
        if (!raw) return defaultPluginSettings();
        return parseStoredPluginSettings(JSON.parse(raw));
    } catch {
        return defaultPluginSettings();
    }
}

export function savePluginSettings(settings: PluginSettings): void {
    const storage = readStorage();
    if (!storage) return;
    try {
        storage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify({
            subjectTypes: normalizeSubjectTypes(settings.subjectTypes),
            lpbTable: settings.lpbTable,
            yourAgency: settings.yourAgency.trim(),
            useD4hAidingAgencies: settings.useD4hAidingAgencies,
            aidingAgencies: normalizeSubjectTypes(settings.aidingAgencies),
        } satisfies PluginSettings));
    } catch {
        // quota / private mode
    }
}
