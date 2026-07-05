export type AssignmentNodeType = 'team' | 'member' | 'position' | 'command';

export type TeamMode = 'generic' | 'configured';

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
    icsPositionKey?: string;
    icsPositionTitle?: string;
    assigneeName?: string;
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
    | { kind: 'member'; d4hMemberId: number; title: string; description: string }
    | { kind: 'position'; resourceName: string; title: string; description: string }
    | {
        kind: 'ics-command';
        icsPositionKey: string;
        icsPositionTitle: string;
        title: string;
        description: string;
        assigneeName?: string;
        d4hMemberId?: number;
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
    { kind: 'configured-team' }
> {
    return pending?.kind === 'configured-team';
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

export function newCommandNode(
    icsPositionKey: string,
    icsPositionTitle: string,
    assigneeName?: string,
    d4hMemberId?: number,
): HastyTreeNode {
    return {
        self: {
            id: crypto.randomUUID(),
            type: 'command',
            title: icsPositionTitle,
            description: assigneeName,
            icsPositionKey,
            icsPositionTitle,
            assigneeName,
            d4hMemberId,
        },
        children: [],
    };
}

export function teamNodeFromPaletteDrop(
    pending: Extract<PendingPaletteDrop, { kind: 'configured-team' }>,
): HastyTreeNode {
    return newTeamNode(pending.title, pending.description, {
        teamMode: 'configured',
        teamNumber: pending.teamNumber,
        resourceName: pending.resourceName,
        assignmentUid: pending.assignmentUid,
        assignmentCallsign: pending.assignmentCallsign,
    });
}

export function leafNodeFromPaletteDrop(
    pending: Extract<PendingPaletteDrop, { kind: 'member' | 'position' | 'ics-command' }>,
): HastyTreeNode {
    if (pending.kind === 'position') {
        return newPositionNode(pending.resourceName);
    }
    if (pending.kind === 'ics-command') {
        return newCommandNode(
            pending.icsPositionKey,
            pending.icsPositionTitle,
            pending.assigneeName,
            pending.d4hMemberId,
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
