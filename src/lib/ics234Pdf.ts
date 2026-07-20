import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import templateUrl from '../assets/ics-234-template.pdf?url';
import {
    MAX_OBJECTIVES,
    formatStrategiesForPdf,
    formatTacticsForPdf,
    rowHasContent,
    type ObjectiveRow,
} from './incidentPost.ts';
import { formatDatetimeForPdf } from './ics234Datetime.ts';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';

export interface Ics234Header {
    incidentName: string;
    incidentLocation: string;
    operationalPeriodFrom: string;
    operationalPeriodTo: string;
    preparedByName: string;
    preparedByTitle: string;
    preparedBySignature: string;
    preparedByDateTime: string;
}

export const ICS234_MISSION_FILENAME = 'ICS-234.pdf';

const TEMPLATE_FORM_PAGE_INDEX = 1;
const PAGE_W = 612;
const PAGE_H = 792;
const FONT_SIZE = 9;
const LINE_HEIGHT = 11;
const CELL_PAD = 3;
const GRID_LINE = rgb(0, 0, 0);
const GRID_THICKNESS = 0.75;

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Layout tuned for 9pt Helvetica on the ICS 234-CG form page (page 2 of template). */
const LAYOUT = {
    header: {
        incidentName: { x: 37.32, y: 680.28, w: 177.6, h: 25.68 },
        incidentLocation: { x: 216.96, y: 680.28, w: 177.72, h: 25.68 },
        periodFrom: { x: 424.27, y: 681.4, w: 72, h: 20.16 },
        periodTo: { x: 500.72, y: 681.78, w: 72.36, h: 20.16 },
    },
    matrix: {
        /** Template AcroForm row bottoms (row 1 = top). */
        rows: [
            { y: 573.48, h: 66.96 },
            { y: 504.36, h: 67.2 },
            { y: 435.6, h: 66.96 },
            { y: 366.6, h: 67.2 },
            { y: 297.6, h: 67.2 },
            { y: 228.84, h: 66.96 },
            { y: 159.84, h: 67.2 },
            { y: 91.08, h: 66.96 },
        ] as const,
        columns: [
            { x: 37.68, w: 176.88 },
            { x: 217.32, w: 177 },
            { x: 397.08, w: 176.88 },
        ] as const,
        /** Horizontal rule under boxes 1–3 / above column headers 4–6. */
        headerRuleY: 680.28,
        /** Horizontal rule under column headers / above row 1 data. */
        columnHeaderRuleY: 573.48 + 66.96,
        /** Horizontal rule above footer box 7. */
        footerRuleY: 91.08,
    },
    footer: {
        name: { x: 37.2, y: 36, w: 145.32, h: 20.16 },
        title: { x: 184.32, y: 36, w: 144.96, h: 20.16 },
        signature: { x: 331.08, y: 36, w: 145.32, h: 20.16 },
        dateTime: { x: 478.2, y: 36, w: 96.24, h: 20.16 },
    },
    pageNumber: { x: 468, y: 12, w: 120, h: 14 },
} as const;

/** Regions to white-out (template AcroForm boxes and page placeholder). */
const WHITE_OUT_RECTS: Rect[] = [
    ...Object.values(LAYOUT.header),
    ...Object.values(LAYOUT.footer),
    LAYOUT.pageNumber,
    // Original matrix form fields (rows 1–8 × 3 columns)
    ...LAYOUT.matrix.rows.flatMap((row) => (
        LAYOUT.matrix.columns.map((col) => ({ x: col.x, y: row.y, w: col.w, h: row.h }))
    )),
];

let templateBytesPromise: Promise<ArrayBuffer> | null = null;

function loadTemplateBytes(): Promise<ArrayBuffer> {
    if (!templateBytesPromise) {
        templateBytesPromise = fetch(templateUrl).then((res) => {
            if (!res.ok) throw new Error(`Could not load ICS 234 template (${res.status})`);
            return res.arrayBuffer();
        });
    }
    return templateBytesPromise;
}

function matrixRowRect(rowIndex: number): { objective: Rect; strategy: Rect; tactic: Rect } {
    const row = LAYOUT.matrix.rows[rowIndex];
    const [obj, strat, tac] = LAYOUT.matrix.columns;
    return {
        objective: { x: obj.x, y: row.y, w: obj.w, h: row.h },
        strategy: { x: strat.x, y: row.y, w: strat.w, h: row.h },
        tactic: { x: tac.x, y: row.y, w: tac.w, h: row.h },
    };
}

function matrixGridBounds(): { left: number; right: number; bottom: number; top: number } {
    const [firstCol, , lastCol] = LAYOUT.matrix.columns;
    const firstRow = LAYOUT.matrix.rows[0];
    const lastRow = LAYOUT.matrix.rows[LAYOUT.matrix.rows.length - 1];
    return {
        left: firstCol.x,
        right: lastCol.x + lastCol.w,
        bottom: lastRow.y,
        top: firstRow.y + firstRow.h,
    };
}

function drawHLine(page: PDFPage, x1: number, x2: number, y: number): void {
    page.drawLine({
        start: { x: x1, y },
        end: { x: x2, y },
        thickness: GRID_THICKNESS,
        color: GRID_LINE,
    });
}

function drawVLine(page: PDFPage, x: number, y1: number, y2: number): void {
    page.drawLine({
        start: { x, y: y1 },
        end: { x, y: y2 },
        thickness: GRID_THICKNESS,
        color: GRID_LINE,
    });
}

/** Redraw grid lines covered by white-out over AcroForm fields. */
function drawGridLines(page: PDFPage): void {
    const { left, right, bottom, top } = matrixGridBounds();
    const [col1, col2] = LAYOUT.matrix.columns;
    const colDivider1 = col1.x + col1.w;
    const colDivider2 = col2.x + col2.w;

    // Between boxes 1–3 and column headers 4–6.
    drawHLine(page, left, right, LAYOUT.matrix.headerRuleY);
    // Under column headers, above objective row 1.
    drawHLine(page, left, right, LAYOUT.matrix.columnHeaderRuleY);

    // Between each objective row (template row bottom edges).
    for (const row of LAYOUT.matrix.rows) {
        drawHLine(page, left, right, row.y);
    }

    // Between boxes 1/4 and 2/5, and 2/5 and 3/6 (full matrix height).
    drawVLine(page, colDivider1, bottom, top);
    drawVLine(page, colDivider2, bottom, top);
    drawVLine(page, left, bottom, top);
    drawVLine(page, right, bottom, top);

    // Vertical separator between boxes 1/2 and 2/5 in the header row.
    const headerTop = LAYOUT.header.incidentName.y + LAYOUT.header.incidentName.h;
    drawVLine(page, colDivider1, LAYOUT.matrix.headerRuleY, headerTop);

    // Above footer box 7 (same as bottom matrix rule; one draw is enough).

    const footerTop = LAYOUT.footer.name.y + LAYOUT.footer.name.h;
    drawHLine(page, LAYOUT.footer.name.x, LAYOUT.footer.dateTime.x + LAYOUT.footer.dateTime.w, LAYOUT.footer.name.y);
    drawVLine(page, LAYOUT.footer.title.x, LAYOUT.footer.name.y, footerTop);
    drawVLine(page, LAYOUT.footer.signature.x, LAYOUT.footer.name.y, footerTop);
    drawVLine(page, LAYOUT.footer.dateTime.x, LAYOUT.footer.name.y, footerTop);
}

// #region agent log
function agentScanNonWinAnsi(label: string, text: string, hypothesisId: string): void {
    const s = String(text ?? '');
    const offenders: Array<{ ch: string; hex: string; index: number }> = [];
    for (let i = 0; i < s.length;) {
        const cp = s.codePointAt(i)!;
        const ch = String.fromCodePoint(cp);
        if (cp > 255) offenders.push({ ch, hex: `0x${cp.toString(16)}`, index: i });
        i += ch.length;
    }
    if (!offenders.length) return;
    fetch('http://127.0.0.1:7627/ingest/45700870-a64c-4e23-b841-0db3851123a5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '05df6e' },
        body: JSON.stringify({
            sessionId: '05df6e',
            runId: 'pre-fix',
            hypothesisId,
            location: 'ics234Pdf.ts:agentScanNonWinAnsi',
            message: 'non-WinAnsi chars in ICS-234 field',
            data: {
                label,
                preview: s.slice(0, 120),
                offenders: offenders.slice(0, 10),
                offenderCount: offenders.length,
            },
            timestamp: Date.now(),
        }),
    }).catch(() => {});
}
// #endregion

function wrapLines(text: string, font: PDFFont, maxWidth: number): string[] {
    const normalized = toPdfWinAnsiText(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    const lines: string[] = [];
    for (const paragraph of normalized.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) continue;

        let line = words[0];
        for (let i = 1; i < words.length; i++) {
            const next = `${line} ${words[i]}`;
            // #region agent log
            let nextWidth: number;
            try {
                nextWidth = font.widthOfTextAtSize(next, FONT_SIZE);
            } catch (err) {
                fetch('http://127.0.0.1:7627/ingest/45700870-a64c-4e23-b841-0db3851123a5', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '05df6e' },
                    body: JSON.stringify({
                        sessionId: '05df6e',
                        runId: 'pre-fix',
                        hypothesisId: 'D',
                        location: 'ics234Pdf.ts:wrapLines',
                        message: 'widthOfTextAtSize threw',
                        data: {
                            err: err instanceof Error ? err.message : String(err),
                            snippet: next.slice(0, 80),
                        },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                throw err;
            }
            if (nextWidth <= maxWidth) {
            // #endregion
                line = next;
            } else {
                lines.push(line);
                line = words[i];
            }
        }
        lines.push(line);
    }
    return lines;
}

function maxLinesForRect(rect: Rect): number {
    return Math.max(1, Math.floor((rect.h - CELL_PAD * 2) / LINE_HEIGHT));
}

function drawWrappedCell(
    page: PDFPage,
    font: PDFFont,
    text: string,
    rect: Rect,
): void {
    const contentW = rect.w - CELL_PAD * 2;
    const lines = wrapLines(text, font, contentW).slice(0, maxLinesForRect(rect));
    let y = rect.y + rect.h - CELL_PAD - FONT_SIZE;
    for (const line of lines) {
        page.drawText(line, {
            x: rect.x + CELL_PAD,
            y,
            size: FONT_SIZE,
            font,
        });
        y -= LINE_HEIGHT;
    }
}

function drawSingleLine(
    page: PDFPage,
    font: PDFFont,
    text: string,
    rect: Rect,
): void {
    const trimmed = toPdfWinAnsiText(text).trim();
    if (!trimmed) return;
    page.drawText(trimmed, {
        x: rect.x + CELL_PAD,
        y: rect.y + (rect.h - FONT_SIZE) / 2,
        size: FONT_SIZE,
        font,
    });
}

function whiteOut(page: PDFPage): void {
    for (const r of WHITE_OUT_RECTS) {
        page.drawRectangle({
            x: r.x - 1,
            y: r.y - 1,
            width: r.w + 2,
            height: r.h + 2,
            color: rgb(1, 1, 1),
            borderWidth: 0,
        });
    }
}

function drawFormContent(
    page: PDFPage,
    font: PDFFont,
    header: Ics234Header,
    rows: ObjectiveRow[],
    visibleCount: number,
    pageNum: number,
    pageCount: number,
): void {
    // #region agent log
    agentScanNonWinAnsi('header.incidentName', header.incidentName, 'B');
    agentScanNonWinAnsi('header.incidentLocation', header.incidentLocation, 'B');
    agentScanNonWinAnsi('header.preparedByName', header.preparedByName, 'B');
    agentScanNonWinAnsi('header.preparedByTitle', header.preparedByTitle, 'B');
    agentScanNonWinAnsi('header.preparedBySignature', header.preparedBySignature, 'B');
    // #endregion
    drawSingleLine(page, font, header.incidentName, LAYOUT.header.incidentName);
    drawSingleLine(page, font, header.incidentLocation, LAYOUT.header.incidentLocation);
    drawSingleLine(page, font, formatDatetimeForPdf(header.operationalPeriodFrom), LAYOUT.header.periodFrom);
    drawSingleLine(page, font, formatDatetimeForPdf(header.operationalPeriodTo), LAYOUT.header.periodTo);

    const rowLimit = Math.min(visibleCount, MAX_OBJECTIVES);
    for (let i = 0; i < rowLimit; i++) {
        const row = rows[i];
        if (!rowHasContent(row)) continue;
        const rects = matrixRowRect(i);
        const objective = row.objective.trim();
        const strategies = formatStrategiesForPdf(row.strategies);
        const tactics = formatTacticsForPdf(row.strategies);
        // #region agent log
        agentScanNonWinAnsi(`row[${i}].objective`, objective, 'A');
        agentScanNonWinAnsi(`row[${i}].strategies`, strategies, 'A');
        agentScanNonWinAnsi(`row[${i}].tactics`, tactics, 'A');
        // #endregion
        drawWrappedCell(page, font, objective, rects.objective);
        drawWrappedCell(page, font, strategies, rects.strategy);
        drawWrappedCell(page, font, tactics, rects.tactic);
    }

    drawSingleLine(page, font, header.preparedByName, LAYOUT.footer.name);
    drawSingleLine(page, font, header.preparedByTitle, LAYOUT.footer.title);
    drawSingleLine(page, font, header.preparedBySignature, LAYOUT.footer.signature);
    drawSingleLine(page, font, formatDatetimeForPdf(header.preparedByDateTime), LAYOUT.footer.dateTime);

    page.drawText(`Page ${pageNum} of ${pageCount}`, {
        x: LAYOUT.pageNumber.x,
        y: LAYOUT.pageNumber.y,
        size: FONT_SIZE,
        font,
    });
}

async function buildFormPage(
    templateDoc: PDFDocument,
    outDoc: PDFDocument,
    font: PDFFont,
    header: Ics234Header,
    rows: ObjectiveRow[],
    visibleCount: number,
    pageNum: number,
    pageCount: number,
): Promise<void> {
    const [templatePage] = await outDoc.copyPages(templateDoc, [TEMPLATE_FORM_PAGE_INDEX]);
    const embedded = await outDoc.embedPage(templatePage);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);
    page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    whiteOut(page);
    drawGridLines(page);
    drawFormContent(page, font, header, rows, visibleCount, pageNum, pageCount);
}

/** Fill the ICS 234-CG form page (template page 2 only) with 9pt text. */
export async function buildIcs234Pdf(
    rows: ObjectiveRow[],
    header: Ics234Header,
    visibleCount = MAX_OBJECTIVES,
): Promise<Uint8Array> {
    // #region agent log
    fetch('http://127.0.0.1:7627/ingest/45700870-a64c-4e23-b841-0db3851123a5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '05df6e' },
        body: JSON.stringify({
            sessionId: '05df6e',
            runId: 'pre-fix',
            hypothesisId: 'E',
            location: 'ics234Pdf.ts:buildIcs234Pdf',
            message: 'ICS-234 build start',
            data: {
                incidentNameLen: (header.incidentName || '').length,
                rowCount: rows.length,
                visibleCount,
                filledRows: rows.filter((r) => rowHasContent(r)).length,
            },
            timestamp: Date.now(),
        }),
    }).catch(() => {});
    // #endregion
    const templateBytes = await loadTemplateBytes();
    const templateDoc = await PDFDocument.load(templateBytes);
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);

    // Single form page for up to MAX_OBJECTIVES rows; extend here if paginating later.
    const pageCount = 1;
    try {
        await buildFormPage(templateDoc, outDoc, font, header, rows, visibleCount, 1, pageCount);
    } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7627/ingest/45700870-a64c-4e23-b841-0db3851123a5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '05df6e' },
            body: JSON.stringify({
                sessionId: '05df6e',
                runId: 'pre-fix',
                hypothesisId: 'A',
                location: 'ics234Pdf.ts:buildIcs234Pdf:catch',
                message: 'ICS-234 build failed',
                data: { err: err instanceof Error ? err.message : String(err) },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        throw err;
    }

    const bytes = await outDoc.save();
    // #region agent log
    fetch('http://127.0.0.1:7627/ingest/45700870-a64c-4e23-b841-0db3851123a5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '05df6e' },
        body: JSON.stringify({
            sessionId: '05df6e',
            runId: 'post-fix',
            hypothesisId: 'A',
            location: 'ics234Pdf.ts:buildIcs234Pdf:success',
            message: 'ICS-234 build succeeded',
            data: { byteLength: bytes.length },
            timestamp: Date.now(),
        }),
    }).catch(() => {});
    // #endregion
    return bytes;
}

export function defaultIcs234Filename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `ICS-234-CG_${base}_${stamp}.pdf`;
}
