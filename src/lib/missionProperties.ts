/**
 * Client for TAK Server 5.9+ Mission Properties (key/value pairs stored on a
 * DataSync mission), via CloudTAK's /api/marti/missions/:guid/property routes
 * (dfpc-coe/CloudTAK#1852).
 *
 * Pure module: all network access goes through an injected transport so the
 * client is testable under `node --test`. The browser transport lives in
 * missionPropertiesTransport.ts.
 *
 * Server behaviour this relies on (verified against 5.9-DEV-57 / DEV-88):
 * - set is an atomic per-key upsert (`insert ... on conflict do update`), so
 *   writers of *different* keys never clobber each other.
 * - list filters with SQL `key LIKE prefix%` and returns keys sorted.
 * - values are `text NOT NULL`; an empty string is allowed.
 * - every write is announced to mission subscribers as `t-x-m-c-p`.
 */

export interface MissionProperty {
    key: string;
    value: string;
}

export interface PropertyTransportRequest {
    method: 'GET' | 'PUT' | 'DELETE';
    /** Path below the API root, e.g. `/api/marti/missions/<guid>/property`. */
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    /** Raw mission subscription token, sent as `MissionAuthorization`. */
    missionToken?: string;
}

export interface PropertyTransportResponse {
    status: number;
    /** Parsed JSON body, or undefined when the body was empty / not JSON. */
    json?: unknown;
    /** Raw body text, for error messages. */
    text: string;
}

export type PropertyTransport = (req: PropertyTransportRequest) => Promise<PropertyTransportResponse>;

export class MissionPropertyError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'MissionPropertyError';
        this.status = status;
    }
}

/**
 * Keys must be safe for the server's prefix filter and for use as a URL path
 * segment: `_` and `%` are LIKE wildcards (a prefix of `op_1` would also match
 * `opX1`), and `/` would split the `/property/:key` path. Dots are the
 * namespace separator (`op.1.debrief.<segmentUid>`).
 */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.:-]*$/;

export function assertValidKey(key: string): void {
    if (!KEY_PATTERN.test(key)) {
        throw new Error(
            `Invalid mission property key "${key}" - use letters, digits, ".", ":" or "-" `
            + '(no "_", "%" or "/")',
        );
    }
}

/** Prefixes follow the same rules but may end in a dot (`op.1.`). */
export function assertValidPrefix(prefix: string): void {
    if (prefix === '') return;
    if (!KEY_PATTERN.test(prefix)) {
        throw new Error(`Invalid mission property prefix "${prefix}"`);
    }
}

function errorMessage(res: PropertyTransportResponse, action: string): string {
    const body = res.json as { message?: unknown } | undefined;
    if (body && typeof body.message === 'string' && body.message.trim()) {
        return `${action} failed (${res.status}): ${body.message}`;
    }
    const text = res.text.trim();
    if (text && !text.includes('<html') && !text.includes('<!DOCTYPE')) {
        return `${action} failed (${res.status}): ${text.slice(0, 200)}`;
    }
    return `${action} failed (${res.status})`;
}

function asProperty(value: unknown): MissionProperty | null {
    if (!value || typeof value !== 'object') return null;
    const rec = value as Record<string, unknown>;
    if (typeof rec.key !== 'string') return null;
    return { key: rec.key, value: typeof rec.value === 'string' ? rec.value : '' };
}

export interface MissionPropertyClient {
    /** All properties, or only those whose key starts with `prefix`; sorted by key. */
    list(prefix?: string): Promise<MissionProperty[]>;
    /** One property's value, or null when the key does not exist. */
    get(key: string): Promise<string | null>;
    /** Create or replace (upsert) one property. */
    set(key: string, value: string): Promise<void>;
    /** Remove one property. Deleting a key that does not exist is not an error. */
    delete(key: string): Promise<void>;
    /** Remove every property on the mission. */
    deleteAll(): Promise<void>;

    /** JSON helpers - values are stored as JSON text. */
    getJson<T>(key: string): Promise<T | null>;
    setJson(key: string, value: unknown): Promise<void>;
    /** List a prefix and parse each value; unparseable values are skipped and reported. */
    listJson<T>(prefix: string): Promise<{ items: Array<{ key: string; value: T }>; invalid: string[] }>;
}

export interface MissionPropertyClientOpts {
    missionGuid: string;
    transport: PropertyTransport;
    /** Mission subscription token; required for writes by non-admin users. */
    missionToken?: string;
}

export function createMissionPropertyClient(opts: MissionPropertyClientOpts): MissionPropertyClient {
    const base = `/api/marti/missions/${encodeURIComponent(opts.missionGuid)}/property`;
    const send = (req: Omit<PropertyTransportRequest, 'missionToken'>) => opts.transport({
        ...req,
        missionToken: opts.missionToken,
    });

    const client: MissionPropertyClient = {
        async list(prefix = '') {
            assertValidPrefix(prefix);
            const res = await send({
                method: 'GET',
                path: base,
                query: prefix ? { prefix } : undefined,
            });
            if (res.status !== 200) throw new MissionPropertyError(res.status, errorMessage(res, 'List properties'));
            const items = (res.json as { items?: unknown } | undefined)?.items;
            if (!Array.isArray(items)) return [];
            return items
                .map(asProperty)
                .filter((p): p is MissionProperty => p !== null)
                .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        },

        async get(key) {
            assertValidKey(key);
            const res = await send({ method: 'GET', path: `${base}/${encodeURIComponent(key)}` });
            if (res.status === 404) return null;
            if (res.status !== 200) throw new MissionPropertyError(res.status, errorMessage(res, `Get ${key}`));
            const prop = asProperty((res.json as { data?: unknown } | undefined)?.data);
            return prop ? prop.value : null;
        },

        async set(key, value) {
            assertValidKey(key);
            const res = await send({ method: 'PUT', path: base, body: { key, value } });
            if (res.status !== 200) throw new MissionPropertyError(res.status, errorMessage(res, `Set ${key}`));
        },

        async delete(key) {
            assertValidKey(key);
            const res = await send({ method: 'DELETE', path: `${base}/${encodeURIComponent(key)}` });
            if (res.status === 404) return;
            if (res.status !== 200) throw new MissionPropertyError(res.status, errorMessage(res, `Delete ${key}`));
        },

        async deleteAll() {
            const res = await send({ method: 'DELETE', path: base });
            if (res.status !== 200) throw new MissionPropertyError(res.status, errorMessage(res, 'Delete all properties'));
        },

        async getJson<T>(key: string) {
            const raw = await client.get(key);
            if (raw === null || raw === '') return null;
            try {
                return JSON.parse(raw) as T;
            } catch {
                throw new Error(`Mission property ${key} is not valid JSON`);
            }
        },

        async setJson(key, value) {
            await client.set(key, JSON.stringify(value));
        },

        async listJson<T>(prefix: string) {
            const items: Array<{ key: string; value: T }> = [];
            const invalid: string[] = [];
            for (const prop of await client.list(prefix)) {
                try {
                    items.push({ key: prop.key, value: JSON.parse(prop.value) as T });
                } catch {
                    invalid.push(prop.key);
                }
            }
            return { items, invalid };
        },
    };

    return client;
}

/**
 * Does this mission's TAK Server support Mission Properties (5.9+)?
 *
 * Lists properties on a mission the caller can already see. A 200 means yes.
 * On older servers the TAK endpoint does not exist and the request fails, so
 * any non-200 is treated as unsupported - callers then keep using the
 * mission_schema.json file. 401/403 are rethrown: those are permission
 * problems, not a missing feature, and must not silently change the backend.
 */
export async function supportsMissionProperties(client: MissionPropertyClient): Promise<boolean> {
    try {
        await client.list('meta.');
        return true;
    } catch (err) {
        if (err instanceof MissionPropertyError && (err.status === 401 || err.status === 403)) throw err;
        return false;
    }
}
