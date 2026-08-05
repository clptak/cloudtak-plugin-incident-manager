<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>
                Assignments
            </h3>
            <button
                type='button'
                class='btn btn-outline-secondary btn-sm ms-auto'
                :disabled='loadingCots'
                @click='onRefreshMissionCots'
            >
                {{ loadingCots ? 'Loading…' : 'Refresh map objects' }}
            </button>
        </div>

        <div
            v-if='!setupReminderDismissed'
            class='mb-3'
        >
            <TablerInlineAlert
                severity='info'
                title='Setup Reminder'
                description='Before creating mission assignments, attach your assignments (lines, polygons) to this DataSync Mission. If assignments or segments were drawn in other GIS systems, import the GeoJSON file from that platform. If the Caltopo Sync plugin is installed, you can create a sync pair to import them into this DataSync.'
            />
            <div class='text-end mt-1'>
                <button
                    type='button'
                    class='btn btn-link btn-sm p-0 text-muted'
                    @click='dismissSetupReminder'
                >
                    Do not remind me
                </button>
            </div>
        </div>

        <p class='text-muted small mb-2'>
            Log field assignments to DataSync. Teams come from the <strong>Resources</strong> tab.
            Each log links to the selected map object via <code>entryUid</code>.
        </p>

        <TablerInlineAlert
            v-if='!activeMission'
            class='mb-3'
            severity='info'
            title='Mission required'
            description='Select a mission in Create | Open before managing assignments.'
        />

        <TablerInlineAlert
            v-if='statusMessage'
            class='mb-3'
            :severity='statusError ? "danger" : "success"'
            :title='statusError ? "Error" : "Saved"'
            :description='statusMessage'
        />

        <TablerBorder
            class='cloudtak-accent text-white mb-3'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    New Assignment
                </p>
            </template>

            <div class='row g-2'>
                <div class='col-md-1'>
                    <TablerInput
                        v-model='formAssignmentNumber'
                        label='#'
                        type='number'
                        :error='assignmentNumberInvalid ? "Invalid" : ""'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-2'>
                    <TablerEnum
                        v-model='formTeamLabel'
                        label='Team'
                        :options='teamFormOptions'
                        :disabled='!activeMission || saving || !teamOptions.length'
                    />
                </div>
                <div class='col-md-2'>
                    <TablerEnum
                        v-model='formAssignmentLabel'
                        label='Assignment'
                        :options='assignmentFormOptions'
                        :disabled='!activeMission || saving || loadingCots'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='form.instructions'
                        label='Instructions'
                        placeholder='Task instructions'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-2'>
                    <TablerInput
                        v-model='form.started'
                        label='Started'
                        type='datetime-local'
                        :disabled='!activeMission || saving'
                    />
                </div>
                <div class='col-md-2'>
                    <TablerInput
                        v-model='form.completed'
                        label='Completed'
                        type='datetime-local'
                        :disabled='!activeMission || saving'
                    />
                </div>
            </div>
            <div class='d-flex flex-wrap gap-2 mt-3'>
                <button
                    type='button'
                    class='btn btn-primary btn-sm'
                    :disabled='saving'
                    @click='onAddClick'
                >
                    {{ saving ? 'Saving…' : 'Add assignment' }}
                </button>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm'
                    :disabled='saving'
                    @click='resetForm'
                >
                    Clear form
                </button>
            </div>
        </TablerBorder>

        <TablerBorder
            v-if='activeMission'
            class='cloudtak-accent text-white'
            :shadow='false'
            :fill-height='false'
            gap='sm'
        >
            <template #label>
                <p class='text-uppercase text-white-50 small mb-0'>
                    Mission Assignments ({{ assignments.length }})
                </p>
            </template>

            <div
                v-if='!assignments.length && !loading'
                class='text-muted small'
            >
                No assignments yet.
            </div>
            <div
                v-else-if='assignments.length'
                class='assignments-table-scroll'
            >
                <table class='table table-sm table-hover mb-0 small align-middle'>
                    <thead class='sticky-top bg-body'>
                        <tr>
                            <th style='width: 56px;'>
                                #
                            </th>
                            <th>Team</th>
                            <th>Assignment</th>
                            <th>Instructions</th>
                            <th>Started</th>
                            <th>Completed</th>
                            <th style='width: 88px;' />
                            <th style='width: 100px;' />
                            <th style='width: 48px;' />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='row in assignments'
                            :key='row.id'
                        >
                            <td>
                                <TablerInput
                                    :model-value='row.assignmentNumber'
                                    type='number'
                                    :disabled='saving || sending'
                                    @update:model-value='onNumberChange(row.id, String($event))'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='teamLabelForId(row.teamResourceAssignmentId)'
                                    :options='teamRowOptions'
                                    :disabled='saving || sending || !teamOptions.length'
                                    @update:model-value='onRowTeamLabelChange(row.id, $event)'
                                />
                            </td>
                            <td>
                                <TablerEnum
                                    :model-value='callsignForUid(row.assignmentUid)'
                                    :options='assignmentRowOptions'
                                    :disabled='saving || sending || loadingCots'
                                    @update:model-value='onRowAssignmentLabelChange(row.id, $event)'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='row.instructions'
                                    :disabled='saving || sending'
                                    @update:model-value='onFieldChange(row.id, "instructions", String($event))'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='row.started'
                                    type='datetime-local'
                                    :disabled='saving || sending'
                                    @update:model-value='onFieldChange(row.id, "started", String($event))'
                                />
                            </td>
                            <td>
                                <TablerInput
                                    :model-value='row.completed'
                                    type='datetime-local'
                                    :disabled='saving || sending'
                                    @update:model-value='onFieldChange(row.id, "completed", String($event))'
                                />
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-success btn-sm w-100'
                                    title='Send start to DataSync'
                                    :disabled='saving || sending'
                                    @click='onSendStart(row.id)'
                                >
                                    Start
                                </button>
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-primary btn-sm w-100'
                                    title='Send completion to DataSync'
                                    :disabled='saving || sending'
                                    @click='onSendComplete(row.id)'
                                >
                                    Complete
                                </button>
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-danger btn-sm'
                                    title='Remove'
                                    :disabled='saving || sending'
                                    @click='removeRow(row.id)'
                                >
                                    ×
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </TablerBorder>

        <div
            v-if='noResourcesModalOpen'
            class='modal modal-blur show d-block'
            tabindex='-1'
            role='dialog'
            @click.self='closeNoResourcesModal'
        >
            <div
                class='modal-dialog modal-dialog-centered'
                role='document'
            >
                <div class='modal-content'>
                    <div class='modal-header'>
                        <h5 class='modal-title'>
                            Mission resources needed
                        </h5>
                        <button
                            type='button'
                            class='btn-close'
                            aria-label='Close'
                            @click='closeNoResourcesModal'
                        />
                    </div>
                    <div class='modal-body'>
                        <p class='mb-0'>
                            Please create your mission
                            <button
                                type='button'
                                class='btn btn-link p-0 align-baseline'
                                @click='goToResources'
                            >
                                resources
                            </button>.
                        </p>
                    </div>
                    <div class='modal-footer'>
                        <button
                            type='button'
                            class='btn btn-secondary'
                            @click='closeNoResourcesModal'
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if='noResourcesModalOpen'
            class='modal-backdrop fade show'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import {
    TablerBorder,
    TablerInput,
    TablerEnum,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import { useResourceAssignments } from '../../composables/useResourceAssignments.ts';
import { useWorkAssignments } from '../../composables/useWorkAssignments.ts';
import { nowDatetimeLocal } from '../../lib/incidentInfo.ts';
import { listMissionCots, type MissionCotRef } from '../../lib/missionCots.ts';
import { isValidAssignmentNumber } from '../../lib/workAssignments.ts';
import { ensureMissionFolder } from '../../lib/folder.ts';
import { loadIncidentSubscription } from '../../lib/incidentSubscription.ts';

const SETUP_REMINDER_KEY = 'incident-manager:assignments-setup-reminder-dismissed';
const ASSIGNMENT_FOLDER = 'Assignments';

const { activeMission, selectKey, requireActiveMission } = useIncident();
const {
    assignments: resourceTeams,
    loading: loadingResourceTeams,
    loadForMission: loadResourceTeams,
} = useResourceAssignments();

const noResourcesModalOpen = ref(false);

const setupReminderDismissed = ref(
    localStorage.getItem(SETUP_REMINDER_KEY) === '1',
);

function dismissSetupReminder(): void {
    setupReminderDismissed.value = true;
    localStorage.setItem(SETUP_REMINDER_KEY, '1');
}

function closeNoResourcesModal(): void {
    noResourcesModalOpen.value = false;
}

function openNoResourcesModalIfEmpty(): void {
    if (!activeMission.value) return;
    if (loadingResourceTeams.value) return;
    if (resourceTeams.value.length > 0) return;
    noResourcesModalOpen.value = true;
}

function goToResources(): void {
    closeNoResourcesModal();
    selectKey('resources');
}

const {
    assignments,
    loading,
    saving,
    sending,
    statusMessage,
    statusError,
    blankWorkAssignmentForm,
    loadForMission,
    addAssignment,
    removeAssignment,
    updateAssignment,
    sendPhaseLog,
} = useWorkAssignments();

const missionCots = ref<MissionCotRef[]>([]);
const loadingCots = ref(false);

const form = ref({
    ...blankWorkAssignmentForm(),
    started: nowDatetimeLocal(),
});

const teamOptions = computed(() => resourceTeams.value);

const assignmentNumberInvalid = computed(() =>
    !isValidAssignmentNumber(form.value.assignmentNumber),
);

const canAdd = computed(() =>
    !!activeMission.value
    && isValidAssignmentNumber(form.value.assignmentNumber)
    && form.value.teamResourceAssignmentId.trim().length > 0
    && form.value.assignmentUid.trim().length > 0,
);

const teamSelectLabel = computed(() => {
    if (!activeMission.value) return 'Select a mission';
    if (!teamOptions.value.length) return 'Create teams in Resources';
    return '— Team —';
});

const assignmentSelectLabel = computed(() => {
    if (!activeMission.value) return 'Select a mission';
    if (loadingCots.value) return 'Loading…';
    if (!missionCots.value.length) return 'No map objects';
    return '— Map object —';
});

const teamFormOptions = computed(() => [
    teamSelectLabel.value,
    ...teamOptions.value.map((team) => team.resourceIdentifier),
]);

const assignmentFormOptions = computed(() => [
    assignmentSelectLabel.value,
    ...missionCots.value.map((cot) => cot.callsign),
]);

const teamRowOptions = computed(() => teamOptions.value.map((team) => team.resourceIdentifier));
const assignmentRowOptions = computed(() => missionCots.value.map((cot) => cot.callsign));

const formAssignmentNumber = computed({
    get(): string {
        return String(form.value.assignmentNumber ?? '');
    },
    set(raw: string): void {
        const n = Number(raw);
        form.value.assignmentNumber = Number.isFinite(n) ? n : 0;
    },
});

const formTeamLabel = computed({
    get(): string {
        if (!form.value.teamResourceAssignmentId) return teamSelectLabel.value;
        return teamLabelForId(form.value.teamResourceAssignmentId) || teamSelectLabel.value;
    },
    set(label: string): void {
        if (!label || label === teamSelectLabel.value) {
            form.value.teamResourceAssignmentId = '';
            form.value.teamLabel = '';
            return;
        }
        const team = teamOptions.value.find((entry) => entry.resourceIdentifier === label);
        form.value.teamResourceAssignmentId = team?.id ?? '';
        form.value.teamLabel = team?.resourceIdentifier ?? '';
    },
});

const formAssignmentLabel = computed({
    get(): string {
        if (!form.value.assignmentUid) return assignmentSelectLabel.value;
        return callsignForUid(form.value.assignmentUid) || assignmentSelectLabel.value;
    },
    set(label: string): void {
        if (!label || label === assignmentSelectLabel.value) {
            form.value.assignmentUid = '';
            form.value.assignmentCallsign = '';
            return;
        }
        const cot = missionCots.value.find((entry) => entry.callsign === label);
        form.value.assignmentUid = cot?.uid ?? '';
        form.value.assignmentCallsign = cot?.callsign ?? '';
    },
});

function teamLabelForId(id: string): string {
    return teamOptions.value.find((t) => t.id === id)?.resourceIdentifier ?? '';
}

function callsignForUid(uid: string): string {
    return missionCots.value.find((c) => c.uid === uid)?.callsign ?? '';
}

function resetForm(): void {
    const nextNumber = assignments.value.length
        ? Math.max(...assignments.value.map((a) => a.assignmentNumber)) + 1
        : 1;
    form.value = {
        ...blankWorkAssignmentForm(),
        assignmentNumber: nextNumber,
        started: nowDatetimeLocal(),
    };
}

async function onRefreshMissionCots(): Promise<void> {
    if (!requireActiveMission()) return;
    await refreshMissionCots();
}

async function refreshMissionCots(): Promise<void> {
    missionCots.value = [];
    if (!activeMission.value) return;

    loadingCots.value = true;
    try {
        missionCots.value = await listMissionCots(activeMission.value);
    } catch {
        missionCots.value = [];
    } finally {
        loadingCots.value = false;
    }
}

async function softEnsureAssignmentFolder(): Promise<void> {
    if (!activeMission.value) return;
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        await ensureMissionFolder(sub, ASSIGNMENT_FOLDER);
    } catch (err) {
        console.warn('Failed to ensure Assignments mission folder', err);
    }
}

async function fileCotsIntoAssignmentFolder(uids: string[]): Promise<void> {
    if (!activeMission.value || !uids.length) return;
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        const folder = await ensureMissionFolder(sub, ASSIGNMENT_FOLDER);
        await sub.layer.attachFeatures(folder.uid, [...new Set(uids)]);
    } catch (err) {
        console.warn('Failed to file CoTs into Assignments folder', err);
    }
}

async function addRow(): Promise<void> {
    if (!activeMission.value || !canAdd.value) return;

    const assignmentUid = form.value.assignmentUid.trim();
    await addAssignment(activeMission.value, {
        assignmentNumber: form.value.assignmentNumber,
        teamResourceAssignmentId: form.value.teamResourceAssignmentId.trim(),
        teamLabel: teamLabelForId(form.value.teamResourceAssignmentId),
        assignmentUid,
        assignmentCallsign: callsignForUid(form.value.assignmentUid),
        instructions: form.value.instructions.trim(),
        started: form.value.started.trim(),
        completed: form.value.completed.trim(),
    });

    await fileCotsIntoAssignmentFolder([assignmentUid]);
    resetForm();
}

async function onAddClick(): Promise<void> {
    if (!requireActiveMission()) return;
    if (saving.value) return;
    if (!teamOptions.value.length) {
        openNoResourcesModalIfEmpty();
        return;
    }
    if (!canAdd.value) return;
    await addRow();
}

async function removeRow(id: string): Promise<void> {
    if (!activeMission.value) return;
    if (!window.confirm('Remove this assignment?')) return;
    await removeAssignment(activeMission.value, id);
}

async function onNumberChange(id: string, raw: string): Promise<void> {
    if (!activeMission.value) return;
    const n = Number(raw);
    if (!isValidAssignmentNumber(n)) return;
    await updateAssignment(activeMission.value, id, { assignmentNumber: n });
}

async function onFieldChange(
    id: string,
    field: 'instructions' | 'started' | 'completed',
    value: string,
): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, { [field]: value });
}

async function onRowTeamChange(id: string, teamId: string): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, {
        teamResourceAssignmentId: teamId,
        teamLabel: teamLabelForId(teamId),
    });
}

async function onRowTeamLabelChange(id: string, label: string): Promise<void> {
    const team = teamOptions.value.find((entry) => entry.resourceIdentifier === label);
    if (!team) return;
    await onRowTeamChange(id, team.id);
}

async function onRowAssignmentChange(id: string, uid: string): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, {
        assignmentUid: uid,
        assignmentCallsign: callsignForUid(uid),
    });
    await fileCotsIntoAssignmentFolder([uid]);
}

async function onRowAssignmentLabelChange(id: string, label: string): Promise<void> {
    const cot = missionCots.value.find((entry) => entry.callsign === label);
    if (!cot) return;
    await onRowAssignmentChange(id, cot.uid);
}

async function onSendStart(id: string): Promise<void> {
    if (!requireActiveMission()) return;
    await sendStart(id);
}

async function onSendComplete(id: string): Promise<void> {
    if (!requireActiveMission()) return;
    await sendComplete(id);
}

async function sendStart(id: string): Promise<void> {
    if (!activeMission.value) return;
    await sendPhaseLog(activeMission.value, id, 'started');
}

async function sendComplete(id: string): Promise<void> {
    if (!activeMission.value) return;
    await sendPhaseLog(activeMission.value, id, 'completed');
}

watch(loadingResourceTeams, (loading) => {
    if (!loading) openNoResourcesModalIfEmpty();
});

watch(resourceTeams, (teams) => {
    if (teams.length > 0) closeNoResourcesModal();
});

watch(() => activeMission.value?.guid, (guid) => {
    const mission = guid ? activeMission.value : null;
    void (async () => {
        await loadForMission(mission);
        void loadResourceTeams(mission);
        void refreshMissionCots();
        if (!mission) return;
        await softEnsureAssignmentFolder();
        const uids = assignments.value
            .map((a) => a.assignmentUid.trim())
            .filter(Boolean);
        await fileCotsIntoAssignmentFolder(uids);
    })();
}, { immediate: true });

onMounted(() => {
    resetForm();
});
</script>

<style scoped>
.assignments-table-scroll {
    max-height: 50vh;
    overflow: auto;
}
</style>
