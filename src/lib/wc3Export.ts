/**
 * WinC.A.S.I.E. III (WC3) export from Initial Consensus.
 *
 * Produces .con / .poa / .pod / .nam / .hst / .ioc text files (CRLF) and a
 * STORE-only zip download matching CASIE_support/sampleWC3 layout.
 */

import {
    consensusForSegment,
    consensusRow,
    type InitialConsensusState,
} from './consensus.ts';

export interface Wc3SegmentRef {
    uid: string;
    callsign: string;
}

const CRLF = '\r\n';

/** Sanitize a basename for zip/folder use. */
export function safeWc3Basename(name: string): string {
    return name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'consensus';
}

/** Format a percentage like sample .con: 10, 28.8 (no forced trailing zeros). */
export function formatConPercent(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 1e10) / 1e10;
    if (Number.isInteger(rounded)) return String(rounded);
    return String(rounded);
}

/** Format a POA fraction (percent / 100) for .poa (15 significant digits). */
export function formatPoaFraction(percent: number): string {
    if (!Number.isFinite(percent)) return '0';
    return (+(percent / 100).toPrecision(15)).toString();
}

function joinLines(lines: Array<string | number>): string {
    return lines.map(String).join(CRLF) + CRLF;
}

export interface Wc3FileContents {
    con: string;
    poa: string;
    pod: string;
    nam: string;
    hst: string;
    ioc: string;
}

/** Build WC3 text file contents from an accepted consensus + segments. */
export function buildWc3Files(
    consensus: InitialConsensusState,
    segments: Wc3SegmentRef[],
): Wc3FileContents {
    const nSeg = segments.length;
    const respondents = consensus.respondents;

    const conLines: Array<string | number> = [
        respondents.length,
        nSeg + 1,
    ];
    for (const resp of respondents) {
        conLines.push(resp.name);
        conLines.push(formatConPercent(resp.row));
        for (const seg of segments) {
            conLines.push(formatConPercent(resp.values[seg.uid] ?? 0));
        }
    }

    const poaLines: Array<string | number> = [
        nSeg,
        formatPoaFraction(consensusRow(respondents)),
    ];
    for (const seg of segments) {
        poaLines.push(formatPoaFraction(consensusForSegment(respondents, seg.uid)));
    }

    const podLines: Array<string | number> = [nSeg];
    for (let i = 0; i < nSeg + 1; i++) podLines.push(0);

    return {
        con: joinLines(conLines),
        poa: joinLines(poaLines),
        pod: joinLines(podLines),
        nam: joinLines([consensus.incident_name]),
        hst: '',
        ioc: '',
    };
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Minimal STORE-only ZIP (no compression, no extra deps) ---

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
    const b = new Uint8Array(2);
    b[0] = n & 0xff;
    b[1] = (n >>> 8) & 0xff;
    return b;
}

function u32(n: number): Uint8Array {
    const b = new Uint8Array(4);
    b[0] = n & 0xff;
    b[1] = (n >>> 8) & 0xff;
    b[2] = (n >>> 16) & 0xff;
    b[3] = (n >>> 24) & 0xff;
    return b;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return out;
}

interface ZipEntry {
    path: string;
    data: Uint8Array;
}

function encodeUtf8(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/** Build an uncompressed (STORE) zip archive. */
export function buildStoreZip(entries: ZipEntry[]): Blob {
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encodeUtf8(entry.path);
        const data = entry.data;
        const crc = crc32(data);
        const size = data.length;

        const localHeader = concatBytes([
            u32(0x04034b50),
            u16(20),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(crc),
            u32(size),
            u32(size),
            u16(nameBytes.length),
            u16(0),
            nameBytes,
            data,
        ]);

        const centralHeader = concatBytes([
            u32(0x02014b50),
            u16(20),
            u16(20),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(crc),
            u32(size),
            u32(size),
            u16(nameBytes.length),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(offset),
            nameBytes,
        ]);

        localParts.push(localHeader);
        centralParts.push(centralHeader);
        offset += localHeader.length;
    }

    const centralDir = concatBytes(centralParts);
    const end = concatBytes([
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(entries.length),
        u16(entries.length),
        u32(centralDir.length),
        u32(offset),
        u16(0),
    ]);

    const zipBytes = concatBytes([...localParts, centralDir, end]);
    const ab = new ArrayBuffer(zipBytes.byteLength);
    new Uint8Array(ab).set(zipBytes);
    return new Blob([ab], { type: 'application/zip' });
}

/**
 * Build WC3 files and trigger a browser download of `{basename}.zip`
 * containing `{basename}/{basename}.{ext}` entries.
 */
export function downloadWc3Zip(
    consensus: InitialConsensusState,
    segments: Wc3SegmentRef[],
): string {
    const basename = safeWc3Basename(
        (consensus.filename || consensus.incident_name || 'consensus').trim(),
    );
    const files = buildWc3Files(consensus, segments);
    const enc = new TextEncoder();
    const folder = `${basename}/`;
    const entries: ZipEntry[] = [
        { path: `${folder}${basename}.con`, data: enc.encode(files.con) },
        { path: `${folder}${basename}.hst`, data: enc.encode(files.hst) },
        { path: `${folder}${basename}.ioc`, data: enc.encode(files.ioc) },
        { path: `${folder}${basename}.nam`, data: enc.encode(files.nam) },
        { path: `${folder}${basename}.poa`, data: enc.encode(files.poa) },
        { path: `${folder}${basename}.pod`, data: enc.encode(files.pod) },
    ];
    const blob = buildStoreZip(entries);
    const zipName = `${basename}.zip`;
    downloadBlob(blob, zipName);
    return zipName;
}
