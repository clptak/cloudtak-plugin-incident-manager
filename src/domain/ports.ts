/**
 * Repository/gateway interfaces (Clean Architecture ports).
 * Use cases (Phase 3+) depend on these — never on src/lib directly (DIP).
 * Adapters in src/lib implement them over the existing DataSync plumbing.
 */

import type {
    DebriefRecord,
    OpAssignment,
    OpPeriodRegistryEntry,
    TrackLogRef,
} from './entities.ts';

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
        /** Copied from the parent incident so OP syncs keep the same chrome. */
        keywords?: string[];
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
    /**
     * Ensure a named mission folder (UID-typed MissionLayer) exists on the OP
     * sync; returns its layer uid. Idempotent — reuses a folder of that name.
     */
    ensureFolder(op: OpPeriodRegistryEntry, name: string): Promise<string>;
}

/** Debrief (POD) records for rollup — stored on the management sync. */
export interface DebriefStore {
    load(): Promise<DebriefRecord[]>;
    append(record: DebriefRecord): Promise<void>;
    /**
     * Replace the track list on the record identified by `key`
     * (see domain/trackLog.ts `debriefKey`). Throws when no record matches —
     * silently dropping an attached track would strand a published CoT.
     */
    setTracks(key: string, tracks: TrackLogRef[]): Promise<void>;
}

/** A track ready to publish into an OP sync. */
export interface TrackLogPayload {
    callsign: string;
    /** [lng, lat] pairs, already thinned. */
    coords: [number, number][];
    /** Existing CoT uid when re-filing a line already on the map. */
    uid?: string;
    remarks?: string;
}

/** Publish a GPS track into an OP sync's Track Logs folder; returns the uid. */
export interface TrackLogPublisher {
    publishTrack(
        op: OpPeriodRegistryEntry,
        folderUid: string,
        track: TrackLogPayload,
    ): Promise<string>;
}

/** Style carried from the source feature so OP copies render identically. */
export interface PolygonStyle {
    stroke?: string;
    fill?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted' | 'outlined';
}

/**
 * A feature tasked as an assignment, in the three shapes TAK draws.
 *
 * Search incidents always task a `polygon` (a registered segment). Other
 * incident types task any CoT on the incident map (Paul, 2026-08-30) — a
 * structure or staging `point`, a road or hoseline `line`, a division
 * `polygon` — so the payload is a discriminated union rather than a ring.
 */
export type AssignmentPayload =
    | {
        kind: 'polygon';
        callsign: string;
        /** Closed ring of [lng, lat] (first == last). */
        ring: [number, number][];
        center: [number, number];
        style?: PolygonStyle;
    }
    | {
        kind: 'line';
        callsign: string;
        line: [number, number][];
        center: [number, number];
        style?: PolygonStyle;
    }
    | {
        kind: 'point';
        callsign: string;
        point: [number, number];
        /** CoT type and icon, carried so the OP copy renders identically. */
        cotType?: string;
        icon?: string;
    };

/** Backwards-compatible alias — search code still speaks in polygons. */
export type PolygonPayload = Extract<AssignmentPayload, { kind: 'polygon' }>;

/**
 * Read the geometry of an assignable feature, from wherever it lives (the
 * segment registry on a search, or any incident sync otherwise).
 */
export interface SegmentGeometrySource {
    getFeature(uid: string): Promise<AssignmentPayload | null>;
}

/**
 * Publish an assignment feature into an OP sync; returns the feature uid.
 * Pass `existingUid` on republish — TAK treats a repeated uid as an update,
 * which prevents duplicate features on subscriber maps.
 */
export interface OpFeaturePublisher {
    publishFeature(
        op: OpPeriodRegistryEntry,
        feature: AssignmentPayload,
        existingUid?: string,
    ): Promise<string>;
}

/** Running assignment list — stored on the management sync. */
export interface AssignmentStore {
    load(): Promise<OpAssignment[]>;
    /** Insert or replace keyed by (opNumber, segmentUid). */
    upsert(assignment: OpAssignment): Promise<void>;
}
