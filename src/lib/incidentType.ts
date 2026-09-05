/** Canonical slug stored as a TAK mission keyword: `incidentType:<slug>`. */
export const INCIDENT_TYPE_KEYWORD_PREFIX = 'incidentType:';

export const SEARCH_ONLY_NAV_KEYS = new Set<string>([
    'search-urgency',
    'search-scenarios',
    'search-area',
    'segmentation',
    'initial-consensus',
    // 'operational-periods' is deliberately NOT here: every incident type runs
    // operational periods. POD and the CASIE rollup are the only search-specific
    // parts, and they are gated inside the pane (Paul, 2026-08-30).
]);

export const SEARCH_ONLY_HTAB_KEYS = new Set<string>([
    'task',
    'clues',
    'casie',
]);

export function isSearchIncidentType(type: string | undefined | null): boolean {
    return type === 'search';
}

export function incidentTypeKeyword(type: string): string {
    return `${INCIDENT_TYPE_KEYWORD_PREFIX}${type}`;
}

/**
 * Strip Create-form `_OP-00` / Area Search ` - OP1` / MGMT suffixes so sibling
 * DataSyncs of the same incident compare equal.
 */
export function incidentStemFromName(name: string): string {
    return name
        .replace(/ - MGMT$/, '')
        .replace(/ - OP\d+$/, '')
        .replace(/_OP-\d+$/, '');
}

export function isSameIncidentFamily(a: string, b: string): boolean {
    const stem = incidentStemFromName(a);
    return stem.length > 0 && stem === incidentStemFromName(b);
}

/** Parent / sibling names to try when this DataSync has no `incidentType:` keyword. */
export function parentIncidentCandidateNames(name: string): string[] {
    const stem = incidentStemFromName(name);
    const out: string[] = [];
    const add = (candidate: string): void => {
        if (candidate && candidate !== name && !out.includes(candidate)) out.push(candidate);
    };
    add(stem);
    add(`${stem}_OP-00`);
    add(`${stem} - MGMT`);
    return out;
}

export function parseIncidentTypeFromKeywords(keywords?: readonly string[] | null): string {
    if (!keywords) return '';
    const tag = keywords.find((k) => k.startsWith(INCIDENT_TYPE_KEYWORD_PREFIX));
    return tag ? tag.slice(INCIDENT_TYPE_KEYWORD_PREFIX.length) : '';
}

/** Read `incidentType:` from a mission/subscription-like object (`keywords` or `meta.keywords`). */
export function parseIncidentTypeFromRecord(record: unknown): string {
    if (!record || typeof record !== 'object') return '';
    const rec = record as { keywords?: unknown; meta?: { keywords?: unknown } };
    const fromTop = stringKeywords(rec.keywords);
    const parsedTop = parseIncidentTypeFromKeywords(fromTop);
    if (parsedTop) return parsedTop;
    if (!rec.meta || typeof rec.meta !== 'object') return '';
    return parseIncidentTypeFromKeywords(stringKeywords(rec.meta.keywords));
}

function stringKeywords(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.filter((k): k is string => typeof k === 'string');
}
