/** IR Briefing form model and mission data loading. */

import Subscription from '../../../../src/base/subscription.ts';
import { formatCoordPair } from '../../../../src/base/utils/coordinateFormat.ts';
import { latestIncidentInfoFromLogs } from './incidentInfo.ts';
import { parseCoordinates } from './coords.ts';
import { resolveMissionIppLocation } from './missionIpp.ts';
import {
    blankSubjectForm,
    effectiveSubjectAge,
    fieldsFromLog,
    parseSubjectsFromLogs,
    subjectNumberFromLog,
    type SubjectForm,
} from './subjectInfo.ts';

export const DEFAULT_SAFETY_MESSAGE = [
    'Stay warm.',
    'Situational awareness.',
    'Respect private property.',
    'Personal / Personnel accountability.',
].join('\n');

export const BRIEFING_SUBJECT_NUMBERS = ['01', '02', '03'] as const;

export interface BriefingSubjectColumn {
    number: string;
    name: string;
    age: string;
    height: string;
    weight: string;
    hairColor: string;
    facialHair: string;
    glasses: string;
    distinguishingMarks: string;
    clothing: string;
    footwear: string;
    equipment: string;
    vehicle: string;
    medicalConditions: string;
    experience: string;
}

export interface IrBriefingForm {
    briefingDate: string;
    briefingTime: string;
    incidentCommander: string;
    initialPlanningPoint: string;
    subjects: [BriefingSubjectColumn, BriefingSubjectColumn, BriefingSubjectColumn];
    situationSummary: string;
    actionsTaken: string;
    adamRepeatedChannel: string;
    carToCarChannel: string;
    alternateChannel: string;
    weatherSummary: string;
    safetyMessage: string;
    incidentName: string;
    operationalPeriod: string;
}

export interface IrBriefingSources {
    ippLatLng: { lat: number; lng: number } | null;
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

export function nowBriefingDate(): string {
    const d = new Date();
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${String(d.getFullYear()).slice(-2)}`;
}

export function nowBriefingTime(): string {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function blankSubjectColumn(number: string): BriefingSubjectColumn {
    return {
        number,
        name: '',
        age: '',
        height: '',
        weight: '',
        hairColor: '',
        facialHair: '',
        glasses: '',
        distinguishingMarks: '',
        clothing: '',
        footwear: '',
        equipment: '',
        vehicle: '',
        medicalConditions: '',
        experience: '',
    };
}

export function blankIrBriefingForm(): IrBriefingForm {
    return {
        briefingDate: nowBriefingDate(),
        briefingTime: nowBriefingTime(),
        incidentCommander: '',
        initialPlanningPoint: '',
        subjects: [
            blankSubjectColumn('01'),
            blankSubjectColumn('02'),
            blankSubjectColumn('03'),
        ],
        situationSummary: '',
        actionsTaken: '',
        adamRepeatedChannel: '',
        carToCarChannel: '',
        alternateChannel: '',
        weatherSummary: '',
        safetyMessage: DEFAULT_SAFETY_MESSAGE,
        incidentName: '',
        operationalPeriod: '',
    };
}

function subjectToColumn(f: SubjectForm): BriefingSubjectColumn {
    return {
        number: f.subjectCaseID,
        name: f.subjectName.trim(),
        age: effectiveSubjectAge(f),
        height: f.subjectHeight.trim(),
        weight: f.subjectWeight.trim(),
        hairColor: f.subjectHairColor.trim(),
        facialHair: f.subjectFacialHair.trim(),
        glasses: f.subjectGlasses.trim(),
        distinguishingMarks: f.subjectDistinguishingMarks.trim(),
        clothing: f.subjectClothing.trim(),
        footwear: f.subjectFootwear.trim(),
        equipment: f.subjectEquipment.trim(),
        vehicle: f.subjectVehicle.trim(),
        medicalConditions: f.subjectMedicalConditions.trim(),
        experience: f.subjectExperience.trim(),
    };
}

export function operationalPeriodFromKeywords(keywords?: string[]): string {
    const tag = keywords?.find((k) => k.startsWith('operationalPeriod:'));
    return tag ? tag.slice('operationalPeriod:'.length) : '';
}

export function formatIppAsUtm(lat: number, lng: number): string {
    return `${formatCoordPair(lat, lng, 'utm')} / WGS84`;
}

export function parseIppLatLng(ippText: string): { lat: number; lng: number } | null {
    return parseCoordinates(ippText);
}

export async function resolveIppLatLng(
    missionGuid: string,
    missionToken?: string,
): Promise<{ lat: number; lng: number } | null> {
    const location = await resolveMissionIppLocation(missionGuid, missionToken);
    if (!location) return null;
    return parseCoordinates(location);
}

function subjectsByNumber(logs: { keywords?: string[] }[]): Map<string, SubjectForm> {
    const parsed = parseSubjectsFromLogs(logs);
    const map = new Map<string, SubjectForm>();
    for (const s of parsed) map.set(s.subjectCaseID, s);
    return map;
}

export interface LoadedIrBriefing {
    form: IrBriefingForm;
    sources: IrBriefingSources;
}

/** Load auto-filled briefing values from mission logs and metadata. */
export async function loadIrBriefingFromMission(
    missionGuid: string,
    missionToken?: string,
    missionName?: string,
): Promise<LoadedIrBriefing> {
    const form = blankIrBriefingForm();
    const sources: IrBriefingSources = { ippLatLng: null };

    const sub = await Subscription.load(missionGuid, { token: missionToken ?? '' });
    const logs = await sub.log.list({ refresh: true });

    const incident = latestIncidentInfoFromLogs(logs);
    if (incident) {
        form.incidentCommander = incident.fields.icCoordinator.trim();
        form.incidentName = incident.fields.incidentName.trim();
    }
    if (!form.incidentName && missionName) form.incidentName = missionName;

    form.operationalPeriod = operationalPeriodFromKeywords(sub.meta.keywords);

    const ippLatLng = await resolveIppLatLng(missionGuid, missionToken);
    sources.ippLatLng = ippLatLng;
    if (ippLatLng) {
        form.initialPlanningPoint = formatIppAsUtm(ippLatLng.lat, ippLatLng.lng);
    }

    const byNumber = subjectsByNumber(logs);
    BRIEFING_SUBJECT_NUMBERS.forEach((num, i) => {
        const subject = byNumber.get(num) ?? blankSubjectForm(num);
        form.subjects[i] = subjectToColumn(subject);
    });

    return { form, sources };
}

/** Re-pull only auto-filled source fields, preserving user-edited briefing-only fields. */
export function mergeIrBriefingSources(
    current: IrBriefingForm,
    loaded: IrBriefingForm,
): IrBriefingForm {
    return {
        ...current,
        briefingDate: loaded.briefingDate,
        briefingTime: loaded.briefingTime,
        incidentCommander: loaded.incidentCommander,
        initialPlanningPoint: loaded.initialPlanningPoint,
        subjects: loaded.subjects,
        incidentName: loaded.incidentName,
        operationalPeriod: loaded.operationalPeriod || current.operationalPeriod,
    };
}

export function subjectFieldsFromLogKeywords(keywords?: string[]): SubjectForm {
    return fieldsFromLog(keywords);
}

export function isBriefingSubjectLog(keywords?: string[]): boolean {
    const num = subjectNumberFromLog(keywords);
    return !!num && (BRIEFING_SUBJECT_NUMBERS as readonly string[]).includes(num);
}
