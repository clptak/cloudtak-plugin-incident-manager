/**
 * Normalize a person name for comma-separated export lists.
 * Converts "Last, First" (D4H style) to "First Last" so commas only separate people.
 */
export function formatPersonNameFirstLast(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    const commaIdx = trimmed.indexOf(',');
    if (commaIdx < 0) return trimmed;

    const last = trimmed.slice(0, commaIdx).trim();
    const first = trimmed.slice(commaIdx + 1).trim();
    if (!first) return last;
    if (!last) return first;
    return `${first} ${last}`;
}
