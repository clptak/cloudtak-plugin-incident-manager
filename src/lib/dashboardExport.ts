import {
    formatTeamRosterChild,
    resourceAssignmentDetailRows,
    workAssignmentDetailRows,
    type DashboardTeamRoster,
} from './dashboardPanels.ts';
import {
    initialInfoDetailRows,
    type IncidentInfoForm,
} from './incidentInfo.ts';
import type { ResourceAssignment } from './resourceAssignments.ts';
import {
    displaySubjectNumber,
    subjectDetailRows,
    type ParsedSubject,
} from './subjectInfo.ts';
import type { WorkAssignment } from './workAssignments.ts';

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
    subjects: ParsedSubject[] = [],
    teams: DashboardTeamRoster[] = [],
    resourceAssignments: ResourceAssignment[] = [],
    workAssignments: WorkAssignment[] = [],
): void {
    const lines: string[] = [];

    if (subjects.length) {
        lines.push(csvEscape('Subject Information'));
        for (const s of subjects) {
            lines.push(csvEscape(`Subject ${displaySubjectNumber(s.subjectCaseID)}`));
            for (const row of subjectDetailRows(s)) {
                lines.push([csvEscape(row.label), csvEscape(row.value)].join(','));
            }
            lines.push('');
        }
    }

    const header = ['Time', 'Entry', 'Source', 'Keywords'];
    lines.push(header.map(csvEscape).join(','));
    lines.push(...rows.map((r) => [
        formatLocalTime(r.epoch),
        r.content,
        r.source,
        r.keywords.join('; '),
    ].map(csvEscape).join(',')));

    if (teams.length) {
        lines.push('');
        lines.push(csvEscape('Teams'));
        for (const team of teams) {
            lines.push(csvEscape(team.title));
            for (const child of team.children) {
                lines.push(csvEscape(formatTeamRosterChild(child)));
            }
            lines.push('');
        }
    }

    if (resourceAssignments.length) {
        lines.push(csvEscape('Resource Assignments'));
        for (const assignment of resourceAssignments) {
            lines.push(csvEscape(assignment.resourceIdentifier));
            for (const row of resourceAssignmentDetailRows(assignment)) {
                lines.push([csvEscape(row.label), csvEscape(row.value)].join(','));
            }
            lines.push('');
        }
    }

    if (workAssignments.length) {
        lines.push(csvEscape('Work Assignments'));
        for (const assignment of workAssignments) {
            lines.push(csvEscape(`Assignment ${assignment.assignmentNumber}`));
            for (const row of workAssignmentDetailRows(assignment)) {
                lines.push([csvEscape(row.label), csvEscape(row.value)].join(','));
            }
            lines.push('');
        }
    }

    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `${safeFilename(missionName)}-dashboard.csv`);
}

// ---- Minimal landscape PDF (no external deps) --------------------------------

const PAGE_W = 792;  // landscape letter
const PAGE_H = 612;
const MARGIN = 36;
const FONT_SIZE = 8;
const LINE_H = 11;
const ROW_VPAD = 5;       // gap between horizontal rule and text
const FONT_ASCENT = 7;    // ~cap height for 8pt Helvetica (baseline → top of glyphs)
const HEADER_H = LINE_H + ROW_VPAD * 2;

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

interface PdfDetailLine {
    text: string;
    size: number;
    bold: boolean;
}

interface PdfGridLine {
    text: string;
    size?: number;
    bold?: boolean;
}

function detailSectionLines(
    title: string,
    rows: Array<{ label: string; value: string }>,
    titleSize = 9,
): PdfDetailLine[] {
    if (!rows.length) return [];
    const lines: PdfDetailLine[] = [{ text: title, size: titleSize, bold: true }];
    for (const row of rows) {
        lines.push({ text: `${row.label}: ${row.value}`, size: FONT_SIZE, bold: false });
    }
    return lines;
}

/** PDF log table: only source:/uid: keywords in the Source column. */
function pdfSourceKeywords(keywords: string[]): string {
    return keywords
        .filter((k) => k.startsWith('source:') || k.startsWith('uid:'))
        .join(', ');
}

function buildPdf(
    rows: DashboardExportRow[],
    missionName: string,
    exportedAt: string,
    subjects: ParsedSubject[] = [],
    initialInfo?: IncidentInfoForm | null,
    teams: DashboardTeamRoster[] = [],
    resourceAssignments: ResourceAssignment[] = [],
    workAssignments: WorkAssignment[] = [],
): string {
    const contentW = PAGE_W - MARGIN * 2;
    const colWidths = [
        contentW * 0.12,  // Time
        contentW * 0.58,  // Entry (majority)
        contentW * 0.14,  // User
        contentW * 0.16,  // Source (source:/uid: keywords)
    ];
    const colX = [
        MARGIN,
        MARGIN + colWidths[0],
        MARGIN + colWidths[0] + colWidths[1],
        MARGIN + colWidths[0] + colWidths[1] + colWidths[2],
    ];

    const headerLabels = ['Time', 'Entry', 'User', 'Source'];
    const bodyRows = rows.map((r) => [
        formatLocalTime(r.epoch),
        r.content,
        r.source,
        pdfSourceKeywords(r.keywords),
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

    function addWrappedBlock(
        text: string,
        indent: number,
        size = FONT_SIZE,
        bold = false,
        maxWidth = contentW - indent,
    ): void {
        const wrapped = wrapText(text, maxWidth, size);
        const blockH = wrapped.length * LINE_H + ROW_VPAD;
        ensureSpace(blockH);
        let lineY = y - ROW_VPAD - FONT_ASCENT;
        for (const line of wrapped) {
            addText(MARGIN + indent, lineY, line, size, bold);
            lineY -= LINE_H;
        }
        y = lineY - ROW_VPAD + FONT_ASCENT;
    }

    function addThreeColumnSection(title: string, entries: PdfGridLine[][]): void {
        if (!entries.length) return;

        addWrappedBlock(title, 0, 10, true);
        y -= 4;

        const colCount = 3;
        const colGap = 10;
        const colW = (contentW - colGap * (colCount - 1)) / colCount;

        for (let i = 0; i < entries.length; i += colCount) {
            const rowEntries = entries.slice(i, i + colCount);
            const rowLayouts = rowEntries.map((entry) => {
                const wrapped: Array<{ text: string; size: number; bold: boolean }> = [];
                for (const line of entry) {
                    const size = line.size ?? FONT_SIZE;
                    const bold = line.bold ?? false;
                    const pieces = wrapText(line.text, colW - 6, size);
                    for (const piece of pieces) wrapped.push({ text: piece, size, bold });
                }
                const lineCount = Math.max(wrapped.length, 1);
                const rowHeight = lineCount * LINE_H + ROW_VPAD * 2;
                return {
                    wrapped: wrapped.length ? wrapped : [{ text: '', size: FONT_SIZE, bold: false }],
                    rowHeight,
                };
            });

            const rowHeight = Math.max(...rowLayouts.map((layout) => layout.rowHeight));
            ensureSpace(rowHeight + 4);

            const rowTop = y;
            const firstBaseline = rowTop - ROW_VPAD - FONT_ASCENT;
            for (let col = 0; col < rowLayouts.length; col++) {
                const x = MARGIN + col * (colW + colGap);
                let lineY = firstBaseline;
                for (const line of rowLayouts[col].wrapped) {
                    addText(x + 2, lineY, line.text, line.size, line.bold);
                    lineY -= LINE_H;
                }
            }

            y = rowTop - rowHeight - 4;
        }

        addLine(MARGIN, y, PAGE_W - MARGIN, y);
        y -= 12;
    }

    // Title block on first page
    addText(MARGIN, y, `Dashboard — ${missionName}`, 11, true);
    y -= 14;
    addText(MARGIN, y, `Exported ${exportedAt} (local time)`, 8, false);
    y -= 18;
    addLine(MARGIN, y, PAGE_W - MARGIN, y);
    y -= 12;

    const initialRows = initialInfo ? initialInfoDetailRows(initialInfo) : [];
    const hasInitialInfo = initialRows.length > 0;
    const hasSubjects = subjects.length > 0;

    if (hasInitialInfo || hasSubjects) {
        const gap = contentW * 0.04;
        const colW = (contentW - gap) / 2;
        const leftX = MARGIN;
        const rightX = MARGIN + colW + gap;

        const leftLines = hasInitialInfo
            ? detailSectionLines('Initial Information', initialRows)
            : [];
        const rightLines: PdfDetailLine[] = [];
        if (hasSubjects) {
            for (const s of subjects) {
                const details = subjectDetailRows(s);
                if (!details.length) continue;
                rightLines.push(
                    ...detailSectionLines(
                        `Subject ${displaySubjectNumber(s.subjectCaseID)}`,
                        details,
                    ),
                );
                rightLines.push({ text: '', size: FONT_SIZE, bold: false });
            }
        }

        let leftIdx = 0;
        let rightIdx = 0;
        while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
            const leftLine = leftLines[leftIdx];
            const rightLine = rightLines[rightIdx];
            const leftWrapped = leftLine
                ? wrapText(leftLine.text, colW - 4, leftLine.size)
                : [];
            const rightWrapped = rightLine
                ? wrapText(rightLine.text, colW - 4, rightLine.size)
                : [];
            const lineCount = Math.max(leftWrapped.length, rightWrapped.length, 1);
            const blockH = lineCount * LINE_H + ROW_VPAD;
            ensureSpace(blockH);

            const firstBaseline = y - ROW_VPAD - FONT_ASCENT;
            for (let i = 0; i < lineCount; i++) {
                const lineY = firstBaseline - i * LINE_H;
                if (leftLine && leftWrapped[i]) {
                    addText(leftX + 2, lineY, leftWrapped[i], leftLine.size, leftLine.bold);
                }
                if (rightLine && rightWrapped[i]) {
                    addText(rightX + 2, lineY, rightWrapped[i], rightLine.size, rightLine.bold);
                }
            }

            y -= blockH;
            if (leftLine) leftIdx++;
            if (rightLine) rightIdx++;
        }

        addLine(MARGIN, y, PAGE_W - MARGIN, y);
        y -= 12;
    }

    if (rows.length) {
        if (hasInitialInfo || hasSubjects) {
            addWrappedBlock('Mission Log', 0, 10, true);
            y -= 4;
        }

        // Table header row
        ensureSpace(HEADER_H);
        const headerBottom = y - HEADER_H;
        const headerBaseline = y - ROW_VPAD - FONT_ASCENT;
        for (let c = 0; c < headerLabels.length; c++) {
            addText(colX[c] + 2, headerBaseline, headerLabels[c], FONT_SIZE, true);
        }
        addLine(MARGIN, headerBottom, PAGE_W - MARGIN, headerBottom);
        y = headerBottom;

        for (const cols of bodyRows) {
            const { cells, rowHeight: contentHeight } = layoutRow(cols, colWidths);
            const rowHeight = contentHeight + ROW_VPAD * 2;
            ensureSpace(rowHeight);
            const rowBottom = y - rowHeight;
            const firstBaseline = y - ROW_VPAD - FONT_ASCENT;
            for (let c = 0; c < cells.length; c++) {
                let lineY = firstBaseline;
                for (const line of cells[c].lines) {
                    addText(colX[c] + 2, lineY, line);
                    lineY -= LINE_H;
                }
            }
            addLine(MARGIN, rowBottom, PAGE_W - MARGIN, rowBottom);
            y = rowBottom;
        }
    }

    const hasPostLogSections = teams.length > 0
        || resourceAssignments.length > 0
        || workAssignments.length > 0;

    if (hasPostLogSections) {
        y -= 8;
        addLine(MARGIN, y, PAGE_W - MARGIN, y);
        y -= 12;
    }

    if (teams.length) {
        addWrappedBlock('Teams', 0, 10, true);
        y -= 4;
        for (const team of teams) {
            const teamTitle = team.assignmentCallsign
                ? `${team.title} (${team.assignmentCallsign})`
                : team.title;
            addWrappedBlock(teamTitle, 0, FONT_SIZE, true);
            if (team.description) {
                addWrappedBlock(team.description, 8, FONT_SIZE, false);
            }
            if (team.children.length) {
                for (const child of team.children) {
                    addWrappedBlock(formatTeamRosterChild(child), 12);
                }
            } else {
                addWrappedBlock('No roster entries', 12);
            }
            y -= 4;
        }
        addLine(MARGIN, y, PAGE_W - MARGIN, y);
        y -= 12;
    }

    if (resourceAssignments.length) {
        const entries = resourceAssignments.map((assignment) => [
            { text: assignment.resourceIdentifier, bold: true, size: FONT_SIZE },
            ...resourceAssignmentDetailRows(assignment).map((row) => ({
                text: `${row.label}: ${row.value}`,
                size: FONT_SIZE,
                bold: false,
            })),
        ]);
        addThreeColumnSection('Resource Assignments', entries);
    }

    if (workAssignments.length) {
        const entries = workAssignments.map((assignment) => [
            { text: `Assignment ${assignment.assignmentNumber}`, bold: true, size: FONT_SIZE },
            ...workAssignmentDetailRows(assignment).map((row) => ({
                text: `${row.label}: ${row.value}`,
                size: FONT_SIZE,
                bold: false,
            })),
        ]);
        addThreeColumnSection('Work Assignments', entries);
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
    subjects: ParsedSubject[] = [],
    initialInfo?: IncidentInfoForm | null,
    teams: DashboardTeamRoster[] = [],
    resourceAssignments: ResourceAssignment[] = [],
    workAssignments: WorkAssignment[] = [],
): void {
    const exportedAt = new Date().toLocaleString(undefined, LOCAL_TIME_OPTS);
    const pdf = buildPdf(
        rows,
        missionName,
        exportedAt,
        subjects,
        initialInfo,
        teams,
        resourceAssignments,
        workAssignments,
    );
    const blob = new Blob([pdf], { type: 'application/pdf' });
    downloadBlob(blob, `${safeFilename(missionName)}-dashboard.pdf`);
}
