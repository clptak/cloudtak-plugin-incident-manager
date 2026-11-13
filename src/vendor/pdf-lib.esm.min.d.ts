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
        opacity?: number;
    }): void;
    drawImage(
        image: PDFImage,
        options: { x: number; y: number; width: number; height: number },
    ): void;
    /** SVG path with y pointing down from (x, y). */
    drawSvgPath(path: string, options: { x: number; y: number; color?: RGB; scale?: number }): void;
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
    /** Low-level page dictionary (form-field merging, #33). */
    node: { Annots(): PDFArray | undefined };
}

export type PDFEmbeddedPage = object;
export type PDFImage = object;

/** AcroForm field types used by the IAP generator (official ICS templates). */
export interface PDFWidgetAnnotation {
    getRectangle(): { x: number; y: number; width: number; height: number };
}

export interface PDFAcroField {
    getWidgets(): PDFWidgetAnnotation[];
}

export interface PDFTextField {
    acroField: PDFAcroField;
    setText(text: string): void;
    getText(): string | undefined;
    addToPage(page: PDFPage, options: {
        x: number;
        y: number;
        width: number;
        height: number;
        font?: PDFFont;
        textColor?: RGB;
        backgroundColor?: RGB;
        borderColor?: RGB;
        borderWidth?: number;
    }): void;
    setFontSize(size: number): void;
    enableMultiline(): void;
    isMultiline(): boolean;
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
    getField(name: string): {
        acroField: {
            getWidgets(): Array<{
                getRectangle(): { x: number; y: number; width: number; height: number };
            }>;
        };
    };
    createTextField(name: string): PDFTextField;
    updateFieldAppearances(font?: PDFFont): void;
    flatten(): void;
    acroForm: { dict: PDFDict; addField(ref: PDFRef): void };
}

// ── Low-level objects (form-field merging, #33) ───────────────────────────
export class PDFObject {}
export class PDFName extends PDFObject {
    static of(name: string): PDFName;
}
export class PDFHexString extends PDFObject {
    static fromText(text: string): PDFHexString;
    decodeText(): string;
}
export class PDFString extends PDFObject {
    decodeText(): string;
}
export class PDFRef extends PDFObject {}
export class PDFArray extends PDFObject {
    size(): number;
    get(index: number): PDFObject;
}
export class PDFDict extends PDFObject {
    get(key: PDFName): PDFObject | undefined;
    set(key: PDFName, value: PDFObject): void;
    lookup(key: PDFName): PDFObject | undefined;
    entries(): [PDFName, PDFObject][];
}
export interface PDFContext {
    lookup(obj: PDFObject | undefined): PDFObject | undefined;
    obj(value: Record<string, never>): PDFDict;
}
export class PDFObjectCopier {
    static for(src: PDFContext, dest: PDFContext): PDFObjectCopier;
    copy<T extends PDFObject>(obj: T): T;
}

export class PDFDocument {
    static load(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument>;
    static create(): Promise<PDFDocument>;
    copyPages(src: PDFDocument, indices: number[]): Promise<PDFPage[]>;
    embedPage(page: PDFPage): Promise<PDFEmbeddedPage>;
    embedFont(name: StandardFonts): Promise<PDFFont>;
    embedJpg(bytes: ArrayBuffer | Uint8Array): Promise<PDFImage>;
    addPage(size: [number, number]): PDFPage;
    getPageCount(): number;
    getForm(): PDFForm;
    context: PDFContext;
    save(): Promise<Uint8Array>;
}
