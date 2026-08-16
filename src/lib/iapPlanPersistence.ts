/**
 * The editable IAP plan for one operational period.
 *
 * Everything the generated PDF prints lives here: prefilled from incident data
 * (org chart, Incident POST objectives, OP assignments, Resources) and from the
 * previous OP's plan for the parts that carry forward (comms, medical, safety),
 * then reviewed and edited by the IMT before generating. Stored Sworn-side in
 * mission_schema.json under `incident_response.iap_plans[<opNumber>]`.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import { loadSchemaSubscription, schemaMissionToken } from './incidentSubscription.ts';
import { loadMissionSchema, saveMissionSchema, type MissionSchema } from './missionSchema.ts';
import type { IapInputs } from './iapData.ts';

export interface IapCommsRow {
    zone: string;
    ch: string;
    func: string;
    channelName: string;
    assignment: string;
    rxFreq: string;
    rxTone: string;
    txFreq: string;
    txTone: string;
    mode: string;
    remarks: string;
}

export interface IapResourceRow {
    identifier: string;
    leader: string;
    persons: string;
    contact: string;
    reporting: string;
}

export interface IapAssignmentPlan {
    segmentUid: string;
    label: string;
    supervisor: string;
    workAssignment: string;
    specialInstructions: string;
    resources: IapResourceRow[];
}

export interface IapOrg {
    incidentCommander: string;
    deputy: string;
    safetyOfficer: string;
    publicInformationOfficer: string;
    liaisonOfficer: string;
    operationsChief: string;
    planningChief: string;
    logisticsChief: string;
    financeChief: string;
}

export interface IapMedical {
    aidStations: string;
    transportation: string;
    hospitals: string;
    emergencyProcedures: string;
}

export interface IapUas {
    /** Explicit include switch — defaults on when a UAS resource is assigned. */
    include: boolean;
    sunrise: string;
    sunset: string;
    tfrAltitude: string;
    tfrCenter: string;
    briefingTime: string;
    briefingLocation: string;
    personnel: string[];
}

export interface IapPlan {
    opNumber: number;
    dateFrom: string;
    timeFrom: string;
    dateTo: string;
    timeTo: string;
    preparedBy: string;
    preparedByPosition: string;
    approvedBy: string;
    objectives: string[];
    commandEmphasis: string;
    situationalAwareness: string;
    siteSafetyRequired: 'yes' | 'no' | '';
    siteSafetyLocation: string;
    org: IapOrg;
    assignments: IapAssignmentPlan[];
    comms: IapCommsRow[];
    medical: IapMedical;
    safetyMessage: string;
    uas: IapUas;
    updated?: string;
}

export function blankCommsRow(): IapCommsRow {
    return {
        zone: '', ch: '', func: '', channelName: '', assignment: '',
        rxFreq: '', rxTone: '', txFreq: '', txTone: '', mode: '', remarks: '',
    };
}

function str(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function strArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function sanitizeComms(raw: unknown): IapCommsRow[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r === 'object').map((r) => {
        const rec = r as Record<string, unknown>;
        return {
            zone: str(rec.zone), ch: str(rec.ch), func: str(rec.func),
            channelName: str(rec.channelName), assignment: str(rec.assignment),
            rxFreq: str(rec.rxFreq), rxTone: str(rec.rxTone),
            txFreq: str(rec.txFreq), txTone: str(rec.txTone),
            mode: str(rec.mode), remarks: str(rec.remarks),
        };
    });
}

function sanitizeAssignments(raw: unknown): IapAssignmentPlan[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((a) => a && typeof a === 'object').map((a) => {
        const rec = a as Record<string, unknown>;
        const resources = Array.isArray(rec.resources)
            ? rec.resources.filter((r) => r && typeof r === 'object').map((r) => {
                const rr = r as Record<string, unknown>;
                return {
                    identifier: str(rr.identifier), leader: str(rr.leader),
                    persons: str(rr.persons), contact: str(rr.contact),
                    reporting: str(rr.reporting),
                };
            })
            : [];
        return {
            segmentUid: str(rec.segmentUid),
            label: str(rec.label),
            supervisor: str(rec.supervisor),
            workAssignment: str(rec.workAssignment),
            specialInstructions: str(rec.specialInstructions),
            resources,
        };
    });
}

export function iapPlanFromValue(raw: unknown, opNumber: number): IapPlan | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const org = (rec.org && typeof rec.org === 'object' ? rec.org : {}) as Record<string, unknown>;
    const med = (rec.medical && typeof rec.medical === 'object' ? rec.medical : {}) as Record<string, unknown>;
    const uas = (rec.uas && typeof rec.uas === 'object' ? rec.uas : {}) as Record<string, unknown>;
    const safety = str(rec.siteSafetyRequired);
    return {
        opNumber,
        dateFrom: str(rec.dateFrom), timeFrom: str(rec.timeFrom),
        dateTo: str(rec.dateTo), timeTo: str(rec.timeTo),
        preparedBy: str(rec.preparedBy),
        preparedByPosition: str(rec.preparedByPosition),
        approvedBy: str(rec.approvedBy),
        objectives: strArray(rec.objectives),
        commandEmphasis: str(rec.commandEmphasis),
        situationalAwareness: str(rec.situationalAwareness),
        siteSafetyRequired: safety === 'yes' || safety === 'no' ? safety : '',
        siteSafetyLocation: str(rec.siteSafetyLocation),
        org: {
            incidentCommander: str(org.incidentCommander),
            deputy: str(org.deputy),
            safetyOfficer: str(org.safetyOfficer),
            publicInformationOfficer: str(org.publicInformationOfficer),
            liaisonOfficer: str(org.liaisonOfficer),
            operationsChief: str(org.operationsChief),
            planningChief: str(org.planningChief),
            logisticsChief: str(org.logisticsChief),
            financeChief: str(org.financeChief),
        },
        assignments: sanitizeAssignments(rec.assignments),
        comms: sanitizeComms(rec.comms),
        medical: {
            aidStations: str(med.aidStations),
            transportation: str(med.transportation),
            hospitals: str(med.hospitals),
            emergencyProcedures: str(med.emergencyProcedures),
        },
        safetyMessage: str(rec.safetyMessage),
        uas: {
            include: uas.include === true,
            sunrise: str(uas.sunrise), sunset: str(uas.sunset),
            tfrAltitude: str(uas.tfrAltitude), tfrCenter: str(uas.tfrCenter),
            briefingTime: str(uas.briefingTime), briefingLocation: str(uas.briefingLocation),
            personnel: strArray(uas.personnel),
        },
        updated: str(rec.updated) || undefined,
    };
}

function plansFromSchema(schema: MissionSchema): Record<string, unknown> {
    const raw = (schema.incident_response as Record<string, unknown>).iap_plans;
    return raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};
}

/**
 * Build a fresh plan from incident data, carrying comms/medical/safety and the
 * command team forward from the most recent previous OP plan (those rarely
 * change between periods and re-typing them each OP is the main friction).
 */
export function prefillIapPlan(input: IapInputs, previous?: IapPlan | null): IapPlan {
    const f = input.form201;
    return {
        opNumber: input.op.opNumber,
        dateFrom: input.dateFrom || previous?.dateFrom || '',
        timeFrom: input.timeFrom || previous?.timeFrom || '',
        dateTo: input.dateTo,
        timeTo: input.timeTo,
        preparedBy: input.preparedBy || previous?.preparedBy || '',
        preparedByPosition: f.positionTitle || previous?.preparedByPosition || '',
        approvedBy: f.incidentCommanders || previous?.approvedBy || '',
        objectives: input.objectives.length ? input.objectives : (previous?.objectives ?? []),
        commandEmphasis: f.situationSummary || previous?.commandEmphasis || '',
        situationalAwareness: f.weatherSummary || previous?.situationalAwareness || '',
        siteSafetyRequired: previous?.siteSafetyRequired ?? '',
        siteSafetyLocation: previous?.siteSafetyLocation ?? '',
        org: {
            incidentCommander: f.incidentCommanders || previous?.org.incidentCommander || '',
            deputy: previous?.org.deputy ?? '',
            safetyOfficer: f.safetyOfficer || previous?.org.safetyOfficer || '',
            publicInformationOfficer: f.publicInformationOfficer || previous?.org.publicInformationOfficer || '',
            liaisonOfficer: f.liaisonOfficer || previous?.org.liaisonOfficer || '',
            operationsChief: f.operationsSectionChief || previous?.org.operationsChief || '',
            planningChief: f.planningSectionChief || previous?.org.planningChief || '',
            logisticsChief: f.logisticsSectionChief || previous?.org.logisticsChief || '',
            financeChief: f.financeSectionChief || previous?.org.financeChief || '',
        },
        assignments: input.assignments.map((a) => {
            const prior = previous?.assignments.find((p) => p.segmentUid === a.segmentUid);
            const resources = input.resources
                .filter((r) => !a.team || r.resourceIdentifier === a.team)
                .map((r) => ({
                    identifier: r.resourceIdentifier,
                    leader: r.agency,
                    persons: '',
                    contact: '',
                    reporting: '',
                }));
            return {
                segmentUid: a.segmentUid,
                label: a.label,
                supervisor: a.team ?? prior?.supervisor ?? '',
                workAssignment: prior?.workAssignment
                    || [`Search segment ${a.label}.`, a.notes ?? ''].filter(Boolean).join(' '),
                specialInstructions: prior?.specialInstructions
                    ?? 'Report POD and coverage at debrief.',
                resources: resources.length ? resources : (prior?.resources ?? []),
            };
        }),
        comms: previous?.comms?.length
            ? previous.comms.map((c) => ({ ...c }))
            : [
                { ...blankCommsRow(), func: 'Command', channelName: f.adamRepeatedChannel, assignment: 'All personnel' },
                { ...blankCommsRow(), func: 'Tactical', channelName: f.carToCarChannel, assignment: 'Field teams' },
                { ...blankCommsRow(), func: 'Alternate', channelName: f.alternateChannel, assignment: 'As directed' },
            ].filter((c) => c.channelName.trim()),
        medical: previous?.medical ?? {
            aidStations: '', transportation: '', hospitals: '', emergencyProcedures: '',
        },
        safetyMessage: previous?.safetyMessage
            || [f.situationSummary, f.weatherSummary].filter(Boolean).join('\n\n'),
        uas: {
            ...(previous?.uas ?? {
                sunrise: '', sunset: '', tfrAltitude: '', tfrCenter: '',
                briefingTime: '', briefingLocation: '', personnel: [],
            }),
            // Auto-on when the OP has a drone/UAS resource; the builder lets
            // the IMT include it regardless (aviation planned before tasking).
            include: input.hasUas || previous?.uas.include === true,
            personnel: previous?.uas.personnel?.length
                ? previous.uas.personnel
                : input.resources
                    .filter((r) => /drone|uas|uav/i.test(`${r.resource} ${r.resourceIdentifier}`))
                    .map((r) => r.resourceIdentifier),
        },
    };
}

/** Load the saved plan for an OP (null when never saved). */
export async function loadIapPlan(
    mission: ActiveMission,
    opNumber: number,
): Promise<IapPlan | null> {
    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);
    return iapPlanFromValue(plansFromSchema(schema)[String(opNumber)], opNumber);
}

/** Most recent saved plan before this OP — the carry-forward source. */
export async function loadPreviousIapPlan(
    mission: ActiveMission,
    opNumber: number,
    registry: OpPeriodRegistryEntry[],
): Promise<IapPlan | null> {
    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);
    const plans = plansFromSchema(schema);
    const earlier = registry
        .map((op) => op.opNumber)
        .filter((n) => n < opNumber)
        .sort((a, b) => b - a);
    for (const n of earlier) {
        const plan = iapPlanFromValue(plans[String(n)], n);
        if (plan) return plan;
    }
    return null;
}

export async function saveIapPlan(mission: ActiveMission, plan: IapPlan): Promise<void> {
    const sub = await loadSchemaSubscription(mission);
    const loaded = await loadMissionSchema(sub);
    const ir = loaded.schema.incident_response as Record<string, unknown>;
    const plans = plansFromSchema(loaded.schema);
    ir.iap_plans = { ...plans, [String(plan.opNumber)]: { ...plan, updated: new Date().toISOString() } };
    await saveMissionSchema(sub, loaded.schema, {
        contentHash: loaded.contentHash,
        legacyLogId: loaded.legacyLogId,
        missionToken: schemaMissionToken(sub, mission),
    });
}
