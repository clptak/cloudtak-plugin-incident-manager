/** Persist the Assignments org chart structure to DataSync (round-trip, not ICS export). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription } from './incidentSubscription.ts';
import { normalizeLogKeywords, type MissionLogLike } from './incidentInfo.ts';
import { emptyTree, treeHasContent, type HastyTreeNode } from './hastyTeamTree.ts';

export const ORG_CHART_TREE_KEYWORD = 'assignments-org-chart';

const JSON_MARKER = '---assignments-org-json---';

export function serializeOrgChartTree(tree: HastyTreeNode): string {
    return `Assignments org chart\n${JSON_MARKER}\n${JSON.stringify(tree)}`;
}

export function parseOrgChartTreeFromContent(content: string): HastyTreeNode | null {
    const idx = content.indexOf(JSON_MARKER);
    if (idx < 0) return null;
    const json = content.slice(idx + JSON_MARKER.length).trim();
    if (!json) return emptyTree();
    try {
        const parsed = JSON.parse(json) as HastyTreeNode;
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            self: parsed.self,
            children: Array.isArray(parsed.children) ? parsed.children : [],
        };
    } catch {
        return null;
    }
}

export function latestOrgChartFromLogs(logs: MissionLogLike[]): {
    tree: HastyTreeNode;
    logId: string;
} | null {
    let best: { tree: HastyTreeNode; logId: string; created: string } | null = null;

    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ORG_CHART_TREE_KEYWORD)) continue;

        const tree = parseOrgChartTreeFromContent(log.content ?? '');
        if (!tree) continue;

        const logId = String(log.id ?? '');
        if (!logId) continue;

        const created = log.created || log.dtg || '';
        if (!best || created > best.created) {
            best = { tree, logId, created };
        }
    }

    return best ? { tree: best.tree, logId: best.logId } : null;
}

export async function loadOrgChartFromMission(
    mission: ActiveMission,
): Promise<{ tree: HastyTreeNode; logId?: string }> {
    const sub = await loadIncidentSubscription(mission);
    const logs = await sub.log.list({ refresh: true });
    const saved = latestOrgChartFromLogs(logs);
    return saved ?? { tree: emptyTree() };
}

export async function saveOrgChartToMission(
    mission: ActiveMission,
    tree: HastyTreeNode,
    logId?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);

    if (!treeHasContent(tree)) {
        if (logId) {
            await sub.log.delete(logId);
            return undefined;
        }
        return undefined;
    }

    const body = {
        dtg: new Date().toISOString(),
        content: serializeOrgChartTree(tree),
        keywords: [ORG_CHART_TREE_KEYWORD],
    };

    if (logId) {
        await sub.log.update(logId, body);
        return logId;
    }

    const created = await sub.log.create(body);
    return String(created.id);
}
