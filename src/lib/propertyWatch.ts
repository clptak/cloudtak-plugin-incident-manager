/**
 * Notices changes to an incident's Mission Properties made by other managers.
 *
 * Two sources, one result:
 *   - push: CloudTAK's worker broadcasts `mission:change:property` when the
 *     server announces a property write (needs CloudTAK #1919). A push only
 *     says "something changed"; the watcher re-lists to learn exactly what.
 *   - poll: re-list every `pollMs` (15 s). Once a push has been seen, push is
 *     trusted and polling drops to a slow safety net (`pushPollMs`, 60 s).
 * Polling pauses while the page is hidden and catches up when it is shown.
 *
 * Changes are found by diffing listings, so a missed push or a skipped poll
 * never loses a change - the next listing still differs. Each change says
 * whether it matches a write this tab made itself (`own`), so callers can
 * ignore their own saves.
 *
 * No browser APIs here; liveIncident.ts supplies them.
 */

export interface PropertyChange {
    key: string;
    /** New value, or null when the key was deleted. */
    value: string | null;
    /** True when this tab wrote exactly this value itself. */
    own: boolean;
}

export type ChangeListener = (changes: PropertyChange[]) => void;

export interface PropertyWatcherDeps {
    /** Every property on the mission, key → value. */
    list(): Promise<Map<string, string>>;
    isOwnWrite?(key: string, value: string | null): boolean;
    /** Start listening for push notices; returns a stop function. */
    subscribePush?(onPush: () => void): () => void;
    isHidden?(): boolean;
    /** Call `cb` when the page becomes visible again; returns a stop function. */
    onVisible?(cb: () => void): () => void;
    setTimer(fn: () => void, ms: number): unknown;
    clearTimer(handle: unknown): void;
}

export interface PropertyWatcherOpts {
    pollMs?: number;
    pushPollMs?: number;
    /** Collapse a burst of push notices (one save can write several keys). */
    pushDebounceMs?: number;
}

export interface PropertyWatcher {
    /** Starts watching on the first listener and stops after the last leaves. */
    subscribe(listener: ChangeListener): () => void;
    /** Re-list now (also used by push and the poll timer). */
    checkNow(): Promise<void>;
    readonly pushSeen: boolean;
    readonly running: boolean;
}

/** Keys whose value differs between two listings (deleted keys → null). */
export function diffListings(
    before: Map<string, string>,
    after: Map<string, string>,
): Array<{ key: string; value: string | null }> {
    const out: Array<{ key: string; value: string | null }> = [];
    for (const [key, value] of after) {
        if (before.get(key) !== value) out.push({ key, value });
    }
    for (const key of before.keys()) {
        if (!after.has(key)) out.push({ key, value: null });
    }
    return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function createPropertyWatcher(
    deps: PropertyWatcherDeps,
    opts: PropertyWatcherOpts = {},
): PropertyWatcher {
    const pollMs = opts.pollMs ?? 15_000;
    const pushPollMs = opts.pushPollMs ?? 60_000;
    const pushDebounceMs = opts.pushDebounceMs ?? 300;

    const listeners = new Set<ChangeListener>();
    let snapshot: Map<string, string> | null = null;
    let running = false;
    let pushSeen = false;
    let pollTimer: unknown = null;
    let pushTimer: unknown = null;
    let stopPush: (() => void) | null = null;
    let stopVisible: (() => void) | null = null;
    let inFlight: Promise<void> | null = null;
    let again = false;

    function schedulePoll(): void {
        if (pollTimer !== null) deps.clearTimer(pollTimer);
        pollTimer = null;
        if (!running) return;
        pollTimer = deps.setTimer(() => {
            pollTimer = null;
            // Hidden: skip this round; onVisible catches up.
            if (deps.isHidden?.()) {
                schedulePoll();
                return;
            }
            void checkNow();
        }, pushSeen ? pushPollMs : pollMs);
    }

    async function runCheck(): Promise<void> {
        let next: Map<string, string>;
        try {
            next = await deps.list();
        } catch {
            // Network blip or server restart: try again on the next tick.
            return;
        }
        if (!running) return;
        const before = snapshot;
        snapshot = next;
        if (!before) return; // first listing is the baseline
        const changes = diffListings(before, next).map((c) => ({
            ...c,
            own: deps.isOwnWrite?.(c.key, c.value) ?? false,
        }));
        if (!changes.length) return;
        for (const listener of [...listeners]) {
            try {
                listener(changes);
            } catch {
                // One broken listener must not stop the others.
            }
        }
    }

    async function checkNow(): Promise<void> {
        if (!running) return;
        if (inFlight) {
            again = true;
            return inFlight;
        }
        inFlight = (async () => {
            try {
                do {
                    again = false;
                    await runCheck();
                } while (again && running);
            } finally {
                inFlight = null;
                schedulePoll();
            }
        })();
        return inFlight;
    }

    function onPush(): void {
        pushSeen = true;
        if (pushTimer !== null) deps.clearTimer(pushTimer);
        pushTimer = deps.setTimer(() => {
            pushTimer = null;
            void checkNow();
        }, pushDebounceMs);
    }

    function start(): void {
        running = true;
        snapshot = null;
        stopPush = deps.subscribePush?.(onPush) ?? null;
        stopVisible = deps.onVisible?.(() => void checkNow()) ?? null;
        void checkNow();
    }

    function stop(): void {
        running = false;
        snapshot = null;
        if (pollTimer !== null) deps.clearTimer(pollTimer);
        if (pushTimer !== null) deps.clearTimer(pushTimer);
        pollTimer = null;
        pushTimer = null;
        stopPush?.();
        stopVisible?.();
        stopPush = null;
        stopVisible = null;
    }

    return {
        subscribe(listener) {
            listeners.add(listener);
            if (!running) start();
            return () => {
                listeners.delete(listener);
                if (!listeners.size && running) stop();
            };
        },
        checkNow,
        get pushSeen() { return pushSeen; },
        get running() { return running; },
    };
}

/** Remembers this tab's own writes so the watcher can tell them apart. */
export function createOwnWriteLog(now: () => number = Date.now, ttlMs = 10 * 60_000) {
    const writes = new Map<string, Map<string, { value: string | null; at: number }>>();
    return {
        record(guid: string, key: string, value: string | null): void {
            let forGuid = writes.get(guid);
            if (!forGuid) writes.set(guid, (forGuid = new Map()));
            forGuid.set(key, { value, at: now() });
        },
        matches(guid: string, key: string, value: string | null): boolean {
            const hit = writes.get(guid)?.get(key);
            if (!hit) return false;
            if (now() - hit.at > ttlMs) {
                writes.get(guid)?.delete(key);
                return false;
            }
            return hit.value === value;
        },
    };
}
