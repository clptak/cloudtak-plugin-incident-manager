import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PDFDocument } from '../vendor/pdf-lib.esm.min.js';
import { buildConsensusFormsPdf, consensusFormsFilename, instructionsFor } from './consensusFormPdf.ts';

test('one form per respondent, fields named per respondent and method', async () => {
    const bytes = await buildConsensusFormsPdf({
        incidentName: 'Hiker – Ridge',
        respondents: [
            { name: 'Avery', method: 'mattson' },
            { name: 'Responder 2', method: 'oconnor' },
            { name: 'Sam', method: 'proportional' },
        ],
        segments: [{ callsign: '1' }, { callsign: '2' }],
    });
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 3);
    const form = doc.getForm();
    const names = form.getFields().map((f) => f.getName()).sort();
    assert.ok(names.includes('r1_Name'));
    assert.ok(names.includes('r1_ROW'));
    assert.ok(names.includes('r1_Seg 2'));
    assert.ok(names.includes('r2_Seg 1'));
    assert.ok(names.includes('r3_ROW'));
    // The Mattson total is printed (= 100), not a field.
    assert.ok(!names.includes('r1_Total'));
    assert.equal(form.getTextField('r1_Name').getText(), 'Avery');
});

test('many segments continue onto more pages with the name kept in step', async () => {
    const segments = Array.from({ length: 60 }, (_, i) => ({ callsign: String(i + 1) }));
    const doc = await PDFDocument.load(await buildConsensusFormsPdf({
        incidentName: 'Big',
        respondents: [{ name: 'Avery', method: 'oconnor' }],
        segments,
    }));
    assert.ok(doc.getPageCount() >= 2);
    const form = doc.getForm();
    assert.equal(form.getTextField('r1_Name').getText(), 'Avery');
    assert.ok(form.getFields().some((f) => f.getName() === 'r1_Seg 60'));
});

test('instructions match each method', () => {
    assert.match(instructionsFor('mattson'), /100 points/);
    assert.match(instructionsFor('oconnor'), /A very likely.*I very unlikely/);
    assert.match(instructionsFor('proportional'), /1 to 1000/);
    assert.equal(consensusFormsFilename('Hiker / Ridge'), 'Hiker_Ridge-consensus-respondent-forms.pdf');
});
