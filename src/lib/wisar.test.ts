import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    CONTENT_IDS,
    OUTPUT_NAMES,
    OVERLAY_IDS,
    WISAR_SPEC_VERSION,
    WisarError,
    checkWisarConnection,
    createWisarClient,
    distancesProblem,
    normalizeBaseUrl,
    problemMessage,
    resolveWisarUrl,
    retryAfterSeconds,
    type Job,
} from './wisar.ts';

// ---- helpers ---------------------------------------------------------------

type Call = { url: string; method: string; headers: Headers; body?: string };

function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
    const calls: Call[] = [];
    const fn = async (input: string, init: RequestInit = {}) => {
        const call: Call = {
            url: input,
            method: init.method ?? 'GET',
            headers: new Headers(init.headers),
            body: typeof init.body === 'string' ? init.body : undefined,
        };
        calls.push(call);
        return handler(call);
    };
    return { fn, calls };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    const type = status >= 400 ? 'application/problem+json' : 'application/json';
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type, ...headers } });
}

function job(over: Partial<Job> = {}): Job {
    return {
        id: '11111111-2222-3333-4444-555555555555',
        type: 'travel_time',
        status: 'queued',
        queue_position: 1,
        created_at: '2026-10-01T00:00:00Z',
        request: {},
        links: { self: '/api/v1/jobs/11111111-2222-3333-4444-555555555555' },
        ...over,
    };
}

const noSleep = async () => {};

// ---- pure helpers ----------------------------------------------------------

test('normalizeBaseUrl accepts host, trailing slash and /api/v1', () => {
    assert.equal(normalizeBaseUrl('wisar.example.org'), 'https://wisar.example.org');
    assert.equal(normalizeBaseUrl(' https://wisar.example.org/ '), 'https://wisar.example.org');
    assert.equal(normalizeBaseUrl('https://wisar.example.org/api/v1/'), 'https://wisar.example.org');
    assert.equal(normalizeBaseUrl('http://localhost:8760'), 'http://localhost:8760');
    assert.equal(normalizeBaseUrl('https://example.org/wisar/api/v1'), 'https://example.org/wisar');
    assert.equal(normalizeBaseUrl('  '), '');
    assert.throws(() => normalizeBaseUrl('ftp://example.org'), /http or https/);
});

test('resolveWisarUrl prefers a non-blank override', () => {
    assert.equal(resolveWisarUrl('', 'https://a.example.org'), 'https://a.example.org');
    assert.equal(resolveWisarUrl(null, 'https://a.example.org'), 'https://a.example.org');
    assert.equal(resolveWisarUrl('b.example.org/', 'https://a.example.org'), 'https://b.example.org');
    assert.equal(resolveWisarUrl(undefined), 'https://wisar.clpdevtak.com');
});

test('distancesProblem mirrors the API rule', () => {
    assert.equal(distancesProblem({ p25: 1, p50: 2, p75: 3 }), null);
    assert.match(distancesProblem({ p25: 0, p50: 0, p75: 0 }) ?? '', /greater than zero/);
    assert.match(distancesProblem({ p25: 66.07, p50: 66.07, p75: 66.07 }) ?? '', /strictly increasing/);
    assert.match(distancesProblem({ p25: 1, p50: NaN, p75: 3 }) ?? '', /numbers/);
});

test('retryAfterSeconds clamps and falls back', () => {
    assert.equal(retryAfterSeconds('15'), 15);
    assert.equal(retryAfterSeconds(null), 10);
    assert.equal(retryAfterSeconds('nonsense', 7), 7);
    assert.equal(retryAfterSeconds('0'), 2);
    assert.equal(retryAfterSeconds('600'), 30);
});

test('problemMessage includes field errors', () => {
    assert.equal(
        problemMessage({ type: 'about:blank', title: 'Unprocessable request', status: 422, detail: 'Bad body.',
            errors: [{ pointer: '/speed/value', detail: 'must be at most 20 km/h (12.4 mph)' }] }),
        'Unprocessable request: Bad body. (/speed/value must be at most 20 km/h (12.4 mph))',
    );
    assert.equal(problemMessage(null), 'WiSAR request failed');
});

// ---- client ----------------------------------------------------------------

test('requests carry the token and hit /api/v1 on the base URL', async () => {
    const f = fakeFetch(() => jsonResponse({ default_dataset: 'koester', datasets: [] }));
    const c = createWisarClient({ baseUrl: 'https://wisar.example.org/', getToken: async () => 'tok', fetch: f.fn });
    const body = await c.profiles();
    assert.equal(body.default_dataset, 'koester');
    assert.equal(f.calls[0].url, 'https://wisar.example.org/api/v1/profiles');
    assert.equal(f.calls[0].headers.get('Authorization'), 'Bearer tok');
    assert.equal(f.calls[0].headers.get('Content-Type'), null);
});

test('createWisarClient refuses a blank URL', () => {
    assert.throws(() => createWisarClient({ baseUrl: ' ', getToken: () => 'x' }), /not set/);
});

test('submitTravelTime posts JSON', async () => {
    const f = fakeFetch(() => jsonResponse(job(), 202, { Location: '/api/v1/jobs/x', 'Retry-After': '15' }));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 'tok', fetch: f.fn });
    const req = { ipp: { lat: 35.2, lon: -111.6 }, speed: { value: 2, unit: 'mph' as const }, intervals_hours: [2, 4] };
    const j = await c.submitTravelTime(req);
    assert.equal(j.status, 'queued');
    assert.equal(f.calls[0].method, 'POST');
    assert.equal(f.calls[0].url, 'https://w.example.org/api/v1/travel-time/jobs');
    assert.equal(f.calls[0].headers.get('Content-Type'), 'application/json');
    assert.deepEqual(JSON.parse(f.calls[0].body ?? ''), req);
});

test('problem+json errors become WisarError with the problem', async () => {
    const problem = { type: 'about:blank', title: 'Unprocessable request', status: 422,
        errors: [{ pointer: '/subject/distances', detail: 'p25, p50 and p75 must be strictly increasing' }] };
    const f = fakeFetch(() => jsonResponse(problem, 422));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 'tok', fetch: f.fn });
    await assert.rejects(
        c.submitTarr({ ipp: { lat: 35, lon: -111 }, subject: { kind: 'custom', name: 'x', distances: { p25: 1, p50: 1, p75: 1 } } }),
        (err: unknown) => err instanceof WisarError && err.status === 422 && err.problem?.errors?.length === 1
            && /strictly increasing/.test(err.message),
    );
});

test('non-JSON errors and 401 get readable messages', async () => {
    const f = fakeFetch((call) => call.url.endsWith('/health')
        ? new Response('<html>Bad Gateway</html>', { status: 502 })
        : new Response('', { status: 401 }));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => undefined, fetch: f.fn });
    await assert.rejects(c.health(), (e: unknown) => e instanceof WisarError && e.status === 502 && /HTTP 502/.test(e.message));
    await assert.rejects(c.profiles(), (e: unknown) => e instanceof WisarError && e.status === 401 && /Sign in again/.test(e.message));
    assert.equal(f.calls[0].headers.get('Authorization'), null);
});

test('network failure is WisarError status 0', async () => {
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't',
        fetch: async () => { throw new TypeError('Failed to fetch'); } });
    await assert.rejects(c.health(), (e: unknown) => e instanceof WisarError && e.status === 0 && /Could not reach/.test(e.message));
});

test('waitForJob polls with Retry-After until finished and reports progress', async () => {
    const states = [
        jsonResponse(job({ status: 'queued', queue_position: 2 }), 200, { 'Retry-After': '15' }),
        jsonResponse(job({ status: 'running', queue_position: null }), 200, { 'Retry-After': '10' }),
        jsonResponse(job({ status: 'succeeded', queue_position: null, outputs: {} })),
    ];
    const f = fakeFetch(() => states.shift() as Response);
    const sleeps: number[] = [];
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: f.fn,
        sleep: async (ms) => { sleeps.push(ms); } });
    const seen: string[] = [];
    const done = await c.waitForJob(job(), { onUpdate: (j) => seen.push(j.status) });
    assert.equal(done.status, 'succeeded');
    assert.deepEqual(seen, ['queued', 'queued', 'running', 'succeeded']);
    assert.deepEqual(sleeps, [5000, 15000, 10000]);
    assert.equal(f.calls[0].url, 'https://w.example.org/api/v1/jobs/11111111-2222-3333-4444-555555555555');
});

test('waitForJob resolves with a failed job instead of throwing', async () => {
    const f = fakeFetch(() => jsonResponse(job({ status: 'failed', error: { type: 'about:blank', title: 'Analysis failed', status: 500 } })));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: f.fn, sleep: noSleep });
    const done = await c.waitForJob('abc');
    assert.equal(done.status, 'failed');
    assert.equal(done.error?.title, 'Analysis failed');
    assert.equal(f.calls.length, 1); // no sleep before the first poll when given an id
});

test('waitForJob tolerates a few network errors, then gives up', async () => {
    let n = 0;
    const flaky = async () => {
        n++;
        if (n <= 2) throw new TypeError('offline');
        return jsonResponse(job({ status: 'succeeded' }));
    };
    const c1 = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: flaky, sleep: noSleep });
    assert.equal((await c1.waitForJob('abc')).status, 'succeeded');

    const dead = async () => { throw new TypeError('offline'); };
    const c2 = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: dead, sleep: noSleep });
    await assert.rejects(c2.waitForJob('abc', { maxNetworkErrors: 3 }), (e: unknown) => e instanceof WisarError && e.status === 0);
});

test('waitForJob surfaces 410 for an expired job', async () => {
    const f = fakeFetch(() => jsonResponse({ type: 'about:blank', title: 'Gone', status: 410, detail: 'Job expired.' }, 410));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: f.fn, sleep: noSleep });
    await assert.rejects(c.waitForJob('abc'), (e: unknown) => e instanceof WisarError && e.status === 410);
});

test('waitForJob can be cancelled', async () => {
    const ac = new AbortController();
    const f = fakeFetch(() => jsonResponse(job({ status: 'running' }), 200, { 'Retry-After': '10' }));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: f.fn,
        sleep: async () => { ac.abort(); } });
    await assert.rejects(c.waitForJob('abc', { signal: ac.signal }), (e: unknown) => e instanceof Error && e.name === 'AbortError');
});

test('waitForJob stops at maxWaitMs', async () => {
    const f = fakeFetch(() => jsonResponse(job({ status: 'running' }), 200, { 'Retry-After': '30' }));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: f.fn, sleep: noSleep });
    await assert.rejects(c.waitForJob('abc', { maxWaitMs: 1000 }), /Gave up waiting/);
});

test('outputs resolve root-relative hrefs, send the token and keep the file name', async () => {
    const done = job({
        status: 'succeeded',
        outputs: {
            'contours.geojson': { href: '/api/v1/jobs/j1/outputs/contours.geojson', media_type: 'application/geo+json' },
            'cost-distance.tif': { href: '/api/v1/jobs/j1/outputs/cost-distance.tif', media_type: 'image/tiff' },
        },
    });
    const f = fakeFetch((call) => call.url.endsWith('.geojson')
        ? jsonResponse({ type: 'FeatureCollection', features: [] })
        : new Response(new Uint8Array([1, 2, 3]), { headers: {
            'Content-Type': 'image/tiff; application=geotiff; profile=cloud-optimized',
            'Content-Disposition': 'attachment; filename=travel_time_11111111_cost-distance.tif' } }));
    const c = createWisarClient({ baseUrl: 'https://w.example.org/api/v1', getToken: () => 'tok', fetch: f.fn });
    const fc = await c.contours(done);
    assert.equal(fc.type, 'FeatureCollection');
    const out = await c.output(done, 'cost-distance.tif');
    assert.equal(out.filename, 'travel_time_11111111_cost-distance.tif');
    assert.equal(out.blob.size, 3);
    assert.equal(f.calls[0].url, 'https://w.example.org/api/v1/jobs/j1/outputs/contours.geojson');
    assert.equal(f.calls[1].headers.get('Authorization'), 'Bearer tok');
    await assert.rejects(c.output(done, 'probability.tif'), /no probability.tif output/);
    await assert.rejects(c.contours(job({ status: 'running' })), /has not succeeded/);
});

test('content fetches a section by id', async () => {
    const f = fakeFetch(() => jsonResponse({ id: 'metadata', title: 'T', html: '<p>x</p>', css_variables: {},
        source: { file: 'static/index.html', element_id: 'metadataModal', sha256: 'a'.repeat(64) } }));
    const c = createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch: f.fn });
    assert.equal((await c.content('metadata')).title, 'T');
    assert.equal(f.calls[0].url, 'https://w.example.org/api/v1/content/metadata');
    assert.equal(f.calls[0].headers.get('If-None-Match'), null); // not allowed by WiSAR's CORS headers
});

// ---- connection check ------------------------------------------------------

const HEALTH = { status: 'ok', version: WISAR_SPEC_VERSION, auth: 'cloudtak', queue: {},
    snapshots: { osm: { available: true, age_days: 1 } } };

function checkClient(health: Response | (() => never), profiles?: Response) {
    const fetch = async (url: string) => {
        if (url.endsWith('/health')) {
            if (typeof health === 'function') health();
            return health as Response;
        }
        return profiles as Response;
    };
    return createWisarClient({ baseUrl: 'https://w.example.org', getToken: () => 't', fetch });
}

test('checkWisarConnection: ok', async () => {
    const r = await checkWisarConnection(checkClient(jsonResponse(HEALTH), jsonResponse({ datasets: [], default_dataset: 'koester' })));
    assert.equal(r.status, 'ok');
    assert.match(r.message, /Connected to WiSAR 1\.1\.0-draft at https:\/\/w\.example\.org/);
});

test('checkWisarConnection: degraded on missing snapshots or version mismatch', async () => {
    const h = { ...HEALTH, status: 'degraded', version: '2.0.0', snapshots: { nhd: { available: false, age_days: null } } };
    const r = await checkWisarConnection(checkClient(jsonResponse(h), jsonResponse({ datasets: [], default_dataset: 'k' })));
    assert.equal(r.status, 'degraded');
    assert.match(r.message, /built for 1\.1\.0-draft/);
    assert.match(r.message, /Missing data snapshots: nhd/);
});

test('checkWisarConnection: unreachable (also how an unregistered CloudTAK looks to a browser)', async () => {
    const r = await checkWisarConnection(checkClient(() => { throw new TypeError('Failed to fetch'); }));
    assert.equal(r.status, 'unreachable');
    assert.match(r.message, /WISAR_CLOUDTAK_INSTANCES/);
});

test('checkWisarConnection: session rejected / not registered', async () => {
    const p401 = jsonResponse({ type: 'about:blank', title: 'Unauthorized', status: 401 }, 401);
    assert.equal((await checkWisarConnection(checkClient(jsonResponse(HEALTH), p401))).status, 'unauthorized');
    const p403 = jsonResponse({ type: 'about:blank', title: 'CloudTAK not registered', status: 403 }, 403);
    assert.equal((await checkWisarConnection(checkClient(jsonResponse(HEALTH), p403))).status, 'not-registered');
});

// ---- drift against the WiSAR contract ---------------------------------------
// Reads docs/openapi.json from a WiSAR checkout next to this repo
// (../WiSAR-Terrain-Aware-Range-Rings) or from $WISAR_OPENAPI. Skipped when
// neither is present.

const here = dirname(fileURLToPath(import.meta.url));
const specPath = [
    process.env.WISAR_OPENAPI,
    resolve(here, '../../../WiSAR-Terrain-Aware-Range-Rings/docs/openapi.json'),
].find((p): p is string => !!p && existsSync(p));
const spec = specPath ? JSON.parse(readFileSync(specPath, 'utf8')) : null;
const skip = spec ? false : 'WiSAR openapi.json not found (set WISAR_OPENAPI or check out WiSAR next to this repo)';

test('drift: client matches WiSAR openapi.json', { skip }, () => {
    const s = spec.components.schemas;
    assert.equal(spec.info.version, WISAR_SPEC_VERSION, 'bump WISAR_SPEC_VERSION after reviewing the spec changes');
    assert.deepEqual([...OUTPUT_NAMES].sort(), [...s.Job.properties.outputs.propertyNames.enum].sort());
    assert.deepEqual([...CONTENT_IDS].sort(), [...s.Content.properties.id.enum].sort());
    assert.deepEqual(s.JobStatus.enum, ['queued', 'running', 'succeeded', 'failed']);
    assert.deepEqual(s.JobType.enum, ['tarr', 'travel_time']);
    assert.deepEqual([...OVERLAY_IDS].sort(), [...s.Overlay.properties.id.enum].sort());
    assert.deepEqual(Object.keys(s.Overlay.properties).sort(), ['bounds', 'geotiff', 'id', 'png', 'title']);
    assert.ok(s.JobResult.properties.overlays, 'JobResult.overlays');
    assert.deepEqual(s.Calibration.enum, ['auto', 'global', 'none']);
    assert.deepEqual(s.Speed.properties.unit.enum, ['mph', 'kmh']);
    assert.deepEqual(s.Distances.properties.unit.enum, ['km', 'mi']);
    assert.deepEqual(Object.keys(s.Distances.properties).sort(), ['p25', 'p50', 'p75', 'p90', 'unit']);
    assert.deepEqual(s.ContourFeature.properties.properties.properties.percentile.enum, ['25%', '50%', '75%', '90%']);
    assert.deepEqual(Object.keys(s.TarrJobRequest.properties).sort(), ['calibration', 'dataset', 'ipp', 'subject']);
    assert.deepEqual(Object.keys(s.TravelTimeJobRequest.properties).sort(), ['intervals_hours', 'ipp', 'min_radius_m', 'speed']);
    assert.deepEqual(Object.keys(s.ListedSubject.properties).sort(), ['category', 'eco_region', 'kind', 'terrain']);
    assert.deepEqual(Object.keys(s.CustomSubject.properties).sort(), ['distances', 'kind', 'name']);
    for (const p of ['/health', '/profiles', '/content/{content_id}', '/tarr/jobs', '/travel-time/jobs', '/jobs', '/jobs/{job_id}']) {
        assert.ok(spec.paths[p], `missing path ${p}`);
    }
});
