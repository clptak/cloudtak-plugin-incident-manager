import { PDFDocument } from '../vendor/pdf-lib.esm.min.js';
import templateUrl from '../assets/ics-234-template.pdf?url';
import {
    MAX_OBJECTIVES,
    formatStrategiesForPdf,
    formatTacticsForPdf,
    rowHasContent,
    type ObjectiveRow,
} from './incidentPost.ts';

export interface Ics234Header {
    incidentName: string;
    incidentLocation: string;
    operationalPeriodFrom: string;
    operationalPeriodTo: string;
    preparedByName: string;
    preparedByTitle: string;
    preparedBySignature: string;
    preparedByDateTime: string;
}

function objectiveField(row: number): string {
    return `4 Objectives Desired OutcomeRow${row}`;
}

function strategyField(row: number): string {
    return `5 Strategies HowRow${row}`;
}

function tacticField(row: number): string {
    return `6 Tactics  Work Assignments Who  What  Where  WhenRow${row}`;
}

function setField(form: ReturnType<PDFDocument['getForm']>, name: string, value: string): void {
    if (!value.trim()) return;
    try {
        form.getTextField(name).setText(value);
    } catch {
        // Field missing or wrong type — skip rather than fail the whole export.
    }
}

let templateBytesPromise: Promise<ArrayBuffer> | null = null;

function loadTemplateBytes(): Promise<ArrayBuffer> {
    if (!templateBytesPromise) {
        templateBytesPromise = fetch(templateUrl).then((res) => {
            if (!res.ok) throw new Error(`Could not load ICS 234 template (${res.status})`);
            return res.arrayBuffer();
        });
    }
    return templateBytesPromise;
}

/** Fill the official ICS 234-CG AcroForm template from Incident POST rows. */
export async function buildIcs234Pdf(
    rows: ObjectiveRow[],
    header: Ics234Header,
    visibleCount = MAX_OBJECTIVES,
): Promise<Uint8Array> {
    const templateBytes = await loadTemplateBytes();
    const doc = await PDFDocument.load(templateBytes);
    const form = doc.getForm();

    setField(form, '1 Incident Name', header.incidentName);
    setField(form, '2 Incident Location', header.incidentLocation);
    setField(form, 'DateTime0', header.operationalPeriodFrom);
    setField(form, 'DateTime1', header.operationalPeriodTo);
    setField(form, 'Name', header.preparedByName);
    setField(form, 'Position Title', header.preparedByTitle);
    setField(form, 'Signature', header.preparedBySignature);
    setField(form, 'DateTime', header.preparedByDateTime);

    const rowLimit = Math.min(visibleCount, MAX_OBJECTIVES);
    for (let i = 0; i < rowLimit; i++) {
        const rowNum = i + 1;
        const row = rows[i];
        if (!rowHasContent(row)) continue;

        setField(form, objectiveField(rowNum), row.objective.trim());
        setField(form, strategyField(rowNum), formatStrategiesForPdf(row.strategies));
        setField(form, tacticField(rowNum), formatTacticsForPdf(row.strategies));
    }

    form.flatten();
    return doc.save();
}

export function defaultIcs234Filename(incidentName: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = incidentName.trim().replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'incident';
    return `ICS-234-CG_${base}_${stamp}.pdf`;
}
