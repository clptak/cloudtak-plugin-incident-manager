import areaSearchMd from '../../docs/area_search.md?raw';
import routeAndLocationSearchMd from '../../docs/route_and_location_search.md?raw';
import establishingSearchAreaMd from '../../docs/establishing_search_area_0_main.md?raw';
import theoreticalSearchAreaMd from '../../docs/establishing_search_area_1_theoretical.md?raw';
import statisticalSearchAreaMd from '../../docs/establishing_search_area_2_statistical.md?raw';
import subjectiveSearchAreaMd from '../../docs/establishing_search_area_3_subjective.md?raw';
import segmentingSearchAreaMd from '../../docs/segmenting.md?raw';
import resourceSummaryMd from '../../docs/resource_summary.md?raw';

export type NavSectionHelpKey =
    | 'area-search'
    | 'route-location-search'
    | 'establishing-search-area'
    | 'theoretical-search-area'
    | 'statistical-search-area'
    | 'subjective-search-area'
    | 'segmenting-search-area'
    | 'resource-summary';

export interface NavSectionHelpDoc {
    markdown: string;
    ariaLabel: string;
}

export const NAV_SECTION_HELP: Record<NavSectionHelpKey, NavSectionHelpDoc> = {
    'area-search': {
        markdown: areaSearchMd,
        ariaLabel: 'About Area Searches',
    },
    'route-location-search': {
        markdown: routeAndLocationSearchMd,
        ariaLabel: 'About Route and Location Search',
    },
    'establishing-search-area': {
        markdown: establishingSearchAreaMd,
        ariaLabel: 'About Establishing the Search Area',
    },
    'theoretical-search-area': {
        markdown: theoreticalSearchAreaMd,
        ariaLabel: 'About Theoretical Search Area',
    },
    'statistical-search-area': {
        markdown: statisticalSearchAreaMd,
        ariaLabel: 'About Statistical Search Area',
    },
    'subjective-search-area': {
        markdown: subjectiveSearchAreaMd,
        ariaLabel: 'About Subjective Search Area',
    },
    'segmenting-search-area': {
        markdown: segmentingSearchAreaMd,
        ariaLabel: 'About Segmenting the Search Area',
    },
    'resource-summary': {
        markdown: resourceSummaryMd,
        ariaLabel: 'About Resource Summary',
    },
};
