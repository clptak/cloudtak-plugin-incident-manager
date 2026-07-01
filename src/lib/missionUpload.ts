import { Preferences } from '@capacitor/preferences';
import { server, stdurl } from '../../../../src/std.ts';

function bytesToArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function tryContentHash(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const rec = value as Record<string, unknown>;
    const hash = rec.hash ?? rec.Hash;
    return typeof hash === 'string' && hash.trim() ? hash.trim() : undefined;
}

/** Best-effort hash from POST /missions/:guid/upload JSON body. */
export function extractUploadContentHash(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const root = payload as Record<string, unknown>;

    const direct = tryContentHash(root);
    if (direct) return direct;

    const data = root.data;
    if (Array.isArray(data)) {
        for (const item of data) {
            const hash = tryContentHash(item);
            if (hash) return hash;
        }
    } else if (data && typeof data === 'object') {
        const dataRec = data as Record<string, unknown>;
        const contents = dataRec.contents;
        if (Array.isArray(contents)) {
            for (const item of contents) {
                const inner = item && typeof item === 'object'
                    ? ((item as { data?: unknown }).data ?? item)
                    : item;
                const hash = tryContentHash(inner);
                if (hash) return hash;
            }
        }
        const nested = tryContentHash(data);
        if (nested) return nested;
    }

    return undefined;
}

function formatUploadError(status: number, detail: string): string {
    const trimmed = detail.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed) as { message?: string };
            if (parsed.message && !parsed.message.includes('<!DOCTYPE')) {
                return `Upload failed (${status}): ${parsed.message}`;
            }
        } catch {
            /* fall through */
        }
    }
    if (trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')) {
        return `Upload failed (${status}): the server rejected the file upload. `
            + 'Confirm you have MISSION_WRITE on this mission.';
    }
    return `Upload failed (${status})${trimmed ? `: ${trimmed.slice(0, 200)}` : ''}`;
}

/** Upload raw bytes as a mission file (DataSync contents). Returns content hash when present. */
export async function uploadMissionFile(
    missionGuid: string,
    filename: string,
    data: Uint8Array,
    opts?: {
        missionToken?: string;
    },
): Promise<string | undefined> {
    const { value: token } = await Preferences.get({ key: 'token' });
    const url = stdurl(`/api/marti/missions/${missionGuid}/upload`);
    url.searchParams.set('name', filename);

    const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts?.missionToken) headers.MissionAuthorization = opts.missionToken;

    const body = bytesToArrayBuffer(data);
    const res = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
    });

    const detail = await res.text().catch(() => '');
    if (!res.ok) {
        throw new Error(formatUploadError(res.status, detail));
    }

    if (!detail.trim()) return undefined;
    try {
        return extractUploadContentHash(JSON.parse(detail));
    } catch {
        return undefined;
    }
}

/** Download a mission content file as text (DataSync contents, not the log). */
export async function fetchMissionFileText(hash: string, name: string): Promise<string> {
    const res = await server.GET('/api/marti/api/files/{:hash}', {
        params: {
            path: { ':hash': hash },
            query: { name },
        },
        parseAs: 'text',
    });
    if (res.error) throw new Error(res.error.message);
    return res.data;
}

export function safeMissionFilename(name: string): string {
    return name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 100) || 'mission';
}

export function downloadPdfBytes(data: Uint8Array, filename: string): void {
    const blob = new Blob([bytesToArrayBuffer(data)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
