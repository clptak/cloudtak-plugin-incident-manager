/**
 * Initial Consensus respondent forms (#29): one page (or more, for many
 * segments) per respondent, laid out for that respondent's method, so the
 * group can fill them in on paper while the segments are still a sketch and
 * the planner keys them in afterwards.
 *
 * - Mattson: points for R.O.W. and each segment, totalling 100.
 * - O'Connor: R.O.W. as a percentage; one letter A–I circled per segment.
 * - Proportional: R.O.W. as a percentage; a 1–1000 rating per segment.
 *
 * The boxes are live form fields (#33) so the form can be filled on screen too.
 */

import { PDFDocument, rgb, StandardFonts } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import {
    methodLabel,
    OCONNOR_LETTERS,
    OCONNOR_SCALE,
    type ConsensusMethod,
} from './consensus.ts';
import { EditableFields } from './pdfFormFields.ts';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';

export interface ConsensusFormInput {
    incidentName: string;
    respondents: { name: string; method: ConsensusMethod }[];
    /** In display order. */
    segments: { callsign: string }[];
}

const PAGE: [number, number] = [612, 792];
const MARGIN = 50;
const ROW_H = 22;
const LINE = rgb(0.6, 0.6, 0.6);
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.35, 0.35, 0.35);

export function instructionsFor(method: ConsensusMethod): string {
    if (method === 'mattson') {
        return 'Each evaluator is allotted 100 points. Assign points to R.O.W. and each segment so that all '
            + '100 points are used. Higher probability areas should get more points.';
    }
    if (method === 'oconnor') {
        const scale = OCONNOR_LETTERS
            .filter((l) => OCONNOR_SCALE[l])
            .map((l) => `${l} ${OCONNOR_SCALE[l]}`)
            .join(', ');
        return `The R.O.W. requires a percentage. Circle one letter for each segment: ${scale} `
            + '(B, D, F and H fall between their neighbours).';
    }
    return 'The R.O.W. requires a percentage. Each segment requires a positive number from 1 to 1000. '
        + 'The numbers 1 and 1000 do not have to be used. It is not a percentage. If one segment has the '
        + 'number 100 and another the number 25, the subject is considered 4 times as likely to be in the '
        + 'first segment than the second.';
}

function valueHeading(method: ConsensusMethod): string {
    if (method === 'mattson') return 'Points';
    if (method === 'oconnor') return 'Letter (circle one)';
    return 'Rating (1-1000)';
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > width) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

export async function buildConsensusFormsPdf(input: ConsensusFormInput): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fields = new EditableFields(doc, font);
    const incident = toPdfWinAnsiText(input.incidentName.trim()) || 'Incident';
    const width = PAGE[0] - 2 * MARGIN;
    const total = input.respondents.length;

    input.respondents.forEach((resp, index) => {
        const prefix = `r${index + 1}_`;
        const method = resp.method;
        let page: PDFPage = doc.addPage(PAGE);
        let y = PAGE[1] - MARGIN;

        const text = (p: PDFPage, s: string, x: number, at: number, size = 10, f = font, color = INK) => {
            p.drawText(toPdfWinAnsiText(s), { x, y: at, size, font: f, color });
        };

        const header = (continued: boolean) => {
            text(page, 'INITIAL CONSENSUS - RESPONDENT FORM', MARGIN, y, 15, bold);
            const tag = `Responder ${index + 1} of ${total}${continued ? ' (continued)' : ''}`;
            text(page, tag, PAGE[0] - MARGIN - font.widthOfTextAtSize(tag, 10), y + 3);
            y -= 22;
            text(page, `Incident: ${incident}`, MARGIN, y);
            const m = `Method: ${methodLabel(method)}`;
            text(page, m, PAGE[0] - MARGIN - bold.widthOfTextAtSize(m, 10), y, 10, bold);
            y -= 22;
            text(page, 'Name:', MARGIN, y);
            page.drawLine({ start: { x: MARGIN + 34, y: y - 3 }, end: { x: MARGIN + 270, y: y - 3 }, thickness: 0.5, color: LINE });
            fields.add(`${prefix}Name`, page, { x: MARGIN + 36, y: y - 3, w: 232, h: 15 }, resp.name, { size: 10, link: true });
            text(page, 'Date/Time:', MARGIN + 300, y);
            page.drawLine({ start: { x: MARGIN + 352, y: y - 3 }, end: { x: PAGE[0] - MARGIN, y: y - 3 }, thickness: 0.5, color: LINE });
            fields.add(`${prefix}DateTime`, page, { x: MARGIN + 354, y: y - 3, w: PAGE[0] - MARGIN - (MARGIN + 356), h: 15 }, '', { size: 10, link: true });
            y -= 26;
        };

        const tableHead = () => {
            page.drawRectangle({ x: MARGIN, y: y - 6, width, height: ROW_H, color: rgb(0.92, 0.92, 0.92) });
            text(page, 'Segment', MARGIN + 6, y, 10, bold);
            text(page, valueHeading(method), MARGIN + 150, y, 10, bold);
            y -= ROW_H;
        };

        const ensureRoom = () => {
            if (y > MARGIN + ROW_H) return;
            page = doc.addPage(PAGE);
            y = PAGE[1] - MARGIN;
            header(true);
            tableHead();
        };

        const row = (label: string, fieldName: string, kind: 'row' | 'segment' | 'total') => {
            ensureRoom();
            page.drawLine({ start: { x: MARGIN, y: y - 6 }, end: { x: MARGIN + width, y: y - 6 }, thickness: 0.5, color: LINE });
            text(page, label, MARGIN + 6, y, 10, kind === 'segment' ? font : bold);
            const box = { x: MARGIN + 150, y: y - 4, w: 90, h: 16 };
            if (method === 'oconnor' && kind === 'segment') {
                OCONNOR_LETTERS.forEach((l, i) => text(page, l, MARGIN + 156 + i * 24, y, 11, bold));
                const lx = MARGIN + 156 + OCONNOR_LETTERS.length * 24 + 10;
                text(page, 'Letter:', lx, y, 9, font, MUTED);
                page.drawRectangle({ x: lx + 32, y: y - 4, width: 28, height: 16, borderColor: LINE, borderWidth: 0.5 });
                fields.add(fieldName, page, { x: lx + 32, y: y - 4, w: 28, h: 16 }, '', { size: 10 });
            } else if (kind === 'total') {
                text(page, '= 100', box.x + 6, y, 10, bold);
            } else {
                page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, borderColor: LINE, borderWidth: 0.5 });
                fields.add(fieldName, page, box, '', { size: 10 });
                const unit = kind === 'row' && method !== 'mattson' ? '%' : '';
                if (unit) text(page, unit, box.x + box.w + 4, y, 10);
            }
            y -= ROW_H;
        };

        header(false);
        for (const line of wrap(instructionsFor(method), font, 9.5, width)) {
            text(page, line, MARGIN, y, 9.5, font, MUTED);
            y -= 13;
        }
        y -= 10;
        tableHead();
        row('R.O.W.', `${prefix}ROW`, 'row');
        for (const seg of input.segments) row(`Seg. ${seg.callsign}`, `${prefix}Seg ${seg.callsign}`, 'segment');
        if (method === 'mattson') row('Total', `${prefix}Total`, 'total');
    });

    if (!input.respondents.length) doc.addPage(PAGE);
    fields.finish();
    return doc.save();
}

export function consensusFormsFilename(incidentName: string): string {
    const base = incidentName.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
    return `${base || 'incident'}-consensus-respondent-forms.pdf`;
}
