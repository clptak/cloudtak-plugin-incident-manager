/**
 * Editable PDF form fields (#33): keep fields live in generated PDFs so a
 * form can be corrected on the fly in any PDF reader (Acrobat, Preview,
 * a browser) without regenerating it.
 *
 * Two jobs:
 * - Merging filled AcroForm templates into one document (the IAP). pdf-lib's
 *   copyPages brings a page's widgets across but not the form's field list,
 *   default font or default appearance, so readers would see dead boxes.
 *   Field names are made unique per section first; two ICS-204s with the
 *   same field names would otherwise mirror each other's edits.
 * - Creating fields on a page we paint ourselves (the ICS-201).
 */

import {
    PDFArray,
    PDFDict,
    PDFHexString,
    PDFName,
    PDFObjectCopier,
    PDFString,
} from '../vendor/pdf-lib.esm.min.js';
import type {
    PDFDocument,
    PDFFont,
    PDFObject,
    PDFPage,
    PDFRef,
    PDFTextField,
} from '../vendor/pdf-lib.esm.min.js';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';

const T = PDFName.of('T');
const PARENT = PDFName.of('Parent');
const SUBTYPE = PDFName.of('Subtype');
const FIELDS = PDFName.of('Fields');
const DR = PDFName.of('DR');
const DA = PDFName.of('DA');
const FONT = PDFName.of('Font');

function textOf(obj: PDFObject | undefined): string | undefined {
    return obj instanceof PDFString || obj instanceof PDFHexString ? obj.decodeText() : undefined;
}

/**
 * Prefix every top-level field name. A dot is the PDF hierarchy separator,
 * so prefixes should not contain one ("s3_", not "s3.").
 */
export function prefixFieldNames(doc: PDFDocument, prefix: string): void {
    const fields = doc.getForm().acroForm.dict.lookup(FIELDS);
    if (!(fields instanceof PDFArray)) return;
    for (let i = 0; i < fields.size(); i++) {
        const field = doc.context.lookup(fields.get(i));
        if (!(field instanceof PDFDict)) continue;
        const name = textOf(field.get(T));
        if (name !== undefined) field.set(T, PDFHexString.fromText(`${prefix}${name}`));
    }
}

function dictIn(out: PDFDocument, parent: PDFDict, key: PDFName): PDFDict {
    const found = out.context.lookup(parent.get(key));
    if (found instanceof PDFDict) return found;
    const made = out.context.obj({});
    parent.set(key, made);
    return made;
}

/**
 * Register the fields behind the widgets on `pages` (already copied from
 * `src` into `out`) with `out`'s form, and carry over the fonts and default
 * appearance readers use when the user types.
 */
export function adoptFormFields(out: PDFDocument, src: PDFDocument, pages: PDFPage[]): void {
    const roots = new Set<PDFRef>();
    for (const page of pages) {
        const annots = page.node.Annots();
        if (!annots) continue;
        for (let i = 0; i < annots.size(); i++) {
            let ref = annots.get(i);
            const widget = out.context.lookup(ref);
            if (!(widget instanceof PDFDict) || String(widget.get(SUBTYPE)) !== '/Widget') continue;
            let dict: PDFDict = widget;
            // Walk up to the top-level field: that is what /Fields lists.
            for (let parent = dict.get(PARENT); parent; parent = dict.get(PARENT)) {
                const up = out.context.lookup(parent);
                if (!(up instanceof PDFDict)) break;
                ref = parent;
                dict = up;
            }
            roots.add(ref as PDFRef);
        }
    }
    if (!roots.size) return;

    const outForm = out.getForm();
    for (const ref of roots) outForm.acroForm.addField(ref);

    const srcAcro = src.getForm().acroForm.dict;
    const outAcro = outForm.acroForm.dict;
    const srcDr = src.context.lookup(srcAcro.get(DR));
    if (srcDr instanceof PDFDict) {
        const copied = PDFObjectCopier.for(src.context, out.context).copy(srcDr);
        const srcFonts = out.context.lookup(copied.get(FONT));
        if (srcFonts instanceof PDFDict) {
            const fonts = dictIn(out, dictIn(out, outAcro, DR), FONT);
            for (const [key, value] of srcFonts.entries()) {
                if (!fonts.get(key)) fonts.set(key, value);
            }
        }
    }
    const da = srcAcro.get(DA);
    if (da && !outAcro.get(DA)) outAcro.set(DA, da);
}

export interface FieldBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Text fields placed over a page we draw ourselves. A name used again with
 * `link` adds another box to the same field (a header repeated on every
 * page stays in step); otherwise the name gets a numbered suffix.
 */
export class EditableFields {
    private readonly fields = new Map<string, PDFTextField>();
    private readonly doc: PDFDocument;
    private readonly font: PDFFont;

    constructor(doc: PDFDocument, font: PDFFont) {
        this.doc = doc;
        this.font = font;
    }

    add(name: string, page: PDFPage, box: FieldBox, value: string, opts: {
        size: number;
        multiline?: boolean;
        link?: boolean;
    }): void {
        let field = opts.link ? this.fields.get(name) : undefined;
        if (!field) {
            let unique = name;
            for (let n = 2; this.fields.has(unique); n++) unique = `${name} (${n})`;
            field = this.doc.getForm().createTextField(unique);
            if (opts.multiline) field.enableMultiline();
            const text = toPdfWinAnsiText(value).trim();
            if (text) field.setText(text);
            this.fields.set(unique, field);
        }
        field.addToPage(page, {
            x: box.x,
            y: box.y,
            width: box.w,
            height: box.h,
            font: this.font,
            // Transparent and borderless: the template's own lines show through.
            backgroundColor: undefined,
            borderColor: undefined,
            borderWidth: 0,
        });
        field.setFontSize(opts.size);
    }

    /** Draw every field's appearance so it shows before anyone clicks it. */
    finish(): void {
        this.doc.getForm().updateFieldAppearances(this.font);
    }
}
