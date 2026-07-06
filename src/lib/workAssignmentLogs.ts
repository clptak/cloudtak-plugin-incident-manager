import type { ActiveMission } from '../composables/useIncident.ts';
import { datetimeLocalToIso } from './incidentInfo.ts';
import { loadIncidentSubscription } from './incidentSubscription.ts';
import type { WorkAssignment } from './workAssignments.ts';

export const WORK_ASSIGNMENT_KEYWORD = 'work-assignment';

export type WorkAssignmentPhase = 'started' | 'completed';

interface WorkAssignmentLogBody {
    dtg: string;
    content: string;
    keywords: string[];
    entryUid?: string;
}

export function buildWorkAssignmentLogContent(
    assignment: WorkAssignment,
    phase: WorkAssignmentPhase,
): string {
    const lines = [
        `Assignment ${assignment.assignmentNumber}`,
        assignment.teamLabel ? `Team: ${assignment.teamLabel}` : '',
        assignment.assignmentCallsign ? `Map object: ${assignment.assignmentCallsign}` : '',
        assignment.instructions ? `Instructions: ${assignment.instructions}` : '',
        phase === 'started' ? 'Status: Started' : 'Status: Completed',
    ].filter(Boolean);
    return lines.join('\n');
}

export function buildWorkAssignmentLogKeywords(
    assignment: WorkAssignment,
    phase: WorkAssignmentPhase,
): string[] {
    return [
        WORK_ASSIGNMENT_KEYWORD,
        `assignment:${assignment.assignmentNumber}`,
        `phase:${phase}`,
        `team:${assignment.teamResourceAssignmentId}`,
        `uid:${assignment.assignmentUid}`,
    ];
}

export async function sendWorkAssignmentLog(
    mission: ActiveMission,
    assignment: WorkAssignment,
    phase: WorkAssignmentPhase,
    existingLogId?: string,
): Promise<string> {
    const sub = await loadIncidentSubscription(mission);
    const localDt = phase === 'started' ? assignment.started : assignment.completed;
    const dtg = datetimeLocalToIso(localDt) || new Date().toISOString();

    const body: WorkAssignmentLogBody = {
        dtg,
        content: buildWorkAssignmentLogContent(assignment, phase),
        keywords: buildWorkAssignmentLogKeywords(assignment, phase),
        entryUid: assignment.assignmentUid,
    };

    const log = sub.log as unknown as {
        create(body: WorkAssignmentLogBody): Promise<{ id: string }>;
        update(logid: string, body: WorkAssignmentLogBody): Promise<{ id: string }>;
    };

    if (existingLogId) {
        const updated = await log.update(existingLogId, body);
        return String(updated.id ?? existingLogId);
    }

    const created = await log.create(body);
    return String(created.id);
}
