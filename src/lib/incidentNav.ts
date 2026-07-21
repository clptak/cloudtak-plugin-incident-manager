import type { NavSectionHelpKey } from './navSectionHelp.ts';

export interface NavSectionItem {
    key: string;
    label: string;
    helpKey?: NavSectionHelpKey;
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
            { key: 'search-urgency', label: 'Search Urgency' },
            { key: 'search-scenarios', label: 'Search Scenarios' },
            { key: 'ir-briefing', label: 'IR Briefing' },
            { key: 'resources', label: 'Resources' },
            { key: 'work-assignments', label: 'Assignments' },
            { key: 'ics-201', label: 'ICS 201' },
        ],
    },
    {
        key: 'h-area',
        label: 'Area Search',
        helpKey: 'area-search',
        items: [
            { key: 'search-scenarios', label: 'Search Scenarios' },
            { key: 'search-area', label: 'Search Area', helpKey: 'establishing-search-area' },
            { key: 'risk-assessment', label: 'Risk Assessment' },
            { key: 'incident-post', label: 'Incident POST' },
            { key: 'casie', label: 'CASIE' },
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
