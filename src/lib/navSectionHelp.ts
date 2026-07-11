import { AREA_SEARCH_HELP } from './areaSearchHelp.ts';
import { ROUTE_AND_LOCATION_SEARCH_HELP } from './routeAndLocationSearchHelp.ts';

export type NavSectionHelpKey = 'area-search' | 'route-location-search';

export interface NavSectionHelpContent {
    title: string;
    intro: string;
    characteristicsHeading: string;
    characteristics: readonly string[];
    closing: string;
    emphasis?: string;
    attribution: string;
    ariaLabel: string;
}

export const NAV_SECTION_HELP: Record<NavSectionHelpKey, NavSectionHelpContent> = {
    'area-search': {
        ...AREA_SEARCH_HELP,
        ariaLabel: 'About Area Searches',
    },
    'route-location-search': {
        ...ROUTE_AND_LOCATION_SEARCH_HELP,
        ariaLabel: 'About Route and Location Search',
    },
};
