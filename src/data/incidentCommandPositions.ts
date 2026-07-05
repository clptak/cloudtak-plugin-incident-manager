import type { RolePositionDef } from './rolePositionTypes.ts';

export const INCIDENT_COMMAND_POSITIONS: RolePositionDef[] = [
    { key: 'ic', title: 'Incident Commander(s)', category: 'incident-command', assigneeMode: 'single' },
    { key: 'lo', title: 'Liaison Officer', category: 'incident-command', assigneeMode: 'single' },
    { key: 'so', title: 'Safety Officer', category: 'incident-command', assigneeMode: 'single' },
    { key: 'pio', title: 'Public Information Officer', category: 'incident-command', assigneeMode: 'single' },
    { key: 'ops', title: 'Operations Section Chief', category: 'incident-command', assigneeMode: 'single' },
    { key: 'plan', title: 'Planning Section Chief', category: 'incident-command', assigneeMode: 'single' },
    { key: 'log', title: 'Logistics Section Chief', category: 'incident-command', assigneeMode: 'single' },
    { key: 'fin', title: 'Finance Section Chief', category: 'incident-command', assigneeMode: 'single' },
];
