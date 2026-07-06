export type AssignmentNodeType = 'team' | 'member' | 'position' | 'role';

export type RoleCategory = 'incident-command' | 'rescue-management';

export type TeamMode = 'generic' | 'configured' | 'resource';

export interface AssignmentNodeSelf {
    id: string;
    type: AssignmentNodeType;
    title: string;
    description?: string;
    d4hMemberId?: number;
    teamMode?: TeamMode;
    teamNumber?: number;
    resourceName?: string;
    assignmentUid?: string;
    assignmentCallsign?: string;
    resourceAssignmentId?: string;
    agency?: string;
    timeOrdered?: string;
    eta?: number | null;
    assignmentStatus?: 'current' | 'planned';
    timeArrived?: string;
    roleCategory?: RoleCategory;
    roleKey?: string;
    roleTitle?: string;
    assigneeName?: string;
    assigneeNames?: string[];
    d4hMemberIds?: number[];
}

export interface HastyTreeNode {
    self?: AssignmentNodeSelf;
    children?: HastyTreeNode[];
}

export type PendingPaletteDrop =
    | {
        kind: 'configured-team';
        teamNumber: number;
        title: string;
        description: string;
        resourceName?: string;
        assignmentUid?: string;
        assignmentCallsign?: string;
    }
    | {
        kind: 'resource-team';
        assignmentId: string;
        title: string;
        description: string;
        resourceName: string;
        agency: string;
        timeOrdered: string;
        eta: number | null;
        status: 'current' | 'planned';
        timeArrived: string;
    }
    | { kind: 'member'; d4hMemberId: number; title: string; description: string }
    | { kind: 'position'; resourceName: string; title: string; description: string }
    | {
        kind: 'role-position';
        roleCategory: RoleCategory;
        roleKey: string;
        roleTitle: string;
        assigneeMode: 'single' | 'multiple';
        title: string;
        description: string;
        assigneeName?: string;
        d4hMemberId?: number;
        assigneeNames?: string[];
        d4hMemberIds?: number[];
    };

export function configuredTeamTitle(teamNumber: number): string {
    const n = Math.max(1, Math.floor(teamNumber) || 1);
    return `Team ${n}`;
}

export function configuredTeamDescription(parts: {
    resourceName?: string;
    assignmentCallsign?: string;
}): string {
    const lines: string[] = [];
    if (parts.resourceName) lines.push(parts.resourceName);
    if (parts.assignmentCallsign) lines.push(`Assignment: ${parts.assignmentCallsign}`);
    return lines.join(' · ') || 'Configured team';
}

export function emptyTree(): HastyTreeNode {
    return {};
}

export function isTeamPaletteDrop(pending: PendingPaletteDrop | null): pending is Extract<
    PendingPaletteDrop,
    { kind: 'configured-team' | 'resource-team' }
> {
    return pending?.kind === 'configured-team' || pending?.kind === 'resource-team';
}

export function newTeamNode(
    title = 'Team',
    description = 'Group or ICS position',
    extra?: Partial<AssignmentNodeSelf>,
): HastyTreeNode {
    return {
        self: {
            id: crypto.randomUUID(),
            type: 'team',
            title,
            description,
            teamMode: 'generic',
            ...extra,
        },
        children: [],
    };
}

export function newMemberNode(
    title: string,
    description: string,
    d4hMemberId?: number,
): HastyTreeNode {
    return {
        self: {
            id: crypto.randomUUID(),
            type: 'member',
            title,
            description,
            d4hMemberId,
        },
        children: [],
    };
}

export function newPositionNode(resourceName: string): HastyTreeNode {
    return {
        self: {
            id: crypto.randomUUID(),
            type: 'position',
            title: resourceName,
            description: 'Position',
            resourceName,
        },
        children: [],
    };
}

export function newRoleNode(
    roleCategory: RoleCategory,
    roleKey: string,
    roleTitle: string,
    description?: string,
    extra?: Pick<AssignmentNodeSelf, 'assigneeName' | 'd4hMemberId' | 'assigneeNames' | 'd4hMemberIds'>,
): HastyTreeNode {
    return {
        self: {
            id: crypto.randomUUID(),
            type: 'role',
            title: roleTitle,
            description,
            roleCategory,
            roleKey,
            roleTitle,
            ...extra,
        },
        children: [],
    };
}

export function teamNodeFromPaletteDrop(
    pending: Extract<PendingPaletteDrop, { kind: 'configured-team' | 'resource-team' }>,
): HastyTreeNode {
    if (pending.kind === 'resource-team') {
        return newTeamNode(pending.title, pending.description, {
            teamMode: 'resource',
            resourceAssignmentId: pending.assignmentId,
            resourceName: pending.resourceName,
            agency: pending.agency,
            timeOrdered: pending.timeOrdered,
            eta: pending.eta,
            assignmentStatus: pending.status,
            timeArrived: pending.timeArrived,
        });
    }

    return newTeamNode(pending.title, pending.description, {
        teamMode: 'configured',
        teamNumber: pending.teamNumber,
        resourceName: pending.resourceName,
        assignmentUid: pending.assignmentUid,
        assignmentCallsign: pending.assignmentCallsign,
    });
}

export function leafNodeFromPaletteDrop(
    pending: Extract<PendingPaletteDrop, { kind: 'member' | 'position' | 'role-position' }>,
): HastyTreeNode {
    if (pending.kind === 'position') {
        return newPositionNode(pending.resourceName);
    }
    if (pending.kind === 'role-position') {
        return newRoleNode(
            pending.roleCategory,
            pending.roleKey,
            pending.roleTitle,
            pending.description,
            {
                assigneeName: pending.assigneeName,
                d4hMemberId: pending.d4hMemberId,
                assigneeNames: pending.assigneeNames,
                d4hMemberIds: pending.d4hMemberIds,
            },
        );
    }
    return newMemberNode(pending.title, pending.description, pending.d4hMemberId);
}

export function extractNodeById(root: HastyTreeNode, id: string): HastyTreeNode | null {
    const children = root.children || [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.self?.id === id) {
            return children.splice(i, 1)[0];
        }
        const found = extractNodeById(child, id);
        if (found) return found;
    }
    return null;
}

export function treeHasContent(tree: HastyTreeNode): boolean {
    return !!(tree.self || (tree.children && tree.children.length > 0));
}

/** Remove a node by id. Returns `root` if the root node was removed (caller should reset tree). */
export function deleteNodeFromTree(
    tree: HastyTreeNode,
    nodeId: string,
): 'root' | 'child' | 'missing' {
    if (!nodeId) return 'missing';
    if (tree.self?.id === nodeId) return 'root';
    return extractNodeById(tree, nodeId) ? 'child' : 'missing';
}

export function appendPaletteDrop(
    parent: HastyTreeNode,
    pending: PendingPaletteDrop | null,
): void {
    if (!pending) return;
    if (!parent.children) parent.children = [];

    if (isTeamPaletteDrop(pending)) {
        parent.children.push(teamNodeFromPaletteDrop(pending));
        return;
    }

    parent.children.push(leafNodeFromPaletteDrop(pending));
}

export function applyPaletteToRoot(
    root: HastyTreeNode,
    pending: PendingPaletteDrop | null,
): void {
    if (!pending) return;

    if (!root.self) {
        const node = isTeamPaletteDrop(pending)
            ? teamNodeFromPaletteDrop(pending)
            : leafNodeFromPaletteDrop(pending);
        root.self = node.self;
        root.children = node.children;
        return;
    }

    appendPaletteDrop(root, pending);
}
