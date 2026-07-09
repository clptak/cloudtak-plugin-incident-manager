/**
 * MPS / CFS Call Notes "Remarks" parser, ported from a legacy SAR TAK app.
 *
 * Produces timestamped log rows suitable for posting to a CloudTAK mission as
 * mission-log entries. The header/folder/"Save Mission JSON" logic from the
 * original is intentionally omitted (mission folders are out of scope here).
 */

import { parseCadIdentifiers } from './incidentInfo.ts';

export interface MpsRow {
    source: 'CAD';
    missionName: string;
    /** ISO-ish "YYYY-MM-DDTHH:MM:SS" */
    dtg: string;
    /** the (source) tag from the CAD entry */
    uid: string;
    remark: string;
    lat: number | '';
    lon: number | '';
}

export interface MpsParseResult {
    /** @deprecated use activityNumber — kept for callers that read eventId */
    eventId: string | null;
    activityNumber: string | null;
    reportNumber: string | null;
    rows: MpsRow[];
}

export interface MpsParseOptions {
    /** Merge rows whose timestamps fall within this window (transitive). Default 60_000; set 0 to disable. */
    mergeWithinMs?: number;
}

interface ParsedRemarkRow {
    dtg: string;
    uid: string;
    remark: string;
}

const DEFAULT_MERGE_WITHIN_MS = 60_000;

const MPS_EVENT_ID = /A\d{8}/;
const MPS_CALL_CREATED = /Created\s*\n[\d:]+\s+([0-1]\d\/[0-3]\d\/[2-4]\d)/;
const MPS_REMARKS_START = /Remarks\s*\n\s*\n\s*\n?\n?/;
const MPS_SECTION_DIV = /(-{10,})\s*\n{2,}Assigned\s+Units\s*\n/;
const MPS_LOG_ENTRY = /([0-2][0-9]:[0-5][0-9]:[0-5][0-9])\s*\(([^)]*)\):\s*\n([^\n]*)/g;
const LAT_DD = /[2-4]\d\.\d{3,}/;
const LON_DD = /-?1\d{2}\.\d{3,}/;

function getEventId(text: string): string | null {
    const cm = text.match(/Case Numbers\s*\n(.*?)\n/);
    if (cm && cm[1] && cm[1].includes('S2')) return cm[1].trim();
    const em = text.match(MPS_EVENT_ID);
    if (em && em[0] && em[0].startsWith('A2')) return em[0];
    return null;
}

function getRemarksSection(text: string): string {
    const mr = text.match(MPS_REMARKS_START), md = text.match(MPS_SECTION_DIV);
    if (!mr || !md) return '';
    const start = text.indexOf(mr[0]) + mr[0].length;
    const end = text.indexOf(md[0], start);
    return end === -1 ? text.slice(start) : text.slice(start, end);
}

function getRemarksDates(rawRemarks: string, callCreated: string[]): string[] {
    const dates: string[] = [];
    const re = /[\s\n]\n([0-1]\d\/[0-3]\d\/20[1-5]\d)\s/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawRemarks)) !== null) dates.push(m[1].trim());
    if (dates.length === 0 && callCreated && callCreated[0]) dates.push(callCreated[0].trim());
    return dates;
}

function toISODate(d: string): string {
    d = d.trim();
    const p = d.split('/').map(Number);
    if (p.length !== 3) return d;
    const [mo, dy] = p;
    let yr = p[2];
    if (yr < 100) yr += 2000;
    return `${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
}

function splitByDate(str: string, dates: string[]): string[] {
    if (dates.length === 1) return [str.replace(/,/g, ' | ')];
    const re = /[0-1]\d\/[0-3]\d\/20\d{2}/g;
    return str.replace(/,/g, ' | ').split(re).filter((p) => p.trim() && !p.includes('Today'));
}

function parseDtgMs(dtg: string): number {
    const m = dtg.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return Number.NaN;
    return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
    ).getTime();
}

/** Cluster rows within mergeWithinMs (transitive) and combine each cluster into one row. */
export function mergeNearbyRows<T extends ParsedRemarkRow>(
    rows: T[],
    mergeWithinMs: number,
): T[] {
    if (mergeWithinMs <= 0 || rows.length <= 1) return rows;

    const indexed = rows.map((row, index) => ({
        row,
        index,
        ms: parseDtgMs(row.dtg),
    }));
    indexed.sort((a, b) => {
        if (a.ms !== b.ms) return a.ms - b.ms;
        return a.index - b.index;
    });

    const parent = indexed.map((_, i) => i);
    function find(i: number): number {
        if (parent[i] !== i) parent[i] = find(parent[i]);
        return parent[i];
    }
    function unite(a: number, b: number): void {
        parent[find(a)] = find(b);
    }

    for (let i = 0; i < indexed.length; i++) {
        if (Number.isNaN(indexed[i].ms)) continue;
        for (let j = i + 1; j < indexed.length; j++) {
            if (Number.isNaN(indexed[j].ms)) break;
            const delta = indexed[j].ms - indexed[i].ms;
            if (delta > mergeWithinMs) break;
            unite(i, j);
        }
    }

    const groups = new Map<number, typeof indexed>();
    for (let i = 0; i < indexed.length; i++) {
        const root = find(i);
        const list = groups.get(root);
        if (list) list.push(indexed[i]);
        else groups.set(root, [indexed[i]]);
    }

    const merged: T[] = [];
    for (const group of groups.values()) {
        group.sort((a, b) => {
            if (a.ms !== b.ms) return a.ms - b.ms;
            return a.index - b.index;
        });
        if (group.length === 1) {
            merged.push(group[0].row);
            continue;
        }
        const remarks = group.map((g) => g.row.remark).filter((r) => r);
        const uids = [...new Set(group.map((g) => g.row.uid).filter(Boolean))];
        merged.push({
            ...group[0].row,
            dtg: group[0].row.dtg,
            uid: uids.join(', '),
            remark: remarks.join(' | '),
        });
    }

    merged.sort((a, b) => parseDtgMs(a.dtg) - parseDtgMs(b.dtg));
    return merged;
}

function parseLogBlock(block: string, dateStr: string): ParsedRemarkRow[] {
    const rows: ParsedRemarkRow[] = [];
    let m: RegExpExecArray | null;
    MPS_LOG_ENTRY.lastIndex = 0;
    while ((m = MPS_LOG_ENTRY.exec(block)) !== null) {
        const time = m[1].trim();
        const source = m[2].replace(/^\(|\):\s*$/g, '').replace(/\n/g, '').trim();
        const desc = m[3].replace(/^:\s*/, '').replace(/\n/g, ' ').trim();
        rows.push({ dtg: dateStr + 'T' + time, uid: source, remark: desc });
    }
    return rows;
}

function annotateRemarks(
    rows: ParsedRemarkRow[],
    eventId: string | null
): MpsRow[] {
    return rows.map((r) => {
        let lat: number | '' = '', lon: number | '' = '';
        const msg = r.remark || '';
        const lm = msg.match(LAT_DD), nm = msg.match(LON_DD);
        if (lm && nm) {
            lat = parseFloat(lm[0]);
            lon = parseFloat(nm[0]);
            if (lon > 0) lon = -lon;
        } else if (lm) {
            lat = parseFloat(lm[0]);
        } else if (nm) {
            lon = parseFloat(nm[0]);
            if (lon > 0) lon = -lon;
        }
        return {
            source: 'CAD',
            missionName: eventId || '',
            dtg: r.dtg,
            uid: r.uid,
            remark: r.remark,
            lat,
            lon,
        };
    });
}

export function getMpsRows(cadText: string, options?: MpsParseOptions): MpsParseResult {
    const mergeWithinMs = options?.mergeWithinMs ?? DEFAULT_MERGE_WITHIN_MS;
    const cadIds = parseCadIdentifiers(cadText);
    const eventId = cadIds.activityNumber ?? getEventId(cadText);
    const rawRemarks = getRemarksSection(cadText);
    if (!rawRemarks) {
        return {
            eventId,
            activityNumber: cadIds.activityNumber,
            reportNumber: cadIds.reportNumber,
            rows: [],
        };
    }

    const callCreated = cadText.match(MPS_CALL_CREATED);
    const dates = getRemarksDates(rawRemarks, callCreated ? [callCreated[1]] : []);
    const blocks = splitByDate(rawRemarks, dates);
    const isoDates = dates.map(toISODate);

    const allRows: ParsedRemarkRow[] = [];
    for (let i = 0; i < isoDates.length && i < blocks.length; i++) {
        parseLogBlock(blocks[i], isoDates[i]).forEach((r) => allRows.push(r));
    }
    const mergedRows = mergeNearbyRows(allRows, mergeWithinMs);
    return {
        eventId,
        activityNumber: cadIds.activityNumber,
        reportNumber: cadIds.reportNumber,
        rows: annotateRemarks(mergedRows, eventId),
    };
}
