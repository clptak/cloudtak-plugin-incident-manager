/** Escape HTML special characters in plain text. */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Inline markdown: links, bold, italic (after escape). */
function renderInline(text: string): string {
    let out = escapeHtml(text);
    out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return out;
}

function isTableSeparator(line: string): boolean {
    return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(line.trim()) && line.includes('-');
}

function parseTableRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((cell) => cell.trim());
}

function renderTable(rows: string[]): string {
    if (rows.length < 2) return '';
    const header = parseTableRow(rows[0]);
    const bodyLines = rows.slice(2); // skip header + separator
    const thead = `<thead><tr>${header.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${bodyLines.map((line) => {
        const cells = parseTableRow(line);
        return `<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;
    return `<div class="table-responsive"><table class="table table-sm">${thead}${tbody}</table></div>`;
}

function isBlockStart(trimmed: string, nextLine: string | undefined): boolean {
    if (trimmed === '') return true;
    if (/^#{1,3}\s+/.test(trimmed)) return true;
    if (/^[-*+–—]\s+/.test(trimmed)) return true;
    if (/^\d+\.\s+/.test(trimmed)) return true;
    if (trimmed.includes('|') && nextLine !== undefined && isTableSeparator(nextLine)) return true;
    return false;
}

/** Append soft-wrapped continuation lines onto the current text. */
function consumeContinuations(lines: string[], start: number): { text: string; next: number } {
    const parts: string[] = [];
    let i = start;
    while (i < lines.length) {
        const t = lines[i].trim();
        if (isBlockStart(t, lines[i + 1])) break;
        parts.push(t);
        i += 1;
    }
    return { text: parts.join(' '), next: i };
}

export interface ParsedHelpMarkdown {
    title: string | null;
    /** Markdown with the first H1 removed (if present). */
    bodyMarkdown: string;
}

/** Split first ATX H1 from the rest of the document. */
export function splitHelpMarkdownTitle(markdown: string): ParsedHelpMarkdown {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let title: string | null = null;
    let start = 0;
    for (let i = 0; i < lines.length; i++) {
        const m = /^#\s+(.+)$/.exec(lines[i].trim());
        if (m) {
            title = m[1].trim();
            start = i + 1;
            while (start < lines.length && lines[start].trim() === '') start += 1;
            break;
        }
        if (lines[i].trim() !== '') break;
    }
    return {
        title,
        bodyMarkdown: lines.slice(start).join('\n').trim(),
    };
}

/**
 * Convert help markdown to HTML (headings, lists, paragraphs, bold, links, pipe tables).
 * Trusted local docs only — output is used with v-html.
 */
export function renderHelpMarkdown(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const html: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            i += 1;
            continue;
        }

        // Pipe table
        if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().includes('|')) {
                tableLines.push(lines[i]);
                i += 1;
            }
            html.push(renderTable(tableLines));
            continue;
        }

        // Headings
        const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
        if (heading) {
            const level = heading[1].length;
            html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
            i += 1;
            continue;
        }

        // Unordered list
        if (/^[-*+–—]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (i < lines.length) {
                const t = lines[i].trim();
                const m = /^[-*+–—]\s+(.+)$/.exec(t);
                if (!m) break;
                i += 1;
                const cont = consumeContinuations(lines, i);
                items.push(`<li>${renderInline(`${m[1]} ${cont.text}`.trim())}</li>`);
                i = cont.next;
            }
            html.push(`<ul>${items.join('')}</ul>`);
            continue;
        }

        // Ordered list
        if (/^\d+\.\s+/.test(trimmed)) {
            const items: string[] = [];
            while (i < lines.length) {
                const t = lines[i].trim();
                const m = /^(\d+)\.\s+(.+)$/.exec(t);
                if (!m) break;
                i += 1;
                const cont = consumeContinuations(lines, i);
                items.push(`<li>${renderInline(`${m[2]} ${cont.text}`.trim())}</li>`);
                i = cont.next;
            }
            html.push(`<ol>${items.join('')}</ol>`);
            continue;
        }

        // Paragraph (consume continuation lines until blank / block)
        const cont = consumeContinuations(lines, i);
        html.push(`<p>${renderInline(cont.text)}</p>`);
        i = cont.next;
    }

    return html.join('\n');
}
