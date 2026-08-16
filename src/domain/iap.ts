/**
 * IAP composition rules (pure): which ICS forms make up the Incident Action
 * Plan for a given incident category and operational period.
 *
 * Base SAR set: 202 (objectives), 203 (organization), 204 per assignment,
 * 205 (comms), 208 (safety). 206 (medical) is included once the medical plan
 * has content. Wildland Fire / Disaster add 207 (org chart) and 209 (status
 * summary). Any UAS/drone resource adds the modified 220.
 */

export type IapFormId =
    | 'ics202' | 'ics203' | 'ics204' | 'ics205'
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
}

/** Ordered list of form types included in the IAP. */
export function iapFormPlan(input: IapPlanInput): IapFormId[] {
    const plan: IapFormId[] = ['ics202', 'ics203', 'ics204', 'ics205'];
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
