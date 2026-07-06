/** Field / task assignments logged to DataSync (Assignments tab). */

export interface WorkAssignment {
    id: string;
    assignmentNumber: number;
    /** Resource assignment id from Resources tab (`resource_assignments`). */
    teamResourceAssignmentId: string;
    teamLabel: string;
    assignmentUid: string;
    assignmentCallsign: string;
    instructions: string;
    started: string;
    completed: string;
    startedLogId?: string;
    completedLogId?: string;
}

export function blankWorkAssignmentForm(): Omit<WorkAssignment, 'id' | 'startedLogId' | 'completedLogId'> {
    return {
        assignmentNumber: 1,
        teamResourceAssignmentId: '',
        teamLabel: '',
        assignmentUid: '',
        assignmentCallsign: '',
        instructions: '',
        started: '',
        completed: '',
    };
}

export function isValidAssignmentNumber(value: unknown): value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) return false;
    return value >= 1;
}

function normalizeAssignmentNumber(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
}

export function normalizeWorkAssignment(raw: unknown): WorkAssignment | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? '').trim();
    const assignmentNumber = normalizeAssignmentNumber(r.assignmentNumber);
    const teamResourceAssignmentId = String(r.teamResourceAssignmentId ?? '').trim();
    const assignmentUid = String(r.assignmentUid ?? '').trim();
    if (!id || assignmentNumber == null || !teamResourceAssignmentId || !assignmentUid) return null;

    return {
        id,
        assignmentNumber,
        teamResourceAssignmentId,
        teamLabel: String(r.teamLabel ?? '').trim(),
        assignmentUid,
        assignmentCallsign: String(r.assignmentCallsign ?? '').trim(),
        instructions: String(r.instructions ?? '').trim(),
        started: String(r.started ?? '').trim(),
        completed: String(r.completed ?? '').trim(),
        startedLogId: String(r.startedLogId ?? '').trim() || undefined,
        completedLogId: String(r.completedLogId ?? '').trim() || undefined,
    };
}

export function workAssignmentsFromSchemaValue(value: unknown): WorkAssignment[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(normalizeWorkAssignment)
        .filter((a): a is WorkAssignment => a != null)
        .sort((a, b) => a.assignmentNumber - b.assignmentNumber);
}

export function workAssignmentToSchemaRecord(a: WorkAssignment): WorkAssignment {
    return {
        id: a.id,
        assignmentNumber: a.assignmentNumber,
        teamResourceAssignmentId: a.teamResourceAssignmentId.trim(),
        teamLabel: a.teamLabel.trim(),
        assignmentUid: a.assignmentUid.trim(),
        assignmentCallsign: a.assignmentCallsign.trim(),
        instructions: a.instructions.trim(),
        started: a.started.trim(),
        completed: a.completed.trim(),
        startedLogId: a.startedLogId?.trim() || undefined,
        completedLogId: a.completedLogId?.trim() || undefined,
    };
}

export function mergeWorkAssignmentPatch(
    current: WorkAssignment,
    patch: Partial<Omit<WorkAssignment, 'id'>>,
): WorkAssignment {
    const assignmentNumber = patch.assignmentNumber !== undefined
        ? normalizeAssignmentNumber(patch.assignmentNumber)
        : current.assignmentNumber;
    if (assignmentNumber == null) return current;

    return workAssignmentToSchemaRecord({
        ...current,
        ...patch,
        assignmentNumber,
    });
}
