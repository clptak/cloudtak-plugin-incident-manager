/**
 * Client for the WiSAR headless API (/api/v1).
 *
 * Contract: WiSAR-Terrain-Aware-Range-Rings, branch headless-api,
 * docs/openapi.json (info.version below). wisar.test.ts checks these types
 * against that file when it is checked out next to this repo.
 *
 * The same file is copied into cloudtak-plugin-search-containment
 * (lib/wisar.ts); keep the copies identical.
 *
 * No CloudTAK or Vue imports, so node:test can run it. Callers pass the
 * token getter (CloudTAK's getRuntimeToken from src/std.ts).
 */

export const WISAR_SPEC_VERSION = '1.1.0-draft';

/** Branch default (decision 3). A per-device override comes from plugin settings. */
export const WISAR_DEFAULT_URL = 'https://wisar.clpdevtak.com';

const API_PREFIX = '/api/v1';

// ---- types (docs/openapi.json components.schemas) -------------------------

export interface LatLon { lat: number; lon: number }
export type JobType = 'tarr' | 'travel_time';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type DistanceUnit = 'km' | 'mi';

export interface Distances { p25: number; p50: number; p75: number; unit?: DistanceUnit }

export interface ListedSubject {
    kind: 'listed';
    category: string;
    eco_region?: string | null;
    terrain?: string | null;
}

export interface CustomSubject {
    kind: 'custom';
    name: string;
    distances: Distances;
}

export type Calibration = 'auto' | 'global' | 'none';

export interface TarrJobRequest {
    ipp: LatLon;
    dataset?: string;
    subject: ListedSubject | CustomSubject;
    calibration?: Calibration;
}

export interface Speed { value: number; unit: 'mph' | 'kmh' }

export interface TravelTimeJobRequest {
    ipp: LatLon;
    speed: Speed;
    intervals_hours: number[];
    min_radius_m?: number;
}

export interface Multipliers { m25: number; m50: number; m75: number }

export interface ResolvedTarr {
    dataset?: string | null;
    subject_label: string;
    variant?: { eco_region?: string | null; terrain?: string | null } | null;
    source_distances_km: Distances;
    calibration_applied: 'category' | 'dataset_default' | 'global' | 'none';
    multipliers: Multipliers;
    final_distances_km: Distances;
    radius_km?: number;
}

export interface ResolvedTravelTime {
    speed_kmh: number;
    speed_mph: number;
    intervals_hours: number[];
    min_radius_km?: number;
    radius_km: number;
}

export interface WisarWarning { severity: 'info' | 'warning'; source: string; message: string }
export interface Bounds { west: number; south: number; east: number; north: number }
export interface OutputLink { href: string; media_type: string; bytes?: number }

export const OVERLAY_IDS = ['attractor', 'terrain', 'probability'] as const;
export type OverlayId = typeof OVERLAY_IDS[number];

/**
 * A colored map layer drawn like the web tool's (1.1.0): `png` is a preview
 * image to place over `bounds`, `geotiff` the same picture as an RGBA COG
 * for importing into CloudTAK. Both are output names.
 */
export interface Overlay {
    id: OverlayId;
    title: string;
    png: OutputName;
    geotiff: OutputName;
    bounds: Bounds;
}

export interface JobResult {
    bounds: Bounds;
    crs: 'EPSG:4326';
    cell_size_m?: number;
    grid?: { width?: number; height?: number };
    contour_count?: number;
    warnings: WisarWarning[];
    /** Absent on a WiSAR older than 1.1.0. */
    overlays?: Overlay[];
}

export const OUTPUT_NAMES = [
    'contours.geojson',
    'contours.kml',
    'cost-distance.tif',
    'cost-surface.tif',
    'attractor-score.tif',
    'probability.tif',
    'overlay-attractor.png',
    'overlay-attractor.tif',
    'overlay-terrain.png',
    'overlay-terrain.tif',
    'overlay-probability.png',
    'overlay-probability.tif',
] as const;
export type OutputName = typeof OUTPUT_NAMES[number];

export interface Problem {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    errors?: { pointer: string; detail: string }[];
}

export interface Job {
    id: string;
    type: JobType;
    status: JobStatus;
    queue_position?: number | null;
    owner?: string;
    /** CloudTAK web origin the owner signed in to; null when WiSAR serves one CloudTAK. */
    instance?: string | null;
    created_at: string;
    started_at?: string | null;
    finished_at?: string | null;
    expires_at?: string | null;
    request: Record<string, unknown>;
    resolved?: ResolvedTarr | ResolvedTravelTime;
    result?: JobResult | null;
    outputs?: Partial<Record<OutputName, OutputLink>> | null;
    error?: Problem | null;
    links: { self: string };
}

export interface ContourProperties {
    callsign: string;
    remarks: string;
    color: string;
    threshold_m: number;
    percentile?: '25%' | '50%' | '75%';
    hours?: number;
    label?: string;
    label_lat?: number;
    label_lng?: number;
    stroke: string;
    'stroke-width': number;
    'stroke-opacity': number;
    fill: string;
    'fill-opacity': number;
}

export interface ContourFeature {
    type: 'Feature';
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown[] };
    properties: ContourProperties;
}

export interface ContourCollection { type: 'FeatureCollection'; features: ContourFeature[] }

export interface ProfileVariant { eco_region: string | null; terrain: string | null; distances_km: Distances }
export interface ProfileCategory { name: string; variants: ProfileVariant[]; calibration?: Multipliers | null }

export interface ProfileDataset {
    id: string;
    name: string;
    source?: string;
    calibration_source?: string | null;
    default_calibration?: Multipliers | null;
    categories: ProfileCategory[];
}

export interface ProfileDatasetList { default_dataset: string; datasets: ProfileDataset[] }

export interface Health {
    status: 'ok' | 'degraded';
    version: string;
    auth: string;
    queue: Record<string, unknown>;
    snapshots: Record<string, { available: boolean; age_days: number | null }>;
}

export const CONTENT_IDS = [
    'metadata',
    'changelog',
    'validation',
    'tarr-explainer',
    'travel-time-explainer',
    'scope-note',
] as const;
export type ContentId = typeof CONTENT_IDS[number];

export interface Content {
    id: ContentId;
    title: string;
    /** HTML fragment from the web tool, inline styles only, no scripts or handlers. */
    html: string;
    /** Values for the CSS variables `html` uses; set them on the element it renders into. */
    css_variables: Record<string, string>;
    source: { file: string; element_id: string; sha256: string };
}

// ---- errors ----------------------------------------------------------------

export class WisarError extends Error {
    status: number;
    problem: Problem | null;

    constructor(message: string, status: number, problem: Problem | null = null) {
        super(message);
        this.name = 'WisarError';
        this.status = status;
        this.problem = problem;
    }
}

/** One line for the UI: title, detail and the first few field errors. */
export function problemMessage(problem: Problem | null | undefined, fallback = 'WiSAR request failed'): string {
    if (!problem) return fallback;
    let msg = problem.detail ? `${problem.title}: ${problem.detail}` : problem.title;
    if (problem.errors?.length) {
        const fields = problem.errors.slice(0, 3).map((e) => `${e.pointer} ${e.detail}`);
        msg += ` (${fields.join('; ')}${problem.errors.length > 3 ? '; …' : ''})`;
    }
    return msg;
}

// ---- pure helpers ------------------------------------------------------------

/**
 * Accepts "wisar.example.org", "https://wisar.example.org/", or a URL ending
 * in /api/v1 and returns the origin-style base without a trailing slash.
 * Returns '' for blank input; throws for anything that isn't http(s).
 */
export function normalizeBaseUrl(raw: string): string {
    let s = (raw || '').trim();
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
    let url: URL;
    try {
        url = new URL(s);
    } catch {
        throw new Error(`Not a valid WiSAR URL: ${raw}`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error(`WiSAR URL must be http or https: ${raw}`);
    }
    let path = url.pathname.replace(/\/+$/, '');
    if (path.endsWith(API_PREFIX)) path = path.slice(0, -API_PREFIX.length);
    return `${url.origin}${path}`;
}

/** Per-device override when set, else the branch default. */
export function resolveWisarUrl(override: string | null | undefined, fallback = WISAR_DEFAULT_URL): string {
    const o = (override || '').trim();
    return normalizeBaseUrl(o || fallback);
}

/**
 * Same rule the API applies to custom distances: all positive and strictly
 * increasing. Returns a reason, or null when they're acceptable.
 */
export function distancesProblem(d: Pick<Distances, 'p25' | 'p50' | 'p75'>): string | null {
    const vals = [d.p25, d.p50, d.p75];
    if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v))) return '25/50/75% distances must all be numbers.';
    if (!vals.every((v) => v > 0)) return '25/50/75% distances must all be greater than zero.';
    if (!(d.p25 < d.p50 && d.p50 < d.p75)) return '25/50/75% distances must be strictly increasing.';
    return null;
}

/** Seconds from a Retry-After header, clamped to [minS, maxS]; fallback when absent. */
export function retryAfterSeconds(header: string | null, fallback = 10, minS = 2, maxS = 30): number {
    const n = header === null ? NaN : Number(header.trim());
    const s = Number.isFinite(n) && n >= 0 ? n : fallback;
    return Math.min(maxS, Math.max(minS, s));
}

export function isFinished(job: Pick<Job, 'status'>): boolean {
    return job.status === 'succeeded' || job.status === 'failed';
}

// ---- client --------------------------------------------------------------------

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface WisarClientOptions {
    /** e.g. https://wisar.clpdevtak.com (with or without /api/v1). */
    baseUrl: string;
    /** CloudTAK session token; std.ts getRuntimeToken. */
    getToken: () => Promise<string | undefined | null> | string | undefined | null;
    fetch?: FetchFn;
    /** Per request. Default 30 s. */
    timeoutMs?: number;
    /** For tests. */
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface WaitOptions {
    signal?: AbortSignal;
    /** Called with every poll result, e.g. to show queue position. */
    onUpdate?: (job: Job) => void;
    /** Give up after this long. Default 20 min. */
    maxWaitMs?: number;
    /** Consecutive network failures tolerated while polling. Default 3. */
    maxNetworkErrors?: number;
}

function abortError(): Error {
    const e = new Error('Cancelled');
    e.name = 'AbortError';
    return e;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const t = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(abortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

export function createWisarClient(opts: WisarClientOptions) {
    const base = normalizeBaseUrl(opts.baseUrl);
    if (!base) throw new Error('WiSAR URL is not set.');
    const doFetch: FetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const sleep = opts.sleep ?? defaultSleep;

    /** API path (/jobs/…) or a root-relative href from the API (/api/v1/…) → absolute URL. */
    function url(pathOrHref: string): string {
        if (/^https?:\/\//i.test(pathOrHref)) return pathOrHref;
        if (pathOrHref.startsWith(API_PREFIX + '/')) return new URL(pathOrHref, base + '/').toString();
        return `${base}${API_PREFIX}${pathOrHref}`;
    }

    async function request(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<Response> {
        const headers = new Headers(init.headers);
        const token = await opts.getToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

        const timer = new AbortController();
        const t = setTimeout(() => timer.abort(), timeoutMs);
        const outer = init.signal;
        const onOuterAbort = () => timer.abort();
        if (outer?.aborted) timer.abort();
        outer?.addEventListener('abort', onOuterAbort, { once: true });
        let res: Response;
        try {
            res = await doFetch(url(path), { ...init, headers, signal: timer.signal });
        } catch (err) {
            if (outer?.aborted) throw abortError();
            if (timer.signal.aborted) throw new WisarError(`WiSAR did not respond within ${Math.round(timeoutMs / 1000)} s.`, 0);
            throw new WisarError(`Could not reach WiSAR at ${base}: ${err instanceof Error ? err.message : String(err)}`, 0);
        } finally {
            clearTimeout(t);
            outer?.removeEventListener('abort', onOuterAbort);
        }
        if (res.status >= 400) {
            let problem: Problem | null = null;
            try {
                const body = await res.json();
                if (body && typeof body === 'object' && typeof body.title === 'string') problem = body as Problem;
            } catch {
                // not problem+json (e.g. a proxy error page)
            }
            const fallback = res.status === 401
                ? 'WiSAR rejected the CloudTAK session (401). Sign in again.'
                : `WiSAR returned HTTP ${res.status}.`;
            throw new WisarError(problem ? problemMessage(problem) : fallback, res.status, problem);
        }
        return res;
    }

    async function json<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
        return (await request(path, init)).json() as Promise<T>;
    }

    async function getJob(id: string, signal?: AbortSignal): Promise<{ job: Job; retryAfter: number }> {
        const res = await request(`/jobs/${encodeURIComponent(id)}`, { signal });
        return { job: await res.json() as Job, retryAfter: retryAfterSeconds(res.headers.get('Retry-After')) };
    }

    function outputHref(job: Job, name: OutputName): string {
        if (job.status !== 'succeeded') throw new WisarError(`Job ${job.id} has not succeeded (status: ${job.status}).`, 409);
        const link = job.outputs?.[name];
        if (!link) throw new WisarError(`Job ${job.id} has no ${name} output.`, 404);
        return link.href;
    }

    return {
        baseUrl: base,

        health: (signal?: AbortSignal) => json<Health>('/health', { signal }),

        profiles: (signal?: AbortSignal) => json<ProfileDatasetList>('/profiles', { signal }),

        /**
         * Reference text. No client-side ETag handling: If-None-Match isn't
         * allowed in WiSAR's CORS headers, and the browser's own cache already
         * revalidates (the response is Cache-Control: no-cache with an ETag).
         */
        content: (id: ContentId, signal?: AbortSignal) =>
            json<Content>(`/content/${encodeURIComponent(id)}`, { signal }),

        submitTarr: (body: TarrJobRequest, signal?: AbortSignal) =>
            json<Job>('/tarr/jobs', { method: 'POST', body: JSON.stringify(body), signal }),

        submitTravelTime: (body: TravelTimeJobRequest, signal?: AbortSignal) =>
            json<Job>('/travel-time/jobs', { method: 'POST', body: JSON.stringify(body), signal }),

        async getJob(id: string, signal?: AbortSignal): Promise<Job> {
            return (await getJob(id, signal)).job;
        },

        async listJobs(filter: { status?: JobStatus; type?: JobType } = {}, signal?: AbortSignal): Promise<Job[]> {
            const q = new URLSearchParams();
            if (filter.status) q.set('status', filter.status);
            if (filter.type) q.set('type', filter.type);
            const qs = q.toString();
            return (await json<{ jobs: Job[] }>(`/jobs${qs ? `?${qs}` : ''}`, { signal })).jobs;
        },

        async deleteJob(id: string, signal?: AbortSignal): Promise<void> {
            await request(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
        },

        /**
         * Poll until the job succeeds or fails, honouring Retry-After. Resolves
         * with the final job either way (check job.status / job.error). Throws
         * WisarError on HTTP errors (e.g. 410 expired) or after
         * maxNetworkErrors consecutive network failures; AbortError on cancel.
         */
        async waitForJob(jobOrId: Job | string, w: WaitOptions = {}): Promise<Job> {
            const deadline = Date.now() + (w.maxWaitMs ?? 20 * 60_000);
            const maxNetErrors = w.maxNetworkErrors ?? 3;
            let job = typeof jobOrId === 'string' ? null : jobOrId;
            const id = typeof jobOrId === 'string' ? jobOrId : jobOrId.id;
            if (job) {
                w.onUpdate?.(job);
                if (isFinished(job)) return job;
            }
            let wait = job ? retryAfterSeconds(null, 5) : 0;
            let netErrors = 0;
            for (;;) {
                if (wait) {
                    if (Date.now() + wait * 1000 > deadline) {
                        throw new WisarError(`Gave up waiting for WiSAR job ${id}; it may still finish (check it later).`, 0);
                    }
                    await sleep(wait * 1000, w.signal);
                }
                if (w.signal?.aborted) throw abortError();
                try {
                    const polled = await getJob(id, w.signal);
                    netErrors = 0;
                    job = polled.job;
                    w.onUpdate?.(job);
                    if (isFinished(job)) return job;
                    wait = polled.retryAfter;
                } catch (err) {
                    if (err instanceof WisarError && err.status === 0 && ++netErrors <= maxNetErrors) {
                        wait = 10;
                        continue;
                    }
                    throw err;
                }
            }
        },

        /** Contours as GeoJSON (both job types). */
        async contours(job: Job, signal?: AbortSignal): Promise<ContourCollection> {
            return (await request(outputHref(job, 'contours.geojson'), { signal })).json() as Promise<ContourCollection>;
        },

        /**
         * Any output as a Blob, with the server's file name. Outputs need the
         * token, so a plain <a href> download won't work; save the Blob instead.
         */
        async output(job: Job, name: OutputName, signal?: AbortSignal): Promise<{ blob: Blob; filename: string }> {
            const res = await request(outputHref(job, name), { signal });
            const cd = res.headers.get('Content-Disposition') || '';
            const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
            const filename = m ? decodeURIComponent(m[1]) : `${job.type}_${job.id.slice(0, 8)}_${name}`;
            return { blob: await res.blob(), filename };
        },
    };
}

export type WisarClient = ReturnType<typeof createWisarClient>;

export type ConnectionStatus = 'ok' | 'degraded' | 'unreachable' | 'unauthorized' | 'not-registered' | 'error';

export interface ConnectionCheck {
    status: ConnectionStatus;
    /** One line for the UI. */
    message: string;
    version?: string;
}

/**
 * Settings "Test connection": is WiSAR reachable from this page, and does it
 * accept this CloudTAK session?
 *
 * A browser can't tell "WiSAR is down" from "WiSAR doesn't list this
 * CloudTAK": WiSAR sends no CORS headers to an unregistered origin, so both
 * look like a failed fetch. The message says so.
 */
export async function checkWisarConnection(client: WisarClient, signal?: AbortSignal): Promise<ConnectionCheck> {
    let health: Health;
    try {
        health = await client.health(signal);
    } catch (err) {
        if (err instanceof WisarError && err.status === 0) {
            return {
                status: 'unreachable',
                message: `Can't reach WiSAR at ${client.baseUrl}. Check the address; if it is right, WiSAR may be down `
                    + 'or not set up for this CloudTAK (WISAR_CLOUDTAK_INSTANCES / WISAR_CORS_ORIGINS).',
            };
        }
        return { status: 'error', message: err instanceof Error ? err.message : String(err) };
    }
    try {
        await client.profiles(signal);
    } catch (err) {
        if (err instanceof WisarError) {
            if (err.status === 401) {
                return { status: 'unauthorized', version: health.version,
                    message: 'WiSAR is up but did not accept this CloudTAK session. Sign in again; if it persists, '
                        + 'WiSAR is checking tokens against a different CloudTAK.' };
            }
            if (err.status === 403) {
                return { status: 'not-registered', version: health.version,
                    message: 'WiSAR is up but this CloudTAK is not on its list (WISAR_CLOUDTAK_INSTANCES).' };
            }
        }
        return { status: 'error', version: health.version, message: err instanceof Error ? err.message : String(err) };
    }
    const notes: string[] = [];
    if (health.version !== WISAR_SPEC_VERSION) {
        notes.push(`API version ${health.version}; this plugin was built for ${WISAR_SPEC_VERSION}.`);
    }
    const missing = Object.entries(health.snapshots ?? {}).filter(([, s]) => !s.available).map(([k]) => k);
    if (missing.length) notes.push(`Missing data snapshots: ${missing.join(', ')} (analyses run with warnings).`);
    return {
        status: health.status === 'ok' && !notes.length ? 'ok' : 'degraded',
        version: health.version,
        message: [`Connected to WiSAR ${health.version} at ${client.baseUrl}.`, ...notes].join(' '),
    };
}
