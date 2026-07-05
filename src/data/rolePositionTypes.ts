export type RoleCategory = 'incident-command' | 'rescue-management';

export type RoleAssigneeMode = 'single' | 'multiple';

export interface RolePositionDef {
    key: string;
    title: string;
    category: RoleCategory;
    assigneeMode: RoleAssigneeMode;
}
