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
        options: { x: number; y: number; size: number; font: PDFFont; color?: RGB },
    ): void;
    drawRectangle(options: {
        x: number;
        y: number;
        width: number;
        height: number;
        color?: RGB;
        borderColor?: RGB;
        borderWidth?: number;
    }): void;
    drawPage(
        embeddedPage: PDFEmbeddedPage,
        options: { x: number; y: number; width: number; height: number },
    ): void;
    drawLine(options: {
        start: { x: number; y: number };
        end: { x: number; y: number };
        thickness?: number;
        color?: RGB;
    }): void;
}

export type PDFEmbeddedPage = object;

/** AcroForm field types used by the IAP generator (official ICS templates). */
export interface PDFTextField {
    setText(text: string): void;
    setFontSize(size: number): void;
    enableMultiline(): void;
}

export interface PDFCheckBox {
    check(): void;
    uncheck(): void;
}

export interface PDFField {
    getName(): string;
}

export interface PDFForm {
    getFields(): PDFField[];
    getTextField(name: string): PDFTextField;
    getCheckBox(name: string): PDFCheckBox;
    updateFieldAppearances(font?: PDFFont): void;
    flatten(): void;
}

export class PDFDocument {
    static load(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument>;
    static create(): Promise<PDFDocument>;
    copyPages(src: PDFDocument, indices: number[]): Promise<PDFPage[]>;
    embedPage(page: PDFPage): Promise<PDFEmbeddedPage>;
    embedFont(name: StandardFonts): Promise<PDFFont>;
    addPage(size: [number, number]): PDFPage;
    getPageCount(): number;
    getForm(): PDFForm;
    save(): Promise<Uint8Array>;
}
