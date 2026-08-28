/**
 * IAP generator: fills the official ICS AcroForm templates (docs-archive/ → assets)
 * and merges them into one per-operational-period Incident Action Plan PDF.
 *
 * Each form is filled, flattened (values baked into page content so the
 * briefing PDF prints identically everywhere), then copied into the output
 * document in IAP order. Missing field names are ignored rather than throwing:
 * the official templates get revised, and a renamed field should degrade to a
 * blank box, never a failed export.
 */

import { PDFDocument, StandardFonts } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFForm } from '../vendor/pdf-lib.esm.min.js';
import ics202Url from '../assets/iap/ics202.pdf?url';
import ics203Url from '../assets/iap/ics203.pdf?url';
import ics204Url from '../assets/iap/ics204.pdf?url';
import ics205Url from '../assets/iap/ics205.pdf?url';
import ics205aUrl from '../assets/iap/ics205a.pdf?url';
import ics206Url from '../assets/iap/ics206.pdf?url';
import ics207Url from '../assets/iap/ics207.pdf?url';
import ics208Url from '../assets/iap/ics208.pdf?url';
import ics209Url from '../assets/iap/ics209.pdf?url';
import ics220Url from '../assets/iap/ics220-uas.pdf?url';
import { describeSave, saveGeneratedFile } from './fileTarget.ts';

export type IapFormId =
    | 'ics202' | 'ics203' | 'ics204' | 'ics205' | 'ics205a'
    | 'ics206' | 'ics207' | 'ics208' | 'ics209' | 'ics220';

const TEMPLATE_URLS: Record<IapFormId, string> = {
    ics202: ics202Url,
    ics203: ics203Url,
    ics204: ics204Url,
    ics205: ics205Url,
    ics205a: ics205aUrl,
    ics206: ics206Url,
    ics207: ics207Url,
    ics208: ics208Url,
    ics209: ics209Url,
    ics220: ics220Url,
};

export interface FilledForm {
    /** Text field name → value. Unknown names are skipped. */
    text: Record<string, string>;
    /** Check box field names to check. Unknown names are skipped. */
    check?: string[];
    /** Pages to keep (0-based). ICS templates carry instruction pages we drop. */
    pages?: number[];
    /**
     * Field carrying "IAP Page x of y" on this template. Filled during
     * assembly, once the final page count is known.
     */
    pageField?: string;
}

async function loadTemplate(id: IapFormId): Promise<PDFDocument> {
    const res = await fetch(TEMPLATE_URLS[id]);
    if (!res.ok) throw new Error(`Failed to load ${id} template`);
    return PDFDocument.load(await res.arrayBuffer());
}

const MAX_FONT = 10;
const MIN_FONT = 4;

/**
 * Shrink the field's font until the text fits its box. The official ICS forms
 * have small, fixed-size boxes and real SAR content (objectives, work
 * assignments) overflows them at a fixed size — so measure and scale.
 */
function fitFontSize(
    field: { acroField: { getWidgets(): { getRectangle(): { width: number; height: number } }[] };
        isMultiline?(): boolean },
    text: string,
    font: PDFFont,
): number {
    let rect: { width: number; height: number };
    try {
        rect = field.acroField.getWidgets()[0].getRectangle();
    } catch {
        return MAX_FONT;
    }
    const usableW = Math.max(1, rect.width - 4);
    const usableH = Math.max(1, rect.height - 4);
    const multiline = (() => {
        try { return field.isMultiline?.() === true; } catch { return false; }
    })() || text.includes('\n') || rect.height > 24;

    for (let size = MAX_FONT; size > MIN_FONT; size -= 0.5) {
        if (!multiline) {
            if (font.widthOfTextAtSize(text, size) <= usableW) return size;
            continue;
        }
        // Wrap into lines at this size and check the stack height.
        const lineHeight = size * 1.15;
        let lines = 0;
        for (const paragraph of text.split('\n')) {
            let current = '';
            let used = 1;
            for (const word of paragraph.split(/\s+/)) {
                const candidate = current ? `${current} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= usableW) {
                    current = candidate;
                } else {
                    used += 1;
                    current = word;
                }
            }
            lines += used;
        }
        if (lines * lineHeight <= usableH) return size;
    }
    return MIN_FONT;
}

function setText(form: PDFForm, name: string, value: string, font?: PDFFont): void {
    if (!value) return;
    try {
        const field = form.getTextField(name);
        field.setText(value);
        if (font) {
            if (value.includes('\n')) {
                try { field.enableMultiline(); } catch { /* single-line field */ }
            }
            field.setFontSize(fitFontSize(field as never, value, font));
        }
    } catch {
        // Field absent in this template revision — leave it blank.
    }
}

function setCheck(form: PDFForm, name: string): void {
    try {
        form.getCheckBox(name).check();
    } catch {
        // Absent or not a checkbox — skip.
    }
}

/** Fill one template and return a flattened single-form document. */
export async function fillIcsForm(id: IapFormId, filled: FilledForm): Promise<PDFDocument> {
    const doc = await loadTemplate(id);
    const form = doc.getForm();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);

    for (const [name, value] of Object.entries(filled.text)) setText(form, name, value, helvetica);
    for (const name of filled.check ?? []) setCheck(form, name);

    try {
        form.updateFieldAppearances(helvetica);
    } catch {
        // Some templates carry their own appearance streams.
    }
    form.flatten();
    return doc;
}

export interface IapSection {
    id: IapFormId;
    filled: FilledForm;
    /**
     * Field name carrying "IAP Page x of y" on this template. The builder
     * fills it during assembly, when the final page count is known.
     */
    pageField?: string;
}

/**
 * Build the merged IAP document. Sections are emitted in the given order;
 * `pages` limits which pages of a template are carried over (ICS templates
 * ship instruction pages after the form itself).
 */
export async function buildIapPdf(sections: IapSection[]): Promise<Uint8Array> {
    const out = await PDFDocument.create();

    // Pages are numbered sequentially across the assembled IAP (1 of N),
    // not per operational period.
    const total = sections.reduce((n, s) => n + (s.filled.pages?.length || 1), 0);
    let pageNo = 0;

    for (const section of sections) {
        const count = section.filled.pages?.length || 1;
        const pageField = section.filled.pageField ?? section.pageField;
        if (pageField) {
            const label = count === 1
                ? `${pageNo + 1} of ${total}`
                : `${pageNo + 1}-${pageNo + count} of ${total}`;
            section.filled.text[pageField] = label;
        }
        pageNo += count;

        const filledDoc = await fillIcsForm(section.id, section.filled);
        const templatePages = filledDoc.getPageCount();
        const wanted = (section.filled.pages ?? [0])
            .filter((i) => Number.isInteger(i) && i >= 0 && i < templatePages);
        const indices = wanted.length ? wanted : [0];
        const copied = await out.copyPages(filledDoc, indices);
        for (const page of copied) out.addPage(page as unknown as [number, number]);
    }

    return out.save();
}

/**
 * Save the generated IAP to the case file folder when configured, else
 * download it. Returns a sentence describing where it went.
 */
export async function saveIapPdf(
    bytes: Uint8Array,
    filename: string,
    incidentName?: string,
): Promise<string> {
    const saved = await saveGeneratedFile(bytes, filename, {
        mime: 'application/pdf',
        subfolder: incidentName,
    });
    return describeSave(saved);
}
