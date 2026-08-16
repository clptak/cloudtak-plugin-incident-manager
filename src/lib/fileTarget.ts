/**
 * "Case file folder" — an optional user-chosen directory that generated
 * documents (IAPs, demob packages, exports) are written into directly,
 * instead of going through the browser download flow.
 *
 * Uses the File System Access API. The chosen `FileSystemDirectoryHandle` is
 * persisted in IndexedDB, so the folder survives restarts; the browser still
 * requires a permission re-grant per session, which we request on demand.
 *
 * Support:
 * - Chrome / Edge: works.
 * - CloudTAK Desktop (Electron 40): the API exists, but the app's permission
 *   handler must allow the `fileSystem` permission (see docs/case-file-folder.md).
 * - Firefox / Safari / mobile: unsupported — callers fall back to download.
 */

const DB_NAME = 'incident-manager-file-target';
const STORE = 'handles';
const KEY = 'case-file-folder';

interface FsPermissionHandle {
    queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export interface DirectoryHandleLike extends FsPermissionHandle {
    name: string;
    getFileHandle(name: string, opts?: { create?: boolean }): Promise<{
        createWritable(): Promise<{
            write(data: BufferSource | Blob | string): Promise<void>;
            close(): Promise<void>;
        }>;
    }>;
    getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirectoryHandleLike>;
}

/** True when this runtime exposes the directory picker. */
export function fileTargetSupported(): boolean {
    return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
    });
}

async function idbGet(): Promise<DirectoryHandleLike | null> {
    try {
        const db = await openDb();
        return await new Promise((resolve) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            req.onsuccess = () => resolve((req.result as DirectoryHandleLike) ?? null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function idbPut(handle: DirectoryHandleLike | null): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
        const req = handle ? store.put(handle, KEY) : store.delete(KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Could not save folder'));
    });
}

/** The saved folder handle, or null when none is configured. */
export async function savedFileTarget(): Promise<DirectoryHandleLike | null> {
    return idbGet();
}

/** Prompt for a folder and remember it. Returns null when the user cancels. */
export async function chooseFileTarget(): Promise<DirectoryHandleLike | null> {
    const picker = (globalThis as {
        showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandleLike>;
    }).showDirectoryPicker;
    if (!picker) throw new Error('This browser cannot pick a folder — downloads will be used instead.');
    try {
        const handle = await picker({ mode: 'readwrite' });
        await idbPut(handle);
        return handle;
    } catch (err) {
        // AbortError = user cancelled; anything else is worth surfacing.
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        throw err;
    }
}

export async function clearFileTarget(): Promise<void> {
    await idbPut(null);
}

/**
 * Ensure we still hold write permission (browsers drop it between sessions).
 * `interactive` prompts the user; pass false for a silent status check.
 */
export async function ensureWritable(
    handle: DirectoryHandleLike,
    interactive = true,
): Promise<boolean> {
    try {
        const current = await handle.queryPermission?.({ mode: 'readwrite' });
        if (current === 'granted') return true;
        if (!interactive) return false;
        const asked = await handle.requestPermission?.({ mode: 'readwrite' });
        return asked === 'granted';
    } catch {
        return false;
    }
}

function downloadFallback(bytes: Uint8Array, filename: string, mime: string): void {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const url = URL.createObjectURL(new Blob([ab], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export interface SaveResult {
    /** Where the file went. */
    via: 'folder' | 'download';
    /** Folder name when written directly. */
    folder?: string;
    /** Sub-path used inside the folder, if any. */
    path: string;
}

/**
 * Write a generated document to the case file folder when one is configured
 * and writable; otherwise fall back to a browser download. `subfolder`
 * (e.g. the incident name) is created inside the target when given.
 */
export async function saveGeneratedFile(
    bytes: Uint8Array,
    filename: string,
    opts: { mime?: string; subfolder?: string } = {},
): Promise<SaveResult> {
    const mime = opts.mime ?? 'application/octet-stream';
    const handle = await savedFileTarget();
    if (!handle || !(await ensureWritable(handle))) {
        downloadFallback(bytes, filename, mime);
        return { via: 'download', path: filename };
    }

    try {
        let dir = handle;
        if (opts.subfolder) {
            const safe = opts.subfolder.replace(/[^\w .-]+/g, '_').slice(0, 80);
            if (safe) dir = await handle.getDirectoryHandle(safe, { create: true });
        }
        const file = await dir.getFileHandle(filename, { create: true });
        const writable = await file.createWritable();
        const ab = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(ab).set(bytes);
        await writable.write(ab);
        await writable.close();
        return {
            via: 'folder',
            folder: handle.name,
            path: opts.subfolder ? `${opts.subfolder}/${filename}` : filename,
        };
    } catch {
        // Any write failure (permission revoked, disk, name clash) → download.
        downloadFallback(bytes, filename, mime);
        return { via: 'download', path: filename };
    }
}

/** Human sentence for status lines. */
export function describeSave(result: SaveResult): string {
    return result.via === 'folder'
        ? `Saved ${result.path} to ${result.folder}.`
        : `Downloaded ${result.path}.`;
}
