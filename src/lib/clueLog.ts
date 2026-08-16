/**
 * Structured clue logs (from the "Clue Found" DataSync template):
 * mission log entries carrying keyword-encoded fields, written to the sync
 * where the clue is reported (current OP by default) and tracked across ALL
 * incident syncs (common map, MGMT, every OP) for the Dashboard.
 */

import Subscription from '../../../../src/base/subscription.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';

export const CLUE_LOG_KEYWORD = 'clue-log';

export const CLUE_VALIDATIONS = ['Pending', 'Yes', 'No'] as const;
export type ClueValidation = (typeof CLUE_VALIDATIONS)[number];

export const CLUE_DISPOSITIONS = [
    'Take Photo and Mark',
    'Collect',
    'Mark Only',
    'Invalidated',
] as const;
export type ClueDisposition = (typeof CLUE_DISPOSITIONS)[number];

export interface ClueLogEntry {
    number: number;
    validation: ClueValidation;
    disposition: ClueDisposition | '';
    finder: string;
    /** CoT uid of the marker/photo on the map representing the clue. */
    markerUid?: string;
    markerCallsign?: string;
    notes?: string;
}

export interface TrackedClue extends ClueLogEntry {
    logId: string;
    /** Which sync the log lives on. */
    sourceLabel: string;
    sourceGuid: string;
    sourceToken?: string;
    at: string;
}

function kw(keywords: string[] | undefined, prefix: string): string {
    const tag = keywords?.find((k) => k.startsWith(prefix));
    return tag ? tag.slice(prefix.length) : '';
}

export function buildClueKeywords(entry: ClueLogEntry): string[] {
    const keywords = [
        CLUE_LOG_KEYWORD,
        `clue-number:${entry.number}`,
        `clue-validation:${entry.validation}`,
    ];
    if (entry.disposition) keywords.push(`clue-disposition:${entry.disposition}`);
    if (entry.finder.trim()) keywords.push(`clue-finder:${entry.finder.trim()}`);
    if (entry.markerUid) keywords.push(`uid:${entry.markerUid}`);
    if (entry.markerCallsign) keywords.push(`clue-marker:${entry.markerCallsign}`);
    return keywords;
}

export function buildClueContent(entry: ClueLogEntry): string {
    const parts = [
        `Clue #${entry.number}`,
        entry.markerCallsign ? `Marker: ${entry.markerCallsign}` : '',
        `Validation: ${entry.validation}`,
        entry.disposition ? `Disposition: ${entry.disposition}` : '',
        entry.finder.trim() ? `Found by: ${entry.finder.trim()}` : '',
        entry.notes?.trim() ? entry.notes.trim() : '',
    ].filter(Boolean);
    return parts.join(' · ');
}

interface LogLike {
    id?: string | number;
    content?: string;
    keywords?: string[];
    created?: string;
    dtg?: string;
}

export function parseClueLog(log: LogLike): ClueLogEntry | null {
    if (!log.keywords?.includes(CLUE_LOG_KEYWORD)) return null;
    const number = Number(kw(log.keywords, 'clue-number:'));
    if (!Number.isInteger(number) || number < 1) return null;
    const validationRaw = kw(log.keywords, 'clue-validation:');
    const validation = (CLUE_VALIDATIONS as readonly string[]).includes(validationRaw)
        ? validationRaw as ClueValidation
        : 'Pending';
    const dispositionRaw = kw(log.keywords, 'clue-disposition:');
    const disposition = (CLUE_DISPOSITIONS as readonly string[]).includes(dispositionRaw)
        ? dispositionRaw as ClueDisposition
        : '';
    return {
        number,
        validation,
        disposition,
        finder: kw(log.keywords, 'clue-finder:'),
        markerUid: kw(log.keywords, 'uid:') || undefined,
        markerCallsign: kw(log.keywords, 'clue-marker:') || undefined,
    };
}

interface ClueSource {
    label: string;
    guid: string;
    token?: string;
}

/** All syncs a clue may be logged on: common map, MGMT, and every OP. */
export function clueSources(
    mission: ActiveMission,
    registry: OpPeriodRegistryEntry[],
): ClueSource[] {
    const sources: ClueSource[] = [
        { label: mission.name, guid: mission.guid, token: mission.missionToken },
    ];
    if (mission.mgmt) {
        sources.push({ label: 'MGMT', guid: mission.mgmt.guid, token: mission.mgmt.missionToken });
    }
    for (const op of registry) {
        sources.push({ label: `OP${op.opNumber}`, guid: op.guid, token: op.ownerToken });
    }
    return sources;
}

/** Gather clue logs across every reachable sync, newest first. */
export async function listTrackedClues(
    mission: ActiveMission,
    registry: OpPeriodRegistryEntry[],
): Promise<TrackedClue[]> {
    const out: TrackedClue[] = [];
    const seen = new Set<string>();
    for (const source of clueSources(mission, registry)) {
        try {
            const sub = await Subscription.load(source.guid, {
                missiontoken: source.token ?? '',
                reload: false,
            });
            const logs = await sub.log.list({ refresh: true }) as LogLike[];
            for (const log of logs) {
                const entry = parseClueLog(log);
                const logId = String(log.id ?? '');
                if (!entry || !logId || seen.has(logId)) continue;
                seen.add(logId);
                out.push({
                    ...entry,
                    logId,
                    sourceLabel: source.label,
                    sourceGuid: source.guid,
                    sourceToken: source.token,
                    at: log.dtg || log.created || '',
                });
            }
        } catch { /* unreachable sync — skip */ }
    }
    return out.sort((a, b) => b.number - a.number);
}

export function nextClueNumber(clues: TrackedClue[]): number {
    return clues.reduce((max, c) => Math.max(max, c.number), 0) + 1;
}

interface ClueLogBody {
    dtg: string;
    content: string;
    keywords: string[];
    /** First-class DataSync CoT association (fork log-entryuid support). */
    entryUid?: string;
}

function clueLogWriter(sub: Subscription): {
    create(body: ClueLogBody): Promise<{ id: string }>;
    update(logid: string, body: ClueLogBody): Promise<{ id: string }>;
} {
    return sub.log as unknown as ReturnType<typeof clueLogWriter>;
}

export async function createClueLog(
    target: { guid: string; token?: string },
    entry: ClueLogEntry,
): Promise<void> {
    const sub = await Subscription.load(target.guid, {
        missiontoken: target.token ?? '',
        subscribed: true,
        reload: false,
    });
    await clueLogWriter(sub).create({
        dtg: new Date().toISOString(),
        content: buildClueContent(entry),
        keywords: buildClueKeywords(entry),
        entryUid: entry.markerUid,
    });
}

/** Update validation/disposition on an existing clue log (full body rewrite). */
export async function updateClueLog(clue: TrackedClue, patch: {
    validation?: ClueValidation;
    disposition?: ClueDisposition | '';
}): Promise<void> {
    const next: ClueLogEntry = {
        ...clue,
        validation: patch.validation ?? clue.validation,
        disposition: patch.disposition !== undefined ? patch.disposition : clue.disposition,
    };
    const sub = await Subscription.load(clue.sourceGuid, {
        missiontoken: clue.sourceToken ?? '',
        reload: false,
    });
    await clueLogWriter(sub).update(clue.logId, {
        dtg: clue.at || new Date().toISOString(),
        content: buildClueContent(next),
        keywords: buildClueKeywords(next),
        entryUid: next.markerUid,
    });
}
