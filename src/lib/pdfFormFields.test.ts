import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PDFDocument, StandardFonts } from '../vendor/pdf-lib.esm.min.js';
import { adoptFormFields, EditableFields, prefixFieldNames } from './pdfFormFields.ts';

/** A one-page "template" with fields, filled like an ICS form. */
async function filledTemplate(values: Record<string, string>): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    let y = 700;
    for (const [name, value] of Object.entries(values)) {
        const field = doc.getForm().createTextField(name);
        field.addToPage(page, { x: 50, y, width: 200, height: 20, font });
        field.setText(value);
        y -= 30;
    }
    doc.getForm().updateFieldAppearances(font);
    return doc;
}

async function reload(doc: PDFDocument): Promise<Map<string, string | undefined>> {
    const back = await PDFDocument.load(await doc.save());
    const form = back.getForm();
    return new Map(form.getFields().map((f) => [f.getName(), form.getTextField(f.getName()).getText()]));
}

test('two copies of one form merge as separate, editable fields', async () => {
    const out = await PDFDocument.create();
    for (const [i, team] of ['Team 1', 'Team 2'].entries()) {
        const src = await filledTemplate({ 'Incident Name': 'Hiker', Resource: team });
        prefixFieldNames(src, `s${i + 1}_`);
        const pages = await out.copyPages(src, [0]);
        for (const p of pages) out.addPage(p as unknown as [number, number]);
        adoptFormFields(out, src, pages);
    }
    const fields = await reload(out);
    assert.deepEqual([...fields.keys()].sort(), ['s1_Incident Name', 's1_Resource', 's2_Incident Name', 's2_Resource']);
    assert.equal(fields.get('s1_Resource'), 'Team 1');
    assert.equal(fields.get('s2_Resource'), 'Team 2');
});

test('copied pages without adopting have no form fields (why adopt exists)', async () => {
    const out = await PDFDocument.create();
    const src = await filledTemplate({ Resource: 'Team 1' });
    for (const p of await out.copyPages(src, [0])) out.addPage(p as unknown as [number, number]);
    assert.equal((await reload(out)).size, 0);
});

test('EditableFields links repeated headers and numbers the rest', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const [p1, p2] = [doc.addPage([612, 792]), doc.addPage([612, 792])];
    const fields = new EditableFields(doc, font);
    const box = { x: 50, y: 700, w: 200, h: 14 };
    fields.add('Incident Name', p1, box, 'Hiker', { size: 9, link: true });
    fields.add('Incident Name', p2, box, 'Hiker', { size: 9, link: true });
    fields.add('TimeRow1', p1, box, '0800', { size: 9 });
    fields.add('TimeRow1', p2, box, '', { size: 9 });
    fields.add('Notes', p1, { ...box, h: 60 }, 'Smart — quotes “ok”', { size: 9, multiline: true });
    fields.finish();

    const back = await reload(doc);
    assert.deepEqual([...back.keys()].sort(), ['Incident Name', 'Notes', 'TimeRow1', 'TimeRow1 (2)']);
    assert.equal(back.get('Incident Name'), 'Hiker');
    assert.equal(back.get('TimeRow1'), '0800');
    assert.equal(back.get('TimeRow1 (2)'), undefined);
    // Text a standard font can't encode is converted, not thrown on.
    assert.ok(back.get('Notes')?.includes('quotes'));
});
