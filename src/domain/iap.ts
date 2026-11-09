/**
 * IAP composition rules (pure): which ICS forms make up the Incident Action
 * Plan for a given incident category and operational period.
 *
 * Base SAR set: 202 (objectives), 203 (organization), 204 per assignment,
 * 205 (comms), 208 (safety). 205A (comms list) is included when it has rows;
 * 206 (medical) is included once the medical plan has content. Wildland Fire / Disaster add 207 (org chart) and 209 (status
 * summary). Any UAS/drone resource adds the modified 220.
 */

export type IapFormId =
    | 'ics202' | 'ics203' | 'ics204' | 'ics205' | 'ics205a'
    | 'ics206' | 'ics207' | 'ics208' | 'ics209' | 'ics220';

export type IncidentCategory = 'search' | 'rescue' | 'recovery' | 'evidence'
    | 'wildland-fire' | 'disaster' | 'other' | string;

/** Categories that brief from the extended ICS set. */
export function usesExtendedIcsSet(category: IncidentCategory): boolean {
    return category === 'wildland-fire' || category === 'disaster';
}

export interface IapPlanInput {
    category: IncidentCategory;
    /** Any drone/UAS resource assigned to this operational period. */
    hasUas: boolean;
    /** Medical plan filled in — ICS-206 is only included when it has content. */
    hasMedical?: boolean;
    /** Communications list (ICS-205A) explicitly included. */
    hasCommsList?: boolean;
}

/** Ordered list of form types included in the IAP. */
export function iapFormPlan(input: IapPlanInput): IapFormId[] {
    const plan: IapFormId[] = ['ics202', 'ics203', 'ics204', 'ics205'];
    if (input.hasCommsList) plan.push('ics205a');
    if (input.hasMedical) plan.push('ics206');
    if (usesExtendedIcsSet(input.category)) plan.push('ics207');
    plan.push('ics208');
    if (usesExtendedIcsSet(input.category)) plan.push('ics209');
    if (input.hasUas) plan.push('ics220');
    return plan;
}

const UAS_KEYWORDS = ['drone', 'uas', 'uav'];

/** True when a resource label denotes an unmanned aircraft. */
export function isUasLabel(...labels: (string | undefined)[]): boolean {
    const hay = labels.filter(Boolean).join(' ').toLowerCase();
    return UAS_KEYWORDS.some((k) => hay.includes(k));
}

/** Assignments merged per segment, in first-seen order, with every team and note. */
export function groupBySegment<T extends { segmentUid: string; team?: string; notes?: string }>(
    list: T[],
): Array<{ a: T; teams: string[]; notes: string[] }> {
    const groups = new Map<string, { a: T; teams: string[]; pairs: Array<[string, string]> }>();
    for (const a of list) {
        const g = groups.get(a.segmentUid) ?? { a, teams: [], pairs: [] };
        const team = a.team?.trim() ?? '';
        if (team && !g.teams.includes(team)) g.teams.push(team);
        const note = a.notes?.trim();
        if (note) g.pairs.push([team, note]);
        groups.set(a.segmentUid, g);
    }
    // Label each note with its team once more than one team shares the segment.
    return [...groups.values()].map(({ a, teams, pairs }) => ({
        a,
        teams,
        notes: pairs.map(([team, note]) => (teams.length > 1 && team ? `${team}: ${note}` : note)),
    }));
}
