/**
 * ISM segment split — schema-side orchestration (single load/save):
 * 1. segments map: parent removed, children added with parentUid lineage;
 * 2. initial-consensus values: every respondent's parent points redistribute
 *    to the children by fraction (letters, if any, are left on the parent —
 *    values are what the rollup reads);
 * 3. debrief records: parent history rewritten onto the children
 *    (splitDebriefRecords) so the replay is preserved exactly.
 * Polygon moves/deletes are the caller's job (Segmentation pane).
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import { splitDebriefRecords } from '../domain/rollup.ts';
import { debriefsFromSchema } from './debriefPersistence.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema } from './missionSchema.ts';
import { segmentsFromSchema, applySegmentsToSchema, type SegmentMap } from './segmentsPersistence.ts';

export interface SplitChildInput {
    uid: string;
    callsign: string;
    fraction: number;
}

export async function splitRegisteredSegment(
    mission: ActiveMission,
    parentUid: string,
    children: SplitChildInput[],
): Promise<void> {
    if (children.length < 2) throw new Error('Split needs at least 2 children');
    const total = children.reduce((a, c) => a + c.fraction, 0);
    if (Math.abs(total - 1) > 0.01) {
        throw new Error(`Child fractions must sum to 1 (got ${total.toFixed(3)})`);
    }

    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    const schema = loaded.schema;

    // 1. Segments map
    const segments: SegmentMap = segmentsFromSchema(schema);
    const parent = segments[parentUid];
    if (!parent) throw new Error(`Segment ${parentUid} is not registered`);
    delete segments[parentUid];
    const now = new Date().toISOString();
    for (const child of children) {
        segments[child.uid] = {
            callsign: child.callsign,
            created: now,
            parentUid,
            parentCallsign: parent.callsign,
        };
    }
    applySegmentsToSchema(schema, segments);

    // 2. Consensus values (all methods keep materialized `values`)
    const ir = schema.incident_response as Record<string, unknown>;
    const casie = ir.casie as Record<string, unknown> | undefined;
    const consensus = casie?.initial_consensus as { respondents?: { values?: Record<string, number> }[] } | undefined;
    for (const respondent of consensus?.respondents ?? []) {
        if (!respondent.values) continue;
        const parentValue = respondent.values[parentUid];
        if (typeof parentValue !== 'number') continue;
        for (const child of children) {
            respondent.values[child.uid] = Math.round(parentValue * child.fraction * 100) / 100;
        }
        delete respondent.values[parentUid];
    }

    // 3. Debrief history
    const records = debriefsFromSchema(schema);
    if (records.some((r) => r.segmentUid === parentUid)) {
        ir.debriefs = splitDebriefRecords(records, parentUid, children.map((c) => c.uid));
    }

    await saveMissionSchema(sub, schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}
