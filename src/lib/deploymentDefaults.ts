/**
 * Shared settings compiled from gitignored config.local.ts and deployment/.
 * Vite rewrites a literal import.meta.glob( call. Do not wrap it in a helper.
 */

/** Scalar Settings fields plus basenames of staged list files. */
export interface DeploymentConfig {
    yourAgency?: string;
    useD4hAidingAgencies?: boolean;
    useD4hPersonnel?: boolean;
    searchOpTemplateId?: string;
    wisarUrl?: string;
    /** Basename under deployment/, e.g. aiding-agencies.json. Empty skips the file. */
    aidingAgenciesFile?: string;
    /** Basename under deployment/. Custom roster used when D4H personnel is off. */
    personnelFile?: string;
    /** Basename under deployment/. */
    subjectTypesFile?: string;
    /** Basename under deployment/. Replaces the bundled Arizona LPB table. */
    lpbTableFile?: string;
}

export interface DeploymentBundle {
    config: DeploymentConfig;
    /** Basename to file text for whatever Vite bundled from deployment/. */
    files: Record<string, string>;
}

interface DeploymentModule {
    deploymentDefaults?: DeploymentConfig;
}

function asText(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'default' in value) {
        const inner = (value as { default: unknown }).default;
        if (typeof inner === 'string') return inner;
    }
    return undefined;
}

function basenameOf(globKey: string): string {
    const path = globKey.replace(/\\/g, '/').split('?')[0];
    const slash = path.lastIndexOf('/');
    return slash >= 0 ? path.slice(slash + 1) : path;
}

function readConfig(): DeploymentConfig {
    let modules: Record<string, DeploymentModule> = {};
    try {
        // Plugin root is two levels up from src/lib.
        modules = import.meta.glob<DeploymentModule>('../../config.local.ts', {
            eager: true,
        });
    } catch {
        return {};
    }

    for (const mod of Object.values(modules)) {
        const defaults = mod?.deploymentDefaults;
        if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) continue;
        return defaults;
    }
    return {};
}

function readFiles(): Record<string, string> {
    let modules: Record<string, unknown> = {};
    try {
        modules = import.meta.glob<unknown>('../../deployment/*.{json,csv,txt}', {
            eager: true,
            query: '?raw',
            import: 'default',
        });
    } catch {
        return {};
    }

    const files: Record<string, string> = {};
    for (const [key, value] of Object.entries(modules)) {
        const text = asText(value);
        const name = basenameOf(key);
        if (text === undefined || !name) continue;
        files[name] = text;
    }
    return files;
}

let cached: DeploymentBundle | undefined;

export function loadDeploymentBundle(): DeploymentBundle {
    if (!cached) {
        cached = { config: readConfig(), files: readFiles() };
    }
    return cached;
}
