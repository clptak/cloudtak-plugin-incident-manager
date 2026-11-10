/**
 * ICS 204A Team Assignment Debriefing PDF (#17 phase 3). The form the user
 * supplied has no fillable fields, so this draws it with pdf-lib: the same
 * boxes in the same order on a letter page. A text box grows to fit what was
 * written, and the form continues on another page rather than cutting text.
 */

import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.esm.min.js';
import type { PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import { toPdfWinAnsiText } from './pdfWinAnsiText.ts';

/** Everything printed on the form, already as text. */
export interface Ics204aPdfData {
    incidentName: string;
    opNumber: string;
    taskNumber: string;
    assignmentNumber: string;
    taskName: string;
    dateCompleted: string;
    timeCompleted: string;
    teamName: string;
    teamLeader: string;
    /** "/S/ <team leader>" once the team leader has signed, else ''. */
    teamLeaderSignature: string;
    debriefedBy: string;
    actions: string;
    mapAttached: boolean;
    estimatedPod: string;
    podResponsive: string;
    podUnresponsive: string;
    clues: string;
    clueStatus: string;
    gaps: string;
    hazards: string;
    suggestions: string;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 40;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 36;
const W = PAGE_W - 2 * MARGIN_X;
const LABEL_SIZE = 8;
const VALUE_SIZE = 9.5;
const LINE_H = 12;
const PAD = 5;
const GAP = 8;
const GRID = rgb(0.15, 0.15, 0.15);
const SHADE = rgb(0.8, 0.8, 0.8);

interface Fonts {
    font: PDFFont;
    bold: PDFFont;
}

function clean(text: string): string {
    return toPdfWinAnsiText(text).replace(/\r\n?/g, '\n');
}

/** Word-wrap to a width, keeping the writer's line breaks. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const normalized = clean(text).trim();
    if (!normalized) return [];
    const lines: string[] = [];
    for (const paragraph of normalized.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
            lines.push('');
            continue;
        }
        let line = '';
        for (const word of words) {
            // A single word wider than the box is broken across lines.
            let rest = word;
            while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
                let cut = rest.length - 1;
                while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
                if (line) {
                    lines.push(line);
                    line = '';
                }
                lines.push(rest.slice(0, cut));
                rest = rest.slice(cut);
            }
            const next = line ? `${line} ${rest}` : rest;
            if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
            else {
                lines.push(line);
                line = rest;
            }
        }
        lines.push(line);
    }
    return lines;
}

function stroke(page: PDFPage, x: number, y: number, w: number, h: number, thickness = 0.9): void {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: GRID, borderWidth: thickness });
}

/** A header cell: small bold label, value on the line below (shrunk to fit). */
function cell(page: PDFPage, f: Fonts, x: number, top: number, w: number, h: number, label: string, value: string, opts: { title?: boolean; shade?: boolean } = {}): void {
    if (opts.shade) page.drawRectangle({ x, y: top - h, width: w, height: h, color: SHADE });
    stroke(page, x, top - h, w, h);
    const labelSize = opts.title ? 12 : LABEL_SIZE;
    page.drawText(clean(label), { x: x + PAD, y: top - PAD - labelSize, size: labelSize, font: f.bold });
    const val = clean(value).trim();
    if (!val) return;
    const maxW = w - 2 * PAD;
    let size = VALUE_SIZE;
    while (size > 6 && f.font.widthOfTextAtSize(val, size) > maxW) size -= 0.5;
    page.drawText(val, { x: x + PAD, y: top - h + PAD + 1, size, font: f.font });
}

/** Two stacked label/value pairs in one cell (Date / Time completed). */
function stackedCell(page: PDFPage, f: Fonts, x: number, top: number, w: number, h: number, rows: [string, string][]): void {
    stroke(page, x, top - h, w, h);
    rows.forEach(([label, value], i) => {
        const y = top - PAD - LABEL_SIZE - i * (h / 2);
        page.drawText(clean(label), { x: x + PAD, y, size: LABEL_SIZE, font: f.bold });
        const labelW = f.bold.widthOfTextAtSize(clean(label), LABEL_SIZE);
        if (value.trim()) page.drawText(clean(value).trim(), { x: x + PAD + labelW + 4, y, size: VALUE_SIZE, font: f.font });
    });
}

/** Page layout state: drawing moves down from `y`; a new page when it runs out. */
class Layout {
    page: PDFPage;
    y: number;
    pages = 1;
    /** Every page drawn, in order (the vendored pdf-lib types have no getPages). */
    all: PDFPage[] = [];
    private doc: PDFDocument;
    private f: Fonts;
    private data: Ics204aPdfData;

    constructor(doc: PDFDocument, f: Fonts, data: Ics204aPdfData) {
        this.doc = doc;
        this.f = f;
        this.data = data;
        this.page = doc.addPage([PAGE_W, PAGE_H]);
        this.all.push(this.page);
        this.y = PAGE_H - MARGIN_TOP;
        this.incidentLine();
    }

    private incidentLine(): void {
        const name = this.data.incidentName.trim();
        const text = name ? `Incident: ${name}` : '';
        if (text) this.page.drawText(clean(text), { x: MARGIN_X, y: this.y - 9, size: 9, font: this.f.font });
        if (this.pages > 1) {
            const cont = 'TEAM ASSIGNMENT DEBRIEFING (continued)';
            const cw = this.f.bold.widthOfTextAtSize(cont, 9);
            this.page.drawText(cont, { x: PAGE_W - MARGIN_X - cw, y: this.y - 9, size: 9, font: this.f.bold });
        }
        this.y -= 16;
    }

    room(): number {
        return this.y - MARGIN_BOTTOM;
    }

    newPage(): void {
        this.page = this.doc.addPage([PAGE_W, PAGE_H]);
        this.all.push(this.page);
        this.pages++;
        this.y = PAGE_H - MARGIN_TOP;
        this.incidentLine();
    }
}

/**
 * A full-width text box: label, then the wrapped text. It is at least
 * `minH` tall (the form's size) and grows to fit; text that does not fit on
 * this page continues in a box on the next one. `extra` draws a line at the
 * bottom of the box (Map attached).
 */
function textBox(l: Layout, f: Fonts, label: string, text: string, minH: number, extra?: string): void {
    const lines = wrapText(text, f.font, VALUE_SIZE, W - 2 * PAD);
    const head = PAD + LABEL_SIZE + 6;
    const tail = extra ? LINE_H + PAD : PAD;
    let remaining = lines;
    let first = true;
    for (;;) {
        const needed = head + remaining.length * LINE_H + tail;
        let h = Math.max(first ? minH : head + LINE_H + tail, needed);
        if (h > l.room()) {
            // Not enough room left: use what is there if a few lines fit, else a new page.
            const fit = Math.floor((l.room() - head - tail) / LINE_H);
            if (fit < 3) {
                l.newPage();
                continue;
            }
            h = l.room();
        }
        const fitLines = Math.floor((h - head - tail) / LINE_H);
        const now = remaining.slice(0, fitLines);
        const top = l.y;
        stroke(l.page, MARGIN_X, top - h, W, h);
        const title = first ? label : `${label} (continued)`;
        l.page.drawText(clean(title), { x: MARGIN_X + PAD, y: top - PAD - LABEL_SIZE, size: LABEL_SIZE, font: f.bold });
        now.forEach((line, i) => {
            if (line) l.page.drawText(line, { x: MARGIN_X + PAD, y: top - head - (i + 1) * LINE_H + 3, size: VALUE_SIZE, font: f.font });
        });
        remaining = remaining.slice(fitLines);
        const last = remaining.length === 0;
        if (extra && last) {
            l.page.drawText(clean(extra), { x: MARGIN_X + PAD + 14, y: top - h + PAD + 2, size: LABEL_SIZE + 1, font: f.font });
        }
        l.y = top - h;
        if (last) return;
        l.newPage();
        first = false;
    }
}

export async function buildIcs204aPdf(data: Ics204aPdfData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const f: Fonts = {
        font: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    const l = new Layout(doc, f, data);
    const x0 = MARGIN_X;
    const third = W / 3;

    // Header: three rows, as on the form.
    let top = l.y;
    const r1 = 38;
    cell(l.page, f, x0, top, W * 0.47, r1, 'TEAM ASSIGNMENT DEBRIEFING', '', { title: true });
    cell(l.page, f, x0 + W * 0.47, top, W * 0.21, r1, 'TASK #', data.taskNumber);
    cell(l.page, f, x0 + W * 0.68, top, W * 0.32, r1, 'FOR OPERATIONAL PERIOD #', data.opNumber);
    top -= r1;
    const r2 = 38;
    cell(l.page, f, x0, top, W * 0.25, r2, 'ASSIGNMENT #', data.assignmentNumber);
    cell(l.page, f, x0 + W * 0.25, top, W * 0.43, r2, 'TASK NAME', data.taskName);
    stackedCell(l.page, f, x0 + W * 0.68, top, W * 0.32, r2, [['DATE COMPLETED:', data.dateCompleted], ['TIME COMPLETED:', data.timeCompleted]]);
    top -= r2;
    const r3 = 34;
    cell(l.page, f, x0, top, W * 0.28, r3, 'TEAM NAME', data.teamName);
    cell(l.page, f, x0 + W * 0.28, top, W * 0.32, r3, 'TEAM LEADER', data.teamLeader);
    cell(l.page, f, x0 + W * 0.6, top, W * 0.4, r3, 'DEBRIEFED BY (PLANNING)', data.debriefedBy);
    top -= r3;
    l.y = top - GAP;

    textBox(l, f, 'EXPLAIN WHAT YOUR TEAM ACTUALLY DID (INCLUDE TIMES AND GPS COORDINATES IF AVAILABLE):', data.actions, 120,
        `MAP ATTACHED (Y): ${data.mapAttached ? 'Y' : ''}`);

    // POD row sits directly under the actions box, as on the form.
    const podH = 30;
    if (l.room() < podH) l.newPage();
    top = l.y;
    cell(l.page, f, x0, top, third, podH, 'ESTIMATED POD %', data.estimatedPod, { shade: true });
    cell(l.page, f, x0 + third, top, third, podH, 'IF RESPONSIVE:', data.podResponsive);
    cell(l.page, f, x0 + 2 * third, top, third, podH, 'IF NON-RESPONSIVE:', data.podUnresponsive);
    l.y = top - podH - GAP;

    textBox(l, f, 'DESCRIBE AND GIVE THE TIME AND LOCATION (GPS) OF ANY CLUES/ITEMS DISCOVERED:', data.clues, 80);
    textBox(l, f, 'CURRENT STATUS OF CLUES/ITEMS:', data.clueStatus, 52);
    l.y -= GAP;
    textBox(l, f, 'DESCRIBE DIFFICULTIES OR GAPS IN COVERAGE:', data.gaps, 72);
    l.y -= GAP;
    textBox(l, f, 'DESCRIBE ANY HAZARDS OR DANGERS IN SEARCH AREA(S)', data.hazards, 64);
    l.y -= GAP;
    textBox(l, f, 'SUGGESTIONS, IDEAS, RECOMMENDATIONS', data.suggestions, 64);

    // Signature row; left blank for the team leader to sign on paper.
    const sigH = 30;
    if (l.room() < sigH) l.newPage();
    top = l.y;
    cell(l.page, f, x0, top, W * 0.8, sigH, 'TEAM LEADER SIGNATURE:', data.teamLeaderSignature);
    stroke(l.page, x0 + W * 0.8, top - sigH, W * 0.2, sigH);
    const tag = 'ICS 204A';
    const tw = f.bold.widthOfTextAtSize(tag, 13);
    l.page.drawText(tag, { x: x0 + W * 0.9 - tw / 2, y: top - sigH / 2 - 4.5, size: 13, font: f.bold });

    // Page numbers only when the form ran onto more than one page.
    const pages = l.all;
    if (pages.length > 1) {
        pages.forEach((p: PDFPage, i: number) => {
            const label = `Page ${i + 1} of ${pages.length}`;
            const lw = f.font.widthOfTextAtSize(label, 8);
            p.drawText(label, { x: PAGE_W - MARGIN_X - lw, y: MARGIN_BOTTOM - 16, size: 8, font: f.font });
        });
    }

    return doc.save();
}
