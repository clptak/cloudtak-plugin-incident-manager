<template>
    <div class='incident-popout d-flex flex-column'>
        <template v-if='paneOpen'>
            <div
                class='d-flex align-items-center px-2 border-bottom flex-shrink-0'
                style='height: 50px;'
            >
                <IconTarget
                    class='flex-shrink-0'
                    :size='20'
                    stroke='1.5'
                />
                <span class='ms-2 text-truncate'>Incident Manager</span>
                <div class='btn-list ms-auto'>
                    <TablerIconButton
                        title='Minimize to task bar'
                        @click='paneOpen = false'
                    >
                        <IconMinus
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
            <div class='flex-grow-1 min-height-0 overflow-hidden'>
                <IncidentManagerPane />
            </div>
        </template>
        <div
            v-else
            class='flex-grow-1 d-flex align-items-center justify-content-center text-secondary'
        >
            <span>Incident Manager is minimized — restore it from the task bar below.</span>
        </div>

        <div class='incident-popout-taskbar d-flex align-items-center justify-content-center gap-2 px-2 flex-shrink-0'>
            <TaskbarChipButton
                :icon='IconTarget'
                label='Incident Manager'
                title='Open Incident Manager'
                @click='openSection()'
            />
            <TaskbarChipButton
                :icon='IconUsersGroup'
                label='Resources'
                title='Open Resources'
                @click='openSection("resources")'
            />
            <TaskbarChipButton
                :icon='IconClipboardList'
                label='Assignments'
                title='Open Assignments'
                @click='openSection("work-assignments")'
            />
            <TaskbarChipButton
                :icon='IconPolygon'
                label='Segments'
                title='Open Segmentation'
                @click='openSection("segmentation")'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    IconClipboardList,
    IconMinus,
    IconPolygon,
    IconTarget,
    IconUsersGroup,
} from '@tabler/icons-vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import IncidentManagerPane from '../IncidentManagerPane.vue';
import TaskbarChipButton from '../TaskbarChipButton.vue';
import { useIncident } from '../../composables/useIncident.ts';

const { selectKeyGuarded } = useIncident();

/**
 * Popout-local minimize state: independent of the main window's floatMinimize
 * state, so the popout pane minimizes to its own task bar separately.
 */
const paneOpen = ref(true);

function openSection(key?: string): void {
    paneOpen.value = true;
    if (key) selectKeyGuarded(key);
}
</script>

<style>
.incident-popout {
    height: 100vh;
    background-color: var(--tblr-bg-surface, #182433);
    color: var(--tblr-body-color, #dce1e7);
}

.incident-popout-taskbar {
    height: 50px;
    background-color: rgba(0, 0, 0, 0.5);
    border-top: 1px solid var(--tblr-border-color, rgba(255, 255, 255, 0.15));
}
</style>
