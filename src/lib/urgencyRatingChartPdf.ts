/**
 * Urgency Rating Chart PDF — blank letter page with ICS-201-style header/signature
 * and a factors/rating/score table (pdf-lib, no AcroForm template).
 */

import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';
import {
    urgencyLevelFromTotal,
    type UrgencyFactorKey,
} from './urgencyRating.ts';

export const URGENCY_RATING_CHART_MISSION_FILENAME = 'Urgency-Rating-Chart.pdf';

export interface UrgencyRatingChartHeader {
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
const CELL_PAD = 4;
const HEADER_BOX_H = 36;
const FOOTER_H = 40;
const COL_HEADER_H = 18;
const SECTION_HEADER_H = 16;
const GUIDANCE_ROW_H = 14;
const TOTAL_ROW_H = 20;
const SCALE_H = 44;

const GRID = rgb(0.25, 0.25, 0.25);
const HEADER_FILL = rgb(0.92, 0.92, 0.92);
const SECTION_FILL = rgb(0.88, 0.88, 0.88);
const EMPHASIS_FILL = rgb(1, 0.95, 0.8);

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Column widths (sum = PAGE_W - 2*MARGIN_X = 540). */
const COLS = {
    factors: 380,
    rating: 80,
    score: 80,
} as const;

interface GuidanceRow {
    text: string;
    rating: string;
}

interface FactorSection {
    key: UrgencyFactorKey;
    title: string;
    rows: GuidanceRow[];
}

const FACTOR_SECTIONS: FactorSection[] = [
    {
        key: 'age',
        title: 'Age of Subject:',
        rows: [
            { text: 'Very Young', rating: '1' },
            { text: 'Very Old', rating: '1' },
            { text: 'Other', rating: '2-3' },
        ],
    },
    {
        key: 'medical',
        title: 'Medical Condition of Subject:',
        rows: [
            { text: 'Known / Suspected injured, ill, or mental problem', rating: '1-2' },
            { text: 'Healthy', rating: '3' },
            { text: 'Known Fatality', rating: '3' },
        ],
    },
    {
        key: 'number',
        title: 'Number of Subjects:',
        rows: [
            { text: 'One / Alone', rating: '1' },
            { text: 'More Than One (Unless Separated)', rating: '2-3' },
        ],
    },
    {
        key: 'experience',
        title: 'Subject Experience Profile:',
        rows: [
            { text: 'Not experienced, does not know the area', rating: '1' },
            { text: 'Not experienced, knows the area', rating: '1-2' },
            { text: 'Experienced, not familiar with the area', rating: '2' },
            { text: 'Experienced, knows the area', rating: '3' },
        ],
    },
    {
        key: 'weather',
        title: 'Weather Profile:',
        rows: [
            { text: 'Past and/or existing hazardous weather', rating: '1' },
            { text: 'Predicted hazardous weather (less than 8 hours)', rating: '1-2' },
            { text: 'Predicted hazardous weather (more than 8 hours)', rating: '2' },
            { text: 'No hazardous weather predicted', rating: '3' },
        ],
    },
    {
        key: 'equipment',
        title: 'Equipment Profile:',
        rows: [
            { text: 'Inadequate for environment and weather.', rating: '1' },
            { text: 'Questionable for environment and weather.', rating: '1-2' },
            { text: 'Adequate for environment and weather.', rating: '3' },
        ],
    },
    {
        key: 'terrain',
        title: 'Terrain / Hazards Profile:',
        rows: [
            { text: 'Known hazardous terrain or other hazards', rating: '1' },
            { text: 'Few or no hazards', rating: '2-3' },
        ],
    },
];

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

function drawCenteredText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    rect: Rect,
    size = FONT_SIZE,
): void {
    const t = toPdfWinAnsiText(text);
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, {
        x: rect.x + (rect.w - w) / 2,
        y: rect.y + (rect.h - size) / 2,
        size,
        font,
    });
}

function drawLeftText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    rect: Rect,
    size = FONT_SIZE,
): void {
    page.drawText(toPdfWinAnsiText(text), {
        x: rect.x + CELL_PAD,
        y: rect.y + (rect.h - size) / 2,
        size,
        font,
    });
}

function colX(): { factors: number; rating: number; score: number; right: number } {
    const factors = MARGIN_X;
    const rating = factors + COLS.factors;
    const score = rating + COLS.rating;
    return { factors, rating, score, right: score + COLS.score };
}

function drawPageChrome(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    header: UrgencyRatingChartHeader,
): { tableTop: number; tableBottom: number } {
    const titleBar: Rect = {
        x: MARGIN_X,
        y: PAGE_H - MARGIN_TOP - 22,
        w: PAGE_W - MARGIN_X * 2,
        h: 22,
    };
    drawFilledRect(page, titleBar, HEADER_FILL);
    drawRectStroke(page, titleBar);
    page.drawText('URGENCY RATING CHART', {
        x: titleBar.x + CELL_PAD,
        y: titleBar.y + 6,
        size: TITLE_SIZE,
        font: bold,
    });
    page.drawText('Page 1 of 1', {
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

function drawColumnHeaders(page: PDFPage, bold: PDFFont, tableTop: number): number {
    const cols = colX();
    const y = tableTop - COL_HEADER_H;
    const cells: Array<{ label: string; x: number; w: number }> = [
        { label: 'Factors', x: cols.factors, w: COLS.factors },
        { label: 'Rating', x: cols.rating, w: COLS.rating },
        { label: 'Score', x: cols.score, w: COLS.score },
    ];
    for (const cell of cells) {
        const rect: Rect = { x: cell.x, y, w: cell.w, h: COL_HEADER_H };
        drawFilledRect(page, rect, HEADER_FILL);
        drawRectStroke(page, rect);
        drawCenteredText(page, bold, cell.label, rect);
    }
    return y;
}

function drawFactorSection(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    section: FactorSection,
    score: number,
    top: number,
): number {
    const cols = colX();
    let cursor = top;

    // Section title row
    const titleRect: Rect = {
        x: cols.factors, y: cursor - SECTION_HEADER_H, w: COLS.factors, h: SECTION_HEADER_H,
    };
    const titleRating: Rect = {
        x: cols.rating, y: cursor - SECTION_HEADER_H, w: COLS.rating, h: SECTION_HEADER_H,
    };
    const titleScore: Rect = {
        x: cols.score, y: cursor - SECTION_HEADER_H, w: COLS.score, h: SECTION_HEADER_H,
    };
    drawFilledRect(page, titleRect, SECTION_FILL);
    drawFilledRect(page, titleRating, SECTION_FILL);
    drawFilledRect(page, titleScore, SECTION_FILL);
    drawRectStroke(page, titleRect);
    drawRectStroke(page, titleRating);
    drawRectStroke(page, titleScore);
    drawLeftText(page, bold, section.title, titleRect);
    cursor -= SECTION_HEADER_H;

    const guidanceTop = cursor;
    const guidanceH = section.rows.length * GUIDANCE_ROW_H;

    for (const row of section.rows) {
        const factorsRect: Rect = {
            x: cols.factors, y: cursor - GUIDANCE_ROW_H, w: COLS.factors, h: GUIDANCE_ROW_H,
        };
        const ratingRect: Rect = {
            x: cols.rating, y: cursor - GUIDANCE_ROW_H, w: COLS.rating, h: GUIDANCE_ROW_H,
        };
        drawRectStroke(page, factorsRect);
        drawRectStroke(page, ratingRect);
        drawLeftText(page, font, row.text, factorsRect);
        drawCenteredText(page, font, row.rating, ratingRect);
        cursor -= GUIDANCE_ROW_H;
    }

    // Merged score cell spanning all guidance rows (and visually aligned under Score).
    const scoreRect: Rect = {
        x: cols.score,
        y: guidanceTop - guidanceH,
        w: COLS.score,
        h: guidanceH,
    };
    drawRectStroke(page, scoreRect);
    // Cover internal horizontal lines inside score column by redrawing fill+stroke.
    drawFilledRect(page, scoreRect, rgb(1, 1, 1));
    drawRectStroke(page, scoreRect);
    drawCenteredText(page, bold, String(score), scoreRect, 11);

    return cursor;
}

function drawTotalRow(
    page: PDFPage,
    bold: PDFFont,
    total: number,
    top: number,
): number {
    const cols = colX();
    const y = top - TOTAL_ROW_H;
    const labelRect: Rect = {
        x: cols.factors, y, w: COLS.factors + COLS.rating, h: TOTAL_ROW_H,
    };
    const scoreRect: Rect = {
        x: cols.score, y, w: COLS.score, h: TOTAL_ROW_H,
    };
    drawFilledRect(page, labelRect, HEADER_FILL);
    drawFilledRect(page, scoreRect, HEADER_FILL);
    drawRectStroke(page, labelRect);
    drawRectStroke(page, scoreRect);
    drawLeftText(page, bold, 'Total (Between 7 and 21)', labelRect);
    drawCenteredText(page, bold, String(total), scoreRect, 11);
    return y;
}

function drawUrgencyScale(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    total: number,
    top: number,
): void {
    const level = urgencyLevelFromTotal(total);
    const rect: Rect = {
        x: MARGIN_X,
        y: top - SCALE_H - 8,
        w: PAGE_W - MARGIN_X * 2,
        h: SCALE_H,
    };
    drawRectStroke(page, rect);

    const third = rect.w / 3;
    const bands: Array<{
        label: string;
        number: string;
        active: boolean;
    }> = [
        {
            label: 'Highest Urgency',
            number: '7',
            active: level === 'High',
        },
        {
            label: 'Intermediate Urgency',
            number: '14',
            active: level === 'Moderate',
        },
        {
            label: 'Lowest Urgency',
            number: '21',
            active: level === 'Lower',
        },
    ];

    bands.forEach((band, i) => {
        const bandRect: Rect = {
            x: rect.x + i * third,
            y: rect.y,
            w: third,
            h: rect.h,
        };
        if (band.active) {
            drawFilledRect(page, bandRect, EMPHASIS_FILL);
        }
        drawCenteredText(
            page,
            bold,
            band.number,
            { x: bandRect.x, y: bandRect.y + 18, w: bandRect.w, h: 14 },
            12,
        );
        drawCenteredText(
            page,
            font,
            band.label,
            { x: bandRect.x, y: bandRect.y + 4, w: bandRect.w, h: 12 },
            8,
        );
    });
    drawRectStroke(page, rect);

    const levelLabel = level === 'Moderate' ? 'Intermediate' : level === 'Lower' ? 'Lowest' : 'Highest';
    page.drawText(toPdfWinAnsiText(`Current: ${levelLabel} Urgency (total ${total})`), {
        x: rect.x + CELL_PAD,
        y: rect.y - 12,
        size: LABEL_SIZE,
        font: bold,
    });
}

export async function buildUrgencyRatingChartPdf(
    factors: Record<UrgencyFactorKey, number>,
    header: UrgencyRatingChartHeader,
): Promise<Uint8Array> {
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);
    const bold = await outDoc.embedFont(StandardFonts.HelveticaBold);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);

    const { tableTop } = drawPageChrome(page, font, bold, header);
    let cursor = drawColumnHeaders(page, bold, tableTop);

    let total = 0;
    for (const section of FACTOR_SECTIONS) {
        const score = Number(factors[section.key]) || 0;
        total += score;
        cursor = drawFactorSection(page, font, bold, section, score, cursor);
    }

    cursor = drawTotalRow(page, bold, total, cursor);
    drawUrgencyScale(page, font, bold, total, cursor);

    return outDoc.save();
}

export function defaultUrgencyRatingChartFilename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `Urgency-Rating-Chart_${base}_${stamp}.pdf`;
}
