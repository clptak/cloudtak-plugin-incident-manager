/**
 * Pure LPB table helpers — quartile options, folder names, display formatting.
 * No CloudTAK host imports (safe for unit tests).
 */

import type { AzlpbEntry } from './pluginSettings.ts';

export const LPB_SOURCE = 'AZ';

export const LPB_RING_STYLE = {
    stroke: '#ff0000',
    fillOpacity: 0,
    strokeWidth: 2,
    strokeStyle: 'dashed' as const,
};

export type LpbQuartileId = 'A' | 'B' | 'C' | 'D';

export interface LpbQuartileOption {
    id: LpbQuartileId;
    label: string;
    meters: number;
    selected: boolean;
}

const QUARTILES: Array<{
    id: LpbQuartileId;
    labelKey: 'qAlabel' | 'qBlabel' | 'qClabel' | 'qDlabel';
    metersKey: 'qAme' | 'qBme' | 'qCme' | 'qDme';
    milesKey: 'qAmi' | 'qBmi' | 'qCmi' | 'qDmi';
    pct: string;
    defaultSelected: boolean;
}> = [
    { id: 'A', labelKey: 'qAlabel', metersKey: 'qAme', milesKey: 'qAmi', pct: '25%', defaultSelected: true },
    { id: 'B', labelKey: 'qBlabel', metersKey: 'qBme', milesKey: 'qBmi', pct: '50%', defaultSelected: true },
    { id: 'C', labelKey: 'qClabel', metersKey: 'qCme', milesKey: 'qCmi', pct: '75%', defaultSelected: false },
    { id: 'D', labelKey: 'qDlabel', metersKey: 'qDme', milesKey: 'qDmi', pct: '90%', defaultSelected: false },
];

function finiteNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function labelOrFallback(value: unknown, pct: string, miles: number): string {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return `${pct} - ${miles}mi`;
}

/** Checkbox rows for the Add to Map modal (25%/50% selected by default). */
export function lpbQuartileOptions(row: AzlpbEntry): LpbQuartileOption[] {
    return QUARTILES.map((q) => {
        const miles = finiteNumber(row[q.milesKey]);
        return {
            id: q.id,
            label: labelOrFallback(row[q.labelKey], q.pct, miles),
            meters: finiteNumber(row[q.metersKey]),
            selected: q.defaultSelected,
        };
    });
}

export function lpbFolderName(category: string, source = LPB_SOURCE): string {
    return `LPB ${category} - ${source}`;
}

/** Next free folder name: base, base (2), base (3), … */
export function uniqueLpbFolderName(base: string, taken: Iterable<string>): string {
    const names = taken instanceof Set ? taken : new Set(taken);
    if (!names.has(base)) return base;
    let n = 2;
    while (names.has(`${base} (${n})`)) n += 1;
    return `${base} (${n})`;
}

export function formatLpbMiles(value: unknown): string {
    return finiteNumber(value).toFixed(2);
}

export function formatLpbCases(value: unknown): string {
    return String(Math.round(finiteNumber(value)));
}

export function filterLpbRows(rows: readonly AzlpbEntry[], query: string): AzlpbEntry[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [...rows];
    return rows.filter((row) => row.category.toLowerCase().includes(needle));
}
