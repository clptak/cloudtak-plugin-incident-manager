import KV from '../../../../src/base/kv.ts';
import type { D4HRoster, D4HRosterMeta, D4HMember } from './d4hTypes.ts';

export const D4H_ROSTER_KEY = 'd4h:roster';
export const D4H_META_KEY = 'd4h:meta';

export async function loadD4hRoster(): Promise<D4HRoster | null> {
    const raw = await KV.value(D4H_ROSTER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as D4HRoster;
    } catch {
        return null;
    }
}

export async function loadD4hMeta(): Promise<D4HRosterMeta | null> {
    const raw = await KV.value(D4H_META_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as D4HRosterMeta;
    } catch {
        return null;
    }
}

export function formatD4hSyncTime(iso?: string): string {
    if (!iso) return '';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return iso;
    return new Date(ms).toLocaleString();
}

/** Ascending sort for D4H badge/ref (numeric when possible, else A→Z; blank refs last). */
export function compareD4hRefAsc(a?: string, b?: string): number {
    const ar = String(a ?? '').trim();
    const br = String(b ?? '').trim();
    if (!ar && !br) return 0;
    if (!ar) return 1;
    if (!br) return -1;

    const an = Number(ar);
    const bn = Number(br);
    const aNum = !Number.isNaN(an);
    const bNum = !Number.isNaN(bn);
    if (aNum && bNum) return an - bn;
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return ar.localeCompare(br, undefined, { sensitivity: 'base' });
}

export function memberMatchesPaletteFilter(m: D4HMember, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [m.name, m.ref, m.position, m.callsign, m.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

export function sortMembersByRefAsc(members: D4HMember[]): D4HMember[] {
    return [...members].sort((a, b) => compareD4hRefAsc(a.ref, b.ref));
}

export function filterAndSortPaletteMembers(
    members: D4HMember[],
    query: string,
): D4HMember[] {
    return sortMembersByRefAsc(members.filter((m) => memberMatchesPaletteFilter(m, query)));
}
