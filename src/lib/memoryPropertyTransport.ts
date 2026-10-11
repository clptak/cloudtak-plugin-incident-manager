/**
 * In-memory stand-in for CloudTAK + TAK Server 5.9 Mission Properties, for
 * tests. Mirrors the #1852 route shapes and the server semantics verified
 * live: per-key upsert, prefix list sorted by key, 404 for a missing key.
 */

import type { PropertyTransport, PropertyTransportRequest } from './missionProperties.ts';

export interface MemoryPropertyServer {
    store: Map<string, string>;
    calls: PropertyTransportRequest[];
    transport: PropertyTransport;
}

export function createMemoryPropertyServer(missionGuid: string): MemoryPropertyServer {
    const base = `/api/marti/missions/${encodeURIComponent(missionGuid)}/property`;
    const store = new Map<string, string>();
    const calls: PropertyTransportRequest[] = [];
    const ok = (json: unknown) => ({ status: 200, json, text: JSON.stringify(json) });
    const notFound = (key: string) => {
        const json = { status: 404, message: `MissionProperty ${key} not found` };
        return { status: 404, json, text: JSON.stringify(json) };
    };

    const transport: PropertyTransport = async (req) => {
        calls.push(req);
        if (req.path === base) {
            if (req.method === 'GET') {
                const prefix = req.query?.prefix ?? '';
                const items = [...store]
                    .filter(([k]) => k.startsWith(prefix))
                    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                    .map(([key, value]) => ({ key, value }));
                return ok({ total: items.length, items });
            }
            if (req.method === 'PUT') {
                const { key, value } = req.body as { key: string; value: string };
                store.set(key, value);
                return ok({ version: '3', data: { key, value } });
            }
            store.clear();
            return ok({ status: 200, message: 'Properties Deleted' });
        }
        const key = decodeURIComponent(req.path.slice(base.length + 1));
        if (req.method === 'GET') {
            return store.has(key) ? ok({ version: '3', data: { key, value: store.get(key) } }) : notFound(key);
        }
        if (!store.has(key)) return notFound(key);
        store.delete(key);
        return ok({ status: 200, message: 'Property Deleted' });
    };

    return { store, calls, transport };
}
