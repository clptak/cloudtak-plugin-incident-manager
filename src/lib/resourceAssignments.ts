/** Mission resource team / assignment records (Resources tab → Assignments palette). */

import { ASSIGNMENT_RESOURCES } from '../data/assignmentResources.ts';

export type ResourceAssignmentStatus = 'requested' | 'have' | 'need' | 'demobilized' | 'cancelled';

export interface ResourceAssignment {
    id: string;
    resourceIdentifier: string;
    resource: string;
    agency: string;
    timeOrdered: string;
    eta: number | null;
    status: ResourceAssignmentStatus;
    timeArrived: string;
    /** Mission CoT uuid for assignment linkage (DataSync log entryUid). */
    assignmentUid?: string;
    assignmentCallsign?: string;
    /** Operational period this resource is assigned to (Area Search phase). */
    opNumber?: number | null;
}

export const RESOURCE_ASSIGNMENT_STATUSES: { value: ResourceAssignmentStatus; label: string }[] = [
    { value: 'requested', label: 'Requested' },
    { value: 'have', label: 'Have' },
    { value: 'need', label: 'Need' },
    { value: 'demobilized', label: 'Demobilized' },
    { value: 'cancelled', label: 'Cancelled' },
];

export function resourceStatusLabel(status: ResourceAssignmentStatus): string {
    return RESOURCE_ASSIGNMENT_STATUSES.find((s) => s.value === status)?.label ?? 'Requested';
}

/** Resources still in play — excludes demobilized and cancelled. */
export function isActiveResource(a: ResourceAssignment): boolean {
    return a.status !== 'demobilized' && a.status !== 'cancelled';
}

export const DEFAULT_AGENCY = '';

export const RESOURCE_TYPE_OPTIONS = [...ASSIGNMENT_RESOURCES] as string[];

/** Mission override wins; then Settings Your Agency; D4H team/org name is last fallback. */
export function resolveEffectiveDefaultAgency(
    schemaDefaultAgency: string,
    d4hContextName?: string,
    yourAgency?: string,
): string {
    const override = schemaDefaultAgency.trim();
    if (override) return override;
    const home = (yourAgency ?? '').trim();
    if (home) return home;
    return (d4hContextName ?? '').trim();
}

export function buildAgencyOptions(
    aidingNames: string[],
    effectiveDefaultAgency = '',
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];

    const home = effectiveDefaultAgency.trim();
    if (home) {
        seen.add(home);
        out.push(home);
    }

    const names = [...aidingNames]
        .map((name) => name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    for (const name of names) {
        if (!seen.has(name)) {
            seen.add(name);
            out.push(name);
        }
    }

    return out;
}

export function resourceAssignmentDescription(a: ResourceAssignment): string {
    const parts = [
        a.resource,
        a.agency,
        resourceStatusLabel(a.status),
    ];
    if (a.eta != null && !Number.isNaN(a.eta)) {
        parts.push(`ETA ${a.eta}`);
    }
    if (a.assignmentCallsign?.trim()) {
        parts.push(`Assignment: ${a.assignmentCallsign.trim()}`);
    }
    return parts.join(' · ');
}

export function blankResourceAssignmentForm(): Omit<ResourceAssignment, 'id'> {
    return {
        resourceIdentifier: '',
        resource: '',
        agency: DEFAULT_AGENCY,
        timeOrdered: '',
        eta: null,
        status: 'requested',
        timeArrived: '',
        opNumber: null,
    };
}

function normalizeOpNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/** Shape written to mission_schema.json → incident_response.resource_assignments[]. */
export function resourceAssignmentToSchemaRecord(a: ResourceAssignment): ResourceAssignment {
    const assignmentUid = a.assignmentUid?.trim() || undefined;
    const assignmentCallsign = a.assignmentCallsign?.trim() || undefined;
    return {
        id: a.id,
        resourceIdentifier: a.resourceIdentifier.trim(),
        resource: a.resource.trim(),
        agency: a.agency.trim(),
        timeOrdered: a.timeOrdered.trim(),
        eta: normalizeEta(a.eta),
        status: normalizeStatus(a.status),
        timeArrived: a.timeArrived.trim(),
        assignmentUid,
        assignmentCallsign: assignmentUid ? assignmentCallsign : undefined,
        opNumber: normalizeOpNumber(a.opNumber),
    };
}

export function mergeResourceAssignmentPatch(
    current: ResourceAssignment,
    patch: Partial<Omit<ResourceAssignment, 'id'>>,
): ResourceAssignment {
    return resourceAssignmentToSchemaRecord({
        ...current,
        ...patch,
        id: current.id,
        eta: patch.eta !== undefined ? normalizeEta(patch.eta) : current.eta,
        status: patch.status !== undefined ? normalizeStatus(patch.status) : current.status,
    });
}

function normalizeStatus(value: unknown): ResourceAssignmentStatus {
    if (RESOURCE_ASSIGNMENT_STATUSES.some((s) => s.value === value)) {
        return value as ResourceAssignmentStatus;
    }
    // Legacy values from pre-Phase-4 incidents
    if (value === 'current') return 'have';
    if (value === 'planned') return 'requested';
    return 'requested';
}

function normalizeEta(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function normalizeResourceAssignment(raw: unknown): ResourceAssignment | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? '').trim();
    const resourceIdentifier = String(r.resourceIdentifier ?? r.resource_id ?? '').trim();
    if (!id || !resourceIdentifier) return null;

    return {
        id,
        resourceIdentifier,
        resource: String(r.resource ?? r.resource_name ?? '').trim(),
        agency: String(r.agency ?? DEFAULT_AGENCY).trim() || DEFAULT_AGENCY,
        timeOrdered: String(r.timeOrdered ?? r.resource_order_dtg ?? '').trim(),
        eta: normalizeEta(r.eta ?? r.resource_order_expected_arrival_dtg),
        status: normalizeStatus(r.status),
        timeArrived: String(r.timeArrived ?? r.resource_arrived_dtg ?? '').trim(),
        assignmentUid: String(r.assignmentUid ?? '').trim() || undefined,
        assignmentCallsign: String(r.assignmentCallsign ?? '').trim() || undefined,
        opNumber: normalizeOpNumber(r.opNumber),
    };
}

export function resourceAssignmentsFromSchemaValue(value: unknown): ResourceAssignment[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(normalizeResourceAssignment)
        .filter((a): a is ResourceAssignment => a != null);
}

export function resourceAssignmentMatchesFilter(a: ResourceAssignment, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [
        a.resourceIdentifier,
        a.resource,
        a.agency,
        a.status,
        a.assignmentCallsign,
    ].join(' ').toLowerCase();
    return hay.includes(q);
}

export function resourceTeamPaletteDrop(a: ResourceAssignment): {
    kind: 'resource-team';
    assignmentId: string;
    title: string;
    description: string;
    resourceName: string;
    agency: string;
    timeOrdered: string;
    eta: number | null;
    status: ResourceAssignmentStatus;
    timeArrived: string;
    assignmentUid?: string;
    assignmentCallsign?: string;
} {
    return {
        kind: 'resource-team',
        assignmentId: a.id,
        title: a.resourceIdentifier,
        description: resourceAssignmentDescription(a),
        resourceName: a.resource,
        agency: a.agency,
        timeOrdered: a.timeOrdered,
        eta: a.eta,
        status: a.status,
        timeArrived: a.timeArrived,
        assignmentUid: a.assignmentUid,
        assignmentCallsign: a.assignmentCallsign,
    };
}
