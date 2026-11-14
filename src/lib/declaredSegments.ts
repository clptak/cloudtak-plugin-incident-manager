/**
 * Declared segments (#29): segments named before anyone draws them, so a
 * planning group can run the Initial Consensus off a paper sketch and draw
 * the polygons afterwards.
 *
 * A declared segment is an ordinary entry in schema.segments under a minted
 * uid, flagged `undrawn`. Linking a drawn polygon later pushes that polygon
 * to MGMT under the SAME uid (and removes the original), so the consensus,
 * POA locks and history keep pointing at the right segment and nothing is
 * re-keyed.
 *
 * Until it is drawn a declared segment is for the consensus (and the WC3
 * export) only: it cannot be assigned, debriefed or split by area.
 *
 * Pure: no I/O.
 */

import type { SegmentRecord } from './missionSchema.ts';

export type SegmentRecords = Record<string, SegmentRecord>;

export const UNDRAWN_EXPLAINER = 'A declared segment has a name but no polygon yet. It can be used in the '
    + 'Initial Consensus (and the WC3 export) only. Draw a polygon with the same number and link it in '
    + 'Segmentation before assigning teams to it or splitting it.';

export function isUndrawn(rec: SegmentRecord | undefined): boolean {
    return rec?.undrawn === true;
}

/** Uids of the registered segments that have a polygon (or are not known to lack one). */
export function drawnSegmentUids(segments: SegmentRecords): string[] {
    return Object.keys(segments).filter((uid) => !isUndrawn(segments[uid]));
}

/** "01" and "1" are the same segment number; anything else compares trimmed. */
export function sameSegmentName(a: string, b: string): boolean {
    const x = a.trim();
    const y = b.trim();
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) === Number(y);
    return x === y;
}

/** The next `count` segment numbers after the highest numbered one, e.g. ["4","5"]. */
export function nextSegmentNames(existing: string[], count: number): string[] {
    let max = 0;
    let width = 1;
    for (const name of existing) {
        const m = /^(\d+)$/.exec(name.trim());
        if (!m) continue;
        const n = Number(m[1]);
        if (n > max) { max = n; width = m[1].length; }
    }
    const out: string[] = [];
    for (let i = 1; i <= Math.max(0, Math.floor(count)); i++) {
        out.push(String(max + i).padStart(width, '0'));
    }
    return out;
}

/**
 * Add declared (undrawn) segments. Names must be whole numbers (ICS
 * convention) and must not repeat each other or an existing segment.
 */
export function declareSegments(
    segments: SegmentRecords,
    names: string[],
    opts: { now?: string; newId?: () => string } = {},
): { segments: SegmentRecords; added: string[] } {
    const now = opts.now ?? new Date().toISOString();
    const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
    const taken = Object.values(segments).map((s) => s.callsign);
    const next: SegmentRecords = { ...segments };
    const added: string[] = [];
    for (const raw of names) {
        const name = raw.trim();
        if (!/^\d+$/.test(name)) throw new Error(`Segment names are whole numbers: "${raw}" is not.`);
        if (taken.some((t) => sameSegmentName(t, name))) throw new Error(`Segment ${name} already exists.`);
        taken.push(name);
        const uid = newId();
        next[uid] = { callsign: name, created: now, undrawn: true };
        added.push(uid);
    }
    return { segments: next, added };
}

/** The record once its polygon is linked: same name and created time, no flag. */
export function markDrawn(rec: SegmentRecord): SegmentRecord {
    const rest: SegmentRecord = { ...rec };
    delete rest.undrawn;
    return rest;
}

export interface NamedRef {
    uid: string;
    callsign: string;
}

/**
 * Suggested links: each declared segment whose name matches exactly one
 * candidate polygon (and that polygon matches no other declared segment).
 * Returns declared uid → polygon uid.
 */
export function matchPolygonsToDeclared(declared: NamedRef[], polygons: NamedRef[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const seg of declared) {
        const hits = polygons.filter((p) => sameSegmentName(p.callsign, seg.callsign));
        if (hits.length !== 1) continue;
        const poly = hits[0];
        const rivals = declared.filter((d) => sameSegmentName(d.callsign, poly.callsign));
        if (rivals.length === 1) out[seg.uid] = poly.uid;
    }
    return out;
}
