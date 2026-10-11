/**
 * Scenarios Record Sheet PDF — blank letter page with ICS-201-style header/signature
 * and a priority-sorted scenarios table (pdf-lib, no AcroForm template).
 */

import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';
import {
    sortScenariosByPriority,
    type SearchScenario,
} from './searchScenarios.ts';

export const SCENARIOS_RECORD_SHEET_MISSION_FILENAME = 'Scenarios-Record-Sheet.pdf';

export interface ScenariosRecordSheetHeader {
    incidentName: string;
    incidentNumber: string;
    date: string;
    time: string;
    preparedByName: string;
    positionTitle: string;
    signature: string;
    preparedDateTime: string;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 36;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 36;
const FONT_SIZE = 9;
const TITLE_SIZE = 12;
const LABEL_SIZE = 7;
const LINE_HEIGHT = 11;
const CELL_PAD = 4;
const HEADER_BOX_H = 36;
const FOOTER_H = 40;
const COL_HEADER_H = 18;
const MIN_ROW_H = 28;
const MAX_ROW_H = 90;

const GRID = rgb(0.25, 0.25, 0.25);
const HEADER_FILL = rgb(0.92, 0.92, 0.92);
const ZEBRA = rgb(0.97, 0.97, 0.97);

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Column widths (sum = PAGE_W - 2*MARGIN_X = 540). */
const COLS = {
    priority: 48,
    letter: 40,
    description: 292,
    mobility: 80,
    responsiveness: 80,
} as const;

function colRects(tableTop: number, rowH: number): Record<keyof typeof COLS, Rect> {
    let x = MARGIN_X;
    const y = tableTop - rowH;
    const out = {} as Record<keyof typeof COLS, Rect>;
    for (const key of Object.keys(COLS) as (keyof typeof COLS)[]) {
        const w = COLS[key];
        out[key] = { x, y, w, h: rowH };
        x += w;
    }
    return out;
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const normalized = toPdfWinAnsiText(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    const lines: string[] = [];
    for (const paragraph of normalized.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
            lines.push('');
            continue;
        }
        let line = words[0];
        for (let i = 1; i < words.length; i++) {
            const next = `${line} ${words[i]}`;
            if (font.widthOfTextAtSize(next, size) <= maxWidth) {
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

const GRID_THICKNESS = 0.75;

function drawHLine(page: PDFPage, x1: number, x2: number, y: number): void {
    page.drawLine({
        start: { x: x1, y },
        end: { x: x2, y },
        thickness: GRID_THICKNESS,
        color: GRID,
    });
}

function drawVLine(page: PDFPage, x: number, y1: number, y2: number): void {
    page.drawLine({
        start: { x, y: y1 },
        end: { x, y: y2 },
        thickness: GRID_THICKNESS,
        color: GRID,
    });
}

function drawRectStroke(page: PDFPage, rect: Rect): void {
    const right = rect.x + rect.w;
    const top = rect.y + rect.h;
    drawHLine(page, rect.x, right, rect.y);
    drawHLine(page, rect.x, right, top);
    drawVLine(page, rect.x, rect.y, top);
    drawVLine(page, right, rect.y, top);
}

function drawFilledRect(page: PDFPage, rect: Rect, color: ReturnType<typeof rgb>): void {
    page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        color,
        borderWidth: 0,
    });
}

function drawLabeledBox(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    label: string,
    value: string,
    rect: Rect,
): void {
    drawRectStroke(page, rect);
    page.drawText(toPdfWinAnsiText(label), {
        x: rect.x + CELL_PAD,
        y: rect.y + rect.h - LABEL_SIZE - 3,
        size: LABEL_SIZE,
        font: bold,
    });
    const val = toPdfWinAnsiText(value).trim();
    if (!val) return;
    const maxW = rect.w - CELL_PAD * 2;
    let size = FONT_SIZE;
    while (size > 6 && font.widthOfTextAtSize(val, size) > maxW) size -= 0.5;
    page.drawText(val, {
        x: rect.x + CELL_PAD,
        y: rect.y + 6,
        size,
        font,
    });
}

function drawWrappedInCell(
    page: PDFPage,
    font: PDFFont,
    text: string,
    rect: Rect,
    alignCenter = false,
): void {
    const contentW = rect.w - CELL_PAD * 2;
    const maxLines = Math.max(1, Math.floor((rect.h - CELL_PAD * 2) / LINE_HEIGHT));
    const lines = wrapLines(text, font, FONT_SIZE, contentW).slice(0, maxLines);
    let y = rect.y + rect.h - CELL_PAD - FONT_SIZE;
    for (const line of lines) {
        let x = rect.x + CELL_PAD;
        if (alignCenter) {
            const w = font.widthOfTextAtSize(line, FONT_SIZE);
            x = rect.x + (rect.w - w) / 2;
        }
        page.drawText(line, {
            x,
            y,
            size: FONT_SIZE,
            font,
        });
        y -= LINE_HEIGHT;
    }
}

function rowHeightForScenario(scenario: SearchScenario, font: PDFFont): number {
    const contentW = COLS.description - CELL_PAD * 2;
    const lines = wrapLines(scenario.description, font, FONT_SIZE, contentW);
    const needed = CELL_PAD * 2 + Math.max(1, lines.length) * LINE_HEIGHT;
    return Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, needed));
}

function mobilityLabel(value: string): string {
    if (value === 'mobile') return 'Mobile';
    if (value === 'immobile') return 'Immobile';
    return '—';
}

function responsivenessLabel(value: string): string {
    if (value === 'responsive') return 'Responsive';
    if (value === 'unresponsive') return 'Unresponsive';
    return '—';
}

function priorityLabel(priority: number | null): string {
    return priority == null ? '—' : String(priority);
}

function drawPageChrome(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    header: ScenariosRecordSheetHeader,
    pageNum: number,
    pageCount: number,
): { tableTop: number; tableBottom: number } {
    const titleBar: Rect = {
        x: MARGIN_X,
        y: PAGE_H - MARGIN_TOP - 22,
        w: PAGE_W - MARGIN_X * 2,
        h: 22,
    };
    drawFilledRect(page, titleBar, HEADER_FILL);
    drawRectStroke(page, titleBar);
    page.drawText('SCENARIOS RECORD SHEET', {
        x: titleBar.x + CELL_PAD,
        y: titleBar.y + 6,
        size: TITLE_SIZE,
        font: bold,
    });
    page.drawText(`Page ${pageNum} of ${pageCount}`, {
        x: titleBar.x + titleBar.w - 70,
        y: titleBar.y + 7,
        size: LABEL_SIZE,
        font,
    });

    const headerY = titleBar.y - 4 - HEADER_BOX_H;
    const gap = 4;
    const halfW = (PAGE_W - MARGIN_X * 2 - gap) / 2;
    const nameW = halfW * 0.62;
    const numW = halfW - nameW;
    const dateW = halfW * 0.5;
    const timeW = halfW - dateW;

    drawLabeledBox(page, font, bold, '1. Incident Name', header.incidentName, {
        x: MARGIN_X, y: headerY, w: nameW, h: HEADER_BOX_H,
    });
    drawLabeledBox(page, font, bold, '2. Incident Number', header.incidentNumber, {
        x: MARGIN_X + nameW, y: headerY, w: numW, h: HEADER_BOX_H,
    });
    drawLabeledBox(page, font, bold, '3. Date', header.date, {
        x: MARGIN_X + halfW + gap, y: headerY, w: dateW, h: HEADER_BOX_H,
    });
    drawLabeledBox(page, font, bold, '4. Time', header.time, {
        x: MARGIN_X + halfW + gap + dateW, y: headerY, w: timeW, h: HEADER_BOX_H,
    });

    const footerY = MARGIN_BOTTOM;
    const footerW = PAGE_W - MARGIN_X * 2;
    const f1 = footerW * 0.28;
    const f2 = footerW * 0.28;
    const f3 = footerW * 0.28;
    const f4 = footerW - f1 - f2 - f3;

    drawLabeledBox(page, font, bold, 'Prepared by (Name)', header.preparedByName, {
        x: MARGIN_X, y: footerY, w: f1, h: FOOTER_H,
    });
    drawLabeledBox(page, font, bold, 'Position / Title', header.positionTitle, {
        x: MARGIN_X + f1, y: footerY, w: f2, h: FOOTER_H,
    });
    drawLabeledBox(page, font, bold, 'Signature', header.signature, {
        x: MARGIN_X + f1 + f2, y: footerY, w: f3, h: FOOTER_H,
    });
    drawLabeledBox(page, font, bold, 'Date / Time', header.preparedDateTime, {
        x: MARGIN_X + f1 + f2 + f3, y: footerY, w: f4, h: FOOTER_H,
    });

    const tableTop = headerY - 10;
    const tableBottom = footerY + FOOTER_H + 10;
    return { tableTop, tableBottom };
}

function drawColumnHeaders(
    page: PDFPage,
    bold: PDFFont,
    tableTop: number,
): number {
    const rects = colRects(tableTop, COL_HEADER_H);
    const labels: Record<keyof typeof COLS, string> = {
        priority: 'Priority',
        letter: 'Letter',
        description: 'Description',
        mobility: 'Mobility',
        responsiveness: 'Responsiveness',
    };
    for (const key of Object.keys(COLS) as (keyof typeof COLS)[]) {
        const rect = rects[key];
        drawFilledRect(page, rect, HEADER_FILL);
        drawRectStroke(page, rect);
        const label = labels[key];
        const centered = key !== 'description';
        const w = bold.widthOfTextAtSize(label, FONT_SIZE);
        page.drawText(label, {
            x: centered ? rect.x + (rect.w - w) / 2 : rect.x + CELL_PAD,
            y: rect.y + (rect.h - FONT_SIZE) / 2,
            size: FONT_SIZE,
            font: bold,
        });
    }
    return tableTop - COL_HEADER_H;
}

function drawScenarioRow(
    page: PDFPage,
    font: PDFFont,
    scenario: SearchScenario,
    top: number,
    rowH: number,
    zebra: boolean,
): void {
    const rects = colRects(top, rowH);
    for (const key of Object.keys(COLS) as (keyof typeof COLS)[]) {
        const rect = rects[key];
        if (zebra) drawFilledRect(page, rect, ZEBRA);
        drawRectStroke(page, rect);
    }
    drawWrappedInCell(page, font, priorityLabel(scenario.priority), rects.priority, true);
    drawWrappedInCell(page, font, scenario.letter, rects.letter, true);
    drawWrappedInCell(page, font, scenario.description, rects.description, false);
    drawWrappedInCell(page, font, mobilityLabel(scenario.mobility), rects.mobility, true);
    drawWrappedInCell(page, font, responsivenessLabel(scenario.responsiveness), rects.responsiveness, true);
}

function paginateRows(
    scenarios: SearchScenario[],
    font: PDFFont,
    firstPageCapacity: number,
    continuationCapacity: number,
): SearchScenario[][] {
    if (!scenarios.length) return [[]];

    const pages: SearchScenario[][] = [];
    let current: SearchScenario[] = [];
    let used = 0;
    let capacity = firstPageCapacity;

    for (const s of scenarios) {
        const h = rowHeightForScenario(s, font);
        if (current.length && used + h > capacity) {
            pages.push(current);
            current = [];
            used = 0;
            capacity = continuationCapacity;
        }
        // If a single row is taller than capacity, still place it alone.
        if (!current.length && h > capacity) {
            current.push(s);
            pages.push(current);
            current = [];
            used = 0;
            capacity = continuationCapacity;
            continue;
        }
        current.push(s);
        used += h;
    }
    if (current.length || !pages.length) pages.push(current);
    return pages;
}

export async function buildScenariosRecordSheetPdf(
    scenarios: SearchScenario[],
    header: ScenariosRecordSheetHeader,
): Promise<Uint8Array> {
    const sorted = sortScenariosByPriority(scenarios.filter((s) => s.description.trim()));
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);
    const bold = await outDoc.embedFont(StandardFonts.HelveticaBold);

    // Approximate usable table body height (header + col headers + footer reserved).
    const chromeTop = MARGIN_TOP + 22 + 4 + HEADER_BOX_H + 10;
    const chromeBottom = MARGIN_BOTTOM + FOOTER_H + 10;
    const usable = PAGE_H - chromeTop - chromeBottom - COL_HEADER_H;
    const pages = paginateRows(sorted, font, usable, usable);
    const pageCount = pages.length;

    for (let i = 0; i < pageCount; i++) {
        const page = outDoc.addPage([PAGE_W, PAGE_H]);
        const { tableTop } = drawPageChrome(page, font, bold, header, i + 1, pageCount);
        let cursor = drawColumnHeaders(page, bold, tableTop);
        const rows = pages[i];
        rows.forEach((scenario, idx) => {
            const h = rowHeightForScenario(scenario, font);
            drawScenarioRow(page, font, scenario, cursor, h, idx % 2 === 1);
            cursor -= h;
        });
        if (!rows.length) {
            page.drawText('No scenarios recorded.', {
                x: MARGIN_X + CELL_PAD,
                y: cursor - 20,
                size: FONT_SIZE,
                font,
            });
        }
    }

    return outDoc.save();
}

export function defaultScenariosRecordSheetFilename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `Scenarios-Record-Sheet_${base}_${stamp}.pdf`;
}
