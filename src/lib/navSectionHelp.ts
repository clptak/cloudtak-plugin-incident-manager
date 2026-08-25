import areaSearchMd from '../content/help/area_search.md?raw';
import routeAndLocationSearchMd from '../content/help/route_and_location_search.md?raw';
import establishingSearchAreaMd from '../content/help/establishing_search_area_0_main.md?raw';
import theoreticalSearchAreaMd from '../content/help/establishing_search_area_1_theoretical.md?raw';
import statisticalSearchAreaMd from '../content/help/establishing_search_area_2_statistical.md?raw';
import subjectiveSearchAreaMd from '../content/help/establishing_search_area_3_subjective.md?raw';
import segmentingSearchAreaMd from '../content/help/segmenting.md?raw';
import initialConsensusMd from '../content/help/consensus_summary.md?raw';
import resourceSummaryMd from '../content/help/resource_summary.md?raw';

export type NavSectionHelpKey =
    | 'area-search'
    | 'route-location-search'
    | 'establishing-search-area'
    | 'theoretical-search-area'
    | 'statistical-search-area'
    | 'subjective-search-area'
    | 'segmenting-search-area'
    | 'initial-consensus'
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
    'initial-consensus': {
        markdown: initialConsensusMd,
        ariaLabel: 'About Initial Consensus',
    },
    'resource-summary': {
        markdown: resourceSummaryMd,
        ariaLabel: 'About Resource Summary',
    },
};
