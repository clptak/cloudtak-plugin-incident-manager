/** Persist the Assignments org chart in mission_schema.json (not mission logs). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadIncidentSubscription, subscriptionMissionToken } from './incidentSubscription.ts';
import { normalizeLogKeywords, type MissionLogLike } from './incidentInfo.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import { emptyTree, treeHasContent, type HastyTreeNode } from './hastyTeamTree.ts';

/** Legacy mission-log keyword from an earlier build; removed on load when found. */
export const ORG_CHART_TREE_KEYWORD = 'assignments-org-chart';

const JSON_MARKER = '---assignments-org-json---';

export function orgChartFromSchemaValue(value: unknown): HastyTreeNode {
    if (!value || typeof value !== 'object') return emptyTree();
    const parsed = value as HastyTreeNode;
    return {
        self: parsed.self,
        children: Array.isArray(parsed.children) ? parsed.children : [],
    };
}

export function applyOrgChartToSchema(schema: MissionSchema, tree: HastyTreeNode): void {
    schema.assignments_org_chart = treeHasContent(tree) ? tree : {};
}

function parseOrgChartTreeFromLogContent(content: string): HastyTreeNode | null {
    const idx = content.indexOf(JSON_MARKER);
    if (idx < 0) return null;
    const json = content.slice(idx + JSON_MARKER.length).trim();
    if (!json) return emptyTree();
    try {
        return orgChartFromSchemaValue(JSON.parse(json));
    } catch {
        return null;
    }
}

function latestOrgChartFromLogs(logs: MissionLogLike[]): HastyTreeNode | null {
    let best: { tree: HastyTreeNode; created: string } | null = null;

    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ORG_CHART_TREE_KEYWORD)) continue;

        const tree = parseOrgChartTreeFromLogContent(log.content ?? '');
        if (!tree) continue;

        const created = log.created || log.dtg || '';
        if (!best || created > best.created) {
            best = { tree, created };
        }
    }

    return best?.tree ?? null;
}

async function deleteLegacyOrgChartLogs(
    sub: Awaited<ReturnType<typeof loadIncidentSubscription>>,
): Promise<number> {
    if (!sub.log.delete) return 0;

    const logs = await sub.log.list({ refresh: true });
    let removed = 0;
    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ORG_CHART_TREE_KEYWORD)) continue;
        const logId = String(log.id ?? '');
        if (!logId) continue;
        try {
            await sub.log.delete(logId);
            removed += 1;
        } catch {
            /* log may already be gone */
        }
    }
    return removed;
}

export async function loadOrgChartFromMission(
    mission: ActiveMission,
): Promise<{ tree: HastyTreeNode; contentHash?: string; migratedFromLog?: boolean }> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    let tree = orgChartFromSchemaValue(loaded.schema.assignments_org_chart);
    let migratedFromLog = false;

    if (!treeHasContent(tree)) {
        const logs = await sub.log.list({ refresh: true });
        const legacyTree = latestOrgChartFromLogs(logs);
        if (legacyTree && treeHasContent(legacyTree)) {
            tree = legacyTree;
            migratedFromLog = true;
        }
    }

    if (migratedFromLog) {
        applyOrgChartToSchema(loaded.schema, tree);
        applyMissionContextToSchema(loaded.schema, mission.name);
        const saved = await saveMissionSchema(sub, loaded.schema, {
            contentHash: loaded.contentHash,
            legacyLogId: loaded.legacyLogId,
            missionToken: subscriptionMissionToken(sub, mission),
        });
        await deleteLegacyOrgChartLogs(sub);
        return { tree, contentHash: saved.contentHash, migratedFromLog: true };
    }

    await deleteLegacyOrgChartLogs(sub);
    return { tree, contentHash: loaded.contentHash };
}

export async function saveOrgChartToMission(
    mission: ActiveMission,
    tree: HastyTreeNode,
    contentHash?: string,
): Promise<string | undefined> {
    const sub = await loadIncidentSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    applyOrgChartToSchema(loaded.schema, tree);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: subscriptionMissionToken(sub, mission),
    });

    return saved.contentHash;
}
