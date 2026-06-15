/** Rows exported from the Dashboard log table. */
export interface DashboardExportRow {
    epoch: number;
    content: string;
    source: string;
    keywords: string[];
}

const LOCAL_TIME_OPTS: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
};

/** Format a log timestamp in the browser's local timezone. */
export function formatLocalTime(epoch: number, raw?: string): string {
    if (epoch > 0) {
        return new Date(epoch).toLocaleString(undefined, LOCAL_TIME_OPTS);
    }
    if (raw) return raw;
    return '';
}

function safeFilename(name: string): string {
    return name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'mission';
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
}

export function exportDashboardCsv(
    rows: DashboardExportRow[],
    missionName: string,
): void {
    const header = ['Time', 'Entry', 'Source', 'Keywords'];
    const lines = [
        header.map(csvEscape).join(','),
        ...rows.map((r) => [
            formatLocalTime(r.epoch),
            r.content,
            r.source,
            r.keywords.join('; '),
        ].map(csvEscape).join(',')),
    ];
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `${safeFilename(missionName)}-dashboard.csv`);
}

// ---- Minimal landscape PDF (no external deps) --------------------------------

const PAGE_W = 792;  // landscape letter
const PAGE_H = 612;
const MARGIN = 36;
const FONT_SIZE = 8;
const LINE_H = 10;
const HEADER_H = 14;

/** Approximate average glyph width for Helvetica at a given size (pt). */
function charWidth(size: number): number {
    return size * 0.48;
}

function wrapText(text: string, maxWidth: number, size = FONT_SIZE): string[] {
    const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!s.trim()) return [''];
    const lines: string[] = [];
    for (const paragraph of s.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
            lines.push('');
            continue;
        }
        let line = words[0];
        for (let i = 1; i < words.length; i++) {
            const next = `${line} ${words[i]}`;
            if (next.length * charWidth(size) <= maxWidth) {
                line = next;
            } else {
                lines.push(line);
                line = words[i];
            }
        }
        lines.push(line);
    }
    return lines.length ? lines : [''];
}

function escapePdfText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

interface PdfCell {
    lines: string[];
    height: number;
}

function layoutRow(
    cols: string[],
    widths: number[],
): { cells: PdfCell[]; rowHeight: number } {
    const cells = cols.map((text, i) => {
        const lines = wrapText(text, widths[i] - 4);
        const height = Math.max(LINE_H, lines.length * LINE_H);
        return { lines, height };
    });
    const rowHeight = Math.max(...cells.map((c) => c.height), LINE_H);
    return { cells, rowHeight };
}

function buildPdf(rows: DashboardExportRow[], missionName: string, exportedAt: string): string {
    const contentW = PAGE_W - MARGIN * 2;
    const colWidths = [
        contentW * 0.12,  // Time
        contentW * 0.58,  // Entry (majority)
        contentW * 0.14,  // Source
        contentW * 0.16,  // Keywords
    ];
    const colX = [
        MARGIN,
        MARGIN + colWidths[0],
        MARGIN + colWidths[0] + colWidths[1],
        MARGIN + colWidths[0] + colWidths[1] + colWidths[2],
    ];

    const headerLabels = ['Time', 'Entry', 'Source', 'Keywords'];
    const bodyRows = rows.map((r) => [
        formatLocalTime(r.epoch),
        r.content,
        r.source,
        r.keywords.join(', '),
    ]);

    type PageOp = string;
    const pages: PageOp[][] = [[]];
    let y = PAGE_H - MARGIN;

    function newPage(): void {
        pages.push([]);
        y = PAGE_H - MARGIN;
    }

    function ensureSpace(need: number): void {
        if (y - need < MARGIN) newPage();
    }

    function addText(x: number, baselineY: number, text: string, size = FONT_SIZE, bold = false): void {
        const font = bold ? '/F2' : '/F1';
        pages[pages.length - 1].push(
            `BT ${font} ${size} Tf ${x.toFixed(2)} ${baselineY.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`,
        );
    }

    function addLine(x1: number, y1: number, x2: number, y2: number): void {
        pages[pages.length - 1].push(
            `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
        );
    }

    // Title block on first page
    addText(MARGIN, y, `Dashboard — ${missionName}`, 11, true);
    y -= 14;
    addText(MARGIN, y, `Exported ${exportedAt} (local time)`, 8, false);
    y -= 18;
    addLine(MARGIN, y, PAGE_W - MARGIN, y);
    y -= 10;

    // Table header
    ensureSpace(HEADER_H);
    for (let c = 0; c < headerLabels.length; c++) {
        addText(colX[c] + 2, y, headerLabels[c], FONT_SIZE, true);
    }
    y -= HEADER_H;
    addLine(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);

    for (const cols of bodyRows) {
        const { cells, rowHeight } = layoutRow(cols, colWidths);
        ensureSpace(rowHeight + 4);
        const rowTop = y;
        for (let c = 0; c < cells.length; c++) {
            let lineY = rowTop;
            for (const line of cells[c].lines) {
                addText(colX[c] + 2, lineY, line);
                lineY -= LINE_H;
            }
        }
        y -= rowHeight + 2;
        addLine(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
    }

    // Serialize PDF objects
    const objects: string[] = [];
    const offsets: number[] = [0];

    function addObject(body: string): number {
        const id = objects.length + 1;
        objects.push(`${id} 0 obj\n${body}\nendobj\n`);
        return id;
    }

    const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const pageIds: number[] = [];
    for (let p = 0; p < pages.length; p++) {
        const ops = [
            'q',
            '0.5 w',
            ...pages[p],
            'Q',
        ].join('\n');
        const contentId = addObject(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`);
        const pageId = addObject(
            `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] `
            + `/Contents ${contentId} 0 R `
            + `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
        );
        pageIds.push(pageId);
    }

    const pagesId = addObject(
        `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
    );
    // Fix page Parent references (written as placeholder above)
    for (let i = 0; i < pageIds.length; i++) {
        const idx = pageIds[i] - 1;
        objects[idx] = objects[idx].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
    }

    const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = '%PDF-1.4\n';
    for (const obj of objects) {
        offsets.push(pdf.length);
        pdf += obj;
    }

    const xrefPos = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
    pdf += `startxref\n${xrefPos}\n%%EOF\n`;

    return pdf;
}

export function exportDashboardPdf(
    rows: DashboardExportRow[],
    missionName: string,
): void {
    const exportedAt = new Date().toLocaleString(undefined, LOCAL_TIME_OPTS);
    const pdf = buildPdf(rows, missionName, exportedAt);
    const blob = new Blob([pdf], { type: 'application/pdf' });
    downloadBlob(blob, `${safeFilename(missionName)}-dashboard.pdf`);
}
