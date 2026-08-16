<template>
    <div class='incident-manager-pane d-flex flex-column gap-2 px-3 py-3 h-100 w-100 overflow-hidden min-height-0'>
        <!-- Mobile: offcanvas nav -->
        <div
            id='incident-manager-nav'
            class='offcanvas offcanvas-start d-md-none'
            tabindex='-1'
            aria-labelledby='incident-manager-nav-label'
        >
            <div class='offcanvas-header'>
                <h5
                    id='incident-manager-nav-label'
                    class='offcanvas-title'
                >
                    Sections
                </h5>
                <button
                    type='button'
                    class='btn-close'
                    data-bs-dismiss='offcanvas'
                    aria-label='Close navigation'
                />
            </div>
            <div class='offcanvas-body p-2 incident-side-nav'>
                <IncidentNavList
                    mobile
                    :section-expanded='sectionExpanded'
                    :active-key='activeKey'
                    :active-h-tab='activeHTab'
                    @toggle-section='toggleSection'
                />
            </div>
        </div>

        <div class='incident-manager-body d-flex gap-2 gap-md-3 flex-grow-1 min-height-0 overflow-hidden'>
            <!-- Desktop: vertical nav -->
            <div
                class='incident-side-nav incident-side-nav--desktop flex-shrink-0 d-none d-md-flex'
                style='min-width: 160px;'
            >
                <IncidentNavList
                    :section-expanded='sectionExpanded'
                    :active-key='activeKey'
                    :active-h-tab='activeHTab'
                    @toggle-section='toggleSection'
                />
            </div>

            <!-- Content column -->
            <div
                class='flex-fill d-flex flex-column min-height-0 overflow-hidden'
                style='min-width: 0;'
            >
                <div class='d-md-none d-flex align-items-center mb-1'>
                    <TablerIconButton
                        title='Open navigation'
                        data-bs-toggle='offcanvas'
                        data-bs-target='#incident-manager-nav'
                    >
                        <IconMenu2
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <span class='incident-mobile-nav-label small ms-2 text-truncate'>
                        {{ activeNavLabel }}
                    </span>
                </div>

                <div class='incident-h-tabs flex-shrink-0 mb-2 mb-md-3 overflow-auto'>
                    <TablerPillGroup
                        :model-value='activeHTab'
                        :options='hTabOptions'
                        @update:model-value='selectHTabGuarded'
                    />
                </div>

                <div
                    class='tab-content flex-grow-1 min-height-0'
                    :class='activeHTab === "organization"
                        ? "overflow-hidden d-flex flex-column"
                        : "overflow-auto"'
                >
                    <!-- Main: shows the active vertical pane -->
                    <div v-if='activeHTab === "main"'>
                        <CreateOpenPane v-if='activeKey === "create-open"' />
                        <ResourcesTab v-else-if='activeKey === "resources"' />
                        <AssignmentsTab v-else-if='activeKey === "work-assignments"' />
                        <WrapUpPane v-else-if='activeKey === "generate-report-template"' />
                        <LoggerPane
                            v-else
                            :sub='activeKey'
                        />
                    </div>

                    <DashboardTab v-if='activeHTab === "dashboard"' />
                    <TaskTab v-if='activeHTab === "task"' />
                    <ClueLog v-if='activeHTab === "clues"' />
                    <CasiePane v-if='activeHTab === "casie"' />
                    <OrganizationTab
                        v-if='activeHTab === "organization"'
                        class='h-100 min-height-0'
                    />
                    <LoggerPane
                        v-if='activeHTab === "risk-assessment"'
                        sub='risk-assessment'
                    />
                </div>
            </div>
        </div>
    </div>
    <MissionRequiredModal />
</template>

<script setup lang='ts'>
import { onMounted, defineAsyncComponent, computed, ref, watch } from 'vue';
import { TablerIconButton, TablerPillGroup } from '@tak-ps/vue-tabler';
import { IconMenu2 } from '@tabler/icons-vue';
import IncidentNavList from './IncidentNavList.vue';
import MissionRequiredModal from './MissionRequiredModal.vue';
import './incidentSideNav.css';
import './incidentModal.css';
import {
    ALL_NAV_ITEMS,
    NAV_SECTIONS,
    sectionKeyForNavItem,
} from '../lib/incidentNav.ts';
import { useIncident } from '../composables/useIncident.ts';

const CreateOpenPane = defineAsyncComponent(() => import('./panes/CreateOpenPane.vue'));
const LoggerPane = defineAsyncComponent(() => import('./panes/LoggerPane.vue'));
const CasiePane = defineAsyncComponent(() => import('./panes/CasiePane.vue'));
const WrapUpPane = defineAsyncComponent(() => import('./panes/WrapUpPane.vue'));
const DashboardTab = defineAsyncComponent(() => import('./panes/DashboardTab.vue'));
const TaskTab = defineAsyncComponent(() => import('./panes/TaskTab.vue'));
const ClueLog = defineAsyncComponent(() => import('./panes/logger/ClueLog.vue'));
const AssignmentsTab = defineAsyncComponent(() => import('./panes/AssignmentsTab.vue'));
const OrganizationTab = defineAsyncComponent(() => import('./panes/OrganizationTab.vue'));
const ResourcesTab = defineAsyncComponent(() => import('./panes/ResourcesTab.vue'));

const SESSION_NAV_SECTIONS_KEY = 'incident-manager:nav-sections-expanded';

const DEFAULT_SECTION_EXPANDED: Record<string, boolean> = Object.fromEntries(
    NAV_SECTIONS.map((section) => [section.key, true]),
);

function loadSectionExpandedFromSession(): Record<string, boolean> {
    const merged = { ...DEFAULT_SECTION_EXPANDED };
    try {
        const raw = sessionStorage.getItem(SESSION_NAV_SECTIONS_KEY);
        if (!raw) return merged;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return merged;
        for (const section of NAV_SECTIONS) {
            const value = (parsed as Record<string, unknown>)[section.key];
            if (typeof value === 'boolean') {
                merged[section.key] = value;
            }
        }
    } catch {
        // ignore corrupt session data
    }
    return merged;
}

function saveSectionExpandedToSession(state: Record<string, boolean>): void {
    try {
        sessionStorage.setItem(SESSION_NAV_SECTIONS_KEY, JSON.stringify(state));
    } catch {
        // ignore quota / private-mode errors
    }
}

const hTabs = [
    { key: 'main', label: 'Main' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'task', label: 'Tasks' },
    { key: 'clues', label: 'Clues' },
    { key: 'casie', label: 'CASIE' },
    { key: 'organization', label: 'Organization' },
    { key: 'risk-assessment', label: 'Risk Assessment' },
] as const;

const hTabOptions = hTabs.map((tab) => ({
    value: tab.key,
    label: tab.label,
}));

const {
    activeKey,
    activeHTab,
    activeMission,
    selectHTabGuarded,
    openNoMissionModal,
    isMissionRequiredView,
    restoreActiveMissionOnMap,
} = useIncident();

const sectionExpanded = ref(loadSectionExpandedFromSession());

function toggleSection(key: string): void {
    sectionExpanded.value = {
        ...sectionExpanded.value,
        [key]: !sectionExpanded.value[key],
    };
}

function expandSectionForActiveKey(key: string): void {
    const sectionKey = sectionKeyForNavItem(key);
    if (!sectionKey || sectionExpanded.value[sectionKey] !== false) return;
    sectionExpanded.value = {
        ...sectionExpanded.value,
        [sectionKey]: true,
    };
}

const activeNavLabel = computed(() => {
    if (activeHTab.value !== 'main') {
        const tab = hTabs.find((item) => item.key === activeHTab.value);
        return tab?.label ?? 'Main';
    }
    const item = ALL_NAV_ITEMS.find((entry) => entry.key === activeKey.value);
    return item?.label ?? 'Create | Open';
});

watch(sectionExpanded, (state) => {
    saveSectionExpandedToSession(state);
}, { deep: true });

watch(activeKey, (key) => {
    expandSectionForActiveKey(key);
}, { immediate: true });

watch([activeKey, activeHTab], () => {
    if (activeMission.value) return;
    if (!isMissionRequiredView(activeKey.value, activeHTab.value)) return;
    openNoMissionModal();
});

onMounted(() => {
    void restoreActiveMissionOnMap();
});
</script>

<style scoped>
.incident-manager-pane {
    /* Match Mission Info insets; Tabler form surfaces are primary-tinted */
    --tabler-input-bg: var(--cloudtak-inset-bg);
    --tblr-bg-forms: var(--cloudtak-inset-bg);
    --tblr-card-bg: var(--cloudtak-inset-bg);
    --bs-card-bg: var(--cloudtak-inset-bg);
}

/*
 * FloatingPane does not get MainMenu's `.cloudtak-bg → panel-bg` remap.
 * Solid dark `.cloudtak-bg` (#283547) and Bootstrap `.card` read as blue-grey
 * slabs. Paint them with inset tokens so sections match Mission Logs tone.
 * Note: `bg-opacity-*` does nothing on `.cloudtak-bg` (solid !important hex).
 */
.incident-manager-pane :deep(.cloudtak-bg) {
    background-color: var(--cloudtak-inset-bg) !important;
    border-color: var(--cloudtak-inset-border);
}

.incident-manager-pane :deep(.card) {
    background-color: var(--cloudtak-inset-bg) !important;
    border-color: var(--cloudtak-inset-border);
}

.incident-manager-pane :deep(.card-header) {
    background-color: transparent !important;
}

.incident-manager-pane :deep(.list-group-item) {
    background-color: var(--cloudtak-inset-bg) !important;
    border-color: var(--cloudtak-inset-border);
}

.incident-manager-pane :deep(.alert-info) {
    --tblr-alert-color: var(--tblr-body-color);
    background-color: var(--cloudtak-inset-bg) !important;
    border-color: var(--cloudtak-inset-border) !important;
    color: var(--tblr-body-color) !important;
}
</style>
