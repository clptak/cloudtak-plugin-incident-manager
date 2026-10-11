/**
 * Influence-of-clue records (ISM 8.17/8.18): stored Sworn-side in
 * mission_schema.json under `incident_response.clues`, with a CASIE History
 * line appended on every accept.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { ClueRecord } from '../domain/entities.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';
import { appendCasieHistory } from './segmentSplit.ts';

/** ISM Table 8.18 authenticity choices (α provisional pending WC3 calibration). */
export const CLUE_AUTHENTICITY_OPTIONS: { label: string; alpha: number }[] = [
    { label: 'Almost surely authentic', alpha: 0.95 },
    { label: 'Probably authentic', alpha: 0.75 },
    { label: 'Chances about even', alpha: 0.5 },
    { label: 'Probably not authentic', alpha: 0.25 },
    { label: 'Almost surely not authentic', alpha: 0.05 },
];

export function cluesFromSchema(schema: MissionSchema): ClueRecord[] {
    const raw = (schema.incident_response as Record<string, unknown>).clues;
    if (!Array.isArray(raw)) return [];
    const out: ClueRecord[] = [];
    for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const rec = value as Record<string, unknown>;
        const description = typeof rec.description === 'string' ? rec.description.trim() : '';
        const opNumber = Number(rec.opNumber);
        const authenticity = Number(rec.authenticity);
        if (!description || !Number.isInteger(opNumber) || opNumber < 0 || !Number.isFinite(authenticity)) continue;
        const letters: Record<string, string> = {};
        if (rec.letters && typeof rec.letters === 'object' && !Array.isArray(rec.letters)) {
            for (const [uid, letter] of Object.entries(rec.letters as Record<string, unknown>)) {
                if (typeof letter === 'string' && /^[A-I]$/i.test(letter)) letters[uid] = letter.toUpperCase();
            }
        }
        const clue: ClueRecord = { opNumber, description, authenticity, letters };
        if (typeof rec.authenticityLabel === 'string' && rec.authenticityLabel.trim()) {
            clue.authenticityLabel = rec.authenticityLabel.trim();
        }
        if (typeof rec.xref === 'string' && rec.xref.trim()) clue.xref = rec.xref.trim();
        if (typeof rec.recordedAt === 'string' && rec.recordedAt.trim()) clue.recordedAt = rec.recordedAt;
        out.push(clue);
    }
    return out;
}

export async function loadCluesFromMission(mission: ActiveMission): Promise<ClueRecord[]> {
    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);
    return cluesFromSchema(schema);
}

export async function addClueToMission(
    mission: ActiveMission,
    clue: ClueRecord,
    segmentLabels: Record<string, string>,
): Promise<void> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    const schema = loaded.schema;
    const now = new Date().toISOString();
    const record: ClueRecord = { ...clue, recordedAt: clue.recordedAt ?? now };

    const existing = cluesFromSchema(schema);
    (schema.incident_response as Record<string, unknown>).clues = [...existing, record];

    const nonNeutral = Object.entries(record.letters)
        .filter(([, letter]) => letter !== 'E')
        .map(([uid, letter]) => `${uid === 'ROW' ? 'R.O.W.' : (segmentLabels[uid] ?? uid)}: ${letter}`)
        .join(', ');
    appendCasieHistory(
        schema,
        `Influence of clue (OP${record.opNumber}): "${record.description}" — `
        + `${record.authenticityLabel ?? `α=${record.authenticity}`}`
        + `${record.xref ? `, xref ${record.xref}` : ''}`
        + `${nonNeutral ? ` [${nonNeutral}]` : ' [neutral]'}`,
        now,
    );

    await saveMissionSchema(sub, schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}
