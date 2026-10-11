/**
 * Browser transport for missionProperties.ts: calls CloudTAK with the
 * signed-in user's token, the same way missionUpload.ts does.
 */

import { Preferences } from '@capacitor/preferences';
import { stdurl } from '../../../../src/std.ts';
import type { PropertyTransport } from './missionProperties.ts';

export const cloudtakPropertyTransport: PropertyTransport = async (req) => {
    const { value: token } = await Preferences.get({ key: 'token' });
    const url = stdurl(req.path);
    for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);

    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (req.missionToken) headers.MissionAuthorization = req.missionToken;
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(url.toString(), {
        method: req.method,
        headers,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    });

    const text = await res.text().catch(() => '');
    let json: unknown;
    if (text.trim()) {
        try {
            json = JSON.parse(text);
        } catch {
            json = undefined;
        }
    }
    return { status: res.status, json, text };
};
