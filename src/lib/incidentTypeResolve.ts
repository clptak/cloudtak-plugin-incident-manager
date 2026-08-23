import { server } from '../../../../src/std.ts';
import {
    parentIncidentCandidateNames,
    parseIncidentTypeFromRecord,
} from './incidentType.ts';

/** Load `incidentType:` from a named DataSync, or '' if missing / unreachable. */
export async function fetchIncidentTypeByName(name: string): Promise<string> {
    try {
        const { data } = await server.GET('/api/marti/missions/{:name}', {
            params: {
                path: { ':name': name },
                query: { changes: false, logs: false },
            },
        });
        return parseIncidentTypeFromRecord(data);
    } catch {
        return '';
    }
}

/**
 * When an OP / later-period DataSync has no type keyword, inherit from the
 * parent incident (common map, OP-00, or MGMT sibling).
 */
export async function resolveIncidentTypeFromFamily(
    missionName: string,
    fallback = '',
): Promise<string> {
    for (const candidate of parentIncidentCandidateNames(missionName)) {
        const type = await fetchIncidentTypeByName(candidate);
        if (type) return type;
    }
    return fallback;
}
