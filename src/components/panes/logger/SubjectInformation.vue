<template>
    <div class='card'>
        <div class='card-header d-flex align-items-center justify-content-between'>
            <h3 class='card-title mb-0'>
                Subject Information
            </h3>
            <button
                type='button'
                class='btn btn-outline-primary btn-sm'
                :disabled='drafts.length >= MAX_SUBJECTS || !availableNumbers.length'
                @click='addSubject'
            >
                + Add Subject
            </button>
        </div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Enter details for one or more missing subjects. Each subject is saved as a single
                DataSync log entry (non-empty fields only) keyed by subject number.
            </p>

            <div
                v-if='loadingSent'
                class='text-muted small mb-2'
            >
                Loading saved subjects…
            </div>

            <div
                v-for='draft in drafts'
                :key='draft.id'
                class='card mb-2'
            >
                <div
                    class='card-header py-2 d-flex align-items-center gap-2'
                    style='cursor: pointer;'
                    @click='toggleDraft(draft.id)'
                >
                    <span class='me-1'>{{ draft.expanded ? '▾' : '▸' }}</span>
                    <span class='fw-bold'>
                        Subject {{ displayNumber(draft.form.subjectCaseID) }}
                        <span
                            v-if='draftSummary(draft.form)'
                            class='text-muted fw-normal'
                        > — {{ draftSummary(draft.form) }}</span>
                    </span>
                    <span
                        v-if='draft.form.logId || isSent(draft.form.subjectCaseID)'
                        class='badge bg-success-lt text-success ms-1'
                    >saved</span>
                    <span
                        v-else-if='hasFilledFields(draft.form)'
                        class='badge bg-warning-lt text-warning ms-1'
                    >draft</span>
                    <button
                        v-if='drafts.length > 1'
                        type='button'
                        class='btn btn-sm btn-link text-danger ms-auto p-0'
                        title='Remove subject'
                        @click.stop='removeDraft(draft.id)'
                    >
                        Remove
                    </button>
                </div>
                <div
                    v-show='draft.expanded'
                    class='card-body pt-3'
                >
                    <div class='row g-3'>
                        <div class='col-md-4'>
                            <label class='form-label'>Subject Number</label>
                            <select
                                v-model='draft.form.subjectCaseID'
                                class='form-select'
                            >
                                <option
                                    v-for='n in SUBJECT_NUMBERS'
                                    :key='n'
                                    :value='n'
                                    :disabled='isNumberUsed(n, draft.id)'
                                >
                                    {{ displayNumber(n) }}
                                </option>
                            </select>
                        </div>
                        <div class='col-md-8'>
                            <label class='form-label'>Subject Full Name</label>
                            <input
                                v-model='draft.form.subjectName'
                                type='text'
                                class='form-control'
                                placeholder='Subject Full Name'
                            >
                        </div>

                        <div class='col-md-4'>
                            <label class='form-label'>Age</label>
                            <input
                                v-model='draft.form.subjectAge'
                                type='text'
                                class='form-control'
                                placeholder='Subject Age'
                            >
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label'>Gender</label>
                            <select
                                v-model='draft.form.subjectGender'
                                class='form-select'
                            >
                                <option value=''>
                                    Select Gender
                                </option>
                                <option value='male'>
                                    Male
                                </option>
                                <option value='female'>
                                    Female
                                </option>
                                <option value='other'>
                                    Other
                                </option>
                            </select>
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label'>Category</label>
                            <select
                                v-model='draft.form.subjectCategory'
                                class='form-select'
                            >
                                <option value=''>
                                    Select Category
                                </option>
                                <option
                                    v-for='c in CATEGORIES'
                                    :key='c.value'
                                    :value='c.value'
                                >
                                    {{ c.label }}
                                </option>
                            </select>
                        </div>

                        <div class='col-12'>
                            <label class='form-label'>Description</label>
                            <input
                                v-model='draft.form.subjectDescription'
                                type='text'
                                class='form-control'
                                placeholder='Height, weight, hair color, eye color, clothing'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>Medical Conditions</label>
                            <input
                                v-model='draft.form.subjectMedicalConditions'
                                type='text'
                                class='form-control'
                                placeholder='Medical Conditions'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>Experience</label>
                            <input
                                v-model='draft.form.subjectExperience'
                                type='text'
                                class='form-control'
                                placeholder='Experience'
                            >
                        </div>
                        <div class='col-12'>
                            <label class='form-label'>Equipment</label>
                            <input
                                v-model='draft.form.subjectEquipment'
                                type='text'
                                class='form-control'
                                placeholder='Equipment'
                            >
                        </div>

                        <div class='col-md-6'>
                            <label class='form-label'>Photo from DataSync</label>
                            <select
                                v-model='draft.form.subjectPhoto'
                                class='form-select'
                            >
                                <option value=''>
                                    Select Photo From DataSync
                                </option>
                                <option
                                    v-for='c in missionPhotos'
                                    :key='c.uid'
                                    :value='c.uid'
                                >
                                    {{ c.name || c.uid }}
                                </option>
                            </select>
                            <div
                                v-if='loadingFeatures'
                                class='form-text'
                            >
                                Loading mission attachments…
                            </div>
                            <div
                                v-else-if='!missionPhotos.length'
                                class='form-text text-muted'
                            >
                                No image attachments in the active DataSync.
                            </div>
                        </div>

                        <div class='col-12'>
                            <label class='form-label'>Subject IPP</label>
                            <select
                                v-model='draft.form.subjectIppFromTak'
                                class='form-select mb-2'
                                :disabled='!!draft.form.subjectIpp.trim()'
                            >
                                <option value=''>
                                    Subject IPP from DataSync
                                </option>
                                <option
                                    v-for='m in missionMarkers'
                                    :key='m.uid'
                                    :value='ippOptionValue(m)'
                                >
                                    {{ markerLabel(m) }}
                                </option>
                            </select>
                            <div class='small text-muted mb-1'>
                                OR
                            </div>
                            <input
                                v-model='draft.form.subjectIpp'
                                type='text'
                                class='form-control'
                                :disabled='!!draft.form.subjectIppFromTak'
                                placeholder='Enter Subject IPP Coordinates (lat, lon)'
                            >
                        </div>

                        <div class='col-md-6'>
                            <label class='form-label'>Time Subject Went Missing</label>
                            <input
                                v-model='draft.form.subjectTimeWentMissing'
                                type='datetime-local'
                                class='form-control'
                            >
                        </div>
                        <div class='col-md-6'>
                            <label class='form-label'>Time Subject Reported Missing</label>
                            <input
                                v-model='draft.form.subjectTimeReportedMissing'
                                type='datetime-local'
                                class='form-control'
                            >
                        </div>

                        <div class='col-md-6'>
                            <label class='form-label'>Reported Missing By</label>
                            <select
                                v-model='draft.form.subjectReportedMissingBy'
                                class='form-select'
                            >
                                <option value=''>
                                    Select Who Reported Subject Missing
                                </option>
                                <option
                                    v-for='r in REPORTED_BY'
                                    :key='r'
                                    :value='r'
                                >
                                    {{ r }}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if='!availableNumbers.length && drafts.length >= MAX_SUBJECTS'
                class='form-text text-muted'
            >
                All {{ MAX_SUBJECTS }} subject slots are in use for this mission.
            </div>

            <div class='mt-3'>
                <button
                    type='button'
                    class='btn btn-primary btn-sm'
                    :disabled='!activeMission || posting || !filledCount'
                    @click='send'
                >
                    {{ posting ? 'Sending…' : `Send ${filledCount} subject${filledCount === 1 ? '' : 's'} to DataSync` }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm ms-2'
                    @click='resetDrafts'
                >
                    Clear Fields
                </button>
            </div>

            <div
                v-if='!activeMission'
                class='form-text text-warning mt-2'
            >
                No active mission. Select one in Create | Open first.
            </div>
            <div
                v-else
                class='form-text mt-2'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
            </div>
            <div
                v-if='status'
                class='fw-bold mt-1'
                :class='statusError ? "text-danger" : "text-success"'
            >
                {{ status }}
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import Subscription from '../../../../../../src/base/subscription.ts';
import type { Feature } from '../../../../../../src/types.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

const SUBJECT_KEYWORD = 'subject-information';
const SUBJECT_NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'] as const;
const MAX_SUBJECTS = SUBJECT_NUMBERS.length;

const CATEGORIES = [
    { value: 'hiker', label: 'Hiker' },
    { value: 'hunter', label: 'Hunter' },
    { value: 'child', label: 'Child' },
    { value: 'elderly', label: 'Elderly' },
    { value: 'mental_illness', label: 'Mental Illness' },
    { value: 'alzheimer_dementia', label: "Alzheimer's/Dementia" },
    { value: 'substance_abuse', label: 'Substance Abuse' },
    { value: 'other', label: 'Other' },
] as const;

const REPORTED_BY = [
    'Boyfriend or Girlfriend',
    'Citizen',
    'Family',
    'Friends',
    'Indian Tribe',
    'Law Enforcement',
    'Park Ranger',
    'Responsible Party',
    'Separated Companion',
    'ARFCC',
    'Other',
] as const;

interface SubjectForm {
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

interface SubjectDraft {
    id: string;
    expanded: boolean;
    form: SubjectForm;
}

interface MissionMarker {
    uid: string;
    callsign: string;
    coords?: [number, number];
}

interface MissionPhoto {
    uid: string;
    name: string;
}

interface SentSubject {
    number: string;
    content: string;
    created: string;
    id: string;
    fields: SubjectForm;
}

let nextDraftId = 1;

function blankForm(subjectCaseID = '01'): SubjectForm {
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

function newDraft(form?: SubjectForm, expanded = true): SubjectDraft {
    return {
        id: String(nextDraftId++),
        expanded,
        form: form ?? blankForm(),
    };
}

const drafts = ref<SubjectDraft[]>([newDraft()]);
const sentSubjects = ref<SentSubject[]>([]);
const missionMarkers = ref<MissionMarker[]>([]);
const missionPhotos = ref<MissionPhoto[]>([]);

const loadingSent = ref(false);
const loadingFeatures = ref(false);
const posting = ref(false);
const status = ref('');
const statusError = ref(false);

function displayNumber(n: string): string {
    return String(Number.parseInt(n, 10));
}

function hasValue(value: string | undefined): value is string {
    return !!value?.trim();
}

function hasFilledFields(f: SubjectForm): boolean {
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

const filledDrafts = computed(() => drafts.value.filter((d) => hasFilledFields(d.form)));
const filledCount = computed(() => filledDrafts.value.length);

const usedNumbers = computed(() => new Set(drafts.value.map((d) => d.form.subjectCaseID)));

const availableNumbers = computed(() =>
    SUBJECT_NUMBERS.filter((n) => !usedNumbers.value.has(n)),
);

function isNumberUsed(number: string, draftId: string): boolean {
    return drafts.value.some((d) => d.id !== draftId && d.form.subjectCaseID === number);
}

function isSent(number: string): boolean {
    return sentSubjects.value.some((s) => s.number === number);
}

function draftSummary(f: SubjectForm): string {
    if (hasValue(f.subjectName)) return f.subjectName.trim();
    if (hasValue(f.subjectAge)) return `Age ${f.subjectAge.trim()}`;
    if (hasValue(f.subjectCategory)) {
        return CATEGORIES.find((c) => c.value === f.subjectCategory)?.label ?? f.subjectCategory;
    }
    return '';
}

function toggleDraft(id: string): void {
    const d = drafts.value.find((x) => x.id === id);
    if (d) d.expanded = !d.expanded;
}

function nextAvailableNumber(): string | null {
    return availableNumbers.value[0] ?? null;
}

function addSubject(): void {
    const num = nextAvailableNumber();
    if (!num || drafts.value.length >= MAX_SUBJECTS) return;
    for (const d of drafts.value) d.expanded = false;
    drafts.value.push(newDraft(blankForm(num), true));
}

function removeDraft(id: string): void {
    if (drafts.value.length <= 1) return;
    drafts.value = drafts.value.filter((d) => d.id !== id);
    if (!drafts.value.some((d) => d.expanded)) {
        drafts.value[0].expanded = true;
    }
}

function resetDrafts(): void {
    drafts.value = [newDraft(blankForm(), true)];
    status.value = '';
}

function ippOptionValue(m: MissionMarker): string {
    if (m.coords) return `${m.coords[1]} ,${m.coords[0]};${m.uid}`;
    return m.uid;
}

function markerLabel(m: MissionMarker): string {
    if (m.coords) {
        return `${m.callsign} (${m.coords[1].toFixed(5)}, ${m.coords[0].toFixed(5)})`;
    }
    return m.callsign;
}

function categoryLabel(value: string): string {
    return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function subjectNumberFromLog(keywords?: string[]): string | null {
    if (!keywords?.includes(SUBJECT_KEYWORD)) return null;
    const tag = keywords.find((k) => k.startsWith('subject:'));
    if (!tag) return null;
    const num = tag.slice('subject:'.length);
    return (SUBJECT_NUMBERS as readonly string[]).includes(num) ? num : null;
}

function kwValue(keywords: string[] | undefined, prefix: string): string {
    const tag = keywords?.find((k) => k.startsWith(prefix));
    return tag ? tag.slice(prefix.length) : '';
}

function fieldsFromLog(keywords?: string[]): SubjectForm {
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

function buildContent(f: SubjectForm): string {
    const parts = buildParts(f);
    return `Subject ${displayNumber(f.subjectCaseID)} — ${parts.join('; ')}`;
}

function buildKeywords(f: SubjectForm): string[] {
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

function rebuildDraftsFromSent(): void {
    if (!sentSubjects.value.length) {
        drafts.value = [newDraft(blankForm(), true)];
        return;
    }

    drafts.value = sentSubjects.value.map((s, i) =>
        newDraft({ ...s.fields, subjectCaseID: s.number, logId: s.id }, i === 0),
    );

    const used = new Set(drafts.value.map((d) => d.form.subjectCaseID));
    const spare = SUBJECT_NUMBERS.find((n) => !used.has(n));
    if (spare && drafts.value.length < MAX_SUBJECTS) {
        drafts.value.push(newDraft(blankForm(spare), false));
    }
}

async function loadMissionAssets(): Promise<void> {
    if (!activeMission.value) {
        missionMarkers.value = [];
        missionPhotos.value = [];
        return;
    }
    loadingFeatures.value = true;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const feats = await sub.feature.list({ refresh: true });
        missionMarkers.value = feats
            .filter((f: Feature) => (f.geometry as { type?: string })?.type === 'Point')
            .map((f: Feature) => {
                const props = (f.properties ?? {}) as { callsign?: string };
                const geom = (f.geometry ?? {}) as { coordinates?: number[] };
                const marker: MissionMarker = {
                    uid: String(f.id),
                    callsign: props.callsign || String(f.id),
                };
                if (Array.isArray(geom.coordinates)) {
                    marker.coords = [geom.coordinates[0], geom.coordinates[1]];
                }
                return marker;
            });

        const contents = await sub.contents.list();
        missionPhotos.value = contents
            .filter((c) => (c.mimeType || '').startsWith('image/'))
            .map((c) => ({ uid: c.uid, name: c.name || c.uid }));
    } catch {
        missionMarkers.value = [];
        missionPhotos.value = [];
    } finally {
        loadingFeatures.value = false;
    }
}

async function loadSent(): Promise<void> {
    if (!activeMission.value) {
        sentSubjects.value = [];
        drafts.value = [newDraft()];
        return;
    }
    loadingSent.value = true;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        const logs = await sub.log.list({ refresh: true });

        const byNumber = new Map<string, SentSubject>();
        for (const log of logs) {
            const number = subjectNumberFromLog(log.keywords);
            if (!number) continue;
            const created = log.created || log.dtg || '';
            const prev = byNumber.get(number);
            if (!prev || Date.parse(created) >= Date.parse(prev.created)) {
                byNumber.set(number, {
                    number,
                    content: log.content || '',
                    created,
                    id: String(log.id),
                    fields: fieldsFromLog(log.keywords),
                });
            }
        }
        sentSubjects.value = [...byNumber.values()].sort(
            (a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10),
        );
        rebuildDraftsFromSent();
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load saved subjects: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loadingSent.value = false;
    }
}

onMounted(() => {
    void loadSent();
    void loadMissionAssets();
});
watch(() => activeMission.value?.guid, () => {
    void loadSent();
    void loadMissionAssets();
});

async function send(): Promise<void> {
    if (!activeMission.value || !filledCount.value) return;
    posting.value = true;
    status.value = '';
    statusError.value = false;
    let created = 0;
    let updated = 0;
    let failed = 0;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        for (const draft of filledDrafts.value) {
            const f = draft.form;
            const existing = sentSubjects.value.find((s) => s.number === f.subjectCaseID);
            const body = {
                dtg: new Date().toISOString(),
                content: buildContent(f),
                keywords: buildKeywords(f),
            };
            try {
                if (f.logId || existing?.id) {
                    await sub.log.update(f.logId || existing!.id, body);
                    updated++;
                } else {
                    await sub.log.create(body);
                    created++;
                }
            } catch {
                failed++;
            }
        }
        statusError.value = failed > 0;
        const parts: string[] = [];
        if (created) parts.push(`${created} new`);
        if (updated) parts.push(`${updated} updated`);
        status.value = `Saved ${parts.join(', ') || '0'} to ${activeMission.value.name}`
            + (failed ? `, ${failed} failed.` : '.');
        await loadSent();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}
</script>
