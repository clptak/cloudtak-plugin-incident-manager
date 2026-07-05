/** SAR resource / position labels for the Assignments palette. */
export const ASSIGNMENT_RESOURCES = [
    '4WD',
    'ATV',
    'Boat',
    'Cavers',
    'Containment Team',
    'Climbers',
    'Divers',
    'Dog Team',
    'Drone',
    'Fixed Wing',
    'Grid Team',
    'Hasty Team',
    'Helicopter',
    'Horse Patrol',
    'Investigator',
    'Sign Cutter',
    'Ski Team',
    'Sound Sweep',
    'Trackers',
    'Vehicle',
] as const;

export type AssignmentResource = typeof ASSIGNMENT_RESOURCES[number];
