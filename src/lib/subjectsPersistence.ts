/** Persist subject information in mission_schema.json (incident_response.subjects array). */

import type { ActiveMission } from '../composables/useIncident.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import {
    applyMissionContextToSchema,
    loadMissionSchema,
    saveMissionSchema,
    type MissionSchema,
} from './missionSchema.ts';
import {
    blankSubjectForm,
    parseSubjectYesNo,
    parseSubjectsFromLogs,
    type ParsedSubject,
    type SubjectForm,
    type SubjectLogInput,
} from './subjectInfo.ts';

/** Form fields stored under each subject's initial_information (excludes logId). */
export type SubjectInitialInformation = Omit<SubjectForm, 'logId'>;

export interface SchemaSubjectRecord {
    initial_information: SubjectInitialInformation;
    lpq: Record<string, unknown>;
}

const STRING_INFO_KEYS = [
    'subjectCaseID',
    'subjectName',
    'subjectDateOfBirth',
    'subjectAge',
    'subjectGender',
    'subjectCategory',
    'subjectType',
    'subjectDescription',
    'subjectHeight',
    'subjectWeight',
    'subjectHairColor',
    'subjectDistinguishingMarks',
    'subjectClothing',
    'subjectFootwear',
    'subjectVehicle',
    'subjectMedicalConditions',
    'subjectExperience',
    'subjectEquipment',
    'subjectPhoto',
    'subjectIppFromTak',
    'subjectIpp',
    'subjectTimeWentMissing',
    'subjectTimeReportedMissing',
    'subjectReportedMissingBy',
] as const satisfies readonly (keyof SubjectInitialInformation)[];

export function subjectFormToInitialInformation(f: SubjectForm): SubjectInitialInformation {
    const rest = { ...f };
    delete rest.logId;
    return rest;
}

export function subjectFormFromInitialInformation(
    info: Partial<SubjectInitialInformation> | Record<string, unknown> | undefined,
): SubjectForm {
    const form = blankSubjectForm();
    if (!info || typeof info !== 'object') return form;
    const raw = info as Record<string, unknown>;
    for (const key of STRING_INFO_KEYS) {
        const value = raw[key];
        if (typeof value === 'string') {
            form[key] = value;
        }
    }
    form.subjectFacialHair = parseSubjectYesNo(raw.subjectFacialHair);
    form.subjectGlasses = parseSubjectYesNo(raw.subjectGlasses);
    if (!form.subjectCaseID) form.subjectCaseID = '01';
    return form;
}

function ensureSubjectsArray(schema: MissionSchema): SchemaSubjectRecord[] {
    if (!schema.incident_response || typeof schema.incident_response !== 'object') {
        schema.incident_response = {
            incident_name: '',
            incident_id: '',
            incident_datetime: '',
            subjects: [],
        };
    }
    const ir = schema.incident_response as Record<string, unknown>;
    const raw = ir.subjects;
    if (!Array.isArray(raw)) {
        ir.subjects = [];
        return ir.subjects as SchemaSubjectRecord[];
    }
    return raw as SchemaSubjectRecord[];
}

function isSchemaSubjectRecord(value: unknown): value is SchemaSubjectRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const rec = value as Record<string, unknown>;
    return typeof rec.initial_information === 'object' && rec.initial_information !== null;
}

/** Read subjects from mission_schema.json; legacy `{}` / malformed values yield []. */
export function subjectsFromSchema(schema: MissionSchema): SubjectForm[] {
    const ir = schema.incident_response as Record<string, unknown> | undefined;
    const raw = ir?.subjects;
    if (!Array.isArray(raw)) return [];

    const byNumber = new Map<string, SubjectForm>();
    for (const entry of raw) {
        if (!isSchemaSubjectRecord(entry)) continue;
        const form = subjectFormFromInitialInformation(entry.initial_information);
        if (!form.subjectCaseID) continue;
        byNumber.set(form.subjectCaseID, form);
    }
    return [...byNumber.values()].sort(
        (a, b) => Number.parseInt(a.subjectCaseID, 10) - Number.parseInt(b.subjectCaseID, 10),
    );
}

/** Replace-or-append by subjectCaseID; preserve existing lpq on update. */
export function upsertSubjectInSchema(schema: MissionSchema, form: SubjectForm): void {
    const subjects = ensureSubjectsArray(schema);
    const info = subjectFormToInitialInformation(form);
    const number = info.subjectCaseID;
    const idx = subjects.findIndex((entry) => {
        if (!isSchemaSubjectRecord(entry)) return false;
        const id = subjectFormFromInitialInformation(entry.initial_information).subjectCaseID;
        return id === number;
    });

    if (idx >= 0) {
        const prev = subjects[idx];
        const lpq = (
            prev.lpq && typeof prev.lpq === 'object' && !Array.isArray(prev.lpq)
        ) ? prev.lpq : {};
        subjects[idx] = { initial_information: info, lpq };
    } else {
        subjects.push({ initial_information: info, lpq: {} });
    }

    (schema.incident_response as Record<string, unknown>).subjects = subjects;
}

export function upsertSubjectsInSchema(schema: MissionSchema, forms: SubjectForm[]): void {
    for (const form of forms) {
        upsertSubjectInSchema(schema, form);
    }
}

/**
 * Prefer mission_schema.json subjects; fall back to DataSync logs when the schema array is empty.
 */
export function resolveSubjects(
    schema: MissionSchema,
    logs?: SubjectLogInput[],
): ParsedSubject[] {
    const fromSchema = subjectsFromSchema(schema);
    if (fromSchema.length) {
        return fromSchema.map((f) => ({
            ...f,
            updatedAt: 0,
            rawTime: '',
        }));
    }
    return logs ? parseSubjectsFromLogs(logs) : [];
}

export async function loadSubjectsFromMission(
    mission: ActiveMission,
): Promise<{ subjects: SubjectForm[]; contentHash?: string; schema: MissionSchema }> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    return {
        subjects: subjectsFromSchema(loaded.schema),
        contentHash: loaded.contentHash,
        schema: loaded.schema,
    };
}

/** Upsert one or more subjects into mission_schema.json. */
export async function saveSubjectsToMission(
    mission: ActiveMission,
    forms: SubjectForm[],
    contentHash?: string,
): Promise<string | undefined> {
    if (!forms.length) return contentHash;
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);

    upsertSubjectsInSchema(loaded.schema, forms);
    applyMissionContextToSchema(loaded.schema, mission.name);

    const saved = await saveMissionSchema(sub, loaded.schema, {
        contentHash: contentHash ?? loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });

    return saved.contentHash;
}
