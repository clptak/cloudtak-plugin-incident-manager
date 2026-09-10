/** Default and user-editable Subject Type labels (Create | Open + Subject Information). */

export const MAX_SUBJECT_TYPES = 80;
export const MAX_AIDING_AGENCIES = 80;

export const DEFAULT_SUBJECT_TYPES = [
    'Hiker', 'Hunter', 'Climber', 'Canyoneering', 'Camper',
    'Child', 'Mountain Biker', 'Autistic', 'Mental Health', 'Boater',
    'Vehicle', 'Fisherman', 'Dementia', 'Alzheimers', 'Base Jumper',
    'Crime Victim', 'Despondent', 'Elderly', 'Intoxicated', 'Kayaker',
    'Paddle Boarder', 'Skier', 'Snowshoer', 'Snowboarder', 'Water',
    'Aircraft', 'Christmas Tree Cutter', 'Cross Country Skier', 'Downhill Skier', 'Equestrian',
    'Mushroom Gatherer', 'Pinon Nut Picker', 'Woodcutter', 'Other',
];

export const SUBJECT_TYPE_PLACEHOLDER = '— Select —';

export type ParseResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: string };

/** Trim, drop blanks, de-dupe case-insensitively (keep first spelling), cap length. */
export function normalizeSubjectTypes(labels: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of labels) {
        const label = raw.trim();
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label);
        if (out.length >= MAX_SUBJECT_TYPES) break;
    }
    return out;
}

/** Merge incoming labels onto an existing list (incoming wins order for new items). */
export function mergeSubjectTypes(existing: string[], incoming: string[]): string[] {
    return normalizeSubjectTypes([...existing, ...incoming]);
}

function stringsFromUnknownArray(value: unknown[]): ParseResult<string[]> {
    const strings: string[] = [];
    for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item !== 'string') {
            return { ok: false, error: `Item ${i + 1} is not a string.` };
        }
        strings.push(item);
    }
    return { ok: true, value: strings };
}

function parseStringListJson(parsed: unknown, objectKeys: string[]): ParseResult<string[]> {
    if (Array.isArray(parsed)) {
        return stringsFromUnknownArray(parsed);
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const rec = parsed as Record<string, unknown>;
        for (const key of objectKeys) {
            if (Array.isArray(rec[key])) {
                return stringsFromUnknownArray(rec[key] as unknown[]);
            }
        }
        const quoted = objectKeys.map((key) => `"${key}"`).join(' or ');
        return { ok: false, error: `JSON object must include a ${quoted} array.` };
    }
    const quoted = objectKeys.map((key) => `{ "${key}": [...] }`).join(' or ');
    return { ok: false, error: `JSON must be an array of strings or ${quoted}.` };
}

function parseStringListCsv(raw: string): string[] {
    return raw
        .split(/[\n,]+/)
        .map((part) => part.replace(/^\uFEFF/, '').trim())
        .filter(Boolean);
}

export function parseStringListText(
    raw: string,
    objectKeys: string[],
    emptyError: string,
): ParseResult<string[]> {
    const text = raw.replace(/^\uFEFF/, '').trim();
    if (!text) {
        return { ok: false, error: 'File is empty.' };
    }

    if (text.startsWith('[') || text.startsWith('{')) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return { ok: false, error: 'File is not valid JSON.' };
        }
        const result = parseStringListJson(parsed, objectKeys);
        if (!result.ok) return result;
        const labels = normalizeSubjectTypes(result.value);
        if (!labels.length) {
            return { ok: false, error: emptyError };
        }
        return { ok: true, value: labels };
    }

    const labels = normalizeSubjectTypes(parseStringListCsv(text));
    if (!labels.length) {
        return { ok: false, error: emptyError };
    }
    return { ok: true, value: labels };
}

/**
 * Parse a JSON array / `{ subjectTypes }` object, or CSV/text (newlines and commas).
 */
export function parseSubjectTypesText(raw: string): ParseResult<string[]> {
    return parseStringListText(raw, ['subjectTypes'], 'No subject types found in the file.');
}

/** Parse a JSON array / `{ agencies }` / `{ aidingAgencies }` object, or CSV/text. */
export function parseAidingAgenciesText(raw: string): ParseResult<string[]> {
    return parseStringListText(
        raw,
        ['agencies', 'aidingAgencies'],
        'No agencies found in the file.',
    );
}

/** Enum options including a placeholder and a saved value that is no longer in the list. */
export function subjectTypeEnumOptions(types: string[], current = ''): string[] {
    const options = [...types];
    if (current && !options.includes(current)) options.push(current);
    return [SUBJECT_TYPE_PLACEHOLDER, ...options];
}
