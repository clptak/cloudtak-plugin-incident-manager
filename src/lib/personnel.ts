/** Custom personnel roster (Settings) using the D4H member fields this plugin reads. */

import type { D4HMember } from './d4hTypes.ts';
import type { ParseResult } from './subjectTypes.ts';

export const MAX_PERSONNEL = 500;

const OPTIONAL_FIELDS = ['ref', 'position', 'callsign', 'email'] as const;

function optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}

function parseMemberId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value.trim());
        if (Number.isInteger(n)) return n;
    }
    return undefined;
}

export function parsePersonnelMember(raw: unknown, index: number): ParseResult<D4HMember> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: `Row ${index + 1} is not an object.` };
    }
    const rec = raw as Record<string, unknown>;
    const id = parseMemberId(rec.id);
    if (id === undefined) {
        return { ok: false, error: `Row ${index + 1} is missing a numeric id.` };
    }
    if (typeof rec.name !== 'string' || !rec.name.trim()) {
        return { ok: false, error: `Row ${index + 1} is missing a name.` };
    }
    const member: D4HMember = {
        id,
        name: rec.name.trim(),
    };
    for (const field of OPTIONAL_FIELDS) {
        const value = optionalString(rec[field]);
        if (value) member[field] = value;
    }
    return { ok: true, value: member };
}

/** Keep first spelling of each id and cap length. */
export function normalizePersonnel(members: D4HMember[]): D4HMember[] {
    const seen = new Set<number>();
    const out: D4HMember[] = [];
    for (const member of members) {
        if (seen.has(member.id)) continue;
        seen.add(member.id);
        out.push(member);
        if (out.length >= MAX_PERSONNEL) break;
    }
    return out;
}

/** Incoming rows replace matching ids, then append new ids. */
export function mergePersonnelById(existing: D4HMember[], incoming: D4HMember[]): D4HMember[] {
    const byId = new Map<number, D4HMember>();
    for (const member of existing) byId.set(member.id, member);
    for (const member of incoming) byId.set(member.id, member);
    return normalizePersonnel([...byId.values()]);
}

export function parsePersonnelList(raw: unknown): ParseResult<D4HMember[]> {
    if (!Array.isArray(raw)) {
        return { ok: false, error: 'Personnel must be an array of members.' };
    }
    const members: D4HMember[] = [];
    for (let i = 0; i < raw.length; i++) {
        const parsed = parsePersonnelMember(raw[i], i);
        if (!parsed.ok) return parsed;
        members.push(parsed.value);
    }
    const normalized = normalizePersonnel(members);
    if (!normalized.length) {
        return { ok: false, error: 'No personnel found in the file.' };
    }
    return { ok: true, value: normalized };
}

function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}

function parsePersonnelCsv(text: string): ParseResult<D4HMember[]> {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
        return { ok: false, error: 'CSV must include a header row and at least one member.' };
    }
    const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
    const idIdx = headers.indexOf('id');
    const nameIdx = headers.indexOf('name');
    if (idIdx < 0 || nameIdx < 0) {
        return { ok: false, error: 'CSV header must include id and name columns.' };
    }
    const col = (name: string) => headers.indexOf(name);
    const refIdx = col('ref');
    const positionIdx = col('position');
    const callsignIdx = col('callsign');
    const emailIdx = col('email');

    const rows: unknown[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        const rec: Record<string, string> = {
            id: cells[idIdx] ?? '',
            name: cells[nameIdx] ?? '',
        };
        if (refIdx >= 0) rec.ref = cells[refIdx] ?? '';
        if (positionIdx >= 0) rec.position = cells[positionIdx] ?? '';
        if (callsignIdx >= 0) rec.callsign = cells[callsignIdx] ?? '';
        if (emailIdx >= 0) rec.email = cells[emailIdx] ?? '';
        rows.push(rec);
    }
    return parsePersonnelList(rows);
}

function membersFromJson(parsed: unknown): ParseResult<unknown> {
    if (Array.isArray(parsed)) return { ok: true, value: parsed };
    if (parsed && typeof parsed === 'object') {
        const rec = parsed as Record<string, unknown>;
        if (Array.isArray(rec.members)) return { ok: true, value: rec.members };
        if (Array.isArray(rec.personnel)) return { ok: true, value: rec.personnel };
        return { ok: false, error: 'JSON object must include a "members" or "personnel" array.' };
    }
    return { ok: false, error: 'JSON must be an array of members or a D4H roster object.' };
}

export function parsePersonnelText(raw: string): ParseResult<D4HMember[]> {
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
        const extracted = membersFromJson(parsed);
        if (!extracted.ok) return extracted;
        return parsePersonnelList(extracted.value);
    }
    return parsePersonnelCsv(text);
}

export function selectEffectiveMembers(
    useD4h: boolean,
    kvMembers: D4HMember[] | undefined | null,
    settingsMembers: D4HMember[],
): D4HMember[] {
    if (useD4h) return kvMembers ?? [];
    return settingsMembers;
}
