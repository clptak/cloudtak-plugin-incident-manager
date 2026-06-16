declare module '../vendor/pdf-lib.esm.min.js' {
    export class PDFDocument {
        static load(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument>;
        getForm(): PDFForm;
        save(): Promise<Uint8Array>;
    }

    export interface PDFForm {
        getTextField(name: string): PDFTextField;
        flatten(): void;
    }

    export interface PDFTextField {
        setText(value: string): void;
    }
}

declare module '*.pdf?url' {
    const url: string;
    export default url;
}
