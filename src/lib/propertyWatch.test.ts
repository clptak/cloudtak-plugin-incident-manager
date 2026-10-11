import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnWriteLog, createPropertyWatcher, diffListings, type PropertyChange } from './propertyWatch.ts';

/** Manual clock: timers only fire when the test advances time. */
function fakeEnv(initial: Record<string, string> = {}) {
    const server = new Map(Object.entries(initial));
    let now = 0;
    let nextId = 1;
    const timers = new Map<number, { at: number; fn: () => void }>();
    let hidden = false;
    let pushHandler: (() => void) | null = null;
    let visibleHandler: (() => void) | null = null;
    let lists = 0;
    let failNext = false;

    const deps = {
        async list() {
            lists++;
            if (failNext) {
                failNext = false;
                throw new Error('network');
            }
            return new Map(server);
        },
        subscribePush(fn: () => void) {
            pushHandler = fn;
            return () => { pushHandler = null; };
        },
        isHidden: () => hidden,
        onVisible(fn: () => void) {
            visibleHandler = fn;
            return () => { visibleHandler = null; };
        },
        setTimer(fn: () => void, ms: number) {
            const id = nextId++;
            timers.set(id, { at: now + ms, fn });
            return id;
        },
        clearTimer(id: unknown) { timers.delete(id as number); },
    };

    /** Advance the clock, firing due timers in order and letting async work settle. */
    async function advance(ms: number): Promise<void> {
        const until = now + ms;
        for (;;) {
            const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            timers.delete(due[0]);
            now = due[1].at;
            due[1].fn();
            await settle();
        }
        now = until;
    }

    return {
        server,
        deps,
        advance,
        get lists() { return lists; },
        get timerCount() { return timers.size; },
        get hasPush() { return pushHandler !== null; },
        push() { pushHandler?.(); },
        setHidden(h: boolean) {
            hidden = h;
            if (!h) visibleHandler?.();
        },
        failNextList() { failNext = true; },
    };
}

const settle = () => new Promise<void>((r) => setImmediate(r));

function collect() {
    const batches: PropertyChange[][] = [];
    return { batches, listener: (c: PropertyChange[]) => { batches.push(c); } };
}

test('diffListings: changed, added and deleted keys, sorted', () => {
    const before = new Map([['a', '1'], ['b', '2'], ['c', '3']]);
    const after = new Map([['a', '1'], ['b', '20'], ['d', '4']]);
    assert.deepEqual(diffListings(before, after), [
        { key: 'b', value: '20' },
        { key: 'c', value: null },
        { key: 'd', value: '4' },
    ]);
});

test('watcher: first listing is the baseline; a later change is reported once', async () => {
    const env = fakeEnv({ 's.segments': '{}' });
    const w = createPropertyWatcher(env.deps, { pollMs: 15_000 });
    const { batches, listener } = collect();
    w.subscribe(listener);
    await settle();
    assert.equal(batches.length, 0);

    env.server.set('s.segments', '{"x":1}');
    await env.advance(15_000);
    assert.deepEqual(batches, [[{ key: 's.segments', value: '{"x":1}', own: false }]]);

    await env.advance(15_000);
    assert.equal(batches.length, 1);
});

test('watcher: polls every 15 s, then every 60 s once a push has been seen', async () => {
    const env = fakeEnv();
    const w = createPropertyWatcher(env.deps);
    w.subscribe(() => {});
    await settle();
    const base = env.lists;
    await env.advance(30_000);
    assert.equal(env.lists - base, 2);

    env.push();
    await env.advance(300);
    assert.equal(w.pushSeen, true);
    const afterPush = env.lists;
    await env.advance(59_000);
    assert.equal(env.lists, afterPush);
    await env.advance(1_000);
    assert.equal(env.lists, afterPush + 1);
});

test('watcher: a burst of pushes is one re-list', async () => {
    const env = fakeEnv({ k: '1' });
    const w = createPropertyWatcher(env.deps);
    const { batches, listener } = collect();
    w.subscribe(listener);
    await settle();
    const base = env.lists;
    env.server.set('k', '2');
    env.server.set('j', '3');
    env.push(); env.push(); env.push();
    await env.advance(300);
    assert.equal(env.lists - base, 1);
    assert.deepEqual(batches[0].map((c) => c.key), ['j', 'k']);
});

test('watcher: own writes are flagged', async () => {
    const env = fakeEnv({ a: '1', b: '1' });
    const own = createOwnWriteLog(() => 0);
    const w = createPropertyWatcher({ ...env.deps, isOwnWrite: (k, v) => own.matches('g', k, v) });
    const { batches, listener } = collect();
    w.subscribe(listener);
    await settle();
    own.record('g', 'a', '2');
    env.server.set('a', '2');
    env.server.set('b', '9');
    await env.advance(15_000);
    assert.deepEqual(batches[0], [
        { key: 'a', value: '2', own: true },
        { key: 'b', value: '9', own: false },
    ]);
});

test('watcher: hidden page skips polls and catches up when shown', async () => {
    const env = fakeEnv({ a: '1' });
    const w = createPropertyWatcher(env.deps);
    const { batches, listener } = collect();
    w.subscribe(listener);
    await settle();
    env.setHidden(true);
    const base = env.lists;
    env.server.set('a', '2');
    await env.advance(60_000);
    assert.equal(env.lists, base);
    assert.equal(batches.length, 0);
    env.setHidden(false);
    await settle();
    assert.equal(batches.length, 1);
});

test('watcher: a failed listing is retried and the change still arrives', async () => {
    const env = fakeEnv({ a: '1' });
    const w = createPropertyWatcher(env.deps);
    const { batches, listener } = collect();
    w.subscribe(listener);
    await settle();
    env.server.set('a', '2');
    env.failNextList();
    await env.advance(15_000);
    assert.equal(batches.length, 0);
    await env.advance(15_000);
    assert.equal(batches.length, 1);
});

test('watcher: stops polling and drops push after the last listener leaves', async () => {
    const env = fakeEnv();
    const w = createPropertyWatcher(env.deps);
    const off1 = w.subscribe(() => {});
    const off2 = w.subscribe(() => {});
    await settle();
    off1();
    assert.equal(w.running, true);
    off2();
    assert.equal(w.running, false);
    assert.equal(env.hasPush, false);
    assert.equal(env.timerCount, 0);
    const base = env.lists;
    await env.advance(120_000);
    assert.equal(env.lists, base);
});

test('ownWriteLog: matches only the exact value, and expires', () => {
    let t = 0;
    const log = createOwnWriteLog(() => t, 1_000);
    log.record('g', 'k', 'v');
    assert.equal(log.matches('g', 'k', 'v'), true);
    assert.equal(log.matches('g', 'k', 'w'), false);
    assert.equal(log.matches('other', 'k', 'v'), false);
    log.record('g', 'gone', null);
    assert.equal(log.matches('g', 'gone', null), true);
    t = 2_000;
    assert.equal(log.matches('g', 'k', 'v'), false);
});
