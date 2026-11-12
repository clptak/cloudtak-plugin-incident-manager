/**
 * Resources & Assignments board (#6): which resource cards show for the OP
 * picked at the top, in what order, what work sits under each card, and the
 * summary line. Initial Response (opNumber null/0) carries work assignments
 * on map objects; an OP carries segment assignments from Operational Periods.
 */

import type { DebriefRecord, OpAssignment } from '../domain/entities.ts';
import { debriefsForAssignment } from '../domain/debrief.ts';
import {
    isActiveResource,
    type ResourceAssignment,
    type ResourceAssignmentStatus,
} from './resourceAssignments.ts';
import type { WorkAssignment } from './workAssignments.ts';

/** null = Initial Response. */
export type BoardOp = number | null;

export function opOfResource(r: ResourceAssignment): BoardOp {
    return Number.isInteger(r.opNumber) && (r.opNumber as number) > 0 ? r.opNumber as number : null;
}

const STATUS_ORDER: Record<ResourceAssignmentStatus, number> = {
    have: 0, requested: 1, need: 2, demobilized: 3, cancelled: 4,
};

export interface BoardResources {
    /** Have, then Requested, then Need; by identifier within each. */
    active: ResourceAssignment[];
    /** Demobilized and cancelled, folded away at the bottom. */
    inactive: ResourceAssignment[];
}

export function boardResources(resources: ResourceAssignment[], op: BoardOp): BoardResources {
    const mine = resources
        .filter((r) => opOfResource(r) === op)
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
            || a.resourceIdentifier.localeCompare(b.resourceIdentifier, undefined, { numeric: true }));
    return { active: mine.filter(isActiveResource), inactive: mine.filter((r) => !isActiveResource(r)) };
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

// ── Initial Response: work assignments on map objects ───────────────────────

export function workFor(resource: ResourceAssignment, work: WorkAssignment[]): WorkAssignment[] {
    return work
        .filter((w) => w.teamResourceAssignmentId === resource.id)
        .sort((a, b) => a.assignmentNumber - b.assignmentNumber);
}

/** Work whose team was deleted, or is a resource tagged to an OP. */
export function orphanWork(resources: ResourceAssignment[], work: WorkAssignment[]): WorkAssignment[] {
    const ir = new Set(resources.filter((r) => opOfResource(r) === null).map((r) => r.id));
    return work
        .filter((w) => !ir.has(w.teamResourceAssignmentId))
        .sort((a, b) => a.assignmentNumber - b.assignmentNumber);
}

export function workRunning(w: WorkAssignment): boolean {
    return Boolean(w.started.trim()) && !w.completed.trim();
}

export function nextAssignmentNumber(work: WorkAssignment[]): number {
    return work.length ? Math.max(...work.map((w) => w.assignmentNumber)) + 1 : 1;
}

// ── Operational periods: segment assignments and their debriefs ─────────────

export interface OpWork {
    assignment: OpAssignment;
    debriefs: DebriefRecord[];
}

function opWork(assignments: OpAssignment[], debriefs: DebriefRecord[]): OpWork[] {
    return assignments
        .map((a) => ({ assignment: a, debriefs: debriefsForAssignment(a, debriefs) }))
        .sort((x, y) => x.assignment.label.localeCompare(y.assignment.label, undefined, { numeric: true }));
}

export function opWorkFor(
    resource: ResourceAssignment,
    op: number,
    assignments: OpAssignment[],
    debriefs: DebriefRecord[],
): OpWork[] {
    const team = norm(resource.resourceIdentifier);
    return opWork(assignments.filter((a) => a.opNumber === op && team && norm(a.team) === team), debriefs);
}

/** This OP's assignments with no team, or a team that isn't a resource on this OP. */
export function orphanOpWork(
    resources: ResourceAssignment[],
    op: number,
    assignments: OpAssignment[],
    debriefs: DebriefRecord[],
): OpWork[] {
    const teams = new Set(resources.filter((r) => opOfResource(r) === op).map((r) => norm(r.resourceIdentifier)));
    return opWork(assignments.filter((a) => a.opNumber === op && !teams.has(norm(a.team))), debriefs);
}

// ── Summary line ───────────────────────────────────────────────────────────

export interface BoardSummary {
    need: number;
    requested: number;
    have: number;
    demobilized: number;
    /** Initial Response: started, not completed. An OP: assigned, not yet debriefed. */
    running: number;
}

export function boardSummary(
    resources: ResourceAssignment[],
    op: BoardOp,
    work: WorkAssignment[],
    opAssignments: OpAssignment[],
    debriefs: DebriefRecord[],
): BoardSummary {
    const mine = resources.filter((r) => opOfResource(r) === op);
    const count = (s: ResourceAssignmentStatus) => mine.filter((r) => r.status === s).length;
    const running = op === null
        ? work.filter(workRunning).length
        : opAssignments.filter((a) => a.opNumber === op && !debriefsForAssignment(a, debriefs).length).length;
    return {
        need: count('need'),
        requested: count('requested'),
        have: count('have'),
        demobilized: count('demobilized'),
        running,
    };
}

/** Editable fields of an Initial Response work assignment on the board. */
export interface WorkDraft {
    assignmentNumber: number;
    teamResourceAssignmentId: string;
    assignmentUid: string;
    instructions: string;
    started: string;
    completed: string;
}

export function shortLocalTime(local: string): string {
    const d = new Date(local);
    if (!local.trim() || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Free resources and the board filter ───────────────────────────────────

/**
 * A Have resource with no open work: under Initial Response no assignment
 * still to complete; under an OP no segment assignment still to debrief.
 */
export function isFreeResource(
    resource: ResourceAssignment,
    op: BoardOp,
    work: WorkAssignment[],
    opAssignments: OpAssignment[],
    debriefs: DebriefRecord[],
): boolean {
    if (resource.status !== 'have') return false;
    if (op === null) return !workFor(resource, work).some((w) => !w.completed.trim());
    return !opWorkFor(resource, op, opAssignments, debriefs).some((x) => !x.debriefs.length);
}

/**
 * Board search: every word must appear in the resource's identifier, type or
 * agency, or in the text of its work (map object, segment, instructions).
 */
export function matchesBoardSearch(resource: ResourceAssignment, query: string, workText: string[] = []): boolean {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = [resource.resourceIdentifier, resource.resource, resource.agency, ...workText].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
}
