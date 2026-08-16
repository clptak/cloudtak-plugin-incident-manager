/**
 * IAP generator: fills the official ICS AcroForm templates (docs/ → assets)
 * and merges them into one per-operational-period Incident Action Plan PDF.
 *
 * Each form is filled, flattened (values baked into page content so the
 * briefing PDF prints identically everywhere), then copied into the output
 * document in IAP order. Missing field names are ignored rather than throwing:
 * the official templates get revised, and a renamed field should degrade to a
 * blank box, never a failed export.
 */

import { PDFDocument, StandardFonts } from '../vendor/pdf-lib.esm.min.js';
import type { PDFForm } from '../vendor/pdf-lib.esm.min.js';
import ics202Url from '../assets/iap/ics202.pdf?url';
import ics203Url from '../assets/iap/ics203.pdf?url';
import ics204Url from '../assets/iap/ics204.pdf?url';
import ics205Url from '../assets/iap/ics205.pdf?url';
import ics206Url from '../assets/iap/ics206.pdf?url';
import ics207Url from '../assets/iap/ics207.pdf?url';
import ics208Url from '../assets/iap/ics208.pdf?url';
import ics209Url from '../assets/iap/ics209.pdf?url';
import ics220Url from '../assets/iap/ics220-uas.pdf?url';
import { describeSave, saveGeneratedFile } from './fileTarget.ts';

export type IapFormId =
    | 'ics202' | 'ics203' | 'ics204' | 'ics205'
    | 'ics206' | 'ics207' | 'ics208' | 'ics209' | 'ics220';

const TEMPLATE_URLS: Record<IapFormId, string> = {
    ics202: ics202Url,
    ics203: ics203Url,
    ics204: ics204Url,
    ics205: ics205Url,
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
}

async function loadTemplate(id: IapFormId): Promise<PDFDocument> {
    const res = await fetch(TEMPLATE_URLS[id]);
    if (!res.ok) throw new Error(`Failed to load ${id} template`);
    return PDFDocument.load(await res.arrayBuffer());
}

function setText(form: PDFForm, name: string, value: string): void {
    if (!value) return;
    try {
        form.getTextField(name).setText(value);
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

    for (const [name, value] of Object.entries(filled.text)) setText(form, name, value);
    for (const name of filled.check ?? []) setCheck(form, name);

    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
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
}

/**
 * Build the merged IAP document. Sections are emitted in the given order;
 * `pages` limits which pages of a template are carried over (ICS templates
 * ship instruction pages after the form itself).
 */
export async function buildIapPdf(sections: IapSection[]): Promise<Uint8Array> {
    const out = await PDFDocument.create();

    for (const section of sections) {
        const filledDoc = await fillIcsForm(section.id, section.filled);
        const total = filledDoc.getPageCount();
        const wanted = (section.filled.pages ?? [0])
            .filter((i) => Number.isInteger(i) && i >= 0 && i < total);
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
