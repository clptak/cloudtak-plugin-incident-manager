import {
    PDFDocument,
    StandardFonts,
    rgb,
} from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import templateUrl from '../assets/ics-201-template.pdf?url';
import {
    buildMapSketchText,
    collapseActionText,
    MAX_ACTION_ROWS,
    MAX_RESOURCE_ROWS,
    type Ics201ActionRow,
    type Ics201Form,
    type Ics201Sources,
} from './ics201.ts';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';

export const ICS201_MISSION_FILENAME = 'ICS-201.pdf';

const PAGE_W = 612;
const PAGE_H = 792;
/** Form pages only — omit trailing instruction pages with no AcroForm fields. */
const OUTPUT_PAGE_COUNT = 4;
const FONT_SIZE = 9;
const LINE_HEIGHT = 11;
const CELL_PAD = 2;

const MAP_SKETCH_FIELD = '4 MapSketch include sketch showing the total area of operations the incident sitearea impacted and threatened areas overflight results trajectories impacted shorelines or other graphics depicting situational status and resource assignment';
const SITUATION_FIELD = '5 Situation Summary and Health and Safety Briefing for briefings or transfer of command Recognize potential incident Health and Safety Hazards and develop necessary measures remove hazard provide personal protective equipment warn people of the hazard to protect responders from those hazards';
const OBJECTIVES_FIELD = '7 Current and Planned Objectives';
const ORG_NOTES_FIELD = '9 Current Organization fill in additional organization as appropriate Incident Commanders Operations Section Chief Planning Section Chief Logistics Section Chief FinanceAdministration Section Chief Safety Officer Public Information Officer Liaison Officer';

/** Single-widget fields and their template page index (0-based). */
const SINGLE_FIELD_PAGES: Record<string, number> = {
    [MAP_SKETCH_FIELD]: 0,
    [SITUATION_FIELD]: 0,
    '6 Prepared by Name': 0,
    PositionTitle: 0,
    Signature: 0,
    DateTime: 0,
    [OBJECTIVES_FIELD]: 1,
    '6 Prepared by Name_2': 1,
    PositionTitle_2: 1,
    Signature_2: 1,
    DateTime_2: 1,
    'Incident Commanders': 2,
    'Liaison Officer': 2,
    'Safety Officer': 2,
    'Public Information Officer': 2,
    'Planning Section Chief_2': 2,
    'Operations Section Chief_2': 2,
    'FinanceAdministration Section Chief': 2,
    'Logistics Section Chief': 2,
    [ORG_NOTES_FIELD]: 2,
    '6 Prepared by Name_3': 2,
    PositionTitle_3: 2,
    Signature_3: 2,
    DateTime_3: 2,
    '6 Prepared by Name_4': 3,
    PositionTitle_4: 3,
    Signature_4: 3,
    DateTime_4: 3,
};

const WRAPPED_FIELDS = new Set([
    MAP_SKETCH_FIELD,
    SITUATION_FIELD,
    OBJECTIVES_FIELD,
    ORG_NOTES_FIELD,
    'Incident Commanders',
]);

interface FieldLayout {
    pageIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface BriefingPdfForm {
    getField(name: string): {
        acroField: {
            getWidgets(): Array<{
                getRectangle(): { x: number; y: number; width: number; height: number };
            }>;
        };
    };
}

function loadTemplateBytes(): Promise<ArrayBuffer> {
    return fetch(templateUrl, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error(`Could not load ICS 201 template (${res.status})`);
        return res.arrayBuffer();
    });
}

function normalizeRect(rect: { x: number; y: number; width: number; height: number }): FieldLayout['x'] extends number ? {
    x: number;
    y: number;
    w: number;
    h: number;
} : never {
    const h = Math.abs(rect.height) || 12;
    const y = rect.height < 0 ? rect.y + rect.height : rect.y;
    return {
        x: rect.x,
        y,
        w: Math.abs(rect.width) || 40,
        h,
    };
}

function layoutsForField(
    form: BriefingPdfForm,
    fieldName: string,
    pageOverride?: number,
): FieldLayout[] {
    try {
        const widgets = form.getField(fieldName).acroField.getWidgets();
        return widgets.map((widget, index) => {
            const rect = normalizeRect(widget.getRectangle());
            const pageIndex = pageOverride ?? (
                widgets.length > 1
                    ? index
                    : (SINGLE_FIELD_PAGES[fieldName] ?? 0)
            );
            return { pageIndex, ...rect };
        });
    } catch {
        return [];
    }
}

function wrapLines(
    text: string,
    font: PDFFont,
    maxWidth: number,
    fontSize: number = FONT_SIZE,
): string[] {
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
            if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
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
    const trimmed = toPdfWinAnsiText(text).trim();
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
    const maxLines = Math.max(1, Math.floor((layout.h - CELL_PAD * 2) / LINE_HEIGHT));
    const lines = wrapLines(text, font, contentW).slice(0, maxLines);
    let y = layout.y + layout.h - CELL_PAD - FONT_SIZE;
    for (const line of lines) {
        if (line) {
            page.drawText(line, {
                x: layout.x + CELL_PAD,
                y,
                size: FONT_SIZE,
                font,
            });
        }
        y -= LINE_HEIGHT;
    }
}

/** Candidate sizes for shrink-to-fit cells (largest first). */
const FIT_FONT_SIZES = [9, 8, 7, 6, 5] as const;

/**
 * Wrap the text into the cell, stepping the font size down until every line
 * fits the cell width and all lines fit the cell height. Falls back to the
 * smallest size (truncated) when even that overflows.
 */
function drawFitted(page: PDFPage, font: PDFFont, text: string, layout: FieldLayout): void {
    const collapsed = toPdfWinAnsiText(text).replace(/\s+/g, ' ').trim();
    if (!collapsed) return;
    const contentW = Math.max(4, layout.w - CELL_PAD * 2);
    const contentH = Math.max(4, layout.h - CELL_PAD * 2);

    let size: number = FIT_FONT_SIZES[FIT_FONT_SIZES.length - 1];
    let lines: string[] | null = null;
    for (const candidate of FIT_FONT_SIZES) {
        const lineHeight = candidate + 2;
        const maxLines = Math.max(1, Math.floor(contentH / lineHeight));
        const wrapped = wrapLines(collapsed, font, contentW, candidate);
        const fitsWidth = wrapped.every(
            (line) => font.widthOfTextAtSize(line, candidate) <= contentW,
        );
        if (fitsWidth && wrapped.length <= maxLines) {
            size = candidate;
            lines = wrapped;
            break;
        }
    }
    if (!lines) {
        const lineHeight = size + 2;
        const maxLines = Math.max(1, Math.floor(contentH / lineHeight));
        lines = wrapLines(collapsed, font, contentW, size).slice(0, maxLines);
    }

    const lineHeight = size + 2;
    const blockH = lines.length * lineHeight;
    // Center the block vertically inside the cell.
    const topOffset = Math.max(CELL_PAD, (layout.h - blockH) / 2 + (lineHeight - size) / 2);
    let y = layout.y + layout.h - topOffset - size;
    for (const line of lines) {
        if (line) {
            page.drawText(line, {
                x: layout.x + CELL_PAD,
                y,
                size,
                font,
            });
        }
        y -= lineHeight;
    }
}

type PaintMode = 'single' | 'wrapped' | 'fit';

function paintLayouts(
    pages: PDFPage[],
    font: PDFFont,
    layouts: FieldLayout[],
    value: string,
    mode: PaintMode,
): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    for (const layout of layouts) {
        const page = pages[layout.pageIndex];
        if (!page) continue;
        whiteOutField(page, layout);
        if (mode === 'wrapped') drawWrapped(page, font, value, layout);
        else if (mode === 'fit') drawFitted(page, font, value, layout);
        else drawSingleLine(page, font, value, layout);
    }
}

function paintNamedField(
    pages: PDFPage[],
    font: PDFFont,
    form: BriefingPdfForm,
    fieldName: string,
    value: string,
    pageOverride?: number,
    fit = false,
): void {
    const layouts = layoutsForField(form, fieldName, pageOverride);
    const mode: PaintMode = fit ? 'fit' : (WRAPPED_FIELDS.has(fieldName) ? 'wrapped' : 'single');
    paintLayouts(pages, font, layouts, value, mode);
}

function notesFieldName(rowIndex: number): string {
    const n = rowIndex + 1;
    if (n === 1) return 'Notes locationassignmentstatus';
    if (n <= 7) return `Notes locationassignmentstatus_${n}`;
    return `Notes locationassignmentstatusRow${n}`;
}

interface PaintJob {
    name: string;
    value: string;
    page?: number;
    /** Shrink-to-fit cells (resource rows) — wrap and reduce font size to fit. */
    fit?: boolean;
}

function collectPaintJobs(
    form: Ics201Form,
    sources: Pick<Ics201Sources, 'missionName' | 'missionGuid'>,
): PaintJob[] {
    const jobs: PaintJob[] = [
        { name: 'Incident Name', value: form.incidentName },
        { name: 'Incident Number', value: form.incidentNumber },
        { name: 'Date', value: form.date },
        { name: 'Time', value: form.time },
        { name: MAP_SKETCH_FIELD, value: buildMapSketchText(form, sources) },
        { name: SITUATION_FIELD, value: form.situationSummary },
        { name: OBJECTIVES_FIELD, value: form.objectives },
        { name: 'Incident Commanders', value: form.incidentCommanders },
        { name: 'Liaison Officer', value: form.liaisonOfficer },
        { name: 'Safety Officer', value: form.safetyOfficer },
        { name: 'Public Information Officer', value: form.publicInformationOfficer },
        { name: 'Planning Section Chief_2', value: form.planningSectionChief },
        { name: 'Operations Section Chief_2', value: form.operationsSectionChief },
        { name: 'FinanceAdministration Section Chief', value: form.financeSectionChief },
        { name: 'Logistics Section Chief', value: form.logisticsSectionChief },
        { name: ORG_NOTES_FIELD, value: form.organizationNotes },
    ];

    for (const suffix of ['', '_2', '_3', '_4']) {
        jobs.push(
            { name: `6 Prepared by Name${suffix}`, value: form.preparedByName },
            { name: `PositionTitle${suffix}`, value: form.positionTitle },
            { name: `Signature${suffix}`, value: form.signature },
            { name: `DateTime${suffix}`, value: form.preparedDateTime },
        );
    }

    for (let i = 0; i < MAX_RESOURCE_ROWS; i++) {
        const row = form.resources[i];
        if (!row) continue;
        const n = i + 1;
        jobs.push(
            { name: `ResourceRow${n}`, value: row.resource, page: 3, fit: true },
            { name: `Resource IdentifierRow${n}`, value: row.identifier, page: 3, fit: true },
            { name: `DateTime OrderedRow${n}`, value: row.dateTimeOrdered, page: 3, fit: true },
            { name: `ETARow${n}`, value: row.eta, page: 3, fit: true },
            { name: `Check Box${n}`, value: row.arrived ? 'X' : '', page: 3 },
            { name: notesFieldName(i), value: row.notes, page: 3, fit: true },
        );
    }

    return jobs;
}

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

/** Word-wrap collapsed action text to one PDF row width (no embedded line breaks). */
function wrapActionToRowWidth(text: string, font: PDFFont, maxWidth: number): string[] {
    const collapsed = toPdfWinAnsiText(collapseActionText(text));
    if (!collapsed) return [];
    const words = collapsed.split(' ').filter(Boolean);
    if (!words.length) return [];

    const lines: string[] = [];
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
    return lines;
}

/**
 * Expand §8 entries across multiple Time/Actions rows when text is wider than the cell.
 * Time is written only on the first line of each entry; later entries shift down.
 */
export function expandActionRowsForPdf(
    actions: Ics201ActionRow[],
    font: PDFFont,
    maxWidth: number,
): Ics201ActionRow[] {
    const out: Ics201ActionRow[] = [];
    for (const row of actions) {
        if (out.length >= MAX_ACTION_ROWS) break;
        const lines = wrapActionToRowWidth(row.actions, font, maxWidth);
        if (!lines.length) {
            if (row.time.trim()) out.push({ time: row.time.trim(), actions: '' });
            continue;
        }
        for (let i = 0; i < lines.length; i++) {
            if (out.length >= MAX_ACTION_ROWS) break;
            out.push({
                time: i === 0 ? row.time.trim() : '',
                actions: lines[i],
            });
        }
    }
    return out;
}

function actionsFieldContentWidth(form: BriefingPdfForm): number {
    const layouts = layoutsForField(form, 'ActionsRow1', 1);
    const width = layouts[0]?.w ?? 468;
    return Math.max(40, width - CELL_PAD * 2);
}

function paintActionRows(
    pages: PDFPage[],
    font: PDFFont,
    form: BriefingPdfForm,
    actions: Ics201ActionRow[],
): void {
    const maxWidth = actionsFieldContentWidth(form);
    const expanded = expandActionRowsForPdf(actions, font, maxWidth);
    for (let i = 0; i < expanded.length; i++) {
        const n = i + 1;
        paintNamedField(pages, font, form, `TimeRow${n}`, expanded[i].time, 1);
        paintNamedField(pages, font, form, `ActionsRow${n}`, expanded[i].actions, 1);
    }
}

/** Paint ICS 201 values onto the template using measured AcroForm widget boxes. */
export async function buildIcs201Pdf(
    form: Ics201Form,
    sources: Pick<Ics201Sources, 'missionName' | 'missionGuid'>,
): Promise<Uint8Array> {
    const templateBytes = await loadTemplateBytes();
    const templateDoc = await PDFDocument.load(templateBytes);
    const templatePdf = templateDoc as PDFDocument & {
        getForm(): BriefingPdfForm;
        getPageCount(): number;
    };
    const pdfForm = templatePdf.getForm();

    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);
    const pages: PDFPage[] = [];
    const pageCount = Math.min(OUTPUT_PAGE_COUNT, templatePdf.getPageCount());
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        pages.push(await embedTemplatePage(templateDoc, outDoc, pageIndex));
    }

    for (const job of collectPaintJobs(form, sources)) {
        paintNamedField(pages, font, pdfForm, job.name, job.value, job.page, job.fit);
    }
    paintActionRows(pages, font, pdfForm, form.actions);

    return outDoc.save();
}

export function defaultIcs201Filename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `ICS-201_${base}_${stamp}.pdf`;
}
