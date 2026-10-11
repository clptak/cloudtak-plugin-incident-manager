/**
 * Urgency Rating Chart PDF — modern Skydio-style report layout with
 * incident header fields and signature footer (pdf-lib, no AcroForm template).
 */

import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage, RGB } from '../vendor/pdf-lib.esm.min.js';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';
import {
    urgencyLevelFromTotal,
    type UrgencyFactorKey,
    type UrgencyLevelLabel,
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
const MARGIN_BOTTOM = 36;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const TITLE_BAND_H = 56;
const BADGE_H = 22;
const FOOTER_H = 42;
const COL_HEADER_H = 14;
const SECTION_TITLE_H = 14;
const GUIDANCE_ROW_H = 11;
const TOTAL_ROW_H = 18;
const SCALE_H = 40;
const CELL_PAD = 6;

const FONT_SIZE = 9;
const TITLE_SIZE = 16;
const SECTION_SIZE = 10;
const LABEL_SIZE = 7;
const MUTED_SIZE = 8;

/** Skydio / Tabler palette (pdf-lib 0–1 rgb). */
const COLOR_PRIMARY = rgb(32 / 255, 107 / 255, 196 / 255);
const COLOR_TEXT = rgb(33 / 255, 37 / 255, 41 / 255);
const COLOR_MUTED = rgb(108 / 255, 117 / 255, 125 / 255);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_HIGH = rgb(220 / 255, 53 / 255, 69 / 255);
const COLOR_MODERATE = rgb(245 / 255, 159 / 255, 0);
const COLOR_LOWER = rgb(25 / 255, 135 / 255, 84 / 255);
const COLOR_HIGH_LT = rgb(0.98, 0.9, 0.91);
const COLOR_MODERATE_LT = rgb(1, 0.96, 0.88);
const COLOR_LOWER_LT = rgb(0.9, 0.96, 0.92);
const COLOR_RULE = rgb(0.88, 0.9, 0.92);
const COLOR_BOX_STROKE = rgb(0.82, 0.84, 0.86);

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Column widths (sum = CONTENT_W = 540). */
const COLS = {
    factors: 360,
    rating: 90,
    score: 90,
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
        title: 'Age of Subject',
        rows: [
            { text: 'Very Young', rating: '1' },
            { text: 'Very Old', rating: '1' },
            { text: 'Other', rating: '2-3' },
        ],
    },
    {
        key: 'medical',
        title: 'Medical Condition of Subject',
        rows: [
            { text: 'Known / Suspected injured, ill, or mental problem', rating: '1-2' },
            { text: 'Healthy', rating: '3' },
            { text: 'Known Fatality', rating: '3' },
        ],
    },
    {
        key: 'number',
        title: 'Number of Subjects',
        rows: [
            { text: 'One / Alone', rating: '1' },
            { text: 'More Than One (Unless Separated)', rating: '2-3' },
        ],
    },
    {
        key: 'experience',
        title: 'Subject Experience Profile',
        rows: [
            { text: 'Not experienced, does not know the area', rating: '1' },
            { text: 'Not experienced, knows the area', rating: '1-2' },
            { text: 'Experienced, not familiar with the area', rating: '2' },
            { text: 'Experienced, knows the area', rating: '3' },
        ],
    },
    {
        key: 'weather',
        title: 'Weather Profile',
        rows: [
            { text: 'Past and/or existing hazardous weather', rating: '1' },
            { text: 'Predicted hazardous weather (less than 8 hours)', rating: '1-2' },
            { text: 'Predicted hazardous weather (more than 8 hours)', rating: '2' },
            { text: 'No hazardous weather predicted', rating: '3' },
        ],
    },
    {
        key: 'equipment',
        title: 'Equipment Profile',
        rows: [
            { text: 'Inadequate for environment and weather.', rating: '1' },
            { text: 'Questionable for environment and weather.', rating: '1-2' },
            { text: 'Adequate for environment and weather.', rating: '3' },
        ],
    },
    {
        key: 'terrain',
        title: 'Terrain / Hazards Profile',
        rows: [
            { text: 'Known hazardous terrain or other hazards', rating: '1' },
            { text: 'Few or no hazards', rating: '2-3' },
        ],
    },
];

function levelColor(level: UrgencyLevelLabel): RGB {
    if (level === 'High') return COLOR_HIGH;
    if (level === 'Moderate') return COLOR_MODERATE;
    return COLOR_LOWER;
}

function levelFill(level: UrgencyLevelLabel): RGB {
    if (level === 'High') return COLOR_HIGH_LT;
    if (level === 'Moderate') return COLOR_MODERATE_LT;
    return COLOR_LOWER_LT;
}

function levelBadgeLabel(level: UrgencyLevelLabel): string {
    if (level === 'High') return 'HIGHEST';
    if (level === 'Moderate') return 'INTERMEDIATE';
    return 'LOWEST';
}

function displayOrDash(value: string): string {
    const t = value.trim();
    return t || '\u2014';
}

function drawFilledRect(page: PDFPage, rect: Rect, color: RGB): void {
    page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        color,
        borderWidth: 0,
    });
}

function drawRectStroke(page: PDFPage, rect: Rect, color: RGB = COLOR_BOX_STROKE, thickness = 0.6): void {
    page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        borderColor: color,
        borderWidth: thickness,
    });
}

function drawHRule(page: PDFPage, x1: number, x2: number, y: number, color: RGB = COLOR_PRIMARY, thickness = 0.75): void {
    page.drawLine({
        start: { x: x1, y },
        end: { x: x2, y },
        thickness,
        color,
    });
}

function fitText(
    font: PDFFont,
    text: string,
    maxW: number,
    size: number,
    minSize = 6,
): { text: string; size: number } {
    const t = toPdfWinAnsiText(text);
    let s = size;
    while (s > minSize && font.widthOfTextAtSize(t, s) > maxW) s -= 0.5;
    if (font.widthOfTextAtSize(t, s) <= maxW) return { text: t, size: s };
    // Truncate with ellipsis if still too wide at min size.
    let truncated = t;
    while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}\u2026`, minSize) > maxW) {
        truncated = truncated.slice(0, -1);
    }
    return { text: `${truncated}\u2026`, size: minSize };
}

function drawCenteredText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    rect: Rect,
    size: number,
    color: RGB = COLOR_TEXT,
): void {
    const t = toPdfWinAnsiText(text);
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, {
        x: rect.x + Math.max(0, (rect.w - w) / 2),
        y: rect.y + (rect.h - size) / 2,
        size,
        font,
        color,
    });
}

function colX(): { factors: number; rating: number; score: number; right: number } {
    const factors = MARGIN_X;
    const rating = factors + COLS.factors;
    const score = rating + COLS.rating;
    return { factors, rating, score, right: score + COLS.score };
}

function drawTitleBand(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    header: UrgencyRatingChartHeader,
): number {
    const band: Rect = { x: 0, y: PAGE_H - TITLE_BAND_H, w: PAGE_W, h: TITLE_BAND_H };
    drawFilledRect(page, band, COLOR_PRIMARY);

    page.drawText(toPdfWinAnsiText('URGENCY RATING CHART'), {
        x: MARGIN_X,
        y: PAGE_H - 28,
        size: TITLE_SIZE,
        font: bold,
        color: COLOR_WHITE,
    });

    const subtitle = displayOrDash(header.incidentName) === '\u2014'
        ? 'Search Urgency'
        : displayOrDash(header.incidentName);
    const sub = fitText(font, subtitle, CONTENT_W * 0.65, 10);
    page.drawText(sub.text, {
        x: MARGIN_X,
        y: PAGE_H - 44,
        size: sub.size,
        font,
        color: rgb(0.85, 0.9, 0.97),
    });

    const pageLabel = 'Page 1 of 1';
    const pageW = font.widthOfTextAtSize(pageLabel, MUTED_SIZE);
    page.drawText(pageLabel, {
        x: PAGE_W - MARGIN_X - pageW,
        y: PAGE_H - 28,
        size: MUTED_SIZE,
        font,
        color: rgb(0.85, 0.9, 0.97),
    });

    return PAGE_H - TITLE_BAND_H - 14;
}

function drawHeaderFields(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    header: UrgencyRatingChartHeader,
    top: number,
): number {
    const rows: Array<[string, string, string, string]> = [
        ['Incident Name', displayOrDash(header.incidentName), 'Incident Number', displayOrDash(header.incidentNumber)],
        ['Date', displayOrDash(header.date), 'Time', displayOrDash(header.time)],
    ];

    let y = top;
    const colGap = 16;
    const colW = (CONTENT_W - colGap) / 2;

    for (const [l1, v1, l2, v2] of rows) {
        const rowH = 20;
        drawLabelValue(page, font, bold, l1, v1, MARGIN_X, y, colW);
        drawLabelValue(page, font, bold, l2, v2, MARGIN_X + colW + colGap, y, colW);
        y -= rowH + 4;
    }
    return y - 4;
}

function drawLabelValue(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    label: string,
    value: string,
    x: number,
    top: number,
    w: number,
): void {
    page.drawText(toPdfWinAnsiText(label), {
        x,
        y: top - LABEL_SIZE,
        size: LABEL_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    const fitted = fitText(font, value, w, FONT_SIZE);
    page.drawText(fitted.text, {
        x,
        y: top - LABEL_SIZE - fitted.size - 2,
        size: fitted.size,
        font,
        color: COLOR_TEXT,
    });
}

function drawUrgencyBadge(
    page: PDFPage,
    bold: PDFFont,
    total: number,
    top: number,
): number {
    const level = urgencyLevelFromTotal(total);
    const label = `URGENCY: ${levelBadgeLabel(level)}  (total ${total})`;
    const rect: Rect = {
        x: MARGIN_X,
        y: top - BADGE_H,
        w: CONTENT_W,
        h: BADGE_H,
    };
    drawFilledRect(page, rect, levelColor(level));
    page.drawText(toPdfWinAnsiText(label), {
        x: rect.x + CELL_PAD,
        y: rect.y + (BADGE_H - 10) / 2,
        size: 10,
        font: bold,
        color: COLOR_WHITE,
    });
    return rect.y - 12;
}

function drawSignatureBlock(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    header: UrgencyRatingChartHeader,
): number {
    const footerY = MARGIN_BOTTOM;
    const gap = 8;
    const footerW = CONTENT_W;
    const f1 = footerW * 0.28;
    const f2 = footerW * 0.28;
    const f3 = footerW * 0.28;
    const f4 = footerW - f1 - f2 - f3 - gap * 3;

    const fields: Array<{ label: string; value: string; x: number; w: number }> = [
        { label: 'Prepared by (Name)', value: header.preparedByName, x: MARGIN_X, w: f1 },
        { label: 'Position / Title', value: header.positionTitle, x: MARGIN_X + f1 + gap, w: f2 },
        { label: 'Signature', value: header.signature, x: MARGIN_X + f1 + gap + f2 + gap, w: f3 },
        { label: 'Date / Time', value: header.preparedDateTime, x: MARGIN_X + f1 + gap + f2 + gap + f3 + gap, w: f4 },
    ];

    for (const field of fields) {
        const rect: Rect = { x: field.x, y: footerY, w: field.w, h: FOOTER_H };
        drawRectStroke(page, rect);
        page.drawText(toPdfWinAnsiText(field.label), {
            x: rect.x + CELL_PAD,
            y: rect.y + rect.h - LABEL_SIZE - 4,
            size: LABEL_SIZE,
            font: bold,
            color: COLOR_MUTED,
        });
        const val = displayOrDash(field.value);
        if (val === '\u2014' && !field.value.trim()) {
            // leave blank line for handwritten signature when empty
            continue;
        }
        const fitted = fitText(font, val, rect.w - CELL_PAD * 2, FONT_SIZE);
        page.drawText(fitted.text, {
            x: rect.x + CELL_PAD,
            y: rect.y + 8,
            size: fitted.size,
            font,
            color: COLOR_TEXT,
        });
    }

    return footerY + FOOTER_H + 10;
}

function drawColumnHeaders(page: PDFPage, bold: PDFFont, tableTop: number): number {
    const cols = colX();
    const y = tableTop - COL_HEADER_H;
    drawHRule(page, MARGIN_X, MARGIN_X + CONTENT_W, tableTop + 2, COLOR_PRIMARY, 0.75);

    page.drawText(toPdfWinAnsiText('FACTOR'), {
        x: cols.factors,
        y: y + 3,
        size: MUTED_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    page.drawText(toPdfWinAnsiText('RATING'), {
        x: cols.rating,
        y: y + 3,
        size: MUTED_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    const scoreLabel = 'SCORE';
    const scoreW = bold.widthOfTextAtSize(scoreLabel, MUTED_SIZE);
    page.drawText(scoreLabel, {
        x: cols.score + (COLS.score - scoreW) / 2,
        y: y + 3,
        size: MUTED_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    drawHRule(page, MARGIN_X, MARGIN_X + CONTENT_W, y, COLOR_RULE, 0.5);
    return y - 4;
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

    // Primary hairline + section title
    drawHRule(page, MARGIN_X, MARGIN_X + CONTENT_W, cursor, COLOR_PRIMARY, 0.5);
    cursor -= 4;
    page.drawText(toPdfWinAnsiText(section.title), {
        x: cols.factors,
        y: cursor - SECTION_SIZE,
        size: SECTION_SIZE,
        font: bold,
        color: COLOR_PRIMARY,
    });
    cursor -= SECTION_TITLE_H;

    const guidanceTop = cursor;
    const guidanceH = section.rows.length * GUIDANCE_ROW_H;

    for (const row of section.rows) {
        const textY = cursor - GUIDANCE_ROW_H + (GUIDANCE_ROW_H - FONT_SIZE) / 2;
        page.drawText(toPdfWinAnsiText(row.text), {
            x: cols.factors + 2,
            y: textY,
            size: FONT_SIZE,
            font,
            color: COLOR_TEXT,
        });
        const ratingW = font.widthOfTextAtSize(row.rating, FONT_SIZE);
        page.drawText(toPdfWinAnsiText(row.rating), {
            x: cols.rating + (COLS.rating - ratingW) / 2,
            y: textY,
            size: FONT_SIZE,
            font,
            color: COLOR_MUTED,
        });
        cursor -= GUIDANCE_ROW_H;
    }

    // Merged score spanning guidance rows
    const scoreRect: Rect = {
        x: cols.score,
        y: guidanceTop - guidanceH,
        w: COLS.score,
        h: guidanceH,
    };
    drawCenteredText(page, bold, String(score), scoreRect, 12, COLOR_TEXT);

    return cursor - 3;
}

function drawTotalRow(
    page: PDFPage,
    bold: PDFFont,
    total: number,
    top: number,
): number {
    const cols = colX();
    const y = top - TOTAL_ROW_H;
    drawHRule(page, MARGIN_X, MARGIN_X + CONTENT_W, top, COLOR_PRIMARY, 0.75);

    const level = urgencyLevelFromTotal(total);
    page.drawText(toPdfWinAnsiText('Total (Between 7 and 21)'), {
        x: cols.factors,
        y: y + (TOTAL_ROW_H - FONT_SIZE) / 2,
        size: FONT_SIZE,
        font: bold,
        color: COLOR_TEXT,
    });

    const totalStr = String(total);
    const totalW = bold.widthOfTextAtSize(totalStr, 12);
    page.drawText(totalStr, {
        x: cols.score + (COLS.score - totalW) / 2,
        y: y + (TOTAL_ROW_H - 12) / 2,
        size: 12,
        font: bold,
        color: levelColor(level),
    });

    return y - 6;
}

function drawUrgencyScale(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    total: number,
    top: number,
): number {
    const level = urgencyLevelFromTotal(total);
    const rect: Rect = {
        x: MARGIN_X,
        y: top - SCALE_H,
        w: CONTENT_W,
        h: SCALE_H,
    };

    const third = rect.w / 3;
    const bands: Array<{
        label: string;
        number: string;
        bandLevel: UrgencyLevelLabel;
        active: boolean;
    }> = [
        {
            label: 'Highest Urgency',
            number: '7',
            bandLevel: 'High',
            active: level === 'High',
        },
        {
            label: 'Intermediate Urgency',
            number: '14',
            bandLevel: 'Moderate',
            active: level === 'Moderate',
        },
        {
            label: 'Lowest Urgency',
            number: '21',
            bandLevel: 'Lower',
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
        drawFilledRect(page, bandRect, band.active ? levelFill(band.bandLevel) : rgb(0.97, 0.97, 0.98));
        const numColor = band.active ? levelColor(band.bandLevel) : COLOR_MUTED;
        drawCenteredText(
            page,
            bold,
            band.number,
            { x: bandRect.x, y: bandRect.y + 18, w: bandRect.w, h: 14 },
            12,
            numColor,
        );
        drawCenteredText(
            page,
            font,
            band.label,
            { x: bandRect.x, y: bandRect.y + 4, w: bandRect.w, h: 12 },
            7.5,
            band.active ? COLOR_TEXT : COLOR_MUTED,
        );
    });
    drawRectStroke(page, rect, COLOR_BOX_STROKE, 0.6);
    // Internal dividers
    page.drawLine({
        start: { x: rect.x + third, y: rect.y },
        end: { x: rect.x + third, y: rect.y + rect.h },
        thickness: 0.5,
        color: COLOR_BOX_STROKE,
    });
    page.drawLine({
        start: { x: rect.x + third * 2, y: rect.y },
        end: { x: rect.x + third * 2, y: rect.y + rect.h },
        thickness: 0.5,
        color: COLOR_BOX_STROKE,
    });

    const levelLabel = level === 'Moderate' ? 'Intermediate' : level === 'Lower' ? 'Lowest' : 'Highest';
    page.drawText(toPdfWinAnsiText(`Current: ${levelLabel} Urgency (total ${total})`), {
        x: rect.x,
        y: rect.y - 12,
        size: MUTED_SIZE,
        font: bold,
        color: levelColor(level),
    });

    return rect.y - 16;
}

export async function buildUrgencyRatingChartPdf(
    factors: Record<UrgencyFactorKey, number>,
    header: UrgencyRatingChartHeader,
): Promise<Uint8Array> {
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);
    const bold = await outDoc.embedFont(StandardFonts.HelveticaBold);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);

    drawSignatureBlock(page, font, bold, header);

    let cursor = drawTitleBand(page, font, bold, header);
    cursor = drawHeaderFields(page, font, bold, header, cursor);

    let total = 0;
    for (const section of FACTOR_SECTIONS) {
        total += Number(factors[section.key]) || 0;
    }

    cursor = drawUrgencyBadge(page, bold, total, cursor);
    cursor = drawColumnHeaders(page, bold, cursor);

    for (const section of FACTOR_SECTIONS) {
        const score = Number(factors[section.key]) || 0;
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
