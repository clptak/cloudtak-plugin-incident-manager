/**
 * Assemble per-operational-period IAP content from incident data and map it
 * onto the official ICS AcroForm field names (see docs/iap-template-fields.json).
 *
 * Sources: ICS-201 autofill (header, org roles, comms — already merges schema
 * + logs), Incident POST objectives, the OP assignment registry, the Resources
 * screen (filtered to the OP), and the IR briefing safety message.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpAssignment, OpPeriodRegistryEntry } from '../domain/entities.ts';
import { loadIcs201FromMission, type Ics201Form } from './ics201.ts';
import { loadSchemaSubscription } from './incidentSubscription.ts';
import { incidentPostFromSchema } from './incidentPostPersistence.ts';
import { loadMissionSchema } from './missionSchema.ts';
import { opAssignmentsFromSchema } from './opAssignmentPersistence.ts';
import { resourceAssignmentsFromSchemaValue, type ResourceAssignment } from './resourceAssignments.ts';
import { iapFormPlan as planForms, isUasLabel, type IncidentCategory } from '../domain/iap.ts';
import type { FilledForm, IapFormId, IapSection } from './iapPdf.ts';
import type { IapAssignmentPlan, IapPlan } from './iapPlanPersistence.ts';

export type { IncidentCategory };

export interface IapInputs {
    incidentName: string;
    incidentNumber: string;
    op: OpPeriodRegistryEntry;
    dateFrom: string;
    timeFrom: string;
    dateTo: string;
    timeTo: string;
    form201: Ics201Form;
    objectives: string[];
    assignments: OpAssignment[];
    resources: ResourceAssignment[];
    category: IncidentCategory;
    /** True when any OP resource is a drone/UAS — pulls in ICS 220. */
    hasUas: boolean;
    preparedBy: string;
}

function splitDt(iso: string | undefined): { date: string; time: string } {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '', time: '' };
    return {
        date: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`,
        time: `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`,
    };
}

export function isUasResource(r: ResourceAssignment): boolean {
    return isUasLabel(r.resource, r.resourceIdentifier);
}

/** Read everything the IAP needs for one operational period. */
export async function loadIapInputs(
    mission: ActiveMission,
    op: OpPeriodRegistryEntry,
    opts: { category?: IncidentCategory; preparedBy?: string } = {},
): Promise<IapInputs> {
    const sub = await loadSchemaSubscription(mission);
    const { schema } = await loadMissionSchema(sub);

    const form201 = (await loadIcs201FromMission(
        mission.guid,
        mission.missionToken,
        mission.name,
        mission,
    )).form;

    const objectives = incidentPostFromSchema(schema)
        .map((row) => row.objective.trim())
        .filter(Boolean);

    const assignments = opAssignmentsFromSchema(schema)
        .filter((a) => a.opNumber === op.opNumber);

    const resources = resourceAssignmentsFromSchemaValue(
        (schema.incident_response as Record<string, unknown>).resource_assignments,
    ).filter((r) => r.opNumber === op.opNumber);

    const from = splitDt(op.openedAt);
    const to = splitDt(op.closedAt);

    return {
        incidentName: form201.incidentName || mission.name,
        incidentNumber: form201.incidentNumber,
        op,
        dateFrom: from.date,
        timeFrom: from.time,
        dateTo: to.date,
        timeTo: to.time,
        form201,
        objectives: objectives.length ? objectives : form201.currentObjectives.filter(Boolean),
        assignments,
        resources,
        category: opts.category ?? 'search',
        hasUas: resources.some(isUasResource),
        preparedBy: opts.preparedBy ?? form201.preparedByName ?? '',
    };
}

/** Header fields shared by every ICS form (name differs per template). */
function header(plan: IapPlan, ctx: IapContext, nameField: string): Record<string, string> {
    return {
        [nameField]: ctx.incidentName,
        'Date From': plan.dateFrom,
        'Date To': plan.dateTo,
        'Time From': plan.timeFrom,
        'Time To': plan.timeTo,
    };
}

/** Per-form preparer, falling back to the plan's author. */
function preparerFor(plan: IapPlan, form: 'ics205' | 'ics206' | 'ics220'): string {
    return plan.preparers?.[form]?.trim() || plan.preparedBy;
}

/** "Prepared by" date/time stamp printed on every form. */
function preparedStamp(plan: IapPlan): string {
    const d = plan.dateFrom || '';
    const t = plan.timeFrom || '';
    return [d, t].filter(Boolean).join(' ');
}

export interface IapContext {
    incidentName: string;
    incidentNumber: string;
    category: IncidentCategory;
}

function ics202(plan: IapPlan, ctx: IapContext, attachments: IapFormId[]): FilledForm {
    return {
        text: {
            ...header(plan, ctx, '1 Incident Name_5'),
            '3 Objectives': plan.objectives
                .filter((o) => o.trim())
                .map((o, i) => `${i + 1}. ${o.trim()}`)
                .join('\n'),
            '4 Operational Period Command Emphasis': plan.commandEmphasis,
            'General Situational Awareness': plan.situationalAwareness,
            '5 Site Safety Plan Required Yes No Approved Site Safety Plans Located at': plan.siteSafetyLocation,
            '7 Prepared by Name': plan.preparedBy,
            PositionTitle_5: plan.preparedByPosition,
            '8 Approved by Incident Commander Name': plan.approvedBy,
            DateTime_5: preparedStamp(plan),
            ...(attachments.includes('ics220') ? { 'Other Attachments 1': 'ICS 220 (UAS)' } : {}),
        },
        check: [
            ...attachments
                .map((id) => ({
                    ics203: 'ICS 203', ics204: 'ICS 204', ics205: 'ICS 205',
                    ics206: 'ICS 206', ics207: 'ICS 207', ics208: 'ICS 208',
                } as Record<string, string>)[id])
                .filter((v): v is string => Boolean(v)),
            // Forms with no dedicated checkbox go in "Other Attachments".
            ...(attachments.includes('ics220') ? ['Check 1'] : []),
            ...(plan.siteSafetyRequired === 'yes' ? ['Yes'] : []),
            ...(plan.siteSafetyRequired === 'no' ? ['No'] : []),
        ],
        pageField: 'IAP Page',
    };
}

function ics203(plan: IapPlan, ctx: IapContext): FilledForm {
    const text: Record<string, string> = {
        ...header(plan, ctx, '1 Incident Name'),
        ICUCs: plan.org.incidentCommander,
        Deputy_2: plan.org.deputy,
        'Safety Officer_3': plan.org.safetyOfficer,
        'Public Info Officer': plan.org.publicInformationOfficer,
        'Liaison Officer_2': plan.org.liaisonOfficer,
        'Planning Section Chief': plan.org.planningChief,
        'Logistics Section Chief': plan.org.logisticsChief,
        'Finance/Adminsitration Section Chief': plan.org.financeChief,
        'Operations Section Chief 1': plan.org.operationsChief,
        '9 Prepared by Name': plan.preparedBy,
        PositionTitle_6: plan.preparedByPosition,
        DateTime_6: preparedStamp(plan),
    };
    // NB: official ICS-203 field names are inconsistent for rows 1-3
    // ('Division/Group Identifier 1', then double-spaced) — verified against
    // the template; do not "tidy" these strings.
    const identField = (n: number): string => {
        if (n === 1) return 'Division/Group Identifier 1';
        if (n === 2 || n === 3) return `DivisionGroup  Identifier ${n}`;
        return `DivisionGroup Identifier ${n}`;
    };
    // §5 rows are DIVISIONS and their supervisors — not segments/resources.
    plan.divisions.slice(0, 15).forEach((d, i) => {
        text[identField(i + 1)] = d.name;
        text[`DivisionGroup Name ${i + 1}`] = d.supervisor;
    });
    return { text, pageField: 'IAP Page_2' };
}

/** One ICS-204 per assignment (segment). */
function ics204(
    plan: IapPlan,
    ctx: IapContext,
    assignment: IapAssignmentPlan,
): FilledForm {
    const division = plan.divisions.find((d) => d.id === assignment.divisionId);
    const text: Record<string, string> = {
        ...header(plan, ctx, '1 Incident Name_7'),
        // §3 carries the DIVISION; the segment is named in §6 Work Assignments.
        '3 Division': division?.name ?? '',
        '3 Group': division ? '' : assignment.label,
        'Operations Section Chief_3': plan.org.operationsChief,
        'DivisionGroup Supervisor': division?.supervisor || assignment.supervisor,
        '6 Work Assignments': assignment.workAssignment,
        '7 Special Instructions': assignment.specialInstructions,
        // §8 Communications is people, not radio channels — the channel plan
        // lives on ICS-205.
        'Name/Function1': assignment.contactName,
        'Primary Contact  indicate cell pager or radio frequencysystemchannel 1': assignment.contactPhone,
        '9 Prepared by Name_2': plan.preparedBy,
        PositionTitle_7: plan.preparedByPosition,
        DateTime_7: preparedStamp(plan),
    };
    assignment.resources.slice(0, 10).forEach((r, i) => {
        const n = i + 1;
        text[`Resource IdentifierRow${n}_2`] = r.identifier;
        text[`LeaderRow${n}`] = r.leader;
        text[`Number of Persons, Row ${n}`] = r.persons;
        text[n <= 3
            ? `Contact eg phone pager radio frequency etc${n === 1 ? '' : `_${n}`}`
            : `Contact eg phone pager radio frequency etcRow${n}`] = r.contact;
        text[n <= 3
            ? `Reporting Location Special Equipment and Supplies Remarks Notes Information${n === 1 ? '' : `_${n}`}`
            : `Reporting Location Special Equipment and Supplies Remarks Notes InformationRow${n}`] = r.reporting;
    });
    return { text, pageField: 'IAP Page_3' };
}

function ics205(plan: IapPlan, ctx: IapContext): FilledForm {
    const text: Record<string, string> = {
        ...header(plan, ctx, '1 Incident Name_8'),
        '2 Date/Time Prepared': preparedStamp(plan),
        '5 Special Instructions': plan.commsSpecialInstructions,
        '6 Prepared by Communications Unit Leader Name': preparerFor(plan, 'ics205'),
        DateTime_8: preparedStamp(plan),
    };
    // The official ICS-205 exposes 8 channel rows.
    plan.comms.slice(0, 8).forEach((c, i) => {
        const n = i + 1;
        text[`Zone GrpRow${n}`] = c.zone;
        text[`Ch Row${n}`] = c.ch;
        text[`FunctionRow${n}`] = c.func;
        text[`Channel NameTrunked Radio System TalkgroupRow${n}`] = c.channelName;
        text[`AssignmentRow${n}`] = c.assignment;
        text[`RX Freq N or WRow${n}`] = c.rxFreq;
        text[`RX ToneNACRow${n}`] = c.rxTone;
        text[`TX Freq N or WRow${n}`] = c.txFreq;
        text[`TX ToneNACRow${n}`] = c.txTone;
        text[`Mode A D or MRow${n}`] = c.mode;
        text[`RemarksRow${n}`] = c.remarks;
    });
    return { text, pageField: 'IAP Page_4' };
}

/** ICS-205A Communications List — 34 rows on the official form. */
function ics205a(plan: IapPlan, ctx: IapContext): FilledForm {
    const text: Record<string, string> = {
        ...header(plan, ctx, '1 Incident Name_9'),
        '4 Prepared by Name': preparerFor(plan, 'ics205'),
        PositionTitle_8: plan.preparedByPosition,
        DateTime_9: preparedStamp(plan),
    };
    plan.commsList.slice(0, 34).forEach((row, i) => {
        const n = i + 1;
        text[`Incident Assigned PositionRow${n}`] = row.position;
        text[`Name AlphabetizedRow${n}`] = row.name;
        text[`Methods of Contact phone pager cell etcRow${n}`] = row.contact;
    });
    return { text, pageField: 'IAP Page_5' };
}

function ics206(plan: IapPlan, ctx: IapContext): FilledForm {
    return {
        text: {
            ...header(plan, ctx, '1 Incident Name_10'),
            // §5 Medical aid stations / §6 transportation / §7 hospitals rows.
            NameRow1: plan.medical.aidStations,
            'Ambulance ServiceRow1': plan.medical.transportation,
            'Hospital NameRow1': plan.medical.hospitals,
            'Special Medical Emergency Procedures': plan.medical.emergencyProcedures,
            '7 Prepared by Medical Unit Leader Name': preparerFor(plan, 'ics206'),
            '8 Approved by Safety Officer Name': plan.org.safetyOfficer,
            DateTime_10: preparedStamp(plan),
        },
        pageField: 'IAP Page_6',
    };
}

function ics207(plan: IapPlan, ctx: IapContext): FilledForm {
    return {
        text: {
            ...header(plan, ctx, '1 Incident Name_11'),
            'Incident Commanders_2': plan.org.incidentCommander,
            'Liaison Officer_3': plan.org.liaisonOfficer,
            'Safety Officer_4': plan.org.safetyOfficer,
            'Public Information Officer_2': plan.org.publicInformationOfficer,
            'Operations Section ChiefRow1': plan.org.operationsChief,
            'Planning Section Chief_3': plan.org.planningChief,
            'Logistics Section Chief_2': plan.org.logisticsChief,
            'FinanceAdmin Section Chief': plan.org.financeChief,
            '4 Prepared by Name_2': plan.preparedBy,
            PositionTitle_9: plan.preparedByPosition,
            DateTime_11: preparedStamp(plan),
        },
        pageField: 'IAP Page_6',
    };
}

function ics208(plan: IapPlan, ctx: IapContext): FilledForm {
    return {
        text: {
            ...header(plan, ctx, '1 Incident Name_12'),
            '3 Safety MessageExpanded Safety Message Safety Plan Site Safety Plan': plan.safetyMessage,
            '4 Site Safety Plan Required Yes No Approved Site Safety Plans Located At': plan.siteSafetyLocation,
            '5 Prepared by Name': plan.preparedBy,
            PositionTitle_10: plan.preparedByPosition,
            DateTime_12: preparedStamp(plan),
        },
        pageField: 'IAP Page_7',
        check: [
            ...(plan.siteSafetyRequired === 'yes' ? ['Site Safety Plan Required? Yes'] : []),
            ...(plan.siteSafetyRequired === 'no' ? ['Site Safety Plan Required? No'] : []),
        ],
    };
}

/** ICS-220 §10 holds 5 aircraft rows; extra rows spill onto repeat pages. */
export const UAS_ROWS_PER_PAGE = 5;

function ics220(plan: IapPlan, ctx: IapContext, chunk = 0): FilledForm {
    const text: Record<string, string> = {
        '1 Incident Name': ctx.incidentName,
        '2 Operational Period Date From': plan.dateFrom,
        '2 Operational Period Date To': plan.dateTo,
        '2 Operational Period Time From': plan.timeFrom,
        '2 Operational Period Time To': plan.timeTo,
        '3 Sunrise': plan.uas.sunrise,
        '3 Sunset': plan.uas.sunset,
        '6 TFR ALTITUDE': plan.uas.tfrAltitude,
        '6 TFR Center Point': plan.uas.tfrCenter,
        'Aviation Mission Briefing Time': plan.uas.briefingTime,
        Location: plan.uas.briefingLocation,
        '11 Prepared by Name': preparerFor(plan, 'ics220'),
        DateTime: preparedStamp(plan),
    };

    // Personnel: the template exposes named role fields plus NameRow4/5.
    const uasFields = ['NameAir Ops Branch Dir', 'NameGroup Supervisor', 'NameGroup Supervisor_2', 'NameRow4', 'NameRow5'];
    plan.uas.personnel.slice(0, uasFields.length).forEach((p, i) => {
        text[uasFields[i]] = p;
    });

    // §10 aircraft table for this page's slice (rows 1-5, 6-10, …).
    const slice = plan.uas.aircraft.slice(
        chunk * UAS_ROWS_PER_PAGE,
        (chunk + 1) * UAS_ROWS_PER_PAGE,
    );
    slice.forEach((a, i) => {
        const n = i + 1;
        text[`FAA N Or other IDRow${n}`] = a.faaId;
        text[`CategoryKindTypeRow${n}`] = a.category;
        text[`MakeModelRow${n}`] = a.makeModel;
        text[`Base  OwnerRow${n}`] = a.baseOwner;
        text[`AvailableRow${n}`] = a.available;
        text[`StartRow${n}`] = a.start;
        text[`RemarksRow${n}`] = a.remarks;
    });
    if (chunk > 0) {
        text['UAS Mission Remarks'] =
            `Continuation page ${chunk + 1} — aircraft ${chunk * UAS_ROWS_PER_PAGE + 1}`
            + `–${chunk * UAS_ROWS_PER_PAGE + slice.length}.`;
    }
    return { text };
}

export function hasMedicalContent(plan: IapPlan): boolean {
    return Boolean(
        plan.medical.aidStations.trim() || plan.medical.transportation.trim()
        || plan.medical.hospitals.trim() || plan.medical.emergencyProcedures.trim(),
    );
}

/** Which forms make up the IAP for this plan (domain rule). */
export function iapFormPlanFor(plan: IapPlan, ctx: IapContext, hasUas = false): IapFormId[] {
    const base = planForms({
        category: ctx.category,
        // The saved plan's explicit switch wins; detection only seeds it.
        hasUas: plan.uas.include || hasUas,
        hasMedical: hasMedicalContent(plan),
        hasCommsList: plan.includeForms.ics205a && plan.commsList.some((r) => r.name.trim() || r.position.trim()),
    }) as IapFormId[];
    const set = new Set(base);
    // Explicit include toggles add forms the category rules left out.
    if (plan.includeForms.ics207) set.add('ics207');
    if (plan.includeForms.ics209) set.add('ics209');
    const order: IapFormId[] = ['ics202', 'ics203', 'ics204', 'ics205', 'ics205a', 'ics206', 'ics207', 'ics208', 'ics209', 'ics220'];
    return order.filter((id) => set.has(id));
}

/** Build the ordered, filled section list for the merged IAP PDF. */
export function buildIapSections(
    plan: IapPlan,
    ctx: IapContext,
    hasUas = false,
): IapSection[] {
    const forms = iapFormPlanFor(plan, ctx, hasUas);
    const attachments = forms.filter((id) => id !== 'ics202');
    const sections: IapSection[] = [
        { id: 'ics202', filled: ics202(plan, ctx, attachments) },
        { id: 'ics203', filled: ics203(plan, ctx) },
    ];
    plan.assignments.forEach((a) => {
        sections.push({ id: 'ics204', filled: ics204(plan, ctx, a), pageField: 'IAP Page_3' });
    });
    sections.push({ id: 'ics205', filled: ics205(plan, ctx), pageField: 'IAP Page_4' });
    if (forms.includes('ics205a')) sections.push({ id: 'ics205a', filled: ics205a(plan, ctx) });
    if (forms.includes('ics206')) sections.push({ id: 'ics206', filled: ics206(plan, ctx) });
    if (forms.includes('ics207')) sections.push({ id: 'ics207', filled: ics207(plan, ctx) });
    sections.push({ id: 'ics208', filled: ics208(plan, ctx) });
    if (forms.includes('ics220')) {
        // One page per 5 aircraft; always at least one page.
        const pages = Math.max(1, Math.ceil(plan.uas.aircraft.length / UAS_ROWS_PER_PAGE));
        for (let chunk = 0; chunk < pages; chunk++) {
            sections.push({ id: 'ics220', filled: ics220(plan, ctx, chunk) });
        }
    }
    return sections;
}
