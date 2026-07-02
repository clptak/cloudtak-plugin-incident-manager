import {
    PDFDocument,
    StandardFonts,
    rgb,
} from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import templateUrl from '../assets/sar-briefing-template.pdf?url';
import type { BriefingSubjectColumn, IrBriefingForm } from './irBriefing.ts';

export const SAR_BRIEFING_MISSION_FILENAME = 'SAR-Briefing.pdf';

/** Page 2 header/roster fields sit above this y (PDF points, origin bottom-left). */
const PAGE2_Y_THRESHOLD = 690;

const PAGE_W = 612;
const PAGE_H = 792;
const FONT_SIZE = 9;
const LINE_HEIGHT = 11;
const CELL_PAD = 2;

interface FieldLayout {
    pageIndex: number;
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

/** AcroForm field names per subject column (template naming is inconsistent on column 3). */
const SUBJECT_COLUMN_FIELDS: Array<Record<keyof BriefingSubjectColumn, string | null>> = [
    {
        number: null,
        name: 'Name1',
        age: 'Age1',
        height: 'Height1',
        weight: 'Weight1',
        hairColor: 'Hair Color1',
        facialHair: 'Facial Hair1',
        glasses: 'Glasses1',
        distinguishingMarks: 'Distinguishing1',
        clothing: 'Clothing1',
        footwear: 'Footwear1',
        equipment: 'Equipment1',
        vehicle: 'Vehicle1',
        medicalConditions: 'Medical Conditions',
        experience: 'SubjectExperience',
    },
    {
        number: null,
        name: 'Name2',
        age: 'Age2',
        height: 'Height2',
        weight: 'Weight2',
        hairColor: 'Hair Color2',
        facialHair: 'Facial Hair2',
        glasses: 'Glasses2',
        distinguishingMarks: 'Distinguishing2',
        clothing: 'Clothing2',
        footwear: 'Footwear2',
        equipment: 'Equipment2',
        vehicle: 'Vehicle2',
        medicalConditions: null,
        experience: null,
    },
    {
        number: null,
        name: 'Name3',
        age: 'Age3',
        height: 'Height3',
        weight: 'Weight3',
        hairColor: 'HairColor3',
        facialHair: 'Facial Hair3',
        glasses: 'Glasses3',
        distinguishingMarks: 'Distinguishing3',
        clothing: 'Clothing3',
        footwear: 'Footwear3',
        equipment: 'Equipment3',
        vehicle: 'Vehicle3',
        medicalConditions: null,
        experience: null,
    },
];

const WRAPPED_FIELD_NAMES = new Set([
    'SituationSummary',
    'ActionsTakenResourcesOnScene',
    'WeatherSummary',
    'SafetyMessage',
    'Medical Conditions',
    'SubjectExperience',
]);

function loadTemplateBytes(): Promise<ArrayBuffer> {
    return fetch(templateUrl, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error(`Could not load SAR Briefing template (${res.status})`);
        return res.arrayBuffer();
    });
}

function splitIppDatum(ippText: string): { ipp: string; datum: string } {
    const parts = ippText.split(/\s*\/\s*/);
    if (parts.length >= 2) {
        return { ipp: parts[0].trim(), datum: parts.slice(1).join(' / ').trim() };
    }
    return { ipp: ippText.trim(), datum: '' };
}

function getFieldLayout(form: BriefingPdfForm, fieldName: string): FieldLayout | null {
    try {
        const widget = form.getField(fieldName).acroField.getWidgets()[0];
        if (!widget) return null;
        const rect = widget.getRectangle();
        return {
            pageIndex: rect.y >= PAGE2_Y_THRESHOLD ? 1 : 0,
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
        };
    } catch {
        return null;
    }
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

function maxLinesForHeight(height: number): number {
    return Math.max(1, Math.floor((height - CELL_PAD * 2) / LINE_HEIGHT));
}

function whiteOutField(page: PDFPage, layout: FieldLayout): void {
    page.drawRectangle({
        x: layout.x,
        y: layout.y,
        width: layout.w,
        height: layout.h,
        color: rgb(1, 1, 1),
        borderWidth: 0,
    });
}

function drawSingleLine(page: PDFPage, font: PDFFont, text: string, layout: FieldLayout): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    page.drawText(trimmed, {
        x: layout.x + CELL_PAD,
        y: layout.y + (layout.h - FONT_SIZE) / 2,
        size: FONT_SIZE,
        font,
    });
}

function drawWrapped(page: PDFPage, font: PDFFont, text: string, layout: FieldLayout): void {
    const contentW = layout.w - CELL_PAD * 2;
    const lines = wrapLines(text, font, contentW).slice(0, maxLinesForHeight(layout.h));
    let y = layout.y + layout.h - CELL_PAD - FONT_SIZE;
    for (const line of lines) {
        page.drawText(line, {
            x: layout.x + CELL_PAD,
            y,
            size: FONT_SIZE,
            font,
        });
        y -= LINE_HEIGHT;
    }
}

function paintField(
    pages: PDFPage[],
    font: PDFFont,
    layout: FieldLayout,
    value: string,
    wrapped: boolean,
): void {
    const page = pages[layout.pageIndex];
    if (!page) return;
    whiteOutField(page, layout);
    if (wrapped) {
        drawWrapped(page, font, value, layout);
    } else {
        drawSingleLine(page, font, value, layout);
    }
}

function buildFieldLayoutMap(form: BriefingPdfForm, fieldNames: Iterable<string>): Map<string, FieldLayout> {
    const layouts = new Map<string, FieldLayout>();
    for (const fieldName of fieldNames) {
        const layout = getFieldLayout(form, fieldName);
        if (layout) layouts.set(fieldName, layout);
    }
    return layouts;
}

function collectFieldValues(form: IrBriefingForm): Map<string, string> {
    const { ipp, datum } = splitIppDatum(form.initialPlanningPoint);
    const values = new Map<string, string>([
        ['Incident Date_af_date', form.briefingDate],
        ['Incident Time', form.briefingTime],
        ['Incident Commander', form.incidentCommander],
        ['IPP', ipp],
        ['DATUM', datum || 'WGS84'],
        ['SituationSummary', form.situationSummary],
        ['ActionsTakenResourcesOnScene', form.actionsTaken],
        ['CommsChannelRepeated', form.adamRepeatedChannel],
        ['CommSimplex', form.carToCarChannel],
        ['CommsAlternate', form.alternateChannel],
        ['WeatherSummary', form.weatherSummary],
        ['SafetyMessage', form.safetyMessage],
        ['1 Incident Name', form.incidentName],
        ['2 Date Prepared', form.briefingDate],
        ['3 Time Prepared', form.briefingTime],
        ['6 Operational Period', form.operationalPeriod],
    ]);

    form.subjects.forEach((subject, colIndex) => {
        const mapping = SUBJECT_COLUMN_FIELDS[colIndex];
        if (!mapping) return;
        for (const [key, fieldName] of Object.entries(mapping) as Array<[keyof BriefingSubjectColumn, string | null]>) {
            if (!fieldName) continue;
            values.set(fieldName, String(subject[key] ?? ''));
        }
    });

    return values;
}

/** Same embedPage + drawPage pattern as ICS 234 — avoids blank pages and AcroForm widget overlays. */
async function embedTemplatePage(
    templateDoc: PDFDocument,
    outDoc: PDFDocument,
    pageIndex: number,
): Promise<PDFPage> {
    const [templatePage] = await outDoc.copyPages(templateDoc, [pageIndex]);
    const embedded = await outDoc.embedPage(templatePage);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);
    page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    return page;
}

/** Paint briefing values onto the SAR template using measured AcroForm widget boxes. */
export async function buildSarBriefingPdf(form: IrBriefingForm): Promise<Uint8Array> {
    const templateBytes = await loadTemplateBytes();
    const templateDoc = await PDFDocument.load(templateBytes);
    const templatePdf = templateDoc as PDFDocument & {
        getForm(): BriefingPdfForm;
        getPageCount(): number;
    };

    const fieldValues = collectFieldValues(form);
    const layouts = buildFieldLayoutMap(templatePdf.getForm(), fieldValues.keys());

    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);

    const pages: PDFPage[] = [];
    for (let pageIndex = 0; pageIndex < templatePdf.getPageCount(); pageIndex++) {
        pages.push(await embedTemplatePage(templateDoc, outDoc, pageIndex));
    }

    for (const [fieldName, value] of fieldValues) {
        const layout = layouts.get(fieldName);
        if (!layout) continue;
        paintField(pages, font, layout, value, WRAPPED_FIELD_NAMES.has(fieldName));
    }

    return outDoc.save();
}

export function defaultSarBriefingFilename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `SAR-Briefing_${base}_${stamp}.pdf`;
}
