/**
 * Helvetica (StandardFonts) uses WinAnsi and cannot encode Unicode ligatures
 * such as U+FB00 (ﬀ). macOS often inserts these when copying/pasting.
 * NFKC expands compatibility ligatures (ﬀ→ff, ﬁ→fi, …).
 */
export function toPdfWinAnsiText(text: string): string {
    return String(text ?? '').normalize('NFKC');
}
