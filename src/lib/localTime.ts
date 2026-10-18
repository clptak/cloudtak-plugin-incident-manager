const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateString(d: Date = new Date()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * ISO / datetime-local string as local "YYYY-MM-DD HH:MM".
 * Date-only or unparseable input is returned unchanged.
 */
export function localDateTimeLabel(raw?: string): string {
    const s = (raw || '').trim();
    if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return s;
    const d = new Date(ms);
    return `${localDateString(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
