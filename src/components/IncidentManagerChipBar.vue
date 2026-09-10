<template>
    <div
        ref='pane'
        class='position-absolute cloudtak-panel d-flex align-items-center gap-2 px-2 incident-chip-bar'
        :class='{
            "incident-chip-bar--dragging": dragging,
            "incident-chip-bar--ready": laidOut,
            "incident-chip-bar--collapsed": hidden,
        }'
        :style='paneStyle'
    >
        <div
            class='incident-chip-bar-grip flex-shrink-0 d-flex align-items-center'
            title='Drag to move. Double-click to dock beside DataSync.'
            @pointerdown='onGripPointerDown'
            @pointermove='onGripPointerMove'
            @pointerup='onGripPointerUp'
            @pointercancel='onGripPointerUp'
            @dblclick.prevent='reDock'
        >
            <IconGripVertical
                :size='20'
                stroke='1.5'
            />
        </div>
        <div
            v-if='hidden'
            class='incident-chip-bar-chips d-flex align-items-center gap-2'
        >
            <TaskbarChipButton
                :icon='IconTarget'
                label='IM'
                title='Show Incident Manager chip bar'
                @click='showBar'
            />
        </div>
        <template v-else>
            <div class='incident-chip-bar-chips d-flex align-items-center gap-2'>
                <IncidentManagerTaskbarChip />
                <ResourcesTaskbarChip />
                <AssignmentsTaskbarChip />
                <SegmentsTaskbarChip />
                <ClueTaskbarChip />
            </div>
            <TablerDropdown>
                <TaskbarChipButton
                    :icon='IconFileText'
                    label='Add DataSync Log'
                    title='Submit a log to DataSync'
                />
                <template #dropdown>
                    <div
                        class='py-1'
                        style='min-width: 160px;'
                    >
                        <button
                            type='button'
                            class='dropdown-item'
                            @click='onOpenLogTemplate("template1")'
                        >
                            Template 1
                        </button>
                        <button
                            type='button'
                            class='dropdown-item'
                            @click='onOpenLogTemplate("template2")'
                        >
                            Template 2
                        </button>
                    </div>
                </template>
            </TablerDropdown>
            <TaskbarChipButton
                :icon='IconChevronRight'
                label='Hide'
                title='Hide chip bar'
                @click='hideBar'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
    IconChevronRight,
    IconFileText,
    IconGripVertical,
    IconTarget,
} from '@tabler/icons-vue';
import { TablerDropdown } from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../../src/stores/map.ts';
import IncidentManagerTaskbarChip from './IncidentManagerTaskbarChip.vue';
import ResourcesTaskbarChip from './ResourcesTaskbarChip.vue';
import AssignmentsTaskbarChip from './AssignmentsTaskbarChip.vue';
import SegmentsTaskbarChip from './SegmentsTaskbarChip.vue';
import ClueTaskbarChip from './ClueTaskbarChip.vue';
import TaskbarChipButton from './TaskbarChipButton.vue';
import {
    CHIP_BAR_ROOT_ID,
    DOCK_GAP,
    PANE_HEIGHT,
    clampOutFromNav,
    clampToShell,
    clearSavedPos,
    dockedMaxWidth,
    dockedPosition,
    isDesktopWidth,
    loadHidden,
    loadSavedPos,
    queryActiveMission,
    queryLeftControls,
    queryNavBanner,
    saveHidden,
    savePos,
    toRect,
    type Point,
} from '../lib/chipBarPosition.ts';

const mapStore = useMapStore();

const navActive = computed(() => {
    try {
        return Boolean(mapStore.navigation?.active);
    } catch {
        return false;
    }
});

const pane = ref<HTMLElement | null>(null);
const saved = loadSavedPos();
const isUndocked = ref(saved !== null);
const hidden = ref(loadHidden());
const pos = ref<Point>(saved ?? { x: DOCK_GAP, y: DOCK_GAP });
const maxWidth = ref(480);
const dragging = ref(false);
const laidOut = ref(false);

const dragOrigin = ref<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
} | null>(null);

const paneStyle = computed(() => ({
    top: `${pos.value.y}px`,
    left: `${pos.value.x}px`,
    maxWidth: `${maxWidth.value}px`,
}));

let observer: ResizeObserver | null = null;

function layout(): void {
    if (dragging.value) return;

    const shellEl = pane.value?.closest('.map-shell')
        ?? document.getElementById(CHIP_BAR_ROOT_ID)?.closest('.map-shell')
        ?? document.querySelector('.map-shell');
    const shell = toRect(shellEl);
    if (!shell || !shellEl) return;

    const mission = toRect(queryActiveMission(shellEl));
    const leftControls = toRect(queryLeftControls(shellEl));
    const nav = toRect(queryNavBanner());
    const paneSize = {
        width: pane.value?.offsetWidth || (hidden.value ? 80 : 200),
        height: pane.value?.offsetHeight || PANE_HEIGHT,
    };
    const desktop = isDesktopWidth(window.innerWidth);

    if (isUndocked.value) {
        pos.value = clampToShell(
            clampOutFromNav(pos.value, paneSize, nav, shell),
            paneSize,
            { width: shell.width, height: shell.height },
        );
        maxWidth.value = hidden.value
            ? Math.max(80, Math.min(160, shell.width - pos.value.x - DOCK_GAP))
            : Math.max(120, shell.width - pos.value.x - DOCK_GAP);
        laidOut.value = true;
        return;
    }

    pos.value = dockedPosition({
        shell,
        activeMission: mission,
        leftControls,
        navActive: navActive.value,
        isDesktop: desktop,
    });
    maxWidth.value = hidden.value
        ? Math.max(80, Math.min(160, shell.width - pos.value.x - DOCK_GAP))
        : dockedMaxWidth(
            pos.value,
            shell.width,
            !(navActive.value && desktop),
        );
    laidOut.value = true;
}

function attachObservers(): void {
    observer?.disconnect();
    observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
        layout();
    });
    if (!observer) return;

    const shellEl = document.querySelector('.map-shell');
    if (!shellEl) return;
    const mission = queryActiveMission(shellEl);
    const controls = queryLeftControls(shellEl);
    const navigating = queryNavBanner();
    if (mission) observer.observe(mission);
    if (controls) observer.observe(controls);
    if (navigating) observer.observe(navigating);
    if (pane.value) observer.observe(pane.value);
}

function onGripPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') event.preventDefault();
    event.stopPropagation();
    dragging.value = true;
    dragOrigin.value = {
        x: pos.value.x,
        y: pos.value.y,
        clientX: event.clientX,
        clientY: event.clientY,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onGripPointerMove(event: PointerEvent): void {
    if (!dragging.value || !dragOrigin.value) return;
    event.stopPropagation();

    const dx = event.clientX - dragOrigin.value.clientX;
    const dy = event.clientY - dragOrigin.value.clientY;
    if (!isUndocked.value && Math.hypot(dx, dy) < 4) return;

    if (event.pointerType === 'touch') event.preventDefault();
    isUndocked.value = true;

    const shell = toRect(pane.value?.closest('.map-shell') ?? document.querySelector('.map-shell'));
    const paneSize = {
        width: pane.value?.offsetWidth || 200,
        height: pane.value?.offsetHeight || PANE_HEIGHT,
    };
    const next = {
        x: dragOrigin.value.x + dx,
        y: dragOrigin.value.y + dy,
    };
    pos.value = shell
        ? clampToShell(next, paneSize, { width: shell.width, height: shell.height })
        : next;
    if (shell) {
        maxWidth.value = Math.max(120, shell.width - pos.value.x - DOCK_GAP);
    }
}

function onGripPointerUp(event: PointerEvent): void {
    if (!dragging.value) return;
    event.stopPropagation();
    dragging.value = false;
    dragOrigin.value = null;
    if (isUndocked.value) savePos(pos.value);
}

function reDock(): void {
    dragging.value = false;
    dragOrigin.value = null;
    isUndocked.value = false;
    clearSavedPos();
    layout();
}

function hideBar(): void {
    hidden.value = true;
    saveHidden(true);
}

function showBar(): void {
    hidden.value = false;
    saveHidden(false);
}

function onOpenLogTemplate(_id: 'template1' | 'template2'): void {
    // TODO: open DataSync log form for this template
}

watch(hidden, () => {
    void nextTick(() => {
        layout();
    });
});

watch(navActive, () => {
    void nextTick(() => {
        attachObservers();
        layout();
    });
});

watch(() => {
    try {
        return mapStore.mission?.meta?.guid ?? null;
    } catch {
        return null;
    }
}, () => {
    void nextTick(() => {
        attachObservers();
        layout();
    });
});

onMounted(() => {
    window.addEventListener('resize', layout);
    void nextTick(() => {
        attachObservers();
        layout();
    });
});

onUnmounted(() => {
    window.removeEventListener('resize', layout);
    observer?.disconnect();
    observer = null;
});
</script>

<style scoped>
.incident-chip-bar {
    z-index: 5;
    height: 60px;
    overflow: hidden;
    user-select: none;
    opacity: 0;
    pointer-events: none;
}

.incident-chip-bar--ready {
    opacity: 1;
    pointer-events: auto;
}

.incident-chip-bar-grip {
    cursor: grab;
    color: inherit;
    touch-action: none;
}

.incident-chip-bar--dragging,
.incident-chip-bar--dragging .incident-chip-bar-grip {
    cursor: grabbing;
}

.incident-chip-bar-chips {
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
}

.incident-chip-bar--collapsed {
    width: max-content;
}
</style>
