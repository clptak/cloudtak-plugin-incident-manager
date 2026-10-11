/**
 * Browser glue for propertyWatch.ts: one watcher per management mission,
 * shared by every open screen, fed by CloudTAK's `cloudtak` BroadcastChannel
 * (push, once CloudTAK #1919 ships) and by polling until then.
 *
 * Also records this tab's own property writes so screens can ignore their
 * own saves.
 */

import { createMissionPropertyClient, type MissionPropertyClient } from './missionProperties.ts';
import { cloudtakPropertyTransport } from './missionPropertiesTransport.ts';
import { createOwnWriteLog, createPropertyWatcher, type PropertyWatcher } from './propertyWatch.ts';

/** CloudTAK's WorkerMessageType.Mission_Change_Property (CloudTAK #1919). */
const MISSION_CHANGE_PROPERTY = 'mission:change:property';

export const ownWrites = createOwnWriteLog();

/** Wrap a client so every successful write is remembered as this tab's own. */
export function recordingClient(missionGuid: string, client: MissionPropertyClient): MissionPropertyClient {
    return {
        ...client,
        async set(key, value) {
            await client.set(key, value);
            ownWrites.record(missionGuid, key, value);
        },
        async setJson(key, value) {
            const text = JSON.stringify(value);
            await client.set(key, text);
            ownWrites.record(missionGuid, key, text);
        },
        async delete(key) {
            await client.delete(key);
            ownWrites.record(missionGuid, key, null);
        },
    };
}

function pushSubscriber(missionGuid: string) {
    return (onPush: () => void): (() => void) => {
        if (typeof BroadcastChannel === 'undefined') return () => {};
        const channel = new BroadcastChannel('cloudtak');
        channel.onmessage = (event: MessageEvent) => {
            const msg = event.data as { type?: string; body?: { guid?: string } } | null;
            if (msg?.type === MISSION_CHANGE_PROPERTY && msg.body?.guid === missionGuid) onPush();
        };
        return () => channel.close();
    };
}

function onVisible(cb: () => void): () => void {
    if (typeof document === 'undefined') return () => {};
    const handler = () => {
        if (document.visibilityState === 'visible') cb();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
}

const watchers = new Map<string, PropertyWatcher>();

/** The shared watcher for one management mission (created on first use). */
export function incidentWatcher(missionGuid: string): PropertyWatcher {
    let watcher = watchers.get(missionGuid);
    if (watcher) return watcher;
    const client = createMissionPropertyClient({ missionGuid, transport: cloudtakPropertyTransport });
    watcher = createPropertyWatcher({
        async list() {
            return new Map((await client.list()).map((p) => [p.key, p.value]));
        },
        isOwnWrite: (key, value) => ownWrites.matches(missionGuid, key, value),
        subscribePush: pushSubscriber(missionGuid),
        isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
        onVisible,
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
    watchers.set(missionGuid, watcher);
    return watcher;
}
