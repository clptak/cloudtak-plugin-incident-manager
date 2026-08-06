<template>
    <TablerBorder
        class='cloudtak-accent text-white'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-2 w-100'>
                <span>Subject Information</span>
                <button
                    type='button'
                    class='btn btn-outline-primary btn-sm ms-auto'
                    :disabled='drafts.length >= MAX_SUBJECTS || !availableNumbers.length'
                    @click='addSubject'
                >
                    + Add Subject
                </button>
            </p>
        </template>

        <p class='text-muted small mb-3'>
            Enter details for one or more missing subjects.
            Send posts each filled subject as a DataSync log entry and upserts it into
            <strong>mission_schema.json</strong> (<code>incident_response.subjects</code>).
        </p>

        <div
            v-if='loadingSent'
            class='text-muted small mb-2'
        >
            Loading saved subjects…
        </div>

        <template
            v-for='draft in drafts'
            :key='draft.id'
        >
            <!-- Collapsed subject row -->
            <div
                v-if='!draft.expanded'
                class='cloudtak-accent border rounded-3 text-white mb-2 px-3 py-2 d-flex align-items-center gap-2 cursor-pointer user-select-none'
                role='button'
                tabindex='0'
                :aria-expanded='false'
                @click='toggleDraft(draft.id)'
                @keydown.enter.prevent='toggleDraft(draft.id)'
                @keydown.space.prevent='toggleDraft(draft.id)'
            >
                <IconChevronDown
                    class='transition-transform text-white-50 rotate-180'
                    :size='18'
                    stroke='1.5'
                />
                <span class='fw-bold'>
                    Subject {{ displayNumber(draft.form.subjectCaseID) }}
                    <span
                        v-if='draftSummary(draft.form)'
                        class='text-white-50 fw-normal'
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

            <!-- Expanded subject card -->
            <div
                v-else
                class='cloudtak-accent border rounded-3 text-white mb-2'
            >
                <div
                    class='d-flex align-items-center gap-2 px-3 py-2 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleDraft(draft.id)'
                    @keydown.enter.prevent='toggleDraft(draft.id)'
                    @keydown.space.prevent='toggleDraft(draft.id)'
                >
                    <IconChevronDown
                        class='transition-transform text-white-50'
                        :size='18'
                        stroke='1.5'
                    />
                    <span class='fw-bold'>
                        Subject {{ displayNumber(draft.form.subjectCaseID) }}
                        <span
                            v-if='draftSummary(draft.form)'
                            class='text-white-50 fw-normal'
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
                <div class='px-3 pb-3 pt-1'>
                    <div class='row g-3'>
                        <div class='col-md-4'>
                            <TablerEnum
                                :model-value='displayNumber(draft.form.subjectCaseID)'
                                label='Subject Number'
                                :options='subjectNumberOptions(draft)'
                                @update:model-value='onSubjectNumberLabelChange(draft, $event)'
                            />
                        </div>
                        <div class='col-md-8'>
                            <TablerInput
                                v-model='draft.form.subjectName'
                                label='Subject Full Name'
                                placeholder='Subject Full Name'
                            />
                        </div>

                        <div class='col-md-4'>
                            <TablerInput
                                v-model='draft.form.subjectDateOfBirth'
                                label='Date of Birth'
                                type='date'
                                @change='onDobChange(draft.form)'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='draft.form.subjectAge'
                                label='Age'
                                :disabled='!!draft.form.subjectDateOfBirth'
                                :placeholder='draft.form.subjectDateOfBirth ? "Calculated from date of birth" : "Subject Age"'
                            />
                            <div
                                v-if='draft.form.subjectDateOfBirth'
                                class='form-text'
                            >
                                <span
                                    v-if='effectiveAge(draft.form)'
                                    class='text-success'
                                >→ {{ effectiveAge(draft.form) }} years (from DOB)</span>
                                <span
                                    v-else
                                    class='text-danger'
                                >Invalid date of birth</span>
                            </div>
                        </div>
                        <div class='col-md-4'>
                            <TablerEnum
                                :model-value='genderLabel(draft.form.subjectGender)'
                                label='Gender'
                                :options='GENDER_OPTIONS'
                                @update:model-value='onGenderLabelChange(draft, $event)'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerEnum
                                :model-value='categoryLabelFor(draft.form.subjectCategory)'
                                label='Category'
                                :options='CATEGORY_OPTIONS'
                                @update:model-value='onCategoryLabelChange(draft, $event)'
                            />
                        </div>

                        <div class='col-12'>
                            <TablerInput
                                v-model='draft.form.subjectDescription'
                                label='Description'
                                placeholder='General description or notes'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='draft.form.subjectHeight'
                                label='Height'
                                placeholder='Height'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='draft.form.subjectWeight'
                                label='Weight'
                                placeholder='Weight'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='draft.form.subjectHairColor'
                                label='Hair Color'
                                placeholder='Hair Color'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerEnum
                                :model-value='yesNoLabel(draft.form.subjectFacialHair)'
                                label='Facial Hair'
                                :options='YES_NO_OPTIONS'
                                @update:model-value='draft.form.subjectFacialHair = onYesNoLabelChange($event)'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerEnum
                                :model-value='yesNoLabel(draft.form.subjectGlasses)'
                                label='Glasses'
                                :options='YES_NO_OPTIONS'
                                @update:model-value='draft.form.subjectGlasses = onYesNoLabelChange($event)'
                            />
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='draft.form.subjectDistinguishingMarks'
                                label='Other Distinguishing Marks'
                                placeholder='Other Distinguishing Marks'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectClothing'
                                label='Clothing Description'
                                placeholder='Clothing Description'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectFootwear'
                                label='Footwear (type and size)'
                                placeholder='Footwear (type and size)'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectVehicle'
                                label='Vehicle Description'
                                placeholder='Vehicle Description'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectMedicalConditions'
                                label='Medical Conditions'
                                placeholder='Medical Conditions'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectExperience'
                                label='Experience'
                                placeholder='Experience'
                            />
                        </div>
                        <div class='col-12'>
                            <TablerInput
                                v-model='draft.form.subjectEquipment'
                                label='Equipment'
                                placeholder='Equipment'
                            />
                        </div>

                        <div class='col-md-6'>
                            <TablerEnum
                                :model-value='photoLabelForUid(draft.form.subjectPhoto)'
                                label='Photo from DataSync'
                                :options='photoOptions'
                                @update:model-value='onPhotoLabelChange(draft, $event)'
                            />
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
                            <TablerEnum
                                :model-value='ippLabelForValue(draft.form.subjectIppFromTak)'
                                label='Subject IPP'
                                :options='ippOptions'
                                :disabled='!!draft.form.subjectIpp.trim()'
                                @update:model-value='onIppLabelChange(draft, $event)'
                            />
                            <div class='small text-muted my-1'>
                                OR
                            </div>
                            <TablerInput
                                v-model='draft.form.subjectIpp'
                                :disabled='!!draft.form.subjectIppFromTak'
                                placeholder='Enter Subject IPP Coordinates (lat, lon)'
                            />
                        </div>

                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectTimeWentMissing'
                                label='Time Subject Went Missing'
                                type='datetime-local'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='draft.form.subjectTimeReportedMissing'
                                label='Time Subject Reported Missing'
                                type='datetime-local'
                            />
                        </div>

                        <div class='col-md-6'>
                            <TablerEnum
                                :model-value='reportedByLabel(draft.form.subjectReportedMissingBy)'
                                label='Reported Missing By'
                                :options='REPORTED_BY_OPTIONS'
                                @update:model-value='onReportedByLabelChange(draft, $event)'
                            />
                        </div>
                    </div>
                </div>
            </div>
        </template>

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
                :disabled='posting || !filledCount'
                @click='onSend'
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

        <TablerInlineAlert
            v-if='!activeMission'
            class='mt-2'
            severity='warning'
            title='Mission Required'
            description='No active mission. Select one in Create | Open first.'
        />
        <p
            v-else
            class='form-text mt-2'
        >
            Active DataSync: <strong>{{ activeMission.name }}</strong>
        </p>
        <TablerInlineAlert
            v-if='status'
            class='mt-2'
            :severity='statusError ? "danger" : "success"'
            :title='statusError ? "Error" : "Success"'
            :description='status'
        />
    </TablerBorder>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import {
    TablerBorder,
    TablerInput,
    TablerEnum,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import type { Feature } from '../../../../../../src/types.ts';
import { useIncident } from '../../../composables/useIncident.ts';
import {
    SUBJECT_NUMBERS,
    SUBJECT_CATEGORIES as CATEGORIES,
    blankSubjectForm,
    buildSubjectContent,
    buildSubjectKeywords,
    calculateAgeFromDateOfBirth,
    displaySubjectNumber,
    effectiveSubjectAge,
    fieldsFromLog,
    hasFilledSubjectFields,
    parseSubjectYesNo,
    subjectNumberFromLog,
    type SubjectForm,
} from '../../../lib/subjectInfo.ts';
import {
    resolveSubjects,
    saveSubjectsToMission,
} from '../../../lib/subjectsPersistence.ts';
import { loadMissionSchema } from '../../../lib/missionSchema.ts';
import { loadIncidentSubscription, loadSchemaSubscription } from '../../../lib/incidentSubscription.ts';

const { activeMission, requireActiveMission } = useIncident();

const MAX_SUBJECTS = SUBJECT_NUMBERS.length;

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

const GENDER_OPTIONS = ['Select Gender', 'Male', 'Female', 'Other'];
const CATEGORY_OPTIONS = ['Select Category', ...CATEGORIES.map((c) => c.label)];
const YES_NO_OPTIONS = ['—', 'Yes', 'No'];
const REPORTED_BY_OPTIONS = ['Select Who Reported Subject Missing', ...REPORTED_BY];
const PHOTO_PLACEHOLDER = 'Select Photo From DataSync';
const IPP_PLACEHOLDER = 'Subject IPP from DataSync';

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
    return blankSubjectForm(subjectCaseID);
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
    return displaySubjectNumber(n);
}

function hasValue(value: string | undefined): value is string {
    return !!value?.trim();
}

function hasFilledFields(f: SubjectForm): boolean {
    return hasFilledSubjectFields(f);
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

function subjectNumberOptions(draft: SubjectDraft): string[] {
    return SUBJECT_NUMBERS
        .filter((n) => !isNumberUsed(n, draft.id))
        .map((n) => displayNumber(n));
}

function onSubjectNumberLabelChange(draft: SubjectDraft, label: string): void {
    const match = SUBJECT_NUMBERS.find((n) => displayNumber(n) === label);
    if (match) draft.form.subjectCaseID = match;
}

function genderLabel(value: string): string {
    if (value === 'male') return 'Male';
    if (value === 'female') return 'Female';
    if (value === 'other') return 'Other';
    return 'Select Gender';
}

function onGenderLabelChange(draft: SubjectDraft, label: string): void {
    if (label === 'Male') draft.form.subjectGender = 'male';
    else if (label === 'Female') draft.form.subjectGender = 'female';
    else if (label === 'Other') draft.form.subjectGender = 'other';
    else draft.form.subjectGender = '';
}

function categoryLabelFor(value: string): string {
    if (!value) return 'Select Category';
    return CATEGORIES.find((c) => c.value === value)?.label ?? 'Select Category';
}

function onCategoryLabelChange(draft: SubjectDraft, label: string): void {
    if (label === 'Select Category') {
        draft.form.subjectCategory = '';
        return;
    }
    draft.form.subjectCategory = CATEGORIES.find((c) => c.label === label)?.value ?? '';
}

function yesNoLabel(value: boolean | null): string {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return '—';
}

function onYesNoLabelChange(label: string): boolean | null {
    if (label === 'Yes') return parseSubjectYesNo('true');
    if (label === 'No') return parseSubjectYesNo('false');
    return parseSubjectYesNo('');
}

function reportedByLabel(value: string): string {
    return value || 'Select Who Reported Subject Missing';
}

function onReportedByLabelChange(draft: SubjectDraft, label: string): void {
    draft.form.subjectReportedMissingBy = label === 'Select Who Reported Subject Missing' ? '' : label;
}

function isSent(number: string): boolean {
    return sentSubjects.value.some((s) => s.number === number);
}

function draftSummary(f: SubjectForm): string {
    if (hasValue(f.subjectName)) return f.subjectName.trim();
    const age = effectiveAge(f);
    if (age) return `Age ${age}`;
    if (hasValue(f.subjectCategory)) {
        return CATEGORIES.find((c) => c.value === f.subjectCategory)?.label ?? f.subjectCategory;
    }
    return '';
}

function effectiveAge(f: SubjectForm): string {
    return effectiveSubjectAge(f);
}

function onDobChange(form: SubjectForm): void {
    if (form.subjectDateOfBirth) {
        form.subjectAge = calculateAgeFromDateOfBirth(form.subjectDateOfBirth) ?? '';
    }
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

const photoOptions = computed(() => [
    PHOTO_PLACEHOLDER,
    ...missionPhotos.value.map((c) => c.name || c.uid),
]);

function photoLabelForUid(uid: string): string {
    if (!uid) return PHOTO_PLACEHOLDER;
    const photo = missionPhotos.value.find((c) => c.uid === uid);
    return photo ? (photo.name || photo.uid) : PHOTO_PLACEHOLDER;
}

function onPhotoLabelChange(draft: SubjectDraft, label: string): void {
    if (label === PHOTO_PLACEHOLDER) {
        draft.form.subjectPhoto = '';
        return;
    }
    const photo = missionPhotos.value.find((c) => (c.name || c.uid) === label);
    draft.form.subjectPhoto = photo?.uid ?? '';
}

const ippOptions = computed(() => [
    IPP_PLACEHOLDER,
    ...missionMarkers.value.map((m) => markerLabel(m)),
]);

function ippLabelForValue(value: string): string {
    if (!value) return IPP_PLACEHOLDER;
    const marker = missionMarkers.value.find((m) => ippOptionValue(m) === value);
    return marker ? markerLabel(marker) : IPP_PLACEHOLDER;
}

function onIppLabelChange(draft: SubjectDraft, label: string): void {
    if (label === IPP_PLACEHOLDER) {
        draft.form.subjectIppFromTak = '';
        return;
    }
    const marker = missionMarkers.value.find((m) => markerLabel(m) === label);
    draft.form.subjectIppFromTak = marker ? ippOptionValue(marker) : '';
}

function rebuildDraftsFromSent(): void {
    if (!sentSubjects.value.length) {
        drafts.value = [newDraft(blankForm(), true)];
        return;
    }

    drafts.value = sentSubjects.value.map((s, i) =>
        newDraft({ ...s.fields, subjectCaseID: s.number, logId: s.id || undefined }, i === 0),
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
        const sub = await loadIncidentSubscription(activeMission.value);
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
    statusError.value = false;
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        const logs = await sub.log.list({ refresh: true });
        const schemaSub = await loadSchemaSubscription(activeMission.value);
        const loaded = await loadMissionSchema(schemaSub);

        const logByNumber = new Map<string, SentSubject>();
        for (const log of logs) {
            const number = subjectNumberFromLog(log.keywords);
            if (!number) continue;
            const created = log.created || log.dtg || '';
            const prev = logByNumber.get(number);
            if (!prev || Date.parse(created) >= Date.parse(prev.created)) {
                logByNumber.set(number, {
                    number,
                    content: log.content || '',
                    created,
                    id: String(log.id),
                    fields: fieldsFromLog(log.keywords),
                });
            }
        }

        const resolved = resolveSubjects(loaded.schema, logs);
        if (resolved.length) {
            sentSubjects.value = resolved.map((s) => {
                const log = logByNumber.get(s.subjectCaseID);
                return {
                    number: s.subjectCaseID,
                    content: log?.content || '',
                    created: log?.created || '',
                    id: log?.id || '',
                    fields: { ...s, logId: log?.id },
                };
            });
        } else {
            sentSubjects.value = [...logByNumber.values()].sort(
                (a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10),
            );
        }
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

async function onSend(): Promise<void> {
    if (!requireActiveMission()) return;
    await send();
}

async function send(): Promise<void> {
    if (!activeMission.value || !filledCount.value) return;
    posting.value = true;
    status.value = '';
    statusError.value = false;
    let created = 0;
    let updated = 0;
    let failed = 0;
    const succeeded: SubjectForm[] = [];
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        for (const draft of filledDrafts.value) {
            const f = draft.form;
            const existing = sentSubjects.value.find((s) => s.number === f.subjectCaseID);
            const body = {
                dtg: new Date().toISOString(),
                content: buildSubjectContent(f),
                keywords: buildSubjectKeywords(f),
            };
            try {
                if (f.logId || existing?.id) {
                    await sub.log.update(f.logId || existing!.id, body);
                    updated++;
                } else {
                    const createdLog = await sub.log.create(body);
                    f.logId = String(createdLog.id);
                    created++;
                }
                succeeded.push({ ...f });
            } catch {
                failed++;
            }
        }

        let schemaOk = true;
        let schemaDetail = '';
        if (succeeded.length) {
            try {
                await saveSubjectsToMission(activeMission.value, succeeded);
            } catch (schemaErr) {
                schemaOk = false;
                schemaDetail = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
            }
        }

        statusError.value = failed > 0 || !schemaOk;
        const parts: string[] = [];
        if (created) parts.push(`${created} new`);
        if (updated) parts.push(`${updated} updated`);
        let msg = `Saved ${parts.join(', ') || '0'} to DataSync on ${activeMission.value.name}`;
        if (succeeded.length && schemaOk) {
            msg += ' and updated mission_schema.json';
        }
        msg += failed ? `, ${failed} failed.` : '.';
        if (!schemaOk) {
            msg += ` Schema update failed: ${schemaDetail}`;
        }
        status.value = msg;
        await loadSent();
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        posting.value = false;
    }
}
</script>
