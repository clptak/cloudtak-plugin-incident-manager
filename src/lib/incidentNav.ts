import type { NavSectionHelpKey } from './navSectionHelp.ts';
import { SEARCH_ONLY_NAV_KEYS } from './incidentType.ts';

export interface NavSectionItem {
    key: string;
    label: string;
    helpKey?: NavSectionHelpKey;
    /** Hide unless the active incident type is `search`. */
    searchOnly?: boolean;
    /**
     * Sub-heading inside the section (Search incidents only). Consecutive
     * items with the same group sit under one sub-heading; non-search
     * incidents get the flat list without sub-headings.
     */
    group?: string;
}

export interface NavSection {
    key: string;
    label: string;
    /** Heading used when the incident is not a search (defaults to `label`). */
    nonSearchLabel?: string;
    helpKey?: NavSectionHelpKey;
    items: NavSectionItem[];
}

export const CREATE_OPEN_NAV: NavSectionItem = {
    key: 'create-open',
    label: 'Create | Open',
};

export const SETTINGS_NAV: NavSectionItem = {
    key: 'settings',
    label: 'Settings',
};

export const NAV_SECTIONS: NavSection[] = [
    {
        key: 'h-initial',
        label: 'Initial Response',
        helpKey: 'route-location-search',
        items: [
            { key: 'initial-information', label: 'Initial Information', group: 'Investigation' },
            { key: 'subject-info', label: 'Subject Information', group: 'Investigation' },
            { key: 'search-urgency', label: 'Search Urgency', searchOnly: true, group: 'Investigation' },
            { key: 'search-scenarios', label: 'Search Scenarios', searchOnly: true, group: 'Investigation' },
            { key: 'physical-wisar', label: 'Physical – WiSAR', searchOnly: true, group: 'Containment' },
            { key: 'ir-briefing', label: 'IR Briefing', group: 'Search' },
            { key: 'incident-post', label: 'Incident POST', group: 'Search' },
            { key: 'resources', label: 'Resources', group: 'Search' },
            { key: 'work-assignments', label: 'Assignments', group: 'Search' },
            { key: 'ics-201', label: 'ICS 201', group: 'Search' },
        ],
    },
    {
        key: 'h-search-transition',
        label: 'Search Transition',
        items: [
            { key: 'search-area', label: 'Search Area', helpKey: 'establishing-search-area', searchOnly: true },
            { key: 'segmentation', label: 'Segmentation', helpKey: 'segmenting-search-area', searchOnly: true },
            { key: 'initial-consensus', label: 'Initial Consensus', helpKey: 'initial-consensus', searchOnly: true },
        ],
    },
    {
        key: 'h-area',
        label: 'Area Search',
        // Every incident type runs operational periods — the OP DataSync
        // lifecycle, assignments, rosters, track logs, IAPs and demob are all
        // type-agnostic. Only POD and the CASIE rollup are search-specific, and
        // those are gated inside the pane rather than by hiding it.
        nonSearchLabel: 'Operations',
        helpKey: 'area-search',
        items: [
            { key: 'operational-periods', label: 'Operational Periods' },
        ],
    },
    {
        key: 'h-wrapup',
        label: 'Wrap Up',
        items: [
            { key: 'generate-closing-package', label: 'Generate Closing Package' },
        ],
    },
];

export const ALL_NAV_ITEMS: NavSectionItem[] = [
    CREATE_OPEN_NAV,
    SETTINGS_NAV,
    ...NAV_SECTIONS.flatMap((section) => section.items),
];

export function sectionKeyForNavItem(key: string): string | null {
    for (const section of NAV_SECTIONS) {
        if (section.items.some((item) => item.key === key)) {
            return section.key;
        }
    }
    return null;
}

/**
 * Drop search-only items (and empty section headers) when the incident is not
 * Search. Non-search incidents also lose the sub-headings (`group`), so their
 * list stays flat as before.
 */
export function visibleNavSections(isSearch: boolean): NavSection[] {
    if (isSearch) return NAV_SECTIONS;
    return NAV_SECTIONS
        .map((section) => ({
            ...section,
            label: section.nonSearchLabel ?? section.label,
            items: section.items
                .filter((item) => !item.searchOnly && !SEARCH_ONLY_NAV_KEYS.has(item.key))
                .map(({ group: _group, ...item }) => item),
        }))
        .filter((section) => section.items.length > 0);
}

/** Sub-heading to draw above items[index], or null when it continues the previous group. */
export function navGroupHeading(items: readonly NavSectionItem[], index: number): string | null {
    const group = items[index]?.group;
    if (!group) return null;
    return index > 0 && items[index - 1].group === group ? null : group;
}
