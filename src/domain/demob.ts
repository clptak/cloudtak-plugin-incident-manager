/**
 * Demobilization packaging rules (pure): what goes into the case-file bundle
 * and what the closeout does to the incident's DataSyncs.
 *
 * Two variants (ISM phase 4):
 * - `closed`: subject located / search suspended — every sync is archived and
 *   the common map may be retired with the rest.
 * - `limited-continuous`: subject NOT found; a limited continuous search
 *   continues, so the common map stays live and field-visible while the OP
 *   syncs and planning material are archived.
 */

export type DemobVariant = 'closed' | 'limited-continuous';

export interface DemobSourceRef {
    /** 'common' | 'mgmt' | 'op' */
    kind: 'common' | 'mgmt' | 'op';
    label: string;
    guid: string;
    opNumber?: number;
}

export interface DemobOptions {
    variant: DemobVariant;
    includeArchives: boolean;
    includeIaps: boolean;
    includeCasieExport: boolean;
    includeReport: boolean;
}

export function defaultDemobOptions(): DemobOptions {
    return {
        variant: 'closed',
        includeArchives: true,
        includeIaps: true,
        includeCasieExport: true,
        includeReport: true,
    };
}

/**
 * Every sync is archived in both variants — the case file must be complete.
 * Ordering is stable for the manifest: common map, MGMT, then OPs ascending.
 */
export function archivableSources(sources: DemobSourceRef[]): DemobSourceRef[] {
    const rank = (s: DemobSourceRef): number =>
        (s.kind === 'common' ? 0 : s.kind === 'mgmt' ? 1 : 2);
    return [...sources].sort((a, b) =>
        rank(a) - rank(b) || (a.opNumber ?? 0) - (b.opNumber ?? 0));
}

/**
 * Syncs left live after packaging. Under a limited continuous search the
 * common map keeps running for field reporting, so its archive in the bundle
 * is a point-in-time snapshot rather than a final record.
 */
export function retainedSources(
    sources: DemobSourceRef[],
    variant: DemobVariant,
): DemobSourceRef[] {
    if (variant !== 'limited-continuous') return [];
    return sources.filter((s) => s.kind === 'common');
}

export interface ManifestEntry {
    path: string;
    description: string;
}

/** Human-readable manifest lines describing the bundle contents. */
export function buildManifest(input: {
    incidentName: string;
    incidentNumber: string;
    generatedAt: string;
    variant: DemobVariant;
    entries: ManifestEntry[];
    retained: DemobSourceRef[];
}): string {
    const lines: string[] = [
        `DEMOBILIZATION PACKAGE — ${input.incidentName}`,
        input.incidentNumber ? `Report #: ${input.incidentNumber}` : '',
        `Generated: ${input.generatedAt}`,
        `Closeout: ${input.variant === 'closed'
            ? 'Search closed — all DataSyncs archived'
            : 'LIMITED CONTINUOUS SEARCH — common map remains live'}`,
        '',
        'CONTENTS',
        ...input.entries.map((e) => `  ${e.path}${' '.repeat(Math.max(1, 44 - e.path.length))}${e.description}`),
    ].filter((l) => l !== '');

    if (input.retained.length) {
        lines.push(
            '',
            'LEFT ACTIVE (not retired)',
            ...input.retained.map((s) => `  ${s.label} (${s.guid})`),
            '',
            'Archives of the live sync above are a point-in-time snapshot;',
            're-run the package when the limited continuous search ends.',
        );
    }
    return lines.join('\n') + '\n';
}
