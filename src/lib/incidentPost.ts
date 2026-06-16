/** ICS 234-CG Work Analysis Matrix — shared types, caps, and formatters. */

export const MAX_OBJECTIVES = 8;
export const MAX_STRATEGIES_PER_OBJECTIVE = 5;
export const MAX_TACTICS_PER_STRATEGY = 5;

export const DEFAULT_OBJECTIVE = 'Provide for safety of incident personnel and public';

export const POST_KEYWORDS = ['incident-post', 'risk-assessment'] as const;

export function hasPostKeyword(keywords: string[]): boolean {
    return keywords.some((k) => (POST_KEYWORDS as readonly string[]).includes(k));
}

export interface TacticCell {
    text: string;
    id?: string;
}

export interface StrategyCell {
    text: string;
    id?: string;
    tactics: TacticCell[];
}

export interface ObjectiveRow {
    objective: string;
    objectiveId?: string;
    strategies: StrategyCell[];
    legacy: boolean;
}

export interface SavedObjectiveRow {
    row: number;
    objective: string;
    strategies: StrategyCell[];
    legacy: boolean;
}

export function blankTactic(): TacticCell {
    return { text: '' };
}

export function blankStrategy(): StrategyCell {
    return { text: '', tactics: [blankTactic()] };
}

export function blankObjectiveRows(): ObjectiveRow[] {
    const rows: ObjectiveRow[] = Array.from({ length: MAX_OBJECTIVES }, (): ObjectiveRow => ({
        objective: '',
        strategies: [blankStrategy()],
        legacy: false,
    }));
    rows[0].objective = DEFAULT_OBJECTIVE;
    return rows;
}

export function objectiveKeyword(obj: number): string {
    return `objective:${obj}`;
}

export function strategyKeyword(obj: number, strat: number): string {
    return `strategy:${obj}-${strat}`;
}

export function tacticKeyword(obj: number, strat: number, tac: number): string {
    return `tactic:${obj}-${strat}-${tac}`;
}

export function formatNumberedList(entries: string[]): string {
    const items = entries.map((entry) => entry.trim()).filter(Boolean);
    if (items.length === 0) return '\u2014';
    return items.map((entry, index) => `${index + 1}. ${entry}`).join('; ');
}

export function formatStrategiesForDisplay(strategies: StrategyCell[]): string {
    return formatNumberedList(strategies.map((s) => s.text));
}

/** One numbered strategy per line for ICS 234 PDF column 5. */
export function formatStrategiesForPdf(strategies: StrategyCell[]): string {
    const lines: string[] = [];
    for (let i = 0; i < strategies.length; i++) {
        const text = strategies[i].text.trim();
        if (text) lines.push(`${i + 1}. ${text}`);
    }
    return lines.join('\n');
}

/** One tactic per line (strategy.tactic prefix) for ICS 234 PDF column 6. */
export function formatTacticsForPdf(strategies: StrategyCell[]): string {
    const lines: string[] = [];
    for (let si = 0; si < strategies.length; si++) {
        for (let ti = 0; ti < strategies[si].tactics.length; ti++) {
            const text = strategies[si].tactics[ti].text.trim();
            if (text) lines.push(`${si + 1}.${ti + 1} ${text}`);
        }
    }
    return lines.join('\n');
}

/** Tactics grouped by parent strategy for the running-list table. */
export function formatTacticsForDisplay(strategies: StrategyCell[]): string {
    const parts: string[] = [];
    for (let si = 0; si < strategies.length; si++) {
        const strategyText = strategies[si].text.trim();
        const tacticTexts = strategies[si].tactics.map((t) => t.text);
        const tacticList = formatNumberedList(tacticTexts);
        if (tacticList === '\u2014') {
            if (strategyText) parts.push(`${si + 1}. (no tactics)`);
            continue;
        }
        const prefix = strategyText ? `${si + 1}. ${strategyText}: ` : `${si + 1}. `;
        parts.push(`${prefix}${tacticList}`);
    }
    return parts.length > 0 ? parts.join('\n') : '\u2014';
}

export function rowHasContent(row: ObjectiveRow): boolean {
    if (row.objective.trim()) return true;
    for (const strategy of row.strategies) {
        if (strategy.text.trim()) return true;
        for (const tactic of strategy.tactics) {
            if (tactic.text.trim()) return true;
        }
    }
    return false;
}

export function ensureStrategy(row: ObjectiveRow, stratIndex: number): StrategyCell {
    while (row.strategies.length <= stratIndex) {
        row.strategies.push(blankStrategy());
    }
    return row.strategies[stratIndex];
}

export function ensureTactic(strategy: StrategyCell, tacIndex: number): TacticCell {
    while (strategy.tactics.length <= tacIndex) {
        strategy.tactics.push(blankTactic());
    }
    return strategy.tactics[tacIndex];
}

export function stripObjectiveContent(content: string): string {
    return content.replace(/^Objective\s+\d+:\s*/, '').trim();
}

export function stripStrategyContent(content: string): string {
    return content.replace(/^Strategy\s+\d+(?:\.\d+)?:\s*/, '').trim();
}

export function stripTacticContent(content: string): string {
    return content.replace(/^Tactic\s+\d+(?:\.\d+){1,2}:\s*/, '').trim();
}

export function countEmptySavedCells(row: ObjectiveRow): number {
    let n = 0;
    if (!row.objective.trim() && row.objectiveId) n++;
    for (const strategy of row.strategies) {
        if (!strategy.text.trim() && strategy.id) n++;
        for (const tactic of strategy.tactics) {
            if (!tactic.text.trim() && tactic.id) n++;
        }
    }
    return n;
}

export function rowHasSavedData(row: ObjectiveRow): boolean {
    if (row.objectiveId) return true;
    for (const strategy of row.strategies) {
        if (strategy.id) return true;
        for (const tactic of strategy.tactics) {
            if (tactic.id) return true;
        }
    }
    return false;
}
