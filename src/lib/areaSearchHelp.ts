export const AREA_SEARCH_HELP = {
    title: 'Area Searches',
    intro: 'Area Searches are searches where segments (areas) are searched, rather than routes and locations. These searches are preceded by the entire search area being segmented. Then a consensus determination of the probability that the subject is in each of the segments of the search area is conducted, based on the assumption that the subject is immobile. Only a small number of searches reach this stage, but when they do, they are memorable and instructive!',
    characteristicsHeading: 'Area Searches are characterized by the following:',
    characteristics: [
        'The subject is assumed to be immobile.',
        'They involve several to many operational periods.',
        'Multiple trained resources, both paid and volunteer, not all local, are used (ground teams, canines, helicopters, fixed wing aircraft, horses, vehicles, climbers, infrared radar and others).',
        'Multiple agencies are often involved (Sheriff, Police, Highway Patrol, National Park Service, Forest Service, FBI, military).',
        'There are many search segments. The emphasis is on searching these segments rather than on searching routes and specific locations.',
        'Search Theory is used.',
        'There is extensive media coverage, both good and bad, with some "on the front page".',
        'There is pressure and anxiety on the search managers, as well as criticism of their actions, or lack of action.',
        'There are many "spontaneous" untrained volunteers, second guessers, and experts who seem to come out of the woodwork.',
    ],
    closing: 'In this category of search the primary search tactic used is some form of a grid search, in the broadest sense. This could include a helicopter using a creeping line search, a ground team using critical separation, or a handler using an air-scent dog. Hasty Search tactics such as sign cutting and tracking may also be used in Area Searches.',
    attribution: 'ATTRIBUTE FROM FINDEM',
} as const;
