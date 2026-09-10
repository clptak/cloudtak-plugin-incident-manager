<template>
    <div>
        <h3 class='mb-3'>
            Settings
        </h3>

        <!-- ══ Case File Folder ══ -->
        <div
            v-if='expandedCard !== "folder"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleCard("folder")'
            @keydown.enter.prevent='toggleCard("folder")'
            @keydown.space.prevent='toggleCard("folder")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Case File Folder
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleCard("folder")'
                    @keydown.enter.prevent='toggleCard("folder")'
                    @keydown.space.prevent='toggleCard("folder")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Case File Folder
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <template v-if='folderSupported'>
                <p class='text-muted small mb-2'>
                    Choose a folder once and generated documents (IAPs, demob packages)
                    are written straight into it, in a sub-folder per incident.
                    Otherwise they download normally.
                </p>
                <div class='d-flex flex-wrap align-items-center gap-2'>
                    <span
                        v-if='folderName'
                        class='badge bg-success-lt text-success'
                    >{{ folderName }}</span>
                    <span
                        v-else
                        class='text-muted small'
                    >No folder set — using downloads.</span>
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm'
                        :disabled='choosingFolder'
                        @click='onChooseFolder'
                    >
                        {{ folderName ? 'Change folder' : 'Choose folder' }}
                    </button>
                    <button
                        v-if='folderName'
                        type='button'
                        class='btn btn-link btn-sm'
                        @click='onClearFolder'
                    >
                        Use downloads
                    </button>
                    <span
                        v-if='folderStatus'
                        class='small'
                        :class='folderError ? "text-danger" : "text-muted"'
                    >{{ folderStatus }}</span>
                </div>
            </template>
            <p
                v-else
                class='text-muted small mb-0'
            >
                This browser cannot write to a chosen folder — documents will download.
                (Supported in Chrome/Edge and in CloudTAK Desktop once the
                <code>fileSystem</code> permission is enabled.)
            </p>
        </TablerBorder>

        <!-- ══ Subject Types ══ -->
        <div
            v-if='expandedCard !== "subject-types"'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleCard("subject-types")'
            @keydown.enter.prevent='toggleCard("subject-types")'
            @keydown.space.prevent='toggleCard("subject-types")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Subject Types
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleCard("subject-types")'
                    @keydown.enter.prevent='toggleCard("subject-types")'
                    @keydown.space.prevent='toggleCard("subject-types")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Subject Types
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <p class='text-muted small mb-3'>
                These labels appear in Create | Open and Subject Information.
                Changes apply in this browser only.
            </p>

            <NumberedTextList
                v-model='draftTypes'
                :max='MAX_SUBJECT_TYPES'
                item-label='Subject Type'
                max-hint='Maximum of 80 subject types.'
            />

            <div class='d-flex flex-wrap gap-2 mt-3'>
                <button
                    type='button'
                    class='btn btn-primary'
                    :disabled='!subjectTypesDirty'
                    @click='saveSubjectTypes'
                >
                    Save
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary'
                    @click='resetSubjectTypesToDefaults'
                >
                    Reset to defaults
                </button>
            </div>

            <hr class='my-3'>

            <p class='small text-uppercase text-white-50 mb-2'>
                Upload list
            </p>
            <p class='text-muted small mb-2'>
                JSON array, <code>{ "subjectTypes": [...] }</code>, or CSV / one type per line.
            </p>
            <input
                ref='subjectFileInput'
                type='file'
                class='d-none'
                accept='.json,.csv,.txt,application/json,text/csv,text/plain'
                @change='onSubjectFileChange'
            >
            <div class='d-flex flex-wrap gap-2'>
                <button
                    type='button'
                    class='btn btn-outline-secondary'
                    @click='pickSubjectFile'
                >
                    Choose file…
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary'
                    :disabled='!pendingSubjectTypes.length'
                    @click='mergeUploadedSubjectTypes'
                >
                    Merge
                </button>
                <button
                    type='button'
                    class='btn btn-outline-primary'
                    :disabled='!pendingSubjectTypes.length'
                    @click='replaceUploadedSubjectTypes'
                >
                    Replace
                </button>
            </div>
            <p
                v-if='pendingSubjectTypes.length'
                class='form-text mb-0 mt-2'
            >
                Parsed {{ pendingSubjectTypes.length }} type{{ pendingSubjectTypes.length === 1 ? '' : 's' }}
                from {{ pendingSubjectFileName }}.
            </p>
            <TablerInlineAlert
                v-if='subjectUploadError'
                class='mt-3'
                severity='danger'
                title='Upload error'
                :description='subjectUploadError'
            />
        </TablerBorder>

        <!-- ══ Statistical Distance (LPB) ══ -->
        <div
            v-if='expandedCard !== "lpb"'
            class='cloudtak-accent border rounded-3 text-white px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='toggleCard("lpb")'
            @keydown.enter.prevent='toggleCard("lpb")'
            @keydown.space.prevent='toggleCard("lpb")'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Statistical Distance (LPB)
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='toggleCard("lpb")'
                    @keydown.enter.prevent='toggleCard("lpb")'
                    @keydown.space.prevent='toggleCard("lpb")'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Statistical Distance (LPB)
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <p class='text-muted small mb-3'>
                Upload a JSON array matching the Arizona LPB table
                (<code>category</code>, <code>cases</code>, <code>qAmi</code>–<code>qDmi</code>).
                Replaces the table used in Search Area. No silent merge.
            </p>

            <p class='mb-2'>
                <span class='badge bg-blue-lt'>
                    {{ lpbIsCustom ? 'Custom upload' : 'Bundled Arizona' }}
                </span>
                <span class='text-muted small ms-2'>
                    {{ lpbCategoryCount }} categor{{ lpbCategoryCount === 1 ? 'y' : 'ies' }}
                </span>
            </p>

            <input
                ref='lpbFileInput'
                type='file'
                class='d-none'
                accept='.json,application/json'
                @change='onLpbFileChange'
            >
            <div class='d-flex flex-wrap gap-2'>
                <button
                    type='button'
                    class='btn btn-primary'
                    @click='pickLpbFile'
                >
                    Upload JSON…
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary'
                    :disabled='!lpbIsCustom'
                    @click='resetLpb'
                >
                    Reset to bundled table
                </button>
            </div>
            <TablerInlineAlert
                v-if='lpbUploadError'
                class='mt-3'
                severity='danger'
                title='Upload error'
                :description='lpbUploadError'
            />
            <TablerInlineAlert
                v-if='lpbUploadOk'
                class='mt-3'
                severity='success'
                title='LPB table updated'
                :description='lpbUploadOk'
            />
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';
import { TablerBorder, TablerInlineAlert } from '@tak-ps/vue-tabler';
import NumberedTextList from '../NumberedTextList.vue';
import { usePluginSettings } from '../../composables/usePluginSettings.ts';
import { parseLpbTableJson } from '../../lib/pluginSettings.ts';
import {
    MAX_SUBJECT_TYPES,
    mergeSubjectTypes,
    parseSubjectTypesText,
} from '../../lib/subjectTypes.ts';
import {
    chooseFileTarget,
    clearFileTarget,
    ensureWritable,
    fileTargetSupported,
    savedFileTarget,
} from '../../lib/fileTarget.ts';

type SettingsCard = 'folder' | 'subject-types' | 'lpb';
const expandedCard = ref<SettingsCard | null>('folder');

function toggleCard(card: SettingsCard): void {
    expandedCard.value = expandedCard.value === card ? null : card;
}

const {
    subjectTypes,
    lpbIsCustom,
    lpbCategoryCount,
    setSubjectTypes,
    resetSubjectTypes,
    setLpbTable,
    resetLpbTable,
} = usePluginSettings();

const draftTypes = ref<string[]>([...subjectTypes.value]);
const subjectFileInput = ref<HTMLInputElement | null>(null);
const lpbFileInput = ref<HTMLInputElement | null>(null);
const pendingSubjectTypes = ref<string[]>([]);
const pendingSubjectFileName = ref('');
const subjectUploadError = ref('');
const lpbUploadError = ref('');
const lpbUploadOk = ref('');

const folderSupported = fileTargetSupported();
const folderName = ref('');
const folderStatus = ref('');
const folderError = ref(false);
const choosingFolder = ref(false);

async function refreshFolder(): Promise<void> {
    const handle = await savedFileTarget();
    folderName.value = handle?.name ?? '';
    if (handle && !(await ensureWritable(handle, false))) {
        folderStatus.value = 'Permission needed — you will be asked on the next save.';
    }
}

async function onChooseFolder(): Promise<void> {
    choosingFolder.value = true;
    folderError.value = false;
    folderStatus.value = '';
    try {
        const handle = await chooseFileTarget();
        if (handle) {
            folderName.value = handle.name;
            folderStatus.value = 'Folder set.';
        }
    } catch (err) {
        folderError.value = true;
        folderStatus.value = err instanceof Error ? err.message : String(err);
    } finally {
        choosingFolder.value = false;
    }
}

async function onClearFolder(): Promise<void> {
    await clearFileTarget();
    folderName.value = '';
    folderStatus.value = 'Reverted to downloads.';
    folderError.value = false;
}

void refreshFolder();

watch(subjectTypes, (types) => {
    draftTypes.value = [...types];
});

const subjectTypesDirty = computed(() =>
    JSON.stringify(draftTypes.value.map((t) => t.trim()).filter(Boolean))
        !== JSON.stringify(subjectTypes.value),
);

function saveSubjectTypes(): void {
    setSubjectTypes(draftTypes.value);
    draftTypes.value = [...subjectTypes.value];
}

function resetSubjectTypesToDefaults(): void {
    resetSubjectTypes();
    pendingSubjectTypes.value = [];
    pendingSubjectFileName.value = '';
    subjectUploadError.value = '';
}

function pickSubjectFile(): void {
    subjectFileInput.value?.click();
}

function pickLpbFile(): void {
    lpbFileInput.value?.click();
}

async function onSubjectFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    pendingSubjectTypes.value = [];
    pendingSubjectFileName.value = '';
    subjectUploadError.value = '';
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = parseSubjectTypesText(text);
        if (!parsed.ok) {
            subjectUploadError.value = parsed.error;
            return;
        }
        pendingSubjectTypes.value = parsed.value;
        pendingSubjectFileName.value = file.name;
    } catch (err) {
        subjectUploadError.value = err instanceof Error ? err.message : String(err);
    }
}

function mergeUploadedSubjectTypes(): void {
    if (!pendingSubjectTypes.value.length) return;
    setSubjectTypes(mergeSubjectTypes(draftTypes.value, pendingSubjectTypes.value));
    pendingSubjectTypes.value = [];
    pendingSubjectFileName.value = '';
    subjectUploadError.value = '';
}

function replaceUploadedSubjectTypes(): void {
    if (!pendingSubjectTypes.value.length) return;
    setSubjectTypes(pendingSubjectTypes.value);
    pendingSubjectTypes.value = [];
    pendingSubjectFileName.value = '';
    subjectUploadError.value = '';
}

async function onLpbFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    lpbUploadError.value = '';
    lpbUploadOk.value = '';
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = parseLpbTableJson(text);
        if (!parsed.ok) {
            lpbUploadError.value = parsed.error;
            return;
        }
        setLpbTable(parsed.value);
        lpbUploadOk.value = `Loaded ${parsed.value.length} categor${parsed.value.length === 1 ? 'y' : 'ies'} from ${file.name}.`;
    } catch (err) {
        lpbUploadError.value = err instanceof Error ? err.message : String(err);
    }
}

function resetLpb(): void {
    resetLpbTable();
    lpbUploadError.value = '';
    lpbUploadOk.value = 'Restored the bundled Arizona LPB table.';
}
</script>

<style scoped>
.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.2s ease-out;
}
</style>
