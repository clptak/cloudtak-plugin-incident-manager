import { INCIDENT_COMMAND_POSITIONS } from '../data/incidentCommandPositions.ts';
import { normalizeLogKeywords, type MissionLogLike } from './incidentInfo.ts';
import { formatPersonNameFirstLast } from './personName.ts';
import type { AssignmentNodeSelf, HastyTreeNode } from './hastyTeamTree.ts';

/** Mission-log keyword — org chart rows for ICS 201 §9. */
export const ORG_CHART_KEYWORD = 'ics-org';

export type Ics201OrgField =
    | 'incidentCommanders'
    | 'liaisonOfficer'
    | 'safetyOfficer'
    | 'publicInformationOfficer'
    | 'planningSectionChief'
    | 'operationsSectionChief'
    | 'financeSectionChief'
    | 'logisticsSectionChief'
    | 'organizationNotes';

/** Single combined log for all ICS §9 command roles. */
export const INCIDENT_COMMAND_COMBINED_FIELD = 'incidentCommand';

export type OrgChartPdfField = Ics201OrgField | typeof INCIDENT_COMMAND_COMBINED_FIELD;

export interface OrgChartExportLine {
    /** Stable id for upsert (`team:uuid`, `incident-command`, `role:uuid`, …). */
    key: string;
    content: string;
    pdfField?: OrgChartPdfField;
    order: number;
}

const ICS_ROLE_TO_PDF_FIELD: Record<string, Exclude<Ics201OrgField, 'organizationNotes'>> = {
    ic: 'incidentCommanders',
    lo: 'liaisonOfficer',
    so: 'safetyOfficer',
    pio: 'publicInformationOfficer',
    plan: 'planningSectionChief',
    ops: 'operationsSectionChief',
    fin: 'financeSectionChief',
    log: 'logisticsSectionChief',
};

const ICS_TITLE_TO_PDF_FIELD = Object.fromEntries(
    INCIDENT_COMMAND_POSITIONS.map((pos) => [pos.title.toLowerCase(), ICS_ROLE_TO_PDF_FIELD[pos.key]]),
) as Record<string, Exclude<Ics201OrgField, 'organizationNotes'> | undefined>;

const ICS_KEY_TO_TITLE = Object.fromEntries(
    INCIDENT_COMMAND_POSITIONS.map((pos) => [pos.key, pos.title]),
) as Record<string, string>;

export function parseIncidentCommandLogContent(
    content: string,
): Partial<Record<Exclude<Ics201OrgField, 'organizationNotes'>, string>> {
    const result: Partial<Record<Exclude<Ics201OrgField, 'organizationNotes'>, string>> = {};

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const colon = trimmed.indexOf(':');
        if (colon < 0) continue;

        const title = trimmed.slice(0, colon).trim().toLowerCase();
        const value = trimmed.slice(colon + 1).trim();
        if (!value) continue;

        const field = ICS_TITLE_TO_PDF_FIELD[title];
        if (field) result[field] = value;
    }

    return result;
}

function buildCombinedIncidentCommandContent(
    roles: Map<string, { title: string; assignee: string }>,
): string {
    const lines: string[] = [];
    for (const pos of INCIDENT_COMMAND_POSITIONS) {
        const entry = roles.get(pos.key);
        const assignee = entry?.assignee.trim();
        if (!assignee) continue;
        const title = entry?.title.trim() || pos.title;
        lines.push(`${title}: ${assignee}`);
    }
    return lines.join('\n');
}

export function isTeamLikeNode(self: AssignmentNodeSelf): boolean {
    if (self.type === 'team') return true;
    return /\bteam\b/i.test(self.title);
}

function incidentCommandRoleKey(
    self: AssignmentNodeSelf,
    pdfField: Exclude<Ics201OrgField, 'organizationNotes'>,
): string | null {
    if (self.roleCategory === 'rescue-management') return null;
    if (self.roleKey && ICS_ROLE_TO_PDF_FIELD[self.roleKey]) return self.roleKey;
    if (self.roleCategory === 'incident-command') {
        const fromField = Object.entries(ICS_ROLE_TO_PDF_FIELD)
            .find(([, field]) => field === pdfField)?.[0];
        if (fromField) return fromField;
    }
    return null;
}

function pdfFieldForRole(self: AssignmentNodeSelf): Exclude<Ics201OrgField, 'organizationNotes'> | undefined {
    if (self.roleKey && ICS_ROLE_TO_PDF_FIELD[self.roleKey]) {
        return ICS_ROLE_TO_PDF_FIELD[self.roleKey];
    }
    const titleKey = (self.roleTitle ?? self.title).toLowerCase();
    return ICS_TITLE_TO_PDF_FIELD[titleKey];
}

function personNameForExport(raw?: string): string {
    return raw ? formatPersonNameFirstLast(raw) : '';
}

function labelForNode(self: AssignmentNodeSelf): string {
    if (self.type === 'member') return personNameForExport(self.title);
    if (self.type === 'role') {
        const name = personNameForExport(self.assigneeName);
        if (name) return name;
        return (self.roleTitle ?? self.title).trim();
    }
    if (self.type === 'position') return self.title.trim();
    return personNameForExport(self.title) || self.title.trim();
}

function notesLineForNode(self: AssignmentNodeSelf): string {
    if (self.type === 'role') {
        const title = (self.roleTitle ?? self.title).trim();
        const name = personNameForExport(self.assigneeName);
        if (title && name) return `${title}: ${name}`;
        return title || name || '';
    }
    return labelForNode(self);
}

/** All people/resources under a team (full subtree), deepest-first within each branch. */
function teamDescendantLabels(node: HastyTreeNode): string[] {
    const labels: string[] = [];

    const walk = (parent: HastyTreeNode): void => {
        const children = [...(parent.children ?? [])].reverse();
        for (const child of children) {
            if (!child.self) continue;
            if (isTeamLikeNode(child.self)) {
                walk(child);
                continue;
            }
            const label = personNameForTeamList(child.self);
            if (label) labels.push(label);
            walk(child);
        }
    };

    walk(node);
    return labels;
}

function personNameForTeamList(self: AssignmentNodeSelf): string {
    if (self.type === 'member') return personNameForExport(self.title);
    if (self.type === 'role') return personNameForExport(self.assigneeName);
    if (self.type === 'position') return self.title.trim();
    return personNameForExport(self.title);
}

function teamLineContent(self: AssignmentNodeSelf, node: HastyTreeNode): string {
    const title = self.title.trim();
    const labels = teamDescendantLabels(node);
    if (!labels.length) return title;
    return `${title}: ${labels.join(', ')}`;
}

/**
 * Walk the org chart and produce one DataSync line per position.
 * Team nodes (title contains "Team") collapse the full subtree into one comma-separated line.
 */
export function orgChartLinesFromTree(tree: HastyTreeNode): OrgChartExportLine[] {
    const lines: OrgChartExportLine[] = [];
    const incidentCommandRoles = new Map<string, { title: string; assignee: string }>();
    let order = 0;

    const push = (
        key: string,
        content: string,
        pdfField?: OrgChartPdfField,
        entryUid?: string,
    ): void => {
        const trimmed = content.trim();
        if (!trimmed && pdfField !== INCIDENT_COMMAND_COMBINED_FIELD) return;
        lines.push({
            key,
            content: trimmed,
            pdfField,
            order: order++,
            entryUid: entryUid?.trim() || undefined,
        });
    };

    const visit = (node: HastyTreeNode): void => {
        if (!node.self) {
            for (const child of node.children ?? []) visit(child);
            return;
        }

        const self = node.self;

        if (isTeamLikeNode(self)) {
            push(`team:${self.id}`, teamLineContent(self, node), undefined, self.assignmentUid);
            return;
        }

        const pdfField = self.type === 'role' ? pdfFieldForRole(self) : undefined;
        const icsKey = pdfField ? incidentCommandRoleKey(self, pdfField) : null;
        if (icsKey) {
            const assignee = personNameForExport(self.assigneeName);
            if (assignee) {
                incidentCommandRoles.set(icsKey, {
                    title: self.roleTitle ?? ICS_KEY_TO_TITLE[icsKey] ?? self.title,
                    assignee,
                });
            }
            for (const child of node.children ?? []) visit(child);
            return;
        }

        if (pdfField) {
            const assignee = personNameForExport(self.assigneeName) || labelForNode(self);
            push(`ics:${self.roleKey ?? self.id}`, assignee, pdfField);
        } else {
            push(`node:${self.id}`, notesLineForNode(self));
        }

        for (const child of node.children ?? []) visit(child);
    };

    visit(tree);

    const incidentCommandContent = buildCombinedIncidentCommandContent(incidentCommandRoles);
    if (incidentCommandContent) {
        push('incident-command', incidentCommandContent, INCIDENT_COMMAND_COMBINED_FIELD);
    }

    return lines;
}

export function buildOrgChartLogKeywords(line: OrgChartExportLine): string[] {
    const kws = [
        ORG_CHART_KEYWORD,
        `org:${line.key}`,
        `order:${line.order}`,
        `field:${line.pdfField ?? 'organizationNotes'}`,
    ];
    if (line.entryUid) kws.push(`uid:${line.entryUid}`);
    return kws;
}

export function buildOrgChartLogContent(line: OrgChartExportLine): string {
    return line.content;
}

export function orgKeyFromLogKeywords(keywords: string[]): string | null {
    const tag = keywords.find((k) => k.startsWith('org:'));
    return tag ? tag.slice(4) : null;
}

export function orderFromLogKeywords(keywords: string[]): number {
    const tag = keywords.find((k) => k.startsWith('order:'));
    if (!tag) return Number.MAX_SAFE_INTEGER;
    const n = Number(tag.slice(6));
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

export function pdfFieldFromLogKeywords(
    keywords: string[],
): OrgChartPdfField | null {
    const tag = keywords.find((k) => k.startsWith('field:'));
    if (!tag) return null;
    return tag.slice(6) as OrgChartPdfField;
}

export function organizationFromOrgChartLogs(
    logs: MissionLogLike[],
): Partial<Record<Ics201OrgField, string>> {
    const result: Partial<Record<Ics201OrgField, string>> = {};
    const noteLines: { order: number; content: string; created: string }[] = [];
    const fieldLatest: Partial<Record<Exclude<Ics201OrgField, 'organizationNotes'>, {
        content: string;
        created: string;
    }>> & Partial<Record<typeof INCIDENT_COMMAND_COMBINED_FIELD, {
        content: string;
        created: string;
    }>> = {};

    for (const log of logs) {
        const keywords = normalizeLogKeywords(log.keywords);
        if (!keywords.includes(ORG_CHART_KEYWORD)) continue;
        const field = pdfFieldFromLogKeywords(keywords);
        if (!field) continue;

        const content = (log.content ?? '').trim();
        const created = log.created || log.dtg || '';

        if (field === 'organizationNotes') {
            if (content) {
                noteLines.push({
                    order: orderFromLogKeywords(keywords),
                    content,
                    created,
                });
            }
            continue;
        }

        if (field === INCIDENT_COMMAND_COMBINED_FIELD) {
            const prev = fieldLatest[INCIDENT_COMMAND_COMBINED_FIELD];
            if (!prev || created >= prev.created) {
                fieldLatest[INCIDENT_COMMAND_COMBINED_FIELD] = { content, created };
            }
            continue;
        }

        const prev = fieldLatest[field as Exclude<Ics201OrgField, 'organizationNotes'>];
        if (!prev || created >= prev.created) {
            fieldLatest[field] = { content, created };
        }
    }

    for (const [field, entry] of Object.entries(fieldLatest)) {
        if (!entry) continue;
        if (field === INCIDENT_COMMAND_COMBINED_FIELD) {
            Object.assign(result, parseIncidentCommandLogContent(entry.content));
            continue;
        }
        result[field as Ics201OrgField] = entry.content;
    }

    if (noteLines.length) {
        noteLines.sort((a, b) => a.order - b.order || a.created.localeCompare(b.created));
        result.organizationNotes = noteLines.map((l) => l.content).join('\n');
    }

    return result;
}
