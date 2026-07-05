export interface IncidentCommandPositionDef {
    key: string;
    title: string;
}

export const INCIDENT_COMMAND_POSITIONS: IncidentCommandPositionDef[] = [
    { key: 'ic', title: 'Incident Commander(s)' },
    { key: 'lo', title: 'Liaison Officer' },
    { key: 'so', title: 'Safety Officer' },
    { key: 'pio', title: 'Public Information Officer' },
    { key: 'ops', title: 'Operations Section Chief' },
    { key: 'plan', title: 'Planning Section Chief' },
    { key: 'log', title: 'Logistics Section Chief' },
    { key: 'fin', title: 'Finance Section Chief' },
];
