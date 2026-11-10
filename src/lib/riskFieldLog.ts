/**
 * FIELD DataSync Log entry for one risk assessment, posted by the Risk
 * Management tab's "Add to FIELD DataSync Log" button.
 */

export type RiskModel = 'gar' | 'comp' | 'spe';

const MODEL: Record<RiskModel, { title: string; max: number; keyword: string }> = {
    gar: { title: 'GAR risk assessment', max: 80, keyword: 'risk-gar' },
    comp: { title: 'Complacency risk assessment', max: 100, keyword: 'risk-complacency' },
    spe: { title: 'SPE risk assessment', max: 100, keyword: 'risk-spe' },
};

export interface RiskLogRespondent {
    name: string;
    score: number;
    level: string;
    recommendation: string;
}

export function riskFieldLogEntry(
    model: RiskModel,
    tacticLabel: string,
    r: RiskLogRespondent,
): { content: string; keywords: string[] } {
    const m = MODEL[model];
    const tactic = tacticLabel.trim();
    const rec = r.recommendation.trim();
    const content = `${m.title}${tactic ? ` of "${tactic}"` : ''} by ${r.name.trim()}: `
        + `${r.score}/${m.max} ${r.level}.${rec ? ` ${rec}` : ''}`;
    const keywords = ['risk-assessment', m.keyword, `level:${r.level}`, `score:${r.score}`];
    if (tactic) keywords.push(`tactic:${tactic}`);
    return { content, keywords };
}
