import type { NavSectionHelpKey } from './navSectionHelp.ts';
import { SEARCH_ONLY_NAV_KEYS } from './incidentType.ts';

export interface NavSectionItem {
    key: string;
    label: string;
    helpKey?: NavSectionHelpKey;
    /** Hide unless the active incident type is `search`. */
    searchOnly?: boolean;
}

export interface NavSection {
    key: string;
    label: string;
    helpKey?: NavSectionHelpKey;
    items: NavSectionItem[];
}

export const CREATE_OPEN_NAV: NavSectionItem = {
    key: 'create-open',
    label: 'Create | Open',
};

export const NAV_SECTIONS: NavSection[] = [
    {
        key: 'h-initial',
        label: 'Initial Response',
        helpKey: 'route-location-search',
        items: [
            { key: 'initial-information', label: 'Initial Information' },
            { key: 'subject-info', label: 'Subject Information' },
            { key: 'search-urgency', label: 'Search Urgency', searchOnly: true },
            { key: 'search-scenarios', label: 'Search Scenarios', searchOnly: true },
            { key: 'ir-briefing', label: 'IR Briefing' },
            { key: 'incident-post', label: 'Incident POST' },
            { key: 'resources', label: 'Resources' },
            { key: 'work-assignments', label: 'Assignments' },
            { key: 'ics-201', label: 'ICS 201' },
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
        helpKey: 'area-search',
        items: [
            { key: 'operational-periods', label: 'Operational Periods', searchOnly: true },
        ],
    },
    {
        key: 'h-wrapup',
        label: 'Wrap Up',
        items: [
            { key: 'generate-report-template', label: 'Generate Report Template' },
        ],
    },
];

export const ALL_NAV_ITEMS: NavSectionItem[] = [
    CREATE_OPEN_NAV,
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

/** Drop search-only items (and empty section headers) when the incident is not Search. */
export function visibleNavSections(isSearch: boolean): NavSection[] {
    if (isSearch) return NAV_SECTIONS;
    return NAV_SECTIONS
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => !item.searchOnly && !SEARCH_ONLY_NAV_KEYS.has(item.key)),
        }))
        .filter((section) => section.items.length > 0);
}
