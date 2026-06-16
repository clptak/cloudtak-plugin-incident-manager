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
        top: 640,
        bottom: 72,
        columns: [
            { x: 37.68, w: 176.88 },
            { x: 217.32, w: 177 },
            { x: 397.08, w: 176.88 },
        ] as const,
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
    ...Array.from({ length: 8 }, (_, i) => {
        const h = 67;
        const y = 573.48 - i * 69.12;
        return LAYOUT.matrix.columns.flatMap((col) => ([
            { x: col.x, y, w: col.w, h },
        ]));
    }).flat(),
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
    const rowH = (LAYOUT.matrix.top - LAYOUT.matrix.bottom) / MAX_OBJECTIVES;
    const y = LAYOUT.matrix.bottom + rowH * (MAX_OBJECTIVES - rowIndex - 1);
    const [obj, strat, tac] = LAYOUT.matrix.columns;
    return {
        objective: { x: obj.x, y, w: obj.w, h: rowH },
        strategy: { x: strat.x, y, w: strat.w, h: rowH },
        tactic: { x: tac.x, y, w: tac.w, h: rowH },
    };
}

function wrapLines(text: string, font: PDFFont, maxWidth: number): string[] {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    const lines: string[] = [];
    for (const paragraph of normalized.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) continue;

        let line = words[0];
        for (let i = 1; i < words.length; i++) {
            const next = `${line} ${words[i]}`;
            if (font.widthOfTextAtSize(next, FONT_SIZE) <= maxWidth) {
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
    const trimmed = text.trim();
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
    drawSingleLine(page, font, header.incidentName, LAYOUT.header.incidentName);
    drawSingleLine(page, font, header.incidentLocation, LAYOUT.header.incidentLocation);
    drawSingleLine(page, font, formatDatetimeForPdf(header.operationalPeriodFrom), LAYOUT.header.periodFrom);
    drawSingleLine(page, font, formatDatetimeForPdf(header.operationalPeriodTo), LAYOUT.header.periodTo);

    const rowLimit = Math.min(visibleCount, MAX_OBJECTIVES);
    for (let i = 0; i < rowLimit; i++) {
        const row = rows[i];
        if (!rowHasContent(row)) continue;
        const rects = matrixRowRect(i);
        drawWrappedCell(page, font, row.objective.trim(), rects.objective);
        drawWrappedCell(page, font, formatStrategiesForPdf(row.strategies), rects.strategy);
        drawWrappedCell(page, font, formatTacticsForPdf(row.strategies), rects.tactic);
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
    drawFormContent(page, font, header, rows, visibleCount, pageNum, pageCount);
}

/** Fill the ICS 234-CG form page (template page 2 only) with 9pt text. */
export async function buildIcs234Pdf(
    rows: ObjectiveRow[],
    header: Ics234Header,
    visibleCount = MAX_OBJECTIVES,
): Promise<Uint8Array> {
    const templateBytes = await loadTemplateBytes();
    const templateDoc = await PDFDocument.load(templateBytes);
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);

    // Single form page for up to MAX_OBJECTIVES rows; extend here if paginating later.
    const pageCount = 1;
    await buildFormPage(templateDoc, outDoc, font, header, rows, visibleCount, 1, pageCount);

    return outDoc.save();
}

export function defaultIcs234Filename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `ICS-234-CG_${base}_${stamp}.pdf`;
}
