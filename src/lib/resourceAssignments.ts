/** Mission resource team / assignment records (Resources tab → Assignments palette). */

import { ASSIGNMENT_RESOURCES } from '../data/assignmentResources.ts';
import type { D4HExternalResource } from './d4hTypes.ts';

export type ResourceAssignmentStatus = 'current' | 'planned';

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
}

export const RESOURCE_ASSIGNMENT_STATUSES: { value: ResourceAssignmentStatus; label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'current', label: 'Current' },
];

export const DEFAULT_AGENCY = '';

export const RESOURCE_TYPE_OPTIONS = [...ASSIGNMENT_RESOURCES] as string[];

/** Mission override wins; D4H team/org name is the fallback when override is empty. */
export function resolveEffectiveDefaultAgency(
    schemaDefaultAgency: string,
    d4hContextName?: string,
): string {
    const override = schemaDefaultAgency.trim();
    if (override) return override;
    return (d4hContextName ?? '').trim();
}

export function buildAgencyOptions(
    d4hExternalResources: D4HExternalResource[],
    effectiveDefaultAgency = '',
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];

    const home = effectiveDefaultAgency.trim();
    if (home) {
        seen.add(home);
        out.push(home);
    }

    const d4hNames = [...d4hExternalResources]
        .map((r) => r.name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    for (const name of d4hNames) {
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
        a.status === 'current' ? 'Current' : 'Planned',
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
        status: 'planned',
        timeArrived: '',
    };
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
    return value === 'current' ? 'current' : 'planned';
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
