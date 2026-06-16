/** Helpers for ICS 234-CG datetime-local inputs and PDF text fields. */

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** Value for `<input type="datetime-local">`. */
export function toDatetimeLocalValue(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function todayDatetimeLocal(hours: number, minutes = 0): string {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return toDatetimeLocalValue(d);
}

export function nowDatetimeLocal(): string {
    return toDatetimeLocalValue(new Date());
}

/** ICS 234 PDF fields use MM/DD/YYYY HHmm (24-hour, no colon). */
export function formatDatetimeForPdf(local: string): string {
    if (!local.trim()) return '';
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return local.trim();
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()} ${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

export function defaultIcs234DatetimeFields(): {
    operationalPeriodFrom: string;
    operationalPeriodTo: string;
    preparedByDateTime: string;
} {
    return {
        operationalPeriodFrom: todayDatetimeLocal(6, 0),
        operationalPeriodTo: todayDatetimeLocal(18, 0),
        preparedByDateTime: nowDatetimeLocal(),
    };
}
