<template>
    <div>
        <div class='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h3 class='mb-0'>
                Assignments
            </h3>
            <button
                type='button'
                class='btn btn-outline-primary btn-sm ms-auto'
                :disabled='loadingCots || !activeMission'
                @click='refreshMissionCots'
            >
                {{ loadingCots ? 'Loading…' : 'Refresh map objects' }}
            </button>
        </div>

        <p class='text-muted small mb-2'>
            Log field assignments to DataSync. Teams come from the <strong>Resources</strong> tab.
            Each log links to the selected map object via <code>entryUid</code>.
        </p>

        <div
            v-if='!activeMission'
            class='alert alert-info small mb-3'
        >
            Select a mission in <strong>Create | Open</strong> before managing assignments.
        </div>

        <div
            v-if='statusMessage'
            class='alert small py-2 mb-3'
            :class='statusError ? "alert-danger" : "alert-success"'
        >
            {{ statusMessage }}
        </div>

        <div class='card mb-3'>
            <div class='card-header py-2 small fw-semibold'>
                New assignment
            </div>
            <div class='card-body'>
                <div class='row g-2 align-items-end'>
                    <div class='col-md-1'>
                        <label class='form-label small mb-1'>#</label>
                        <input
                            v-model.number='form.assignmentNumber'
                            type='number'
                            min='1'
                            step='1'
                            class='form-control form-control-sm'
                            :class='{ "is-invalid": assignmentNumberInvalid }'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label small mb-1'>Team</label>
                        <select
                            v-model='form.teamResourceAssignmentId'
                            class='form-select form-select-sm'
                            :disabled='!activeMission || saving || !teamOptions.length'
                            @change='onFormTeamChange'
                        >
                            <option value=''>
                                {{ teamSelectLabel }}
                            </option>
                            <option
                                v-for='team in teamOptions'
                                :key='team.id'
                                :value='team.id'
                            >
                                {{ team.resourceIdentifier }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label small mb-1'>Assignment</label>
                        <select
                            v-model='form.assignmentUid'
                            class='form-select form-select-sm'
                            :disabled='!activeMission || saving || loadingCots'
                            @change='onFormAssignmentChange'
                        >
                            <option value=''>
                                {{ assignmentSelectLabel }}
                            </option>
                            <option
                                v-for='cot in missionCots'
                                :key='cot.uid'
                                :value='cot.uid'
                            >
                                {{ cot.callsign }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label small mb-1'>Instructions</label>
                        <input
                            v-model='form.instructions'
                            type='text'
                            class='form-control form-control-sm'
                            placeholder='Task instructions'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label small mb-1'>Started</label>
                        <input
                            v-model='form.started'
                            type='datetime-local'
                            class='form-control form-control-sm'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label small mb-1'>Completed</label>
                        <input
                            v-model='form.completed'
                            type='datetime-local'
                            class='form-control form-control-sm'
                            :disabled='!activeMission || saving'
                        >
                    </div>
                </div>
                <div class='d-flex flex-wrap gap-2 mt-3'>
                    <button
                        type='button'
                        class='btn btn-primary btn-sm'
                        :disabled='!canAdd || saving'
                        @click='addRow'
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
            </div>
        </div>

        <div
            v-if='activeMission'
            class='card'
        >
            <div class='card-header py-2 small fw-semibold'>
                Mission assignments ({{ assignments.length }})
            </div>
            <div
                v-if='!assignments.length && !loading'
                class='card-body text-muted small'
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
                                <input
                                    :value='row.assignmentNumber'
                                    type='number'
                                    min='1'
                                    step='1'
                                    class='form-control form-control-sm'
                                    :disabled='saving || sending'
                                    @change='onNumberChange(row.id, ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <select
                                    :value='row.teamResourceAssignmentId'
                                    class='form-select form-select-sm'
                                    :disabled='saving || sending || !teamOptions.length'
                                    @change='onRowTeamChange(row.id, ($event.target as HTMLSelectElement).value)'
                                >
                                    <option
                                        v-for='team in teamOptions'
                                        :key='team.id'
                                        :value='team.id'
                                    >
                                        {{ team.resourceIdentifier }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <select
                                    :value='row.assignmentUid'
                                    class='form-select form-select-sm'
                                    :disabled='saving || sending || loadingCots'
                                    @change='onRowAssignmentChange(row.id, ($event.target as HTMLSelectElement).value)'
                                >
                                    <option
                                        v-for='cot in missionCots'
                                        :key='cot.uid'
                                        :value='cot.uid'
                                    >
                                        {{ cot.callsign }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <input
                                    :value='row.instructions'
                                    type='text'
                                    class='form-control form-control-sm'
                                    :disabled='saving || sending'
                                    @change='onFieldChange(row.id, "instructions", ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <input
                                    :value='row.started'
                                    type='datetime-local'
                                    class='form-control form-control-sm'
                                    :disabled='saving || sending'
                                    @change='onFieldChange(row.id, "started", ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <input
                                    :value='row.completed'
                                    type='datetime-local'
                                    class='form-control form-control-sm'
                                    :disabled='saving || sending'
                                    @change='onFieldChange(row.id, "completed", ($event.target as HTMLInputElement).value)'
                                >
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-success btn-sm w-100'
                                    title='Send start to DataSync'
                                    :disabled='saving || sending || !activeMission'
                                    @click='sendStart(row.id)'
                                >
                                    Start
                                </button>
                            </td>
                            <td>
                                <button
                                    type='button'
                                    class='btn btn-outline-primary btn-sm w-100'
                                    title='Send completion to DataSync'
                                    :disabled='saving || sending || !activeMission'
                                    @click='sendComplete(row.id)'
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
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { useIncident } from '../../composables/useIncident.ts';
import { useResourceAssignments } from '../../composables/useResourceAssignments.ts';
import { useWorkAssignments } from '../../composables/useWorkAssignments.ts';
import { nowDatetimeLocal } from '../../lib/incidentInfo.ts';
import { listMissionCots, type MissionCotRef } from '../../lib/missionCots.ts';
import { isValidAssignmentNumber } from '../../lib/workAssignments.ts';

const { activeMission } = useIncident();
const { assignments: resourceTeams, loadForMission: loadResourceTeams } = useResourceAssignments();
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

function onFormTeamChange(): void {
    form.value.teamLabel = teamLabelForId(form.value.teamResourceAssignmentId);
}

function onFormAssignmentChange(): void {
    form.value.assignmentCallsign = callsignForUid(form.value.assignmentUid);
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

async function addRow(): Promise<void> {
    if (!activeMission.value || !canAdd.value) return;

    await addAssignment(activeMission.value, {
        assignmentNumber: form.value.assignmentNumber,
        teamResourceAssignmentId: form.value.teamResourceAssignmentId.trim(),
        teamLabel: teamLabelForId(form.value.teamResourceAssignmentId),
        assignmentUid: form.value.assignmentUid.trim(),
        assignmentCallsign: callsignForUid(form.value.assignmentUid),
        instructions: form.value.instructions.trim(),
        started: form.value.started.trim(),
        completed: form.value.completed.trim(),
    });

    resetForm();
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

async function onRowAssignmentChange(id: string, uid: string): Promise<void> {
    if (!activeMission.value) return;
    await updateAssignment(activeMission.value, id, {
        assignmentUid: uid,
        assignmentCallsign: callsignForUid(uid),
    });
}

async function sendStart(id: string): Promise<void> {
    if (!activeMission.value) return;
    await sendPhaseLog(activeMission.value, id, 'started');
}

async function sendComplete(id: string): Promise<void> {
    if (!activeMission.value) return;
    await sendPhaseLog(activeMission.value, id, 'completed');
}

watch(() => activeMission.value?.guid, (guid) => {
    const mission = guid ? activeMission.value : null;
    void loadForMission(mission);
    void loadResourceTeams(mission);
    void refreshMissionCots();
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
