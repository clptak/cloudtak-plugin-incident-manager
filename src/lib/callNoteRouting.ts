/**
 * Per-entry DataSync routing for parsed CFS / call notes (#16).
 * Each entry goes to FIELD, MGMT, or nowhere; clicking the chosen
 * destination again clears it. Entries whose wording is already logged on a
 * DataSync are flagged so they aren't posted twice.
 *
 * Pure: no CloudTAK host imports.
 */

import type { MpsRow } from './mpsParser.ts';

export type CallNoteDest = 'field' | 'mgmt' | null;

/** The log text posted for a parsed row. */
export function callNoteContent(r: Pick<MpsRow, 'remark' | 'lat' | 'lon'>): string {
    const coords = (r.lat !== '' && r.lon !== '') ? ` [${r.lat}, ${r.lon}]` : '';
    return `${r.remark}${coords}`;
}

/** Choose a destination, or clear it when it is already chosen. */
export function toggleDest(current: CallNoteDest, picked: 'field' | 'mgmt'): CallNoteDest {
    return current === picked ? null : picked;
}

function norm(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface CallNoteDuplicate {
    field: boolean;
    mgmt: boolean;
}

/** Which DataSyncs already hold an identically worded entry, per row. */
export function callNoteDuplicates(
    rows: Pick<MpsRow, 'remark' | 'lat' | 'lon'>[],
    existing: { field: string[]; mgmt: string[] },
): CallNoteDuplicate[] {
    const field = new Set(existing.field.map(norm));
    const mgmt = new Set(existing.mgmt.map(norm));
    return rows.map((r) => {
        const text = norm(callNoteContent(r));
        return { field: field.has(text), mgmt: mgmt.has(text) };
    });
}
