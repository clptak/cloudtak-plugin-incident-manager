export interface AssignmentNodeSelf {
    id: string;
    type: 'team' | 'member';
    title: string;
    description?: string;
    d4hMemberId?: number;
}

export interface HastyTreeNode {
    self?: AssignmentNodeSelf;
    children?: HastyTreeNode[];
}

export type PendingPaletteDrop =
    | { kind: 'team' }
    | { kind: 'member'; d4hMemberId: number; title: string; description: string };

export function emptyTree(): HastyTreeNode {
    return {};
}

export function newTeamNode(title = 'Team'): HastyTreeNode {
    return {
        self: {
            id: crypto.randomUUID(),
            type: 'team',
            title,
            description: 'Group or ICS position',
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

    if (pending.kind === 'team') {
        parent.children.push(newTeamNode());
        return;
    }

    parent.children.push(newMemberNode(
        pending.title,
        pending.description,
        pending.d4hMemberId,
    ));
}

export function applyPaletteToRoot(
    root: HastyTreeNode,
    pending: PendingPaletteDrop | null,
): void {
    if (!pending) return;

    if (pending.kind === 'team') {
        if (!root.self) {
            const node = newTeamNode();
            root.self = node.self;
            root.children = node.children;
        } else {
            appendPaletteDrop(root, pending);
        }
        return;
    }

    if (!root.self) {
        const node = newMemberNode(
            pending.title,
            pending.description,
            pending.d4hMemberId,
        );
        root.self = node.self;
        root.children = node.children;
    } else {
        appendPaletteDrop(root, pending);
    }
}
