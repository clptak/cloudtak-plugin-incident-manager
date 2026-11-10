/**
 * ICS 204A Team Assignment Debriefing (#17): what fills in automatically when
 * a debrief is started from an assignment. Everything stays editable.
 */

import { priorPlanFor } from '../domain/iap.ts';
import type { Ics204aDetails, OpAssignment } from '../domain/entities.ts';
import type { IapAssignmentPlan } from './iapPlanPersistence.ts';

/**
 * Task name from the assignment's ICS 204 work assignment, team leader from
 * the 204 resource row for this team, debriefed-by from the signed-in
 * callsign, and completed now.
 */
export function prefillIcs204a(
    assignment: OpAssignment,
    plans: IapAssignmentPlan[],
    callsign: string,
    now: string,
): Ics204aDetails {
    const out: Ics204aDetails = { completedAt: now };
    const plan = priorPlanFor(plans, assignment);
    const taskName = plan?.workAssignment.trim() || assignment.notes?.trim();
    if (taskName) out.taskName = taskName;
    const team = assignment.team?.trim().toLowerCase() ?? '';
    const rows = plan?.resources.filter((r) => r.identifier.trim() || r.leader.trim()) ?? [];
    const row = rows.find((r) => team && r.identifier.trim().toLowerCase() === team)
        ?? (rows.length === 1 ? rows[0] : undefined);
    if (row?.leader.trim()) out.teamLeader = row.leader.trim();
    if (callsign.trim()) out.debriefedBy = callsign.trim();
    return out;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** ISO timestamp → the local "YYYY-MM-DDTHH:mm" a datetime-local input shows. */
export function toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value (local time) → ISO timestamp; '' when unreadable. */
export function fromLocalInput(local: string): string {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
