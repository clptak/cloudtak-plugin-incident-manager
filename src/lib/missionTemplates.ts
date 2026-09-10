/**
 * DataSync mission templates: list, SAR default, and Create | Open-style keywords.
 */

export const SAR_TEMPLATE_NAME = 'SAR';
export const DEFAULT_TEMPLATE_ID = 'default';
export const DEFAULT_TEMPLATE_NAME = 'Default';
export const MISSION_TEMPLATE_LIST_LIMIT = 100;

export interface MissionTemplateItem {
    id: string;
    name: string;
    keywords?: string[];
    icon?: string;
    description?: string;
}

export function defaultMissionTemplate(): MissionTemplateItem {
    return {
        id: DEFAULT_TEMPLATE_ID,
        name: DEFAULT_TEMPLATE_NAME,
        keywords: [],
    };
}

export function withDefaultTemplate(items: readonly MissionTemplateItem[]): MissionTemplateItem[] {
    return [defaultMissionTemplate(), ...items];
}

export function isSarTemplateName(name: string | undefined | null): boolean {
    return (name ?? '').trim().toLowerCase() === SAR_TEMPLATE_NAME.toLowerCase();
}

export function findSarTemplate(
    items: readonly MissionTemplateItem[],
): MissionTemplateItem | undefined {
    return items.find((item) => isSarTemplateName(item.name));
}

/**
 * Saved id wins when it is still in the live list; otherwise pick SAR by name.
 * Empty / missing / Default saved ids fall through to SAR.
 */
export function resolveSearchOpTemplate(
    items: readonly MissionTemplateItem[],
    savedId: string,
): MissionTemplateItem | undefined {
    const id = savedId.trim();
    if (id && id !== DEFAULT_TEMPLATE_ID) {
        const found = items.find((item) => item.id === id);
        if (found) return found;
    }
    return findSarTemplate(items);
}

/** Template keywords plus `template:<id>`, matching Create | Open (skip fake Default). */
export function buildTemplateKeywords(
    template: MissionTemplateItem | undefined | null,
): string[] {
    if (!template) return [];
    const kw: string[] = [];
    for (const keyword of template.keywords ?? []) {
        if (keyword && !kw.includes(keyword)) kw.push(keyword);
    }
    if (template.id && template.id !== DEFAULT_TEMPLATE_ID) {
        kw.push(`template:${template.id}`);
    }
    return kw;
}

export async function listMissionTemplates(
    opts: { filter?: string; limit?: number } = {},
): Promise<MissionTemplateItem[]> {
    const { server } = await import('../../../../src/std.ts');
    const res = await server.GET('/api/template/mission', {
        params: {
            query: {
                limit: opts.limit ?? MISSION_TEMPLATE_LIST_LIMIT,
                sort: 'name',
                page: 0,
                order: 'asc',
                filter: opts.filter ?? '',
            },
        },
    });
    if (res.error) throw new Error(res.error.message);
    return (res.data.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        keywords: item.keywords ?? [],
        icon: item.icon,
        description: item.description,
    }));
}
