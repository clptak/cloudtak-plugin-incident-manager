import { ref } from 'vue';
import type { ActiveMission } from './useIncident.ts';
import { sendWorkAssignmentLog, type WorkAssignmentPhase } from '../lib/workAssignmentLogs.ts';
import {
    loadWorkAssignmentsFromMission,
    saveWorkAssignmentsToMission,
} from '../lib/workAssignmentPersistence.ts';
import {
    blankWorkAssignmentForm,
    mergeWorkAssignmentPatch,
    type WorkAssignment,
} from '../lib/workAssignments.ts';

const assignments = ref<WorkAssignment[]>([]);
const schemaHash = ref<string | undefined>();
const loading = ref(false);
const saving = ref(false);
const sending = ref(false);
const statusMessage = ref('');
const statusError = ref(false);

export function useWorkAssignments() {
    async function loadForMission(mission: ActiveMission | null): Promise<void> {
        if (!mission) {
            assignments.value = [];
            schemaHash.value = undefined;
            statusMessage.value = '';
            return;
        }

        loading.value = true;
        statusError.value = false;
        statusMessage.value = 'Loading assignments…';

        try {
            const loaded = await loadWorkAssignmentsFromMission(mission);
            assignments.value = loaded.assignments;
            schemaHash.value = loaded.contentHash;
            statusMessage.value = loaded.assignments.length
                ? `${loaded.assignments.length} assignment${loaded.assignments.length === 1 ? '' : 's'} loaded`
                : '';
        } catch (err) {
            assignments.value = [];
            schemaHash.value = undefined;
            statusError.value = true;
            statusMessage.value = err instanceof Error ? err.message : String(err);
        } finally {
            loading.value = false;
        }
    }

    async function persist(mission: ActiveMission): Promise<void> {
        saving.value = true;
        statusError.value = false;
        statusMessage.value = 'Saving…';

        try {
            schemaHash.value = await saveWorkAssignmentsToMission(
                mission,
                assignments.value,
                schemaHash.value,
            );
            statusMessage.value = `${assignments.value.length} assignment${assignments.value.length === 1 ? '' : 's'} saved`;
        } catch (err) {
            statusError.value = true;
            statusMessage.value = err instanceof Error ? err.message : String(err);
            throw err;
        } finally {
            saving.value = false;
        }
    }

    async function addAssignment(
        mission: ActiveMission,
        input: Omit<WorkAssignment, 'id' | 'startedLogId' | 'completedLogId'>,
    ): Promise<WorkAssignment> {
        const record: WorkAssignment = {
            ...input,
            id: crypto.randomUUID(),
        };

        assignments.value = [...assignments.value, record].sort(
            (a, b) => a.assignmentNumber - b.assignmentNumber,
        );
        await persist(mission);
        return record;
    }

    async function removeAssignment(mission: ActiveMission, id: string): Promise<void> {
        assignments.value = assignments.value.filter((a) => a.id !== id);
        await persist(mission);
    }

    async function updateAssignment(
        mission: ActiveMission,
        id: string,
        patch: Partial<Omit<WorkAssignment, 'id'>>,
    ): Promise<void> {
        const idx = assignments.value.findIndex((a) => a.id === id);
        if (idx < 0) return;

        const updated = mergeWorkAssignmentPatch(assignments.value[idx], patch);
        assignments.value = [
            ...assignments.value.slice(0, idx),
            updated,
            ...assignments.value.slice(idx + 1),
        ].sort((a, b) => a.assignmentNumber - b.assignmentNumber);
        await persist(mission);
    }

    async function sendPhaseLog(
        mission: ActiveMission,
        id: string,
        phase: WorkAssignmentPhase,
    ): Promise<void> {
        const idx = assignments.value.findIndex((a) => a.id === id);
        if (idx < 0) return;

        const current = assignments.value[idx];
        sending.value = true;
        statusError.value = false;
        statusMessage.value = phase === 'started' ? 'Sending start…' : 'Sending completion…';

        try {
            const existingLogId = phase === 'started'
                ? current.startedLogId
                : current.completedLogId;
            const logId = await sendWorkAssignmentLog(mission, current, phase, existingLogId);

            const patch = phase === 'started'
                ? { startedLogId: logId }
                : { completedLogId: logId };
            const updated = mergeWorkAssignmentPatch(current, patch);
            assignments.value = [
                ...assignments.value.slice(0, idx),
                updated,
                ...assignments.value.slice(idx + 1),
            ];
            schemaHash.value = await saveWorkAssignmentsToMission(
                mission,
                assignments.value,
                schemaHash.value,
            );
            statusMessage.value = phase === 'started'
                ? `Assignment ${current.assignmentNumber} start sent to DataSync`
                : `Assignment ${current.assignmentNumber} completion sent to DataSync`;
        } catch (err) {
            statusError.value = true;
            statusMessage.value = err instanceof Error ? err.message : String(err);
            throw err;
        } finally {
            sending.value = false;
        }
    }

    return {
        assignments,
        schemaHash,
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
    };
}
