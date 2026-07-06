import { compareD4hRefAsc } from './d4hRoster.ts';
import type { D4HMember } from './d4hTypes.ts';
import type { AssignmentNodeSelf, HastyTreeNode } from './hastyTeamTree.ts';
import type { IncidentDetailRow } from './incidentInfo.ts';
import { isTeamLikeNode } from './orgChartExport.ts';
import { formatPersonNameFirstLast } from './personName.ts';
import {
    RESOURCE_ASSIGNMENT_STATUSES,
    type ResourceAssignment,
} from './resourceAssignments.ts';
import type { WorkAssignment } from './workAssignments.ts';

const LOCAL_TIME_OPTS: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
};

export interface DashboardTeamRosterEntry {
    ref: string;
    label: string;
}

export interface DashboardTeamRoster {
    title: string;
    description: string;
    assignmentCallsign: string;
    children: DashboardTeamRosterEntry[];
}

function memberRefMap(members: D4HMember[]): Map<number, string> {
    const map = new Map<number, string>();
    for (const m of members) {
        if (m.ref?.trim()) map.set(m.id, m.ref.trim());
    }
    return map;
}

function refForMemberId(refs: Map<number, string>, memberId?: number): string {
    if (memberId == null) return '';
    return refs.get(memberId) ?? '';
}

function rosterEntriesForNode(
    self: AssignmentNodeSelf,
    refs: Map<number, string>,
): DashboardTeamRosterEntry[] {
    if (self.type === 'role' && self.d4hMemberIds?.length) {
        const entries: DashboardTeamRosterEntry[] = [];
        for (let i = 0; i < self.d4hMemberIds.length; i++) {
            const memberId = self.d4hMemberIds[i];
            const name = formatPersonNameFirstLast(self.assigneeNames?.[i] ?? '');
            const ref = refForMemberId(refs, memberId);
            if (!name && !ref) continue;
            entries.push({ ref, label: name });
        }
        if (entries.length) return entries;
    }

    const single = rosterEntryForNode(self, refs);
    return single ? [single] : [];
}

function rosterEntryForNode(
    self: AssignmentNodeSelf,
    refs: Map<number, string>,
): DashboardTeamRosterEntry | null {
    if (self.type === 'member') {
        const label = formatPersonNameFirstLast(self.title);
        const ref = refForMemberId(refs, self.d4hMemberId);
        if (!label && !ref) return null;
        return { ref, label };
    }

    if (self.type === 'role') {
        const name = formatPersonNameFirstLast(self.assigneeName);
        const title = (self.roleTitle ?? self.title).trim();
        const ref = refForMemberId(refs, self.d4hMemberId);
        const label = title && name ? `${title}: ${name}` : (name || title);
        if (!label) return null;
        return { ref, label };
    }

    if (self.type === 'position') {
        const label = self.title.trim();
        return label ? { ref: '', label } : null;
    }

    return null;
}

function teamRosterChildren(
    node: HastyTreeNode,
    refs: Map<number, string>,
): DashboardTeamRosterEntry[] {
    const entries: DashboardTeamRosterEntry[] = [];

    const walk = (parent: HastyTreeNode): void => {
        const children = [...(parent.children ?? [])].reverse();
        for (const child of children) {
            if (!child.self) continue;
            if (isTeamLikeNode(child.self)) {
                walk(child);
                continue;
            }
            const nodeEntries = rosterEntriesForNode(child.self, refs);
            entries.push(...nodeEntries);
            walk(child);
        }
    };

    walk(node);
    entries.sort((a, b) => compareD4hRefAsc(a.ref, b.ref) || a.label.localeCompare(b.label));
    return entries;
}

/** Team roster lines from org-chart team nodes (Organization tab canvas). */
export function dashboardTeamsFromOrgChart(
    tree: HastyTreeNode,
    members: D4HMember[] = [],
): DashboardTeamRoster[] {
    const refs = memberRefMap(members);
    const teams: DashboardTeamRoster[] = [];

    const visit = (node: HastyTreeNode): void => {
        if (node.self && isTeamLikeNode(node.self)) {
            teams.push({
                title: node.self.title.trim(),
                description: (node.self.description ?? '').trim(),
                assignmentCallsign: (node.self.assignmentCallsign ?? '').trim(),
                children: teamRosterChildren(node, refs),
            });
            return;
        }
        for (const child of node.children ?? []) visit(child);
    };

    visit(tree);
    return teams;
}

export function formatTeamRosterChild(entry: DashboardTeamRosterEntry): string {
    if (entry.ref) return `${entry.ref} — ${entry.label}`;
    return entry.label;
}

export function formatDashboardDatetime(local: string): string {
    if (!local.trim()) return '';
    const ms = Date.parse(local);
    if (Number.isNaN(ms)) return local.trim();
    return new Date(ms).toLocaleString(undefined, LOCAL_TIME_OPTS);
}

function statusLabel(status: ResourceAssignment['status']): string {
    return RESOURCE_ASSIGNMENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** Labeled rows for a Resources-tab resource assignment. */
export function resourceAssignmentDetailRows(a: ResourceAssignment): IncidentDetailRow[] {
    const rows: IncidentDetailRow[] = [
        { label: 'Resource Identifier', value: a.resourceIdentifier },
        { label: 'Resource', value: a.resource },
        { label: 'Agency', value: a.agency },
        { label: 'Status', value: statusLabel(a.status) },
    ];
    if (a.assignmentCallsign?.trim()) {
        rows.push({ label: 'Assignment', value: a.assignmentCallsign.trim() });
    }
    if (a.timeOrdered.trim()) {
        rows.push({ label: 'Time Ordered', value: formatDashboardDatetime(a.timeOrdered) });
    }
    if (a.eta != null && !Number.isNaN(a.eta)) {
        rows.push({ label: 'ETA', value: `${a.eta} hr` });
    }
    if (a.timeArrived.trim()) {
        rows.push({ label: 'Time Arrived', value: formatDashboardDatetime(a.timeArrived) });
    }
    return rows.filter((row) => row.value.trim());
}

/** Labeled rows for an Assignments-tab work assignment. */
export function workAssignmentDetailRows(a: WorkAssignment): IncidentDetailRow[] {
    const rows: IncidentDetailRow[] = [
        { label: 'Team', value: a.teamLabel },
        { label: 'Assignment', value: a.assignmentCallsign },
    ];
    if (a.instructions.trim()) {
        rows.push({ label: 'Instructions', value: a.instructions.trim() });
    }
    if (a.started.trim()) {
        rows.push({ label: 'Started', value: formatDashboardDatetime(a.started) });
    }
    if (a.completed.trim()) {
        rows.push({ label: 'Completed', value: formatDashboardDatetime(a.completed) });
    }
    return rows.filter((row) => row.value.trim());
}
