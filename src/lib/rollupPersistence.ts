/**
 * Phase 4 adapters: everything the CASIE rollup dashboard needs, from the
 * management sync — initial consensus → SegmentState[], debrief records,
 * OP registry, and named What-if scenarios
 * (`incident_response.casie_scenarios`).
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { ClueRecord, DebriefRecord, OpPeriodRegistryEntry, SegmentState } from '../domain/entities.ts';
import { scenariosFromValue, type Scenario } from '../domain/history.ts';
import { registryFromSchemaValue } from '../domain/registry.ts';
import { consensusForSegment, consensusRow, type InitialConsensusState } from './consensus.ts';
import { consensusFromSchema } from './casiePersistence.ts';
import { debriefsFromSchema } from './debriefPersistence.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema } from './missionSchema.ts';
import { cluesFromSchema } from './cluePersistence.ts';
import { casieHistoryFromSchema, type CasieHistoryEvent } from './segmentSplit.ts';
import { segmentsFromSchema } from './segmentsPersistence.ts';

export interface RollupInputs {
    /** Registered segments with consensus POA (uid + callsign label). */
    segments: SegmentState[];
    segmentLabels: Record<string, string>;
    rowPoa: number;
    /** True when the consensus has at least one respondent with values. */
    hasConsensus: boolean;
    records: DebriefRecord[];
    registry: OpPeriodRegistryEntry[];
    scenarios: Scenario[];
    historyEvents: CasieHistoryEvent[];
    consensusUpdatedAt: string;
    /** Full consensus state — needed by the WC3 period export. */
    consensus: InitialConsensusState | null;
    clues: ClueRecord[];
}

function consensusHasValues(consensus: InitialConsensusState | null): boolean {
    if (!consensus) return false;
    return consensus.respondents.some(
        (r) => Object.values(r.values).some((v) => Number.isFinite(v) && v > 0),
    );
}

/** One read of the mgmt schema feeding the whole dashboard. */
export async function loadRollupInputs(mission: ActiveMission): Promise<RollupInputs> {
    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);

    const consensus = consensusFromSchema(schema);
    const respondents = consensus?.respondents ?? [];
    const segmentMap = segmentsFromSchema(schema);

    const segmentLabels: Record<string, string> = {};
    const segments: SegmentState[] = Object.entries(segmentMap).map(([uid, record]) => {
        segmentLabels[uid] = record.callsign || uid;
        return { uid, poa: consensusForSegment(respondents, uid) };
    });

    return {
        segments,
        segmentLabels,
        rowPoa: consensusRow(respondents),
        hasConsensus: consensusHasValues(consensus),
        records: debriefsFromSchema(schema),
        registry: registryFromSchemaValue(schema.tak_missions),
        scenarios: scenariosFromValue(
            (schema.incident_response as Record<string, unknown>).casie_scenarios,
        ),
        historyEvents: casieHistoryFromSchema(schema),
        consensusUpdatedAt: consensus?.updated ?? '',
        consensus,
        clues: cluesFromSchema(schema),
    };
}

export async function saveScenarios(
    mission: ActiveMission,
    scenarios: Scenario[],
): Promise<void> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    (loaded.schema.incident_response as Record<string, unknown>).casie_scenarios = scenarios;
    await saveMissionSchema(sub, loaded.schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}
