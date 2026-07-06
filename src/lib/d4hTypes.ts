/** Cross-plugin contract mirrored from cloudtak-plugin-d4h (db.kv d4h:roster). */

export interface D4HQualification {
    id: number;
    name: string;
    expiresAt?: string;
    memberId?: number;
}

export interface D4HMember {
    id: number;
    ref?: string;
    name: string;
    callsign?: string;
    position?: string;
    status?: string;
    email?: string;
    mobile?: string;
    phone?: string;
    qualifications?: D4HQualification[];
}

export interface D4HEquipment {
    id: number;
    ref?: string;
    name: string;
    make?: string;
    model?: string;
    category?: string;
    status?: string;
}

/** External Resource Tracker agency (Intelligence → Resources). */
export interface D4HExternalResource {
    id: number;
    name: string;
}

export interface D4HRosterMeta {
    fetchedAt: string;
    region: string;
    context: string;
    contextId: number;
    memberCount: number;
    equipmentCount: number;
    externalResourceCount?: number;
    warnings: string[];
}

export interface D4HRoster {
    meta: D4HRosterMeta;
    members: D4HMember[];
    equipment: D4HEquipment[];
    externalResources?: D4HExternalResource[];
}
