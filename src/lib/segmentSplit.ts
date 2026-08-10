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
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';
import { segmentsFromSchema, applySegmentsToSchema, type SegmentMap } from './segmentsPersistence.ts';

export interface SplitChildInput {
    uid: string;
    callsign: string;
    fraction: number;
}

/** Append a CASIE audit-history line (WC3-style) to the mgmt schema. */
export function appendCasieHistory(
    schema: MissionSchema,
    text: string,
    at: string = new Date().toISOString(),
): void {
    const ir = schema.incident_response as Record<string, unknown>;
    const existing = Array.isArray(ir.casie_history) ? ir.casie_history : [];
    ir.casie_history = [...existing, { at, text }];
}

export interface CasieHistoryEvent {
    at: string;
    text: string;
}

export function casieHistoryFromSchema(
    schema: MissionSchema,
): CasieHistoryEvent[] {
    const raw = (schema.incident_response as Record<string, unknown>).casie_history;
    if (!Array.isArray(raw)) return [];
    const out: CasieHistoryEvent[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        if (typeof rec.text !== 'string' || !rec.text.trim()) continue;
        out.push({ at: typeof rec.at === 'string' ? rec.at : '', text: rec.text });
    }
    return out;
}

/**
 * ISM incomplete-segment carve (debrief-time split): the parent segment is
 * RETAINED (keeping its polygon and debrief history) but represents only the
 * searched portion, keeping `retainedFraction` of every respondent's POA
 * points; a NEW segment (no polygon yet) takes the remaining (1 − f) as the
 * unsearched remainder. The completing POD is then recorded against the
 * reduced parent at full coverage by the caller.
 */
export async function carveSegmentRemainder(
    mission: ActiveMission,
    parentUid: string,
    retainedFraction: number,
    remainder: { uid: string; callsign: string },
): Promise<void> {
    if (!(retainedFraction > 0 && retainedFraction < 1)) {
        throw new Error('Retained proportion must be between 0 and 100%');
    }

    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    const schema = loaded.schema;

    const segments: SegmentMap = segmentsFromSchema(schema);
    const parent = segments[parentUid];
    if (!parent) throw new Error(`Segment ${parentUid} is not registered`);
    const now = new Date().toISOString();
    segments[remainder.uid] = {
        callsign: remainder.callsign,
        created: now,
        parentUid,
        parentCallsign: parent.callsign,
        carved: true,
    };
    applySegmentsToSchema(schema, segments);

    const ir = schema.incident_response as Record<string, unknown>;
    const casie = ir.casie as Record<string, unknown> | undefined;
    const consensus = casie?.initial_consensus as { respondents?: { values?: Record<string, number> }[] } | undefined;
    for (const respondent of consensus?.respondents ?? []) {
        if (!respondent.values) continue;
        const parentValue = respondent.values[parentUid];
        if (typeof parentValue !== 'number') continue;
        respondent.values[parentUid] = Math.round(parentValue * retainedFraction * 100) / 100;
        respondent.values[remainder.uid] = Math.round(parentValue * (1 - retainedFraction) * 100) / 100;
    }

    appendCasieHistory(
        schema,
        `Split ${parent.callsign || parentUid}: ${Math.round(retainedFraction * 100)}% of POA retained (searched), `
        + `${Math.round((1 - retainedFraction) * 100)}% to new segment ${remainder.callsign} (unsearched remainder)`,
        now,
    );

    await saveMissionSchema(sub, schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}

export interface ExpansionSegmentInput {
    uid: string;
    callsign: string;
    /** Percent of the CURRENT R.O.W. mass allocated to this new segment. */
    pct: number;
}

/**
 * WinCASIE "Expand Search Area": new segments are funded out of R.O.W.
 * The proportions (ROW retained + each new segment) must sum to 100 and are
 * applied per respondent: row → row·pRow/100, newSeg → row·pᵢ/100 — existing
 * segments are untouched and every respondent's total mass is preserved.
 */
export async function expandSearchArea(
    mission: ActiveMission,
    input: {
        rowRetainedPct: number;
        additions: ExpansionSegmentInput[];
        note: string;
    },
): Promise<void> {
    if (!input.additions.length) throw new Error('Expansion needs at least one new segment');
    const total = input.rowRetainedPct + input.additions.reduce((a, s) => a + s.pct, 0);
    if (Math.abs(total - 100) > 0.01) {
        throw new Error(`Proportions must sum to 100% (currently ${total.toFixed(2)}%)`);
    }
    if (!input.note.trim()) throw new Error('A note explaining the expansion is required');

    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    const schema = loaded.schema;

    const segments: SegmentMap = segmentsFromSchema(schema);
    const now = new Date().toISOString();
    for (const addition of input.additions) {
        if (segments[addition.uid]) throw new Error(`Segment ${addition.callsign} already registered`);
        segments[addition.uid] = {
            callsign: addition.callsign,
            created: now,
            expandedFromRow: true,
        };
    }
    applySegmentsToSchema(schema, segments);

    const ir = schema.incident_response as Record<string, unknown>;
    const casie = ir.casie as Record<string, unknown> | undefined;
    const consensus = casie?.initial_consensus as {
        respondents?: { row?: number; values?: Record<string, number> }[];
    } | undefined;
    for (const respondent of consensus?.respondents ?? []) {
        const row = typeof respondent.row === 'number' ? respondent.row : 0;
        if (!respondent.values) respondent.values = {};
        for (const addition of input.additions) {
            respondent.values[addition.uid] = Math.round(row * addition.pct) / 100;
        }
        respondent.row = Math.round(row * input.rowRetainedPct) / 100;
    }

    appendCasieHistory(
        schema,
        `Expanded search area: R.O.W. retains ${input.rowRetainedPct}%, `
        + input.additions.map((a) => `${a.callsign} (${a.pct}%)`).join(', ')
        + ` — Note: ${input.note.trim()}`,
        now,
    );

    await saveMissionSchema(sub, schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
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

    appendCasieHistory(
        schema,
        `Split ${parent.callsign || parentUid} into ${children.map((c) => `${c.callsign} (${Math.round(c.fraction * 100)}%)`).join(', ')} (area-proportional)`,
        now,
    );

    await saveMissionSchema(sub, schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}
