import type { RolePositionDef } from './rolePositionTypes.ts';

export interface RescueGroupLabel {
    key: string;
    title: string;
}

export const RESCUE_MANAGEMENT_POSITIONS: RolePositionDef[] = [
    { key: 'supervisor', title: 'Rescue Supervisor', category: 'rescue-management', assigneeMode: 'single' },
    { key: 'main', title: 'Main', category: 'rescue-management', assigneeMode: 'single' },
    { key: 'belay', title: 'Belay', category: 'rescue-management', assigneeMode: 'single' },
    { key: 'attendant', title: 'Attendant', category: 'rescue-management', assigneeMode: 'single' },
];

export const RESCUE_GROUP_LABELS: RescueGroupLabel[] = [
    { key: 'edge', title: 'Edge' },
    { key: 'haul', title: 'Haul Team' },
];
