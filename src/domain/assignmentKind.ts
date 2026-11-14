/**
 * OP assignment types (#35). Search assignments work a registered segment and
 * are the only ones the POA/POD math sees; the others can be tasked with a map
 * feature or with none (an investigator's interviews), and still get a 204.
 *
 * Erasable TypeScript only (see entities.ts).
 */

import type { AssignmentKind, OpAssignment } from './entities.ts';

export const ASSIGNMENT_KINDS: { value: AssignmentKind; label: string }[] = [
    { value: 'search', label: 'Search' },
    { value: 'investigation', label: 'Investigation' },
    { value: 'containment', label: 'Containment' },
    { value: 'other', label: 'Other' },
];

export function isAssignmentKind(value: unknown): value is AssignmentKind {
    return ASSIGNMENT_KINDS.some((k) => k.value === value);
}

/** The assignment's type; records saved before #35 are search assignments. */
export function assignmentKind(a: Pick<OpAssignment, 'kind'>): AssignmentKind {
    return a.kind ?? 'search';
}

export function assignmentKindLabel(kind: AssignmentKind): string {
    return ASSIGNMENT_KINDS.find((k) => k.value === kind)?.label ?? 'Other';
}

/** Tied to something on the map: a segment or a map feature. */
export function hasMapObject(a: Pick<OpAssignment, 'segmentUid'>): boolean {
    return Boolean(a.segmentUid.trim());
}

/**
 * Can be debriefed with the completed-assignment form, which records against
 * a segment or feature. Work with no map object has nothing to record on.
 */
export function isDebriefable(a: Pick<OpAssignment, 'segmentUid'>): boolean {
    return hasMapObject(a);
}

/** Feeds the search math: a search assignment on a segment. */
export function countsInSearchMath(a: Pick<OpAssignment, 'kind' | 'segmentUid'>): boolean {
    return assignmentKind(a) === 'search' && hasMapObject(a);
}

/** The ICS 204 Work Assignment line seeded for a new plan. */
export function workAssignmentText(a: Pick<OpAssignment, 'kind' | 'segmentUid' | 'label' | 'notes'>): string {
    const kind = assignmentKind(a);
    const notes = a.notes?.trim() ?? '';
    if (kind === 'search') return [`Search segment ${a.label}.`, notes].filter(Boolean).join(' ');
    const what = kind === 'other' ? a.label : `${assignmentKindLabel(kind)}: ${a.label}`;
    // With no map object the label is the work itself; don't repeat it.
    return [what, notes && notes !== a.label ? notes : ''].filter(Boolean).join(' ');
}
