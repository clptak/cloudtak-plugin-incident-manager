/**
 * Modern grayscale SAR Briefing PDF — Skydio-style page 1 (toner-friendly)
 * plus template page 2 unit log (pdf-lib, no AcroForm setText).
 */

import {
    PDFDocument,
    StandardFonts,
    rgb,
} from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage, RGB } from '../vendor/pdf-lib.esm.min.js';
import templateUrl from '../assets/sar-briefing-template.pdf?url';
import type { BriefingSubjectColumn, IrBriefingForm } from './irBriefing.ts';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';

export const SAR_BRIEFING_MODERN_MISSION_FILENAME = 'SAR-Briefing-New.pdf';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 36;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const TITLE_BAND_H = 48;
const BADGE_H = 18;

const FONT_SIZE = 8;
const TITLE_SIZE = 15;
const SECTION_SIZE = 9;
const LABEL_SIZE = 6.5;
const MUTED_SIZE = 7.5;
const LINE_H = 9.5;
const HEADER_ROW_H = 16;
const SUBJECT_ROW_H = 10;
const CELL_PAD = 2;

/** Grayscale palette (toner-friendly — light fills, dark text). */
const COLOR_BAND = rgb(0.92, 0.92, 0.92);
const COLOR_TEXT = rgb(0.15, 0.15, 0.15);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_RULE = rgb(0.78, 0.78, 0.78);
const COLOR_ACCENT = rgb(0.28, 0.28, 0.28);
const COLOR_BADGE = rgb(0.88, 0.88, 0.88);
const COLOR_COL_HEADER = rgb(0.94, 0.94, 0.94);

interface FieldLayout {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface BriefingPdfForm {
    getField(name: string): {
        acroField: { getWidgets(): Array<{ getRectangle(): { x: number; y: number; width: number; height: number } }> };
    };
}

const SUBJECT_ATTRS: Array<{ key: keyof BriefingSubjectColumn; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
    { key: 'height', label: 'Height' },
    { key: 'weight', label: 'Weight' },
    { key: 'hairColor', label: 'Hair Color' },
    { key: 'facialHair', label: 'Facial Hair' },
    { key: 'glasses', label: 'Glasses' },
    { key: 'distinguishingMarks', label: 'Dist. Marks' },
    { key: 'clothing', label: 'Clothing' },
    { key: 'footwear', label: 'Footwear' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'vehicle', label: 'Vehicle' },
];

const PAGE2_FIELDS = [
    '1 Incident Name',
    '2 Date Prepared',
    '3 Time Prepared',
    '6 Operational Period',
] as const;

function displayOrDash(value: string): string {
    const t = value.trim();
    return t || '\u2014';
}

function splitIppDatum(ippText: string): { ipp: string; datum: string } {
    const parts = ippText.split(/\s*\/\s*/);
    if (parts.length >= 2) {
        return { ipp: parts[0].trim(), datum: parts.slice(1).join(' / ').trim() };
    }
    return { ipp: ippText.trim(), datum: '' };
}

function loadTemplateBytes(): Promise<ArrayBuffer> {
    return fetch(templateUrl, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error(`Could not load SAR Briefing template (${res.status})`);
        return res.arrayBuffer();
    });
}

function fitText(
    font: PDFFont,
    text: string,
    maxW: number,
    size: number,
    minSize = 5.5,
): { text: string; size: number } {
    const t = toPdfWinAnsiText(text);
    let s = size;
    while (s > minSize && font.widthOfTextAtSize(t, s) > maxW) s -= 0.5;
    if (font.widthOfTextAtSize(t, s) <= maxW) return { text: t, size: s };
    let truncated = t;
    while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}\u2026`, minSize) > maxW) {
        truncated = truncated.slice(0, -1);
    }
    return { text: `${truncated}\u2026`, size: minSize };
}

function wrapLines(text: string, font: PDFFont, maxWidth: number, size: number): string[] {
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

function drawHRule(page: PDFPage, y: number, color: RGB = COLOR_ACCENT, thickness = 0.6): void {
    page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: MARGIN_X + CONTENT_W, y },
        thickness,
        color,
    });
}

function drawTitleBand(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    form: IrBriefingForm,
): number {
    page.drawRectangle({
        x: 0,
        y: PAGE_H - TITLE_BAND_H,
        width: PAGE_W,
        height: TITLE_BAND_H,
        color: COLOR_BAND,
        borderWidth: 0,
    });

    page.drawText(toPdfWinAnsiText('SAR BRIEFING'), {
        x: MARGIN_X,
        y: PAGE_H - 24,
        size: TITLE_SIZE,
        font: bold,
        color: COLOR_TEXT,
    });

    const subtitle = form.incidentName.trim() || 'Incident Response Briefing';
    const sub = fitText(font, subtitle, CONTENT_W * 0.62, 9);
    page.drawText(sub.text, {
        x: MARGIN_X,
        y: PAGE_H - 38,
        size: sub.size,
        font,
        color: COLOR_MUTED,
    });

    const pageLabel = 'Page 1 of 2';
    const pageW = font.widthOfTextAtSize(pageLabel, MUTED_SIZE);
    page.drawText(pageLabel, {
        x: PAGE_W - MARGIN_X - pageW,
        y: PAGE_H - 24,
        size: MUTED_SIZE,
        font,
        color: COLOR_MUTED,
    });

    return PAGE_H - TITLE_BAND_H - 10;
}

function drawBadge(page: PDFPage, bold: PDFFont, form: IrBriefingForm, top: number): number {
    const label = form.operationalPeriod.trim()
        ? `OPERATIONAL PERIOD: ${form.operationalPeriod.trim()}`
        : 'INCIDENT RESPONSE BRIEFING';
    page.drawRectangle({
        x: MARGIN_X,
        y: top - BADGE_H,
        width: CONTENT_W,
        height: BADGE_H,
        color: COLOR_BADGE,
        borderWidth: 0,
    });
    const fitted = fitText(bold, label, CONTENT_W - 10, 8.5);
    page.drawText(fitted.text, {
        x: MARGIN_X + 5,
        y: top - BADGE_H + (BADGE_H - fitted.size) / 2,
        size: fitted.size,
        font: bold,
        color: COLOR_TEXT,
    });
    return top - BADGE_H - 8;
}

function drawLabelValuePair(
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
    const fitted = fitText(font, displayOrDash(value), w, FONT_SIZE);
    page.drawText(fitted.text, {
        x,
        y: top - LABEL_SIZE - fitted.size - 1,
        size: fitted.size,
        font,
        color: COLOR_TEXT,
    });
}

function drawHeaderFields(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    form: IrBriefingForm,
    top: number,
): number {
    const { ipp, datum } = splitIppDatum(form.initialPlanningPoint);
    const gap = 12;
    const colW = (CONTENT_W - gap * 2) / 3;
    let y = top;

    drawLabelValuePair(page, font, bold, 'Date', form.briefingDate, MARGIN_X, y, colW);
    drawLabelValuePair(page, font, bold, 'Time', form.briefingTime, MARGIN_X + colW + gap, y, colW);
    drawLabelValuePair(page, font, bold, 'Incident Commander', form.incidentCommander, MARGIN_X + (colW + gap) * 2, y, colW);
    y -= HEADER_ROW_H + 2;

    const halfW = (CONTENT_W - gap) / 2;
    drawLabelValuePair(page, font, bold, 'IPP', ipp, MARGIN_X, y, halfW);
    drawLabelValuePair(page, font, bold, 'Datum', datum || 'WGS84', MARGIN_X + halfW + gap, y, halfW);
    return y - HEADER_ROW_H - 4;
}

function drawSectionTitle(page: PDFPage, bold: PDFFont, title: string, top: number): number {
    drawHRule(page, top, COLOR_ACCENT, 0.55);
    page.drawText(toPdfWinAnsiText(title), {
        x: MARGIN_X,
        y: top - SECTION_SIZE - 2,
        size: SECTION_SIZE,
        font: bold,
        color: COLOR_ACCENT,
    });
    return top - SECTION_SIZE - 6;
}

function drawWrappedBlock(
    page: PDFPage,
    font: PDFFont,
    text: string,
    top: number,
    maxLines: number,
): number {
    const lines = wrapLines(displayOrDash(text) === '\u2014' && !text.trim() ? '\u2014' : text, font, CONTENT_W, FONT_SIZE)
        .slice(0, maxLines);
    if (!lines.length) {
        page.drawText('\u2014', {
            x: MARGIN_X,
            y: top - FONT_SIZE,
            size: FONT_SIZE,
            font,
            color: COLOR_MUTED,
        });
        return top - LINE_H - 2;
    }
    let y = top;
    for (const line of lines) {
        page.drawText(line, {
            x: MARGIN_X,
            y: y - FONT_SIZE,
            size: FONT_SIZE,
            font,
            color: COLOR_TEXT,
        });
        y -= LINE_H;
    }
    return y - 3;
}

function drawSubjectsTable(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    form: IrBriefingForm,
    top: number,
): number {
    let y = drawSectionTitle(page, bold, 'Subjects', top);

    const labelW = 72;
    const colW = (CONTENT_W - labelW) / 3;
    const cols = [MARGIN_X + labelW, MARGIN_X + labelW + colW, MARGIN_X + labelW + colW * 2];

    // Column headers
    page.drawRectangle({
        x: MARGIN_X,
        y: y - SUBJECT_ROW_H,
        width: CONTENT_W,
        height: SUBJECT_ROW_H,
        color: COLOR_COL_HEADER,
        borderWidth: 0,
    });
    page.drawText(toPdfWinAnsiText('Attribute'), {
        x: MARGIN_X + 2,
        y: y - SUBJECT_ROW_H + 2,
        size: MUTED_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    form.subjects.forEach((subject, i) => {
        const header = `Subject ${subject.number || String(i + 1).padStart(2, '0')}`;
        page.drawText(toPdfWinAnsiText(header), {
            x: cols[i] + 2,
            y: y - SUBJECT_ROW_H + 2,
            size: MUTED_SIZE,
            font: bold,
            color: COLOR_MUTED,
        });
    });
    y -= SUBJECT_ROW_H;
    drawHRule(page, y, COLOR_RULE, 0.4);

    for (const attr of SUBJECT_ATTRS) {
        page.drawText(toPdfWinAnsiText(attr.label), {
            x: MARGIN_X + 2,
            y: y - SUBJECT_ROW_H + 2,
            size: FONT_SIZE - 0.5,
            font: bold,
            color: COLOR_MUTED,
        });
        form.subjects.forEach((subject, i) => {
            const raw = String(subject[attr.key] ?? '');
            const fitted = fitText(font, displayOrDash(raw), colW - 6, FONT_SIZE - 0.5);
            page.drawText(fitted.text, {
                x: cols[i] + 2,
                y: y - SUBJECT_ROW_H + 2,
                size: fitted.size,
                font,
                color: COLOR_TEXT,
            });
        });
        y -= SUBJECT_ROW_H;
    }
    drawHRule(page, y, COLOR_RULE, 0.4);
    return y - 4;
}

function drawSubject1Extras(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    form: IrBriefingForm,
    top: number,
): number {
    const s1 = form.subjects[0];
    let y = drawSectionTitle(page, bold, 'Medical Conditions / Experience (Subject 01)', top);

    page.drawText(toPdfWinAnsiText('Medical'), {
        x: MARGIN_X,
        y: y - LABEL_SIZE,
        size: LABEL_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    y -= LABEL_SIZE + 2;
    y = drawWrappedBlock(page, font, s1.medicalConditions, y, 3);

    page.drawText(toPdfWinAnsiText('Experience'), {
        x: MARGIN_X,
        y: y - LABEL_SIZE,
        size: LABEL_SIZE,
        font: bold,
        color: COLOR_MUTED,
    });
    y -= LABEL_SIZE + 2;
    return drawWrappedBlock(page, font, s1.experience, y, 3);
}

function drawCommsRow(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    form: IrBriefingForm,
    top: number,
): number {
    const y = drawSectionTitle(page, bold, 'Communications', top);
    const gap = 10;
    const colW = (CONTENT_W - gap * 2) / 3;
    drawLabelValuePair(page, font, bold, 'Repeated', form.adamRepeatedChannel, MARGIN_X, y, colW);
    drawLabelValuePair(page, font, bold, 'Car-to-Car / Simplex', form.carToCarChannel, MARGIN_X + colW + gap, y, colW);
    drawLabelValuePair(page, font, bold, 'Alternate', form.alternateChannel, MARGIN_X + (colW + gap) * 2, y, colW);
    return y - HEADER_ROW_H - 2;
}

function drawPage1(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    form: IrBriefingForm,
): void {
    let y = drawTitleBand(page, font, bold, form);
    y = drawBadge(page, bold, form, y);
    y = drawHeaderFields(page, font, bold, form, y);
    y = drawSubjectsTable(page, font, bold, form, y);
    y = drawSubject1Extras(page, font, bold, form, y);

    y = drawSectionTitle(page, bold, 'Situation Summary', y);
    y = drawWrappedBlock(page, font, form.situationSummary, y, 5);

    y = drawSectionTitle(page, bold, 'Actions Taken / Resources On Scene', y);
    y = drawWrappedBlock(page, font, form.actionsTaken, y, 5);

    y = drawCommsRow(page, font, bold, form, y);

    y = drawSectionTitle(page, bold, 'Weather', y);
    y = drawWrappedBlock(page, font, form.weatherSummary, y, 4);

    y = drawSectionTitle(page, bold, 'Safety Message', y);
    drawWrappedBlock(page, font, form.safetyMessage, y, 5);
}

function getPage2FieldLayout(form: BriefingPdfForm, fieldName: string): FieldLayout | null {
    try {
        const widget = form.getField(fieldName).acroField.getWidgets()[0];
        if (!widget) return null;
        const rect = widget.getRectangle();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    } catch {
        return null;
    }
}

function paintPage2Field(page: PDFPage, font: PDFFont, layout: FieldLayout, value: string): void {
    page.drawRectangle({
        x: layout.x,
        y: layout.y,
        width: layout.w,
        height: layout.h,
        color: COLOR_WHITE,
        borderWidth: 0,
    });
    const trimmed = toPdfWinAnsiText(value).trim();
    if (!trimmed) return;
    const fitted = fitText(font, trimmed, layout.w - CELL_PAD * 2, FONT_SIZE + 1);
    page.drawText(fitted.text, {
        x: layout.x + CELL_PAD,
        y: layout.y + (layout.h - fitted.size) / 2,
        size: fitted.size,
        font,
        color: COLOR_TEXT,
    });
}

async function appendTemplatePage2(
    outDoc: PDFDocument,
    font: PDFFont,
    form: IrBriefingForm,
): Promise<void> {
    const templateBytes = await loadTemplateBytes();
    const templateDoc = await PDFDocument.load(templateBytes);
    const templatePdf = templateDoc as PDFDocument & {
        getForm(): BriefingPdfForm;
        getPageCount(): number;
    };

    if (templatePdf.getPageCount() < 2) {
        throw new Error('SAR Briefing template is missing page 2 (unit log).');
    }

    const [templatePage] = await outDoc.copyPages(templateDoc, [1]);
    const embedded = await outDoc.embedPage(templatePage);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);
    page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

    const values: Record<(typeof PAGE2_FIELDS)[number], string> = {
        '1 Incident Name': form.incidentName,
        '2 Date Prepared': form.briefingDate,
        '3 Time Prepared': form.briefingTime,
        '6 Operational Period': form.operationalPeriod,
    };

    const pdfForm = templatePdf.getForm();
    for (const fieldName of PAGE2_FIELDS) {
        const layout = getPage2FieldLayout(pdfForm, fieldName);
        if (!layout) continue;
        paintPage2Field(page, font, layout, values[fieldName]);
    }
}

/** Build modern grayscale page 1 + template unit-log page 2. */
export async function buildSarBriefingModernPdf(form: IrBriefingForm): Promise<Uint8Array> {
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);
    const bold = await outDoc.embedFont(StandardFonts.HelveticaBold);

    const page1 = outDoc.addPage([PAGE_W, PAGE_H]);
    drawPage1(page1, font, bold, form);
    await appendTemplatePage2(outDoc, font, form);

    return outDoc.save();
}

export function defaultSarBriefingModernFilename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `SAR-Briefing-New_${base}_${stamp}.pdf`;
}
