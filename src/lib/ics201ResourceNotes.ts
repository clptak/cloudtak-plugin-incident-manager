/**
 * ICS 201 Resource Summary notes (#38): pre-filled from the resource's
 * assignments (with their instructions and status) and the resource status,
 * and still editable. The agency is left off.
 *
 * Notes the user has not touched follow the board when the form is
 * reloaded or refreshed; notes they edited are kept. A row remembers the
 * text it was filled with (`autoNotes`) to tell the two apart. Forms saved
 * before that existed are recognised by the old agency-first text.
 *
 * Pure: no I/O.
 */

import { resourceStatusLabel, type ResourceAssignment } from './resourceAssignments.ts';
import { workAssignmentState, workAssignmentTitle, type WorkAssignment } from './workAssignments.ts';

export interface NotesRow {
    identifier: string;
    notes: string;
    autoNotes?: string;
}

/** "11/15 08:39" from a datetime-local / ISO value; '' when unreadable. */
export function shortStamp(value: string): string {
    const ms = Date.parse(value.trim());
    if (!value.trim() || Number.isNaN(ms)) return '';
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Where one work assignment stands, with its time. */
export function workStatusText(w: Pick<WorkAssignment, 'started' | 'completed'>): string {
    const state = workAssignmentState(w);
    if (state === 'completed') return ['Completed', shortStamp(w.completed)].filter(Boolean).join(' ');
    if (state === 'started') return ['In progress since', shortStamp(w.started)].filter(Boolean).join(' ');
    return 'Not started';
}

function workFor(a: ResourceAssignment, work: WorkAssignment[]): WorkAssignment[] {
    return work
        .filter((w) => w.teamResourceAssignmentId === a.id)
        .sort((x, y) => x.assignmentNumber - y.assignmentNumber);
}

/**
 * One assignment for the notes: number, map object, instructions and where
 * it stands, e.g. "#4 02 - Go looking over there. (Completed 11/15 08:39)".
 * Work with no map object is named by its instructions, so they show once.
 */
export function workNoteText(w: WorkAssignment): string {
    const map = w.assignmentCallsign.trim();
    const instructions = w.instructions.trim();
    const what = map && instructions ? `${map} - ${instructions}` : workAssignmentTitle(w);
    return `#${w.assignmentNumber} ${what} (${workStatusText(w)})`.replace(/\s+/g, ' ');
}

/** The pre-filled notes: assignments with instructions and status, then the resource status. */
export function resourceNotes(a: ResourceAssignment, work: WorkAssignment[]): string {
    const tasks = workFor(a, work).map(workNoteText);
    return [
        tasks.length
            ? tasks.join('; ')
            : a.assignmentCallsign?.trim() ? `Assignment: ${a.assignmentCallsign.trim()}` : '',
        a.status !== 'have' ? `Status: ${resourceStatusLabel(a.status)}` : '',
    ].filter(Boolean).join('; ');
}

/** What the notes were pre-filled with before #38, to spot untouched old forms. */
export function legacyResourceNotes(a: ResourceAssignment, work: WorkAssignment[]): string {
    const tasks = work
        .filter((w) => w.teamResourceAssignmentId === a.id)
        .map((w) => `#${w.assignmentNumber} ${workAssignmentTitle(w)}`.trim());
    return [
        a.agency.trim(),
        a.status !== 'have' ? `Status: ${resourceStatusLabel(a.status)}` : '',
        tasks.length
            ? `Assignment: ${tasks.join(', ')}`
            : a.assignmentCallsign?.trim() ? `Assignment: ${a.assignmentCallsign.trim()}` : '',
    ].filter(Boolean).join('; ');
}

const key = (identifier: string) => identifier.trim().toLowerCase();

/**
 * Bring untouched notes on saved rows up to date from freshly built rows
 * (matched by identifier). Edited notes are kept. `legacy` maps an
 * identifier to its old-format text.
 */
export function refreshAutoNotes<T extends NotesRow>(
    saved: T[],
    fresh: NotesRow[],
    legacy: Map<string, string> = new Map(),
): T[] {
    const byKey = new Map(fresh.filter((r) => key(r.identifier)).map((r) => [key(r.identifier), r]));
    return saved.map((row) => {
        const k = key(row.identifier);
        const next = k ? byKey.get(k) : undefined;
        if (!next) return row;
        const notes = row.notes.trim();
        const untouched = !notes
            || (row.autoNotes !== undefined && row.notes === row.autoNotes)
            || (row.autoNotes === undefined && notes === legacy.get(k));
        return untouched ? { ...row, notes: next.notes, autoNotes: next.notes } : row;
    });
}
