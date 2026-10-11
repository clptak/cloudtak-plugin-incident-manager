/** Browser-local plugin preferences (subject types, custom LPB table). */

import type { D4HMember } from './d4hTypes.ts';
import { loadDeploymentBundle, type DeploymentConfig } from './deploymentDefaults.ts';
import {
    normalizePersonnel,
    parsePersonnelMember,
    parsePersonnelText,
} from './personnel.ts';
import {
    DEFAULT_SUBJECT_TYPES,
    normalizeSubjectTypes,
    parseAidingAgenciesText,
    parseSubjectTypesText,
    type ParseResult,
} from './subjectTypes.ts';
import { normalizeBaseUrl } from './wisar.ts';

export const PLUGIN_SETTINGS_KEY = 'incident-manager:settings';

export interface AzlpbEntry {
    category: string;
    cases: number;
    qAmi: number;
    qBmi: number;
    qCmi: number;
    qDmi: number;
    maxMi?: number;
    meanMi?: number;
    qAme?: number;
    qBme?: number;
    qCme?: number;
    qDme?: number;
    qAlabel?: string;
    qBlabel?: string;
    qClabel?: string;
    qDlabel?: string;
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
    /** When true, Organization/Dashboard personnel come from D4H KV. */
    useD4hPersonnel: boolean;
    personnel: D4HMember[];
    /** DataSync mission template id for search OPs. Empty = auto-pick SAR by name. */
    searchOpTemplateId: string;
    /** WiSAR server for this browser. Empty = the branch default (WISAR_DEFAULT_URL in lib/wisar.ts). */
    wisarUrl: string;
}

export function defaultPluginSettings(): PluginSettings {
    return {
        subjectTypes: [...DEFAULT_SUBJECT_TYPES],
        lpbTable: null,
        yourAgency: '',
        useD4hAidingAgencies: true,
        aidingAgencies: [],
        useD4hPersonnel: true,
        personnel: [],
        searchOpTemplateId: '',
        wisarUrl: '',
    };
}

/** Normalized WiSAR URL, '' for blank, or null when it isn't a usable http(s) URL. */
export function parseWisarUrl(raw: string): string | null {
    try {
        return normalizeBaseUrl(raw);
    } catch {
        return null;
    }
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

/** Settings taken from config.local.ts and staged deployment files. */
export interface ResolvedDeployment {
    yourAgency: string;
    searchOpTemplateId: string;
    wisarUrl: string;
    useD4hAidingAgencies?: boolean;
    useD4hPersonnel?: boolean;
    aidingAgencies?: string[];
    personnel?: D4HMember[];
    subjectTypes?: string[];
    lpbTable?: AzlpbEntry[];
}

const SHARED_STRING_KEYS = [
    'yourAgency',
    'searchOpTemplateId',
    'wisarUrl',
] as const satisfies readonly (keyof PluginSettings)[];

function trimmed(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Basename only. A blank name, a directory, or `..` skips the file. */
function stagedText(files: Record<string, string>, name: unknown): string | undefined {
    if (typeof name !== 'string') return undefined;
    const base = name.trim();
    if (!base || base.includes('/') || base.includes('\\') || base.includes('..')) return undefined;
    return files[base];
}

export function deploymentFromConfig(config: DeploymentConfig, files: Record<string, string> = {}): ResolvedDeployment {
    const resolved: ResolvedDeployment = {
        yourAgency: trimmed(config.yourAgency),
        searchOpTemplateId: trimmed(config.searchOpTemplateId),
        wisarUrl: parseWisarUrl(trimmed(config.wisarUrl)) ?? '',
    };
    if (typeof config.useD4hAidingAgencies === 'boolean') {
        resolved.useD4hAidingAgencies = config.useD4hAidingAgencies;
    }
    if (typeof config.useD4hPersonnel === 'boolean') {
        resolved.useD4hPersonnel = config.useD4hPersonnel;
    }

    const subjects = stagedText(files, config.subjectTypesFile);
    if (subjects !== undefined) {
        const parsed = parseSubjectTypesText(subjects);
        if (parsed.ok) resolved.subjectTypes = parsed.value;
    }
    const agencies = stagedText(files, config.aidingAgenciesFile);
    if (agencies !== undefined) {
        const parsed = parseAidingAgenciesText(agencies);
        if (parsed.ok) resolved.aidingAgencies = parsed.value;
    }
    const people = stagedText(files, config.personnelFile);
    if (people !== undefined) {
        const parsed = parsePersonnelText(people);
        if (parsed.ok) resolved.personnel = parsed.value;
    }
    const lpb = stagedText(files, config.lpbTableFile);
    if (lpb !== undefined) {
        const parsed = parseLpbTableJson(lpb);
        if (parsed.ok) resolved.lpbTable = parsed.value;
    }
    return resolved;
}

let resolvedCache: ResolvedDeployment | undefined;

export function resolveDeployment(): ResolvedDeployment {
    if (!resolvedCache) {
        const bundle = loadDeploymentBundle();
        resolvedCache = deploymentFromConfig(bundle.config, bundle.files);
    }
    return resolvedCache;
}

/** True when a shared string or a staged list actually loaded. */
export function hasDeploymentDefaults(deployed: ResolvedDeployment = resolveDeployment()): boolean {
    if (trimmed(deployed.yourAgency)) return true;
    if (trimmed(deployed.searchOpTemplateId)) return true;
    if (trimmed(deployed.wisarUrl)) return true;
    if (deployed.subjectTypes?.length) return true;
    if (deployed.aidingAgencies?.length) return true;
    if (deployed.personnel?.length) return true;
    if (deployed.lpbTable?.length) return true;
    return false;
}

/** Staged subject types, when a deployment file parsed. */
export function deploymentSubjectTypes(): string[] | undefined {
    return resolveDeployment().subjectTypes;
}

/**
 * Code defaults, then deployment, then this browser's saved settings.
 * A missing list key uses the staged file. An empty array or `lpbTable: null`
 * was saved on purpose and wins. A blank string falls back to deployment.
 */
export function applyDeploymentDefaults(
    stored: unknown,
    deployed: ResolvedDeployment = resolveDeployment(),
): PluginSettings {
    const settings = defaultPluginSettings();
    if (deployed.yourAgency) settings.yourAgency = deployed.yourAgency;
    if (deployed.searchOpTemplateId) settings.searchOpTemplateId = deployed.searchOpTemplateId;
    if (deployed.wisarUrl) settings.wisarUrl = deployed.wisarUrl;
    if (typeof deployed.useD4hAidingAgencies === 'boolean') {
        settings.useD4hAidingAgencies = deployed.useD4hAidingAgencies;
    }
    if (typeof deployed.useD4hPersonnel === 'boolean') {
        settings.useD4hPersonnel = deployed.useD4hPersonnel;
    }
    if (deployed.subjectTypes) settings.subjectTypes = [...deployed.subjectTypes];
    if (deployed.aidingAgencies) settings.aidingAgencies = [...deployed.aidingAgencies];
    if (deployed.personnel) settings.personnel = deployed.personnel.map((member) => ({ ...member }));
    if (deployed.lpbTable) settings.lpbTable = deployed.lpbTable.map((row) => ({ ...row }));

    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return settings;
    const rec = stored as Record<string, unknown>;

    if (typeof rec.yourAgency === 'string') {
        settings.yourAgency = trimmed(rec.yourAgency) || settings.yourAgency;
    }
    if (typeof rec.searchOpTemplateId === 'string') {
        settings.searchOpTemplateId = trimmed(rec.searchOpTemplateId) || settings.searchOpTemplateId;
    }
    if (typeof rec.wisarUrl === 'string') {
        settings.wisarUrl = (parseWisarUrl(rec.wisarUrl) ?? '') || settings.wisarUrl;
    }
    if (typeof rec.useD4hAidingAgencies === 'boolean') {
        settings.useD4hAidingAgencies = rec.useD4hAidingAgencies;
    }
    if (typeof rec.useD4hPersonnel === 'boolean') {
        settings.useD4hPersonnel = rec.useD4hPersonnel;
    }
    if (Array.isArray(rec.subjectTypes)) {
        const strings = rec.subjectTypes.filter((item): item is string => typeof item === 'string');
        settings.subjectTypes = normalizeSubjectTypes(strings);
    }
    if (Array.isArray(rec.aidingAgencies)) {
        const strings = rec.aidingAgencies.filter((item): item is string => typeof item === 'string');
        settings.aidingAgencies = normalizeSubjectTypes(strings);
    }
    if (Array.isArray(rec.personnel)) {
        const members: D4HMember[] = [];
        for (let i = 0; i < rec.personnel.length; i++) {
            const parsed = parsePersonnelMember(rec.personnel[i], i);
            if (parsed.ok) members.push(parsed.value);
        }
        settings.personnel = normalizePersonnel(members);
    }
    if ('lpbTable' in rec) {
        if (rec.lpbTable === null) {
            settings.lpbTable = null;
        } else {
            const parsed = parseLpbTable(rec.lpbTable);
            settings.lpbTable = parsed.ok ? parsed.value : null;
        }
    }

    return settings;
}

/** Drop strings and lists that still match the deployment copy so a later rebuild is picked up. */
export function settingsForStorage(
    settings: PluginSettings,
    deployed: ResolvedDeployment = resolveDeployment(),
): Record<string, unknown> {
    const stored: Record<string, unknown> = {
        yourAgency: settings.yourAgency.trim(),
        useD4hAidingAgencies: settings.useD4hAidingAgencies,
        useD4hPersonnel: settings.useD4hPersonnel,
        searchOpTemplateId: settings.searchOpTemplateId.trim(),
        wisarUrl: parseWisarUrl(settings.wisarUrl) ?? '',
        subjectTypes: normalizeSubjectTypes(settings.subjectTypes),
        aidingAgencies: normalizeSubjectTypes(settings.aidingAgencies),
        personnel: normalizePersonnel(settings.personnel),
        lpbTable: settings.lpbTable,
    };

    for (const key of SHARED_STRING_KEYS) {
        const fromDeployment = trimmed(deployed[key]);
        if (fromDeployment && stored[key] === fromDeployment) {
            stored[key] = '';
        }
    }
    if (deployed.subjectTypes && sameJson(stored.subjectTypes, deployed.subjectTypes)) {
        delete stored.subjectTypes;
    }
    if (deployed.aidingAgencies && sameJson(stored.aidingAgencies, deployed.aidingAgencies)) {
        delete stored.aidingAgencies;
    }
    if (deployed.personnel && sameJson(stored.personnel, deployed.personnel)) {
        delete stored.personnel;
    }
    if (deployed.lpbTable && sameJson(stored.lpbTable, deployed.lpbTable)) {
        delete stored.lpbTable;
    }

    return stored;
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

    if (typeof rec.useD4hPersonnel === 'boolean') {
        defaults.useD4hPersonnel = rec.useD4hPersonnel;
    }

    if (Array.isArray(rec.personnel)) {
        const members: D4HMember[] = [];
        for (let i = 0; i < rec.personnel.length; i++) {
            const parsed = parsePersonnelMember(rec.personnel[i], i);
            if (parsed.ok) members.push(parsed.value);
        }
        defaults.personnel = normalizePersonnel(members);
    }

    if (typeof rec.searchOpTemplateId === 'string') {
        defaults.searchOpTemplateId = rec.searchOpTemplateId.trim();
    }

    if (typeof rec.wisarUrl === 'string') {
        defaults.wisarUrl = parseWisarUrl(rec.wisarUrl) ?? '';
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
    if (!storage) return applyDeploymentDefaults(null);
    try {
        const raw = storage.getItem(PLUGIN_SETTINGS_KEY);
        if (!raw) return applyDeploymentDefaults(null);
        return applyDeploymentDefaults(JSON.parse(raw));
    } catch {
        return applyDeploymentDefaults(null);
    }
}

export function savePluginSettings(settings: PluginSettings): void {
    const storage = readStorage();
    if (!storage) return;
    try {
        storage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(settingsForStorage(settings)));
    } catch {
        // quota / private mode
    }
}
