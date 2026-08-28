/**
 * OpPeriodGateway adapter: OP DataSync lifecycle over CloudTAK's Marti routes.
 * Phase 0 findings applied here:
 * - OP syncs are created role-enabled (`defaultRole: MISSION_READONLY_SUBSCRIBER`)
 *   or later role flips would 400 (MissionApi.java:2972);
 * - every privileged op sends the owner token via MissionAuthorization —
 *   without it the request rides the defaultRole and 403s;
 * - the owner token from create MUST be persisted (registry, Sworn-side).
 */

import { server } from '../../../../src/std.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import type { OpPeriodGateway } from '../domain/ports.ts';

function authHeaders(op: OpPeriodRegistryEntry): Record<string, string> {
    return op.ownerToken ? { MissionAuthorization: op.ownerToken } : {};
}

export function createOpPeriodGateway(): OpPeriodGateway {
    return {
        async create(op) {
            // Writable by default (Paul, 2026-08-06): field personnel must add
            // markers/logs immediately on subscribe. OP-close enforcement is the
            // channel strip (volunteers lose the mission entirely) — stronger and
            // simpler than per-user demotion, which is illegal below defaultRole
            // on password-less missions anyway (MissionServiceDefaultImpl.java:4219).
            const res = await server.POST('/api/marti/mission', {
                body: {
                    name: op.name,
                    group: op.channels,
                    description: op.description ?? '',
                    defaultRole: 'MISSION_SUBSCRIBER',
                    keywords: op.keywords ?? [],
                },
            });
            if (res.error) throw new Error(res.error.message);
            const entry: OpPeriodRegistryEntry = {
                opNumber: op.opNumber,
                name: res.data.name,
                guid: res.data.guid,
                status: 'open',
                channels: op.channels,
            };
            const token = (res.data as { token?: string }).token;
            if (token) entry.ownerToken = token;
            return entry;
        },

        async setSubscriberRole(op, subscriber) {
            const res = await server.PUT('/api/marti/missions/{:guid}/role', {
                params: { path: { ':guid': op.name } },
                headers: authHeaders(op),
                body: {
                    clientUid: subscriber.clientUid,
                    username: subscriber.username,
                    role: subscriber.role,
                },
            });
            if (res.error) throw new Error(res.error.message);
        },

        async listSubscribers(op) {
            const res = await server.GET('/api/marti/missions/{:guid}/subscriptions/roles', {
                params: { path: { ':guid': op.name } },
                headers: authHeaders(op),
            });
            if (res.error) throw new Error(res.error.message);
            const data = (res.data as { data?: unknown }).data;
            if (!Array.isArray(data)) return [];
            return data.map((raw) => {
                const rec = raw as {
                    clientUid?: string;
                    username?: string;
                    role?: { type?: string };
                };
                return {
                    clientUid: rec.clientUid ?? '',
                    username: rec.username ?? '',
                    role: rec.role?.type ?? '',
                };
            }).filter((s) => s.clientUid || s.username);
        },

        async setChannels(op, channels) {
            const res = await server.PATCH('/api/marti/missions/{:guid}', {
                params: { path: { ':guid': op.name } },
                headers: authHeaders(op),
                body: { groups: channels },
            });
            if (res.error) throw new Error(res.error.message);
        },
    };
}
