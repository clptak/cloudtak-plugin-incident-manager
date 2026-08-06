/** Persist CASIE Initial Consensus state in mission_schema.json (incident_response.casie.initial_consensus). */

import type { ActiveMission } from '../composables/useIncident.ts';
import {
    OCONNOR_LETTERS,
    type ConsensusMethod,
    type ConsensusRespondent,
    type InitialConsensusState,
    type OconnorLetter,
} from './consensus.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import { segmentsFromSchema, type SegmentMap } from './segmentsPersistence.ts';

const METHODS: ConsensusMethod[] = ['mattson', 'oconnor', 'proportional'];

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeRespondent(raw: unknown, index: number): ConsensusRespondent {
    const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const method = METHODS.includes(rec.method as ConsensusMethod)
        ? (rec.method as ConsensusMethod)
        : 'mattson';

    const letters: Record<string, OconnorLetter> = {};
    if (rec.letters && typeof rec.letters === 'object' && !Array.isArray(rec.letters)) {
        for (const [uid, letter] of Object.entries(rec.letters as Record<string, unknown>)) {
            if (OCONNOR_LETTERS.includes(letter as OconnorLetter)) {
                letters[uid] = letter as OconnorLetter;
            }
        }
    }

    const values: Record<string, number> = {};
    if (rec.values && typeof rec.values === 'object' && !Array.isArray(rec.values)) {
        for (const [uid, value] of Object.entries(rec.values as Record<string, unknown>)) {
            values[uid] = asNumber(value);
        }
    }

    return {
        name: asString(rec.name, `Responder ${index + 1}`) || `Responder ${index + 1}`,
        method,
        row: asNumber(rec.row, 100),
        letters,
        values,
    };
}

export function consensusFromSchema(schema: MissionSchema): InitialConsensusState | null {
    const casie = (schema.incident_response as Record<string, unknown>).casie;
    if (!casie || typeof casie !== 'object' || Array.isArray(casie)) return null;
    const raw = (casie as Record<string, unknown>).initial_consensus;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;

    const respondents = Array.isArray(rec.respondents)
        ? rec.respondents.map((r, i) => sanitizeRespondent(r, i))
        : [];

    return {
        incident_name: asString(rec.incident_name),
        filename: asString(rec.filename),
        use_my_documents: rec.use_my_documents === true,
        respondents,
        accepted: rec.accepted === true,
        updated: asString(rec.updated),
    };
}

export function applyConsensusToSchema(
    schema: MissionSchema,
    consensus: InitialConsensusState,
): void {
    const ir = schema.incident_response as Record<string, unknown>;
    const casie = (ir.casie && typeof ir.casie === 'object' && !Array.isArray(ir.casie))
        ? (ir.casie as Record<string, unknown>)
        : {};
    casie.initial_consensus = {
        ...consensus,
        updated: new Date().toISOString(),
    };
    ir.casie = casie;
}

export interface LoadedCasie {
    consensus: InitialConsensusState | null;
    incidentName: string;
    segments: SegmentMap;
    contentHash?: string;
}

export async function loadCasieFromMission(mission: ActiveMission): Promise<LoadedCasie> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        consensus: consensusFromSchema(loaded.schema),
        incidentName: loaded.schema.incident_response.incident_name || '',
        segments: segmentsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
    };
}

export async function saveCasieToMission(
    mission: ActiveMission,
    consensus: InitialConsensusState,
    opts?: {
        /** When set, also update incident_response.incident_name. */
        incidentName?: string;
        contentHash?: string;
    },
): Promise<string | undefined> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyConsensusToSchema(loaded.schema, consensus);
    if (opts?.incidentName !== undefined && opts.incidentName.trim()) {
        loaded.schema.incident_response.incident_name = opts.incidentName.trim();
    }
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: opts?.contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });

    return saved.contentHash;
}
