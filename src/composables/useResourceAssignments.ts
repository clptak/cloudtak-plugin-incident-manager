import { ref } from 'vue';
import type { ActiveMission } from './useIncident.ts';
import {
    loadResourceAssignmentsFromMission,
    saveResourceAssignmentsToMission,
} from '../lib/resourceAssignmentPersistence.ts';
import {
    blankResourceAssignmentForm,
    mergeResourceAssignmentPatch,
    type ResourceAssignment,
} from '../lib/resourceAssignments.ts';

const assignments = ref<ResourceAssignment[]>([]);
const defaultAgency = ref('');
const schemaHash = ref<string | undefined>();
const loading = ref(false);
const saving = ref(false);
const statusMessage = ref('');
const statusError = ref(false);

export function useResourceAssignments() {
    async function loadForMission(mission: ActiveMission | null): Promise<void> {
        if (!mission) {
            assignments.value = [];
            defaultAgency.value = '';
            schemaHash.value = undefined;
            statusMessage.value = '';
            return;
        }

        loading.value = true;
        statusError.value = false;
        statusMessage.value = 'Loading resource assignments…';

        try {
            const loaded = await loadResourceAssignmentsFromMission(mission);
            assignments.value = loaded.assignments;
            defaultAgency.value = loaded.defaultAgency;
            schemaHash.value = loaded.contentHash;
            statusMessage.value = loaded.assignments.length
                ? `${loaded.assignments.length} resource assignment${loaded.assignments.length === 1 ? '' : 's'} loaded`
                : '';
        } catch (err) {
            assignments.value = [];
            defaultAgency.value = '';
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
            schemaHash.value = await saveResourceAssignmentsToMission(
                mission,
                assignments.value,
                schemaHash.value,
                defaultAgency.value,
            );
            statusMessage.value = `${assignments.value.length} resource assignment${assignments.value.length === 1 ? '' : 's'} saved`;
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
        input: Omit<ResourceAssignment, 'id'>,
    ): Promise<ResourceAssignment> {
        const record: ResourceAssignment = {
            ...input,
            id: crypto.randomUUID(),
            resourceIdentifier: input.resourceIdentifier.trim(),
            resource: input.resource.trim(),
            agency: input.agency.trim(),
            timeOrdered: input.timeOrdered.trim(),
            timeArrived: input.timeArrived.trim(),
        };

        assignments.value = [...assignments.value, record];
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
        patch: Partial<Omit<ResourceAssignment, 'id'>>,
    ): Promise<void> {
        const idx = assignments.value.findIndex((a) => a.id === id);
        if (idx < 0) return;

        const updated = mergeResourceAssignmentPatch(assignments.value[idx], patch);
        assignments.value = [
            ...assignments.value.slice(0, idx),
            updated,
            ...assignments.value.slice(idx + 1),
        ];
        await persist(mission);
    }

    async function updateDefaultAgency(mission: ActiveMission, value: string): Promise<void> {
        defaultAgency.value = value.trim();
        await persist(mission);
    }

    return {
        assignments,
        defaultAgency,
        schemaHash,
        loading,
        saving,
        statusMessage,
        statusError,
        blankResourceAssignmentForm,
        loadForMission,
        addAssignment,
        removeAssignment,
        updateAssignment,
        updateDefaultAgency,
    };
}
