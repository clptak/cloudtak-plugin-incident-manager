/**
 * Repository/gateway interfaces (Clean Architecture ports).
 * Use cases (Phase 3+) depend on these — never on src/lib directly (DIP).
 * Adapters in src/lib implement them over the existing DataSync plumbing.
 */

import type { DebriefRecord, OpAssignment, OpPeriodRegistryEntry } from './entities.ts';

/** Registry persistence on the management sync (tak_missions[] in schema). */
export interface RegistryStore {
    load(): Promise<OpPeriodRegistryEntry[]>;
    save(entries: OpPeriodRegistryEntry[]): Promise<void>;
}

/** Lifecycle operations on OP DataSync missions (create/roles/groups). */
export interface OpPeriodGateway {
    /** Create a dual-channel, role-enabled OP sync; returns its registry entry. */
    create(op: {
        name: string;
        opNumber: number;
        channels: string[];
        description?: string;
    }): Promise<OpPeriodRegistryEntry>;
    /** Promote/demote one subscriber (check-in / OP close). */
    setSubscriberRole(op: OpPeriodRegistryEntry, subscriber: {
        clientUid: string;
        username: string;
        role: 'MISSION_SUBSCRIBER' | 'MISSION_READONLY_SUBSCRIBER';
    }): Promise<void>;
    /** List current subscribers with roles. */
    listSubscribers(op: OpPeriodRegistryEntry): Promise<{
        clientUid: string;
        username: string;
        role: string;
    }[]>;
    /** Strip field channels at OP close (volunteers lose visibility). */
    setChannels(op: OpPeriodRegistryEntry, channels: string[]): Promise<void>;
}

/** Debrief (POD) records for rollup — stored on the management sync. */
export interface DebriefStore {
    load(): Promise<DebriefRecord[]>;
    append(record: DebriefRecord): Promise<void>;
}

/** Read segment polygon geometry (from wherever the segment features live). */
export interface SegmentGeometrySource {
    getPolygon(uid: string): Promise<{
        callsign: string;
        ring: [number, number][];
        center: [number, number];
    } | null>;
}

/** Publish a polygon feature into an OP sync; returns the new feature uid. */
export interface OpFeaturePublisher {
    publishPolygon(op: OpPeriodRegistryEntry, polygon: {
        callsign: string;
        ring: [number, number][];
        center: [number, number];
    }): Promise<string>;
}

/** Running assignment list — stored on the management sync. */
export interface AssignmentStore {
    load(): Promise<OpAssignment[]>;
    append(assignment: OpAssignment): Promise<void>;
}
