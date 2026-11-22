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
    label: 'Open Incident',
};

export const SETTINGS_NAV: NavSectionItem = {
    key: 'settings',
    label: 'Settings',
};

/**
 * Incident-wide views, pinned under Open Incident (not scrolled) and shown
 * for every incident type except where marked search-only (#44). These were
 * the horizontal tabs.
 */
export const INCIDENT_NAV_ITEMS: NavSectionItem[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'incident-summary', label: 'Incident Summary' },
    { key: 'logs', label: 'Logs' },
    { key: 'task', label: 'Tasks & Checklists' },
    { key: 'organization', label: 'Personnel' },
    { key: 'resources', label: 'Resources & Assignments' },
    { key: 'clues', label: 'Clues', searchOnly: true },
];

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
            { key: 'physical-wisar', label: 'Motion Model Tools', searchOnly: true, group: 'Containment' },
            { key: 'lpb-distances', label: 'Lost Person Behavior', searchOnly: true, group: 'Containment' },
            { key: 'ir-briefing', label: 'IR Briefing', group: 'Search' },
            { key: 'incident-post', label: 'Obj | Strategy | Tactics', group: 'Search' },
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
            { key: 'casie', label: 'CASIE', searchOnly: true },
        ],
    },
    {
        // Risk runs with every incident type (#44).
        key: 'h-risk',
        label: 'Risk Management',
        items: [
            { key: 'risk-assessment', label: 'Risk Assessment' },
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
    ...INCIDENT_NAV_ITEMS,
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
 * list stays flat as before, and the search-method help pop-outs (#42).
 */
export function visibleNavSections(isSearch: boolean): NavSection[] {
    if (isSearch) return NAV_SECTIONS;
    return NAV_SECTIONS
        .map((section) => ({
            ...section,
            helpKey: undefined,
            label: section.nonSearchLabel ?? section.label,
            items: section.items
                .filter((item) => !hiddenForNonSearch(item))
                .map((item) => {
                    const flat = { ...item };
                    delete flat.group;
                    delete flat.helpKey;
                    return flat;
                }),
        }))
        .filter((section) => section.items.length > 0);
}

function hiddenForNonSearch(item: NavSectionItem): boolean {
    return !!item.searchOnly || SEARCH_ONLY_NAV_KEYS.has(item.key);
}

/** The pinned incident-wide items for this incident type. */
export function visibleIncidentNavItems(isSearch: boolean): NavSectionItem[] {
    return isSearch ? INCIDENT_NAV_ITEMS : INCIDENT_NAV_ITEMS.filter((item) => !hiddenForNonSearch(item));
}

/** Sub-heading to draw above items[index], or null when it continues the previous group. */
export function navGroupHeading(items: readonly NavSectionItem[], index: number): string | null {
    const group = items[index]?.group;
    if (!group) return null;
    return index > 0 && items[index - 1].group === group ? null : group;
}
