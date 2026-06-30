import { Preferences } from '@capacitor/preferences';
import { server, stdurl } from '../../../../src/std.ts';

function bytesToArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/** Upload raw bytes as a mission file (DataSync contents). */
export async function uploadMissionFile(
    missionGuid: string,
    filename: string,
    data: Uint8Array,
    opts?: {
        missionToken?: string;
        mimeType?: string;
    },
): Promise<void> {
    const { value: token } = await Preferences.get({ key: 'token' });
    const url = stdurl(`/api/marti/missions/${missionGuid}/upload`);
    url.searchParams.set('name', filename);
    const mimeType = opts?.mimeType ?? 'application/pdf';

    const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': mimeType,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts?.missionToken) headers.MissionAuthorization = opts.missionToken;

    const res = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: bytesToArrayBuffer(data),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
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
