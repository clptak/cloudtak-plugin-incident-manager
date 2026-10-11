import type { DeploymentConfig } from './src/lib/deploymentDefaults.ts';

/**
 * Copy to config.local.ts (gitignored), fill in this deployment, then restart
 * or rebuild CloudTAK's app/.
 *
 * These values are compiled into the web bundle. Anyone who can load CloudTAK
 * can read them. Do not put per-user secrets here.
 *
 * Aiding agencies, personnel, subject types, and the LPB table are files, not
 * inline arrays. Copy what you need from deployment.example/ into deployment/
 * (also gitignored). The basenames below are what the build looks up. An empty
 * string skips that list. Basenames only — no directories.
 *
 * Copy deployment.example/lpb-table.json only when this CloudTAK should replace
 * the bundled Arizona statistical-distance table. The sample is a single row.
 */
export const deploymentDefaults: DeploymentConfig = {
    yourAgency: '',
    useD4hAidingAgencies: true,
    useD4hPersonnel: true,
    searchOpTemplateId: '',
    wisarUrl: '',
    aidingAgenciesFile: 'aiding-agencies.json',
    personnelFile: 'personnel.json',
    subjectTypesFile: 'subject-types.json',
    lpbTableFile: 'lpb-table.json',
};
