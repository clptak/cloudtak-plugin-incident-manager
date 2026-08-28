/**
 * Demobilization documentation package (ISM phase 4).
 *
 * Bundles the whole case file into one zip: a TAK mission archive for every
 * incident DataSync (common map, MGMT, each OP), the management schema, the
 * WinCASIE III export, every saved operational-period IAP, and a manifest.
 * Sources that cannot be reached are recorded in the manifest rather than
 * failing the export — a partial case file beats none at demob time.
 */

import { server } from '../../../../src/std.ts';
import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import {
    archivableSources,
    buildManifest,
    retainedSources,
    type DemobOptions,
    type DemobSourceRef,
    type ManifestEntry,
} from '../domain/demob.ts';
import { buildIapSections, loadIapInputs, type IapContext } from './iapData.ts';
import { buildIapPdf } from './iapPdf.ts';
import { iapPlanFromValue, prefillIapPlan, type IapPlan } from './iapPlanPersistence.ts';
import { loadSchemaSubscription } from './incidentSubscription.ts';
import { loadMissionSchema, missionSchemaFilename } from './missionSchema.ts';
import { registryFromSchemaValue } from '../domain/registry.ts';
import { consensusFromSchema } from './casiePersistence.ts';
import { segmentsFromSchema } from './segmentsPersistence.ts';
import { describeSave, saveGeneratedFile } from './fileTarget.ts';
import { buildStoreZip, buildWc3Files, safeWc3Basename } from './wc3Export.ts';

/** All DataSyncs belonging to the incident. */
export function demobSources(
    mission: ActiveMission,
    registry: OpPeriodRegistryEntry[],
): (DemobSourceRef & { token?: string; name: string })[] {
    const out: (DemobSourceRef & { token?: string; name: string })[] = [
        {
            kind: 'common', label: mission.name, name: mission.name,
            guid: mission.guid, token: mission.missionToken,
        },
    ];
    if (mission.mgmt) {
        out.push({
            kind: 'mgmt', label: 'MGMT', name: mission.mgmt.name,
            guid: mission.mgmt.guid, token: mission.mgmt.missionToken,
        });
    }
    for (const op of registry) {
        out.push({
            kind: 'op', label: `OP${op.opNumber}`, name: op.name,
            guid: op.guid, token: op.ownerToken, opNumber: op.opNumber,
        });
    }
    return out;
}

async function fetchMissionArchive(
    name: string,
    token?: string,
): Promise<Uint8Array | null> {
    try {
        const res = await server.GET('/api/marti/missions/{:guid}/archive', {
            params: {
                path: { ':guid': name },
                query: { format: 'zip', download: false },
            },
            headers: token ? { MissionAuthorization: token } : {},
            parseAs: 'arrayBuffer',
        });
        if (!res.data) return null;
        return new Uint8Array(res.data);
    } catch {
        return null;
    }
}

function safeName(value: string): string {
    return value.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'file';
}

export interface DemobResult {
    filename: string;
    bytes: Uint8Array;
    /** Sources whose archive could not be retrieved. */
    failures: string[];
}

/** Build the complete demobilization package. */
export async function buildDemobPackage(
    mission: ActiveMission,
    options: DemobOptions,
    onProgress?: (message: string) => void,
): Promise<DemobResult> {
    const enc = new TextEncoder();
    const entries: { path: string; data: Uint8Array }[] = [];
    const manifest: ManifestEntry[] = [];
    const failures: string[] = [];
    const generatedAt = new Date().toISOString();

    const schemaSub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(schemaSub);
    const registry = registryFromSchemaValue(schema.tak_missions);
    const sources = demobSources(mission, registry);

    const incidentName = String(schema.incident_response?.incident_name ?? '').trim() || mission.name;
    const incidentNumber = String(schema.cad_data?.report_number ?? '').trim()
        || String(schema.incident_id ?? '').trim();

    // 1. Management schema (the incident's structured record)
    const schemaName = missionSchemaFilename(schema);
    entries.push({
        path: `data/${schemaName}`,
        data: enc.encode(JSON.stringify(schema, null, 2)),
    });
    manifest.push({ path: `data/${schemaName}`, description: 'Incident schema (all structured data)' });

    // 2. Mission archives per sync
    if (options.includeArchives) {
        for (const source of archivableSources(sources) as typeof sources) {
            onProgress?.(`Archiving ${source.label}…`);
            const bytes = await fetchMissionArchive(source.name, source.token);
            const path = `archives/${safeName(source.label)}.zip`;
            if (bytes) {
                entries.push({ path, data: bytes });
                manifest.push({ path, description: `${source.name} mission archive` });
            } else {
                failures.push(source.label);
                manifest.push({ path: `${path} (MISSING)`, description: `${source.name} — archive unavailable` });
            }
        }
    }

    // 3. WinCASIE III export of the accepted consensus
    if (options.includeCasieExport) {
        const consensus = consensusFromSchema(schema);
        if (consensus && consensus.respondents.length) {
            onProgress?.('Exporting CASIE consensus…');
            const segs = Object.entries(segmentsFromSchema(schema))
                .map(([uid, rec]) => ({ uid, callsign: rec.callsign || uid }));
            const base = safeWc3Basename(consensus.filename || incidentName || 'consensus');
            const files = buildWc3Files(consensus, segs);
            for (const [ext, text] of Object.entries(files)) {
                const filename = ext === 'trail' ? 'trail.txt' : `${base}.${ext}`;
                entries.push({ path: `casie/${filename}`, data: enc.encode(text) });
            }
            manifest.push({ path: 'casie/', description: 'WinCASIE III consensus export' });
        }
    }

    // 4. Saved IAPs, one PDF per operational period
    if (options.includeIaps) {
        const rawPlans = (schema.incident_response as Record<string, unknown>).iap_plans;
        const plans = rawPlans && typeof rawPlans === 'object' && !Array.isArray(rawPlans)
            ? rawPlans as Record<string, unknown>
            : {};
        for (const op of registry) {
            const saved: IapPlan | null = iapPlanFromValue(plans[String(op.opNumber)], op.opNumber);
            try {
                onProgress?.(`Building IAP for OP${op.opNumber}…`);
                const inputs = await loadIapInputs(mission, op);
                const plan = saved ?? prefillIapPlan(inputs, null);
                const ctx: IapContext = {
                    incidentName,
                    incidentNumber,
                    category: inputs.category,
                };
                const pdf = await buildIapPdf(buildIapSections(plan, ctx, inputs.hasUas));
                const path = `iap/OP${op.opNumber}-IAP.pdf`;
                entries.push({ path, data: pdf });
                manifest.push({
                    path,
                    description: `OP${op.opNumber} Incident Action Plan${saved ? '' : ' (auto-derived — never reviewed)'}`,
                });
            } catch {
                failures.push(`IAP OP${op.opNumber}`);
            }
        }
    }

    // 5. Narrative report (mission logs across every sync)
    if (options.includeReport) {
        onProgress?.('Collecting logs…');
        const { listAllIncidentLogs } = await import('./incidentSubscription.ts');
        try {
            const logs = await listAllIncidentLogs(mission);
            const sorted = [...logs].sort((a, b) =>
                String(a.dtg || a.created || '').localeCompare(String(b.dtg || b.created || '')));
            const lines = [
                `# ${incidentName} — Incident Log`,
                incidentNumber ? `Report #: ${incidentNumber}` : '',
                `Generated: ${generatedAt}`,
                '',
                ...sorted.map((l) => {
                    const when = String(l.dtg || l.created || '').slice(0, 16).replace('T', ' ');
                    return `- ${when} — ${String(l.content ?? '').replace(/\n/g, ' ')}`;
                }),
            ].filter((l) => l !== '');
            entries.push({ path: 'reports/incident-log.md', data: enc.encode(lines.join('\n') + '\n') });
            manifest.push({ path: 'reports/incident-log.md', description: 'Chronological log across all DataSyncs' });
        } catch {
            failures.push('incident log');
        }
    }

    // 6. Manifest last, so it lists everything above
    const retained = retainedSources(sources, options.variant);
    entries.unshift({
        path: 'MANIFEST.txt',
        data: enc.encode(buildManifest({
            incidentName, incidentNumber, generatedAt,
            variant: options.variant, entries: manifest, retained,
        })),
    });

    const blob = buildStoreZip(entries);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const stamp = generatedAt.slice(0, 10);
    return {
        filename: `${safeName(`${incidentNumber} ${incidentName}`.trim())}-demob-${stamp}.zip`,
        bytes,
        failures,
    };
}

/**
 * Write the package to the configured case file folder, falling back to a
 * browser download. Returns a human sentence describing where it landed.
 */
export async function saveDemobPackage(
    result: DemobResult,
    incidentName?: string,
): Promise<string> {
    const saved = await saveGeneratedFile(result.bytes, result.filename, {
        mime: 'application/zip',
        subfolder: incidentName,
    });
    return describeSave(saved);
}
