import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import { normalizeLogKeywords, type MissionLogLike } from './incidentInfo.ts';
import {
    buildOrgChartLogContent,
    buildOrgChartLogKeywords,
    ORG_CHART_KEYWORD,
    orgChartLinesFromTree,
    orgKeyFromLogKeywords,
    type OrgChartExportLine,
} from './orgChartExport.ts';
import type { HastyTreeNode } from './hastyTeamTree.ts';
import { treeHasContent } from './hastyTeamTree.ts';

/** Mission log body with optional CoT linkage (DataSync entryUid). */
interface OrgChartLogWriteBody {
    dtg: string;
    content: string;
    keywords: string[];
    entryUid?: string;
}

export interface OrgChartSyncResult {
    created: number;
    updated: number;
    removed: number;
    lines: number;
}

function existingOrgLogs(logs: MissionLogLike[]): Map<string, string> {
    const byKey = new Map<string, string>();
    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ORG_CHART_KEYWORD)) continue;
        const key = orgKeyFromLogKeywords(keywords);
        const id = String(log.id ?? '');
        if (!key || !id) continue;
        byKey.set(key, id);
    }
    return byKey;
}

export async function syncOrgChartToDataSync(
    mission: ActiveMission,
    tree: HastyTreeNode,
): Promise<OrgChartSyncResult> {
    if (!treeHasContent(tree)) {
        throw new Error('Add at least one node to the org chart before syncing.');
    }

    const lines = orgChartLinesFromTree(tree);
    if (!lines.length) {
        throw new Error('No org chart positions to sync.');
    }

    const sub = await loadIncidentSubscription(mission);
    const missionToken = subscriptionMissionToken(sub, mission);
    const logs = await sub.log.list({ refresh: true });
    const existing = existingOrgLogs(logs);

    let created = 0;
    let updated = 0;
    let removed = 0;

    const currentKeys = new Set(lines.map((l) => l.key));

    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ORG_CHART_KEYWORD)) continue;
        const key = orgKeyFromLogKeywords(keywords);
        const id = String(log.id ?? '');
        if (!key || !id || currentKeys.has(key)) continue;
        await sub.log.delete(id);
        removed++;
    }

    for (const line of lines) {
        await upsertOrgLine(sub, line, existing.get(line.key));
        if (existing.has(line.key)) updated++;
        else created++;
    }

    return { created, updated, removed, lines: lines.length };
}

async function upsertOrgLine(
    sub: Awaited<ReturnType<typeof loadIncidentSubscription>>,
    line: OrgChartExportLine,
    existingId?: string,
): Promise<void> {
    const body: OrgChartLogWriteBody = {
        dtg: new Date().toISOString(),
        content: buildOrgChartLogContent(line),
        keywords: buildOrgChartLogKeywords(line),
    };
    if (line.entryUid) body.entryUid = line.entryUid;
    const log = sub.log as unknown as {
        create(body: OrgChartLogWriteBody): Promise<{ id: string }>;
        update(logid: string, body: OrgChartLogWriteBody): Promise<{ id: string }>;
    };
    if (existingId) {
        await log.update(existingId, body);
        return;
    }
    await log.create(body);
}
