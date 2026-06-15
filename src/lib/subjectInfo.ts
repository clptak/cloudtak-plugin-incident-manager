/** Subject Information log keyword and field parsing (Logger + Dashboard). */

export const SUBJECT_KEYWORD = 'subject-information';

export const SUBJECT_NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'] as const;

export const SUBJECT_CATEGORIES = [
    { value: 'hiker', label: 'Hiker' },
    { value: 'hunter', label: 'Hunter' },
    { value: 'child', label: 'Child' },
    { value: 'elderly', label: 'Elderly' },
    { value: 'mental_illness', label: 'Mental Illness' },
    { value: 'alzheimer_dementia', label: "Alzheimer's/Dementia" },
    { value: 'substance_abuse', label: 'Substance Abuse' },
    { value: 'other', label: 'Other' },
] as const;

export interface SubjectForm {
    subjectCaseID: string;
    subjectName: string;
    subjectAge: string;
    subjectGender: string;
    subjectCategory: string;
    subjectDescription: string;
    subjectMedicalConditions: string;
    subjectExperience: string;
    subjectEquipment: string;
    subjectPhoto: string;
    subjectIppFromTak: string;
    subjectIpp: string;
    subjectTimeWentMissing: string;
    subjectTimeReportedMissing: string;
    subjectReportedMissingBy: string;
    logId?: string;
}

export interface ParsedSubject extends SubjectForm {
    updatedAt: number;
    rawTime: string;
}

export interface SubjectLogInput {
    keywords?: string[];
    created?: string;
    dtg?: string;
}

export function displaySubjectNumber(n: string): string {
    return String(Number.parseInt(n, 10));
}

export function categoryLabel(value: string): string {
    return SUBJECT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function hasValue(value: string | undefined): value is string {
    return !!value?.trim();
}

export function blankSubjectForm(subjectCaseID = '01'): SubjectForm {
    return {
        subjectCaseID,
        subjectName: '',
        subjectAge: '',
        subjectGender: '',
        subjectCategory: '',
        subjectDescription: '',
        subjectMedicalConditions: '',
        subjectExperience: '',
        subjectEquipment: '',
        subjectPhoto: '',
        subjectIppFromTak: '',
        subjectIpp: '',
        subjectTimeWentMissing: '',
        subjectTimeReportedMissing: '',
        subjectReportedMissingBy: '',
        logId: undefined,
    };
}

export function subjectNumberFromLog(keywords?: string[]): string | null {
    if (!keywords?.includes(SUBJECT_KEYWORD)) return null;
    const tag = keywords.find((k) => k.startsWith('subject:'));
    if (!tag) return null;
    const num = tag.slice('subject:'.length);
    return (SUBJECT_NUMBERS as readonly string[]).includes(num) ? num : null;
}

export function kwValue(keywords: string[] | undefined, prefix: string): string {
    const tag = keywords?.find((k) => k.startsWith(prefix));
    return tag ? tag.slice(prefix.length) : '';
}

export function fieldsFromLog(keywords?: string[]): SubjectForm {
    return {
        subjectCaseID: kwValue(keywords, 'subject:') || '01',
        subjectName: kwValue(keywords, 'name:'),
        subjectAge: kwValue(keywords, 'age:'),
        subjectGender: kwValue(keywords, 'gender:'),
        subjectCategory: kwValue(keywords, 'category:'),
        subjectDescription: kwValue(keywords, 'description:'),
        subjectMedicalConditions: kwValue(keywords, 'medical:'),
        subjectExperience: kwValue(keywords, 'experience:'),
        subjectEquipment: kwValue(keywords, 'equipment:'),
        subjectPhoto: kwValue(keywords, 'photo:'),
        subjectIppFromTak: kwValue(keywords, 'ippFromTak:'),
        subjectIpp: kwValue(keywords, 'ipp:'),
        subjectTimeWentMissing: kwValue(keywords, 'missing:'),
        subjectTimeReportedMissing: kwValue(keywords, 'reported:'),
        subjectReportedMissingBy: kwValue(keywords, 'reportedBy:'),
        logId: undefined,
    };
}

export function hasFilledSubjectFields(f: SubjectForm): boolean {
    return [
        f.subjectName,
        f.subjectAge,
        f.subjectGender,
        f.subjectCategory,
        f.subjectDescription,
        f.subjectMedicalConditions,
        f.subjectExperience,
        f.subjectEquipment,
        f.subjectPhoto,
        f.subjectIppFromTak,
        f.subjectIpp,
        f.subjectTimeWentMissing,
        f.subjectTimeReportedMissing,
        f.subjectReportedMissingBy,
    ].some((v) => hasValue(v));
}

function buildParts(f: SubjectForm): string[] {
    const parts: string[] = [];
    if (hasValue(f.subjectName)) parts.push(`Name: ${f.subjectName.trim()}`);
    if (hasValue(f.subjectAge)) parts.push(`Age: ${f.subjectAge.trim()}`);
    if (hasValue(f.subjectGender)) parts.push(`Gender: ${f.subjectGender}`);
    if (hasValue(f.subjectCategory)) parts.push(`Category: ${categoryLabel(f.subjectCategory)}`);
    if (hasValue(f.subjectDescription)) parts.push(`Description: ${f.subjectDescription.trim()}`);
    if (hasValue(f.subjectMedicalConditions)) parts.push(`Medical: ${f.subjectMedicalConditions.trim()}`);
    if (hasValue(f.subjectExperience)) parts.push(`Experience: ${f.subjectExperience.trim()}`);
    if (hasValue(f.subjectEquipment)) parts.push(`Equipment: ${f.subjectEquipment.trim()}`);
    if (hasValue(f.subjectPhoto)) parts.push(`Photo: ${f.subjectPhoto.trim()}`);
    if (hasValue(f.subjectIppFromTak)) parts.push(`IPP (DataSync): ${f.subjectIppFromTak.trim()}`);
    else if (hasValue(f.subjectIpp)) parts.push(`IPP: ${f.subjectIpp.trim()}`);
    if (hasValue(f.subjectTimeWentMissing)) parts.push(`Missing: ${f.subjectTimeWentMissing}`);
    if (hasValue(f.subjectTimeReportedMissing)) parts.push(`Reported: ${f.subjectTimeReportedMissing}`);
    if (hasValue(f.subjectReportedMissingBy)) parts.push(`Reported by: ${f.subjectReportedMissingBy}`);
    return parts;
}

export function buildSubjectContent(f: SubjectForm): string {
    const parts = buildParts(f);
    return `Subject ${displaySubjectNumber(f.subjectCaseID)} — ${parts.join('; ')}`;
}

export function buildSubjectKeywords(f: SubjectForm): string[] {
    const kws = [SUBJECT_KEYWORD, `subject:${f.subjectCaseID}`];
    if (hasValue(f.subjectName)) kws.push(`name:${f.subjectName.trim()}`);
    if (hasValue(f.subjectAge)) kws.push(`age:${f.subjectAge.trim()}`);
    if (hasValue(f.subjectGender)) kws.push(`gender:${f.subjectGender}`);
    if (hasValue(f.subjectCategory)) kws.push(`category:${f.subjectCategory}`);
    if (hasValue(f.subjectDescription)) kws.push(`description:${f.subjectDescription.trim()}`);
    if (hasValue(f.subjectMedicalConditions)) kws.push(`medical:${f.subjectMedicalConditions.trim()}`);
    if (hasValue(f.subjectExperience)) kws.push(`experience:${f.subjectExperience.trim()}`);
    if (hasValue(f.subjectEquipment)) kws.push(`equipment:${f.subjectEquipment.trim()}`);
    if (hasValue(f.subjectPhoto)) kws.push(`photo:${f.subjectPhoto.trim()}`);
    if (hasValue(f.subjectIppFromTak)) kws.push(`ippFromTak:${f.subjectIppFromTak.trim()}`);
    else if (hasValue(f.subjectIpp)) kws.push(`ipp:${f.subjectIpp.trim()}`);
    if (hasValue(f.subjectTimeWentMissing)) kws.push(`missing:${f.subjectTimeWentMissing}`);
    if (hasValue(f.subjectTimeReportedMissing)) kws.push(`reported:${f.subjectTimeReportedMissing}`);
    if (hasValue(f.subjectReportedMissingBy)) kws.push(`reportedBy:${f.subjectReportedMissingBy}`);
    return kws;
}

function parseTime(raw?: string): { rawTime: string; epoch: number } {
    if (!raw) return { rawTime: '', epoch: 0 };
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return { rawTime: raw, epoch: 0 };
    return { rawTime: raw, epoch: ms };
}

/** Most recent log entry per subject number. */
export function parseSubjectsFromLogs(logs: SubjectLogInput[]): ParsedSubject[] {
    const byNumber = new Map<string, ParsedSubject>();
    for (const log of logs) {
        const number = subjectNumberFromLog(log.keywords);
        if (!number) continue;
        const { rawTime, epoch } = parseTime(log.dtg || log.created);
        const prev = byNumber.get(number);
        if (!prev || epoch >= prev.updatedAt) {
            byNumber.set(number, {
                ...fieldsFromLog(log.keywords),
                subjectCaseID: number,
                updatedAt: epoch,
                rawTime,
            });
        }
    }
    return [...byNumber.values()].sort(
        (a, b) => Number.parseInt(a.subjectCaseID, 10) - Number.parseInt(b.subjectCaseID, 10),
    );
}

export interface SubjectDetailRow {
    label: string;
    value: string;
}

/** Labeled rows for Dashboard / PDF (non-empty fields only). */
export function subjectDetailRows(s: SubjectForm): SubjectDetailRow[] {
    const rows: SubjectDetailRow[] = [];
    if (hasValue(s.subjectName)) rows.push({ label: 'Name', value: s.subjectName.trim() });
    if (hasValue(s.subjectAge)) rows.push({ label: 'Age', value: s.subjectAge.trim() });
    if (hasValue(s.subjectGender)) rows.push({ label: 'Gender', value: s.subjectGender });
    if (hasValue(s.subjectCategory)) {
        rows.push({ label: 'Category', value: categoryLabel(s.subjectCategory) });
    }
    if (hasValue(s.subjectDescription)) rows.push({ label: 'Description', value: s.subjectDescription.trim() });
    if (hasValue(s.subjectMedicalConditions)) {
        rows.push({ label: 'Medical Conditions', value: s.subjectMedicalConditions.trim() });
    }
    if (hasValue(s.subjectExperience)) rows.push({ label: 'Experience', value: s.subjectExperience.trim() });
    if (hasValue(s.subjectEquipment)) rows.push({ label: 'Equipment', value: s.subjectEquipment.trim() });
    if (hasValue(s.subjectPhoto)) rows.push({ label: 'Photo', value: s.subjectPhoto.trim() });
    if (hasValue(s.subjectIppFromTak)) {
        rows.push({ label: 'IPP (DataSync)', value: s.subjectIppFromTak.trim() });
    } else if (hasValue(s.subjectIpp)) {
        rows.push({ label: 'IPP', value: s.subjectIpp.trim() });
    }
    if (hasValue(s.subjectTimeWentMissing)) {
        rows.push({ label: 'Time Went Missing', value: s.subjectTimeWentMissing });
    }
    if (hasValue(s.subjectTimeReportedMissing)) {
        rows.push({ label: 'Time Reported Missing', value: s.subjectTimeReportedMissing });
    }
    if (hasValue(s.subjectReportedMissingBy)) {
        rows.push({ label: 'Reported Missing By', value: s.subjectReportedMissingBy });
    }
    return rows;
}
