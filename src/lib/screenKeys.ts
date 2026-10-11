/**
 * Which Mission Properties keys each screen edits, and readable names for
 * keys. Used by the "updated by another manager" banner (only changes to what
 * the open screen edits raise it) and by save-conflict messages.
 *
 * Keys are the schemaCodec layout: `s.<field>` and
 * `s.incident-response.<field>`, with "_" written as "-".
 */

const IR = 's.incident-response.';

/** Screen id: the nav key on the Main tab, `htab:<key>` on the other tabs. */
export function screenId(activeKey: string, activeHTab: string): string {
    return activeHTab === 'main' ? activeKey : `htab:${activeHTab}`;
}

/**
 * Keys each form screen edits. Screens not listed either have nothing to
 * overwrite (read-only views) or refresh their lists on their own
 * (Operational Periods lists, Dashboard).
 */
export const SCREEN_EDIT_KEYS: Record<string, string[]> = {
    'initial-information': [
        's.event-id', 's.incident-id', 's.dema-mission-number', 's.sar-coordinators',
        's.cad-data', 's.assignment',
        `${IR}incident-name`, `${IR}incident-id`, `${IR}incident-datetime`,
    ],
    'subject-info': [`${IR}subjects`],
    'search-area': [`${IR}ipp-coordinates`, `${IR}ipp-type`, 's.row-segments'],
    'segmentation': ['s.segments', 's.row-segments'],
    'initial-consensus': [`${IR}casie`],
    'search-urgency': [`${IR}urgency-rating`],
    'search-scenarios': [`${IR}scenarios`],
    'risk-assessment': ['s.risk', `${IR}work-assignments`],
    'incident-post': [`${IR}incident-post`],
    'resources': [`${IR}resource-assignments`, 's.default-agency'],
    'work-assignments': [`${IR}work-assignments`],
    // The IAP builder lives on this screen; its lists refresh by themselves.
    'operational-periods': [`${IR}iap-plans`],
    'htab:casie': [`${IR}casie`, `${IR}casie-scenarios`],
    'htab:organization': ['s.assignments-org-chart', `${IR}resource-assignments`],
    'htab:clues': [`${IR}clues`],
    'htab:risk-assessment': ['s.risk', `${IR}work-assignments`],
};

const LABELS: Record<string, string> = {
    's.event-id': 'Initial Information',
    's.incident-id': 'Initial Information',
    's.dema-mission-number': 'Initial Information',
    's.sar-coordinators': 'Initial Information',
    's.assignment': 'Initial Information',
    's.cad-data': 'CAD data',
    [`${IR}incident-name`]: 'Initial Information',
    [`${IR}incident-id`]: 'Initial Information',
    [`${IR}incident-datetime`]: 'Initial Information',
    [`${IR}subjects`]: 'Subject Information',
    [`${IR}ipp-coordinates`]: 'IPP',
    [`${IR}ipp-type`]: 'IPP',
    's.row-segments': 'ROW segments',
    's.segments': 'Segments',
    [`${IR}casie`]: 'CASIE',
    [`${IR}casie-scenarios`]: 'CASIE scenarios',
    [`${IR}urgency-rating`]: 'Search Urgency',
    [`${IR}scenarios`]: 'Search Scenarios',
    's.risk': 'Risk Assessment',
    [`${IR}work-assignments`]: 'Work Assignments',
    [`${IR}incident-post`]: 'Incident POST',
    [`${IR}resource-assignments`]: 'Resources',
    's.default-agency': 'Resources',
    [`${IR}iap-plans`]: 'IAP',
    's.assignments-org-chart': 'Organization chart',
    [`${IR}clues`]: 'Clues',
    [`${IR}op-assignments`]: 'Assignments',
};

/** A readable name for one key. */
export function keyLabel(key: string): string {
    if (LABELS[key]) return LABELS[key];
    const op = /^op\.(\d+)\.mission$/.exec(key);
    if (op) return `OP${op[1]}`;
    const debrief = /^op\.(\d+)\.debrief\./.exec(key);
    if (debrief) return `OP${debrief[1]} debriefs`;
    const field = key.startsWith(IR) ? key.slice(IR.length) : key.startsWith('s.') ? key.slice(2) : key;
    return field.replace(/[-.]/g, ' ');
}

/** Distinct readable names for a set of keys, in first-seen order. */
export function keyLabels(keys: Iterable<string>): string[] {
    return [...new Set([...keys].map(keyLabel))];
}

/** The keys among `changed` that the screen edits. */
export function screenChangedKeys(screen: string, changed: string[]): string[] {
    const edits = SCREEN_EDIT_KEYS[screen];
    if (!edits) return [];
    return changed.filter((key) => edits.includes(key));
}

/** Prefixes whose changes the Operational Periods lists reload for. */
export const OP_LIST_PREFIXES = [
    'op.',
    's.segments',
    's.row-segments',
    `${IR}op-assignments`,
    `${IR}resource-assignments`,
    `${IR}casie`,
];

export function touchesPrefixes(keys: string[], prefixes: string[]): boolean {
    return keys.some((key) => prefixes.some((p) => key.startsWith(p)));
}
