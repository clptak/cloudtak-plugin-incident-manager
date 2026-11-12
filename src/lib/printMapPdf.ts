/**
 * Place a rendered print map into a PDF box (#28): the image, a thin frame,
 * a north arrow (maps print north-up) and a US scale bar.
 */

import { rgb } from '../vendor/pdf-lib.esm.min.js';
import type { PDFDocument, PDFFont, PDFPage } from '../vendor/pdf-lib.esm.min.js';
import type { PrintMapImage } from './printMap.ts';
import { scaleBar } from './printMapFrame.ts';

export interface PdfRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const INK = rgb(0.1, 0.1, 0.1);
const PAPER = rgb(1, 1, 1);

export async function drawPrintMap(
    doc: PDFDocument,
    page: PDFPage,
    font: PDFFont,
    map: PrintMapImage,
    rect: PdfRect,
): Promise<void> {
    const image = await doc.embedJpg(map.jpeg);
    page.drawImage(image, rect);
    page.drawRectangle({ ...rect, borderColor: INK, borderWidth: 0.75 });

    // North arrow, top right.
    const ax = rect.x + rect.width - 22;
    const ay = rect.y + rect.height - 8;
    page.drawRectangle({ x: ax - 8, y: ay - 30, width: 26, height: 30, color: PAPER, opacity: 0.85 });
    page.drawSvgPath('M 5 0 L 10 16 L 5 12 L 0 16 Z', { x: ax, y: ay - 3, color: INK });
    page.drawText('N', { x: ax + 1.6, y: ay - 27, size: 8, font, color: INK });

    // Scale bar, bottom left. metersPerPt is for the image as rendered; the
    // box may scale it a little.
    const metersPerPt = map.metersPerPt * (map.widthPt / rect.width);
    const bar = scaleBar(metersPerPt, Math.min(120, rect.width / 3));
    if (bar) {
        const bx = rect.x + 8;
        const by = rect.y + 8;
        const labelW = font.widthOfTextAtSize(bar.label, 7);
        page.drawRectangle({ x: bx - 4, y: by - 4, width: bar.length + labelW + 16, height: 16, color: PAPER, opacity: 0.85 });
        page.drawRectangle({ x: bx, y: by, width: bar.length / 2, height: 3, color: INK });
        page.drawRectangle({ x: bx + bar.length / 2, y: by, width: bar.length / 2, height: 3, borderColor: INK, borderWidth: 0.5, color: PAPER });
        page.drawText(bar.label, { x: bx + bar.length + 5, y: by, size: 7, font, color: INK });
    }
}
