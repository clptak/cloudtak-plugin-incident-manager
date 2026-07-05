import KV from '../../../../src/base/kv.ts';
import type { D4HRoster, D4HRosterMeta } from './d4hTypes.ts';

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
