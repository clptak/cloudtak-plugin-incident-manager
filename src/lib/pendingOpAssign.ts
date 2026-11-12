/**
 * Hand-offs from the Resources & Assignments board to Operational Periods.
 * The board leaves a request here and opens Operational Periods, which picks
 * it up once it has loaded and clears it:
 * - "Assign in Operational Periods": fill the team into a new assignment row.
 * - "Complete / Debrief": fill the completed-assignment (debrief) form.
 */
import { ref } from 'vue';

export interface PendingOpAssign {
    team: string;
    opNumber: number;
}

export const pendingOpAssign = ref<PendingOpAssign | null>(null);

export interface PendingOpDebrief {
    assignmentId?: string;
    opNumber: number;
    segmentUid: string;
    team: string;
}

export const pendingOpDebrief = ref<PendingOpDebrief | null>(null);
