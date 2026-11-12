/**
 * Hand-off from the Resources & Assignments board to Operational Periods:
 * "Assign in Operational Periods" leaves the team and OP here, and Operational
 * Periods picks it up once it has loaded, fills the team into a new row and
 * clears it.
 */
import { ref } from 'vue';

export interface PendingOpAssign {
    team: string;
    opNumber: number;
}

export const pendingOpAssign = ref<PendingOpAssign | null>(null);
