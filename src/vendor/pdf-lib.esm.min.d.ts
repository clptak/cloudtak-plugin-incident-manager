export enum StandardFonts {
    Helvetica = 'Helvetica',
    HelveticaBold = 'Helvetica-Bold',
}

export interface RGB {
    red: number;
    green: number;
    blue: number;
}

export function rgb(red: number, green: number, blue: number): RGB;

export interface PDFFont {
    widthOfTextAtSize(text: string, size: number): number;
}

export interface PDFPage {
    getSize(): { width: number; height: number };
    drawText(
        text: string,
        options: { x: number; y: number; size: number; font: PDFFont },
    ): void;
    drawRectangle(options: {
        x: number;
        y: number;
        width: number;
        height: number;
        color?: RGB;
        borderWidth?: number;
    }): void;
    drawPage(
        embeddedPage: PDFEmbeddedPage,
        options: { x: number; y: number; width: number; height: number },
    ): void;
}

export type PDFEmbeddedPage = object;

export class PDFDocument {
    static load(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument>;
    static create(): Promise<PDFDocument>;
    copyPages(src: PDFDocument, indices: number[]): Promise<PDFPage[]>;
    embedPage(page: PDFPage): Promise<PDFEmbeddedPage>;
    embedFont(name: StandardFonts): Promise<PDFFont>;
    addPage(size: [number, number]): PDFPage;
    getPageCount(): number;
    save(): Promise<Uint8Array>;
}
