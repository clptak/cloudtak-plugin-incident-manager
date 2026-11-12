<template>
    <div class='row g-2'>
        <div class='col-3 col-sm-2'>
            <label class='form-label small mb-0'>#</label>
            <input
                :value='draft.assignmentNumber'
                type='number'
                min='1'
                class='form-control form-control-sm'
                @input='set("assignmentNumber", Number(($event.target as HTMLInputElement).value))'
            >
        </div>
        <div class='col-9 col-sm-10 col-lg-6'>
            <label class='form-label small mb-0'>Map object</label>
            <div class='d-flex gap-1'>
                <select
                    :value='draft.assignmentUid'
                    class='form-select form-select-sm'
                    @change='set("assignmentUid", ($event.target as HTMLSelectElement).value)'
                >
                    <option value=''>
                        {{ loadingMapObjects ? 'Loading…' : (mapObjects.length ? '— Map object —' : 'No map objects') }}
                    </option>
                    <option
                        v-for='c in mapObjects'
                        :key='c.uid'
                        :value='c.uid'
                    >
                        {{ c.callsign }}
                    </option>
                </select>
                <button
                    type='button'
                    class='btn btn-outline-secondary btn-sm text-nowrap'
                    title='Refresh map objects'
                    aria-label='Refresh map objects'
                    :disabled='loadingMapObjects'
                    @click='emit("refresh")'
                >
                    <IconRefresh
                        :size='14'
                        stroke='1.5'
                    />
                </button>
            </div>
        </div>
        <div
            v-if='teams'
            class='col-sm-6 col-lg-4'
        >
            <label class='form-label small mb-0'>Team</label>
            <select
                :value='draft.teamResourceAssignmentId'
                class='form-select form-select-sm'
                @change='set("teamResourceAssignmentId", ($event.target as HTMLSelectElement).value)'
            >
                <option :value='draft.teamResourceAssignmentId'>
                    — Team —
                </option>
                <option
                    v-for='t in teams'
                    :key='t.id'
                    :value='t.id'
                >
                    {{ t.resourceIdentifier }}
                </option>
            </select>
        </div>
        <div class='col-12'>
            <label class='form-label small mb-0'>Instructions</label>
            <input
                :value='draft.instructions'
                class='form-control form-control-sm'
                placeholder='Task instructions'
                @input='set("instructions", ($event.target as HTMLInputElement).value)'
            >
        </div>
        <div class='col-sm-6 col-lg-4'>
            <label class='form-label small mb-0'>Started</label>
            <input
                :value='draft.started'
                type='datetime-local'
                class='form-control form-control-sm'
                @input='set("started", ($event.target as HTMLInputElement).value)'
            >
        </div>
        <div class='col-sm-6 col-lg-4'>
            <label class='form-label small mb-0'>Completed</label>
            <input
                :value='draft.completed'
                type='datetime-local'
                class='form-control form-control-sm'
                @input='set("completed", ($event.target as HTMLInputElement).value)'
            >
        </div>
        <div
            v-if='!mapObjects.length && !loadingMapObjects'
            class='col-12 small text-white-50'
        >
            Attach the assignment lines and polygons to this DataSync first, or import them
            (GeoJSON or the CalTopo Sync plugin), then refresh.
        </div>
    </div>
</template>

<script setup lang='ts'>
/** Fields of a work assignment on the Resources & Assignments board. */
import { IconRefresh } from '@tabler/icons-vue';
import type { MissionCotRef } from '../../lib/missionCots.ts';
import type { ResourceAssignment } from '../../lib/resourceAssignments.ts';
import type { WorkDraft } from '../../lib/resourceBoard.ts';

const props = defineProps<{
    draft: WorkDraft;
    mapObjects: MissionCotRef[];
    loadingMapObjects: boolean;
    /** When given, the team can be changed (assignments with no resource). */
    teams?: ResourceAssignment[];
}>();

const emit = defineEmits<{
    (e: 'update:draft', value: WorkDraft): void;
    (e: 'refresh'): void;
}>();

function set<K extends keyof WorkDraft>(key: K, value: WorkDraft[K]): void {
    emit('update:draft', { ...props.draft, [key]: value });
}
</script>
