<template>
    <div class='d-flex flex-column gap-2 p-2 p-md-3 h-100 w-100'>
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
            <div class='offcanvas-body p-2 nav flex-column nav-pills'>
                <template
                    v-for='item in navItems'
                    :key='item.key'
                >
                    <NavSectionHeader
                        v-if='item.kind === "header"'
                        :label='item.label'
                        :help-key='item.helpKey'
                    />
                    <button
                        v-else
                        type='button'
                        class='nav-link text-start'
                        :class='{ active: activeKey === item.key && activeHTab === "main", "py-1": item.kind === "sub" }'
                        :style='item.kind === "sub" ? "padding-left: 1.25rem;" : ""'
                        data-bs-dismiss='offcanvas'
                        data-bs-target='#incident-manager-nav'
                        @click='selectKeyGuarded(item.key)'
                    >
                        {{ item.label }}
                    </button>
                </template>
            </div>
        </div>

        <div class='d-flex gap-2 gap-md-3 flex-grow-1 min-height-0'>
            <!-- Desktop: vertical nav -->
            <div
                class='nav flex-column nav-pills flex-shrink-0 d-none d-md-flex'
                style='min-width: 160px;'
            >
                <template
                    v-for='item in navItems'
                    :key='item.key'
                >
                    <NavSectionHeader
                        v-if='item.kind === "header"'
                        :label='item.label'
                        :help-key='item.helpKey'
                    />
                    <button
                        v-else
                        type='button'
                        class='nav-link text-start'
                        :class='{ active: activeKey === item.key && activeHTab === "main", "py-1": item.kind === "sub" }'
                        :style='item.kind === "sub" ? "padding-left: 1.25rem;" : ""'
                        @click='selectKeyGuarded(item.key)'
                    >
                        {{ item.label }}
                    </button>
                </template>
            </div>

            <!-- Content column -->
            <div
                class='flex-fill d-flex flex-column min-height-0'
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
                    <span class='text-muted small ms-2 text-truncate'>
                        {{ activeNavLabel }}
                    </span>
                </div>

                <ul class='nav nav-tabs mb-2 mb-md-3 flex-nowrap overflow-auto'>
                    <li
                        v-for='tab in hTabs'
                        :key='tab.key'
                        class='nav-item'
                    >
                        <button
                            type='button'
                            class='nav-link text-nowrap'
                            :class='{ active: activeHTab === tab.key }'
                            @click='selectHTabGuarded(tab.key)'
                        >
                            {{ tab.label }}
                        </button>
                    </li>
                </ul>

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
                        <CasiePane v-else-if='activeKey === "casie"' />
                        <WrapUpPane v-else-if='activeKey === "generate-report-template"' />
                        <LoggerPane
                            v-else
                            :sub='activeKey'
                        />
                    </div>

                    <DashboardTab v-if='activeHTab === "dashboard"' />
                    <TaskTab v-if='activeHTab === "task"' />
                    <OrganizationTab
                        v-if='activeHTab === "organization"'
                        class='h-100 min-height-0'
                    />
                </div>
            </div>
        </div>
    </div>
    <MissionRequiredModal />
</template>

<script setup lang='ts'>
import { onMounted, defineAsyncComponent, computed, watch } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconMenu2 } from '@tabler/icons-vue';
import NavSectionHeader from './NavSectionHeader.vue';
import MissionRequiredModal from './MissionRequiredModal.vue';
import type { NavSectionHelpKey } from '../lib/navSectionHelp.ts';
import { useIncident } from '../composables/useIncident.ts';

const CreateOpenPane = defineAsyncComponent(() => import('./panes/CreateOpenPane.vue'));
const LoggerPane = defineAsyncComponent(() => import('./panes/LoggerPane.vue'));
const CasiePane = defineAsyncComponent(() => import('./panes/CasiePane.vue'));
const WrapUpPane = defineAsyncComponent(() => import('./panes/WrapUpPane.vue'));
const DashboardTab = defineAsyncComponent(() => import('./panes/DashboardTab.vue'));
const TaskTab = defineAsyncComponent(() => import('./panes/TaskTab.vue'));
const AssignmentsTab = defineAsyncComponent(() => import('./panes/AssignmentsTab.vue'));
const OrganizationTab = defineAsyncComponent(() => import('./panes/OrganizationTab.vue'));
const ResourcesTab = defineAsyncComponent(() => import('./panes/ResourcesTab.vue'));

interface NavEntry {
    kind: 'item' | 'header' | 'sub';
    key: string;
    label: string;
    helpKey?: NavSectionHelpKey;
}

const navItems: NavEntry[] = [
    { kind: 'item', key: 'create-open', label: 'Create | Open' },

    { kind: 'header', key: 'h-initial', label: 'Initial Response', helpKey: 'route-location-search' },
    { kind: 'sub', key: 'initial-information', label: 'Initial Information' },
    { kind: 'sub', key: 'subject-info', label: 'Subject Information' },
    { kind: 'sub', key: 'search-urgency', label: 'Search Urgency' },
    { kind: 'sub', key: 'ir-briefing', label: 'IR Briefing' },
    { kind: 'sub', key: 'resources', label: 'Resources' },
    { kind: 'sub', key: 'work-assignments', label: 'Assignments' },
    { kind: 'sub', key: 'ics-201', label: 'ICS 201' },

    { kind: 'header', key: 'h-area', label: 'Area Search', helpKey: 'area-search' },
    { kind: 'sub', key: 'search-scenarios', label: 'Search Scenarios' },
    { kind: 'sub', key: 'search-area', label: 'Search Area' },
    { kind: 'sub', key: 'risk-assessment', label: 'Risk Assessment' },
    { kind: 'sub', key: 'incident-post', label: 'Incident POST' },
    { kind: 'sub', key: 'casie', label: 'CASIE' },

    { kind: 'header', key: 'h-wrapup', label: 'Wrap Up' },
    { kind: 'sub', key: 'generate-report-template', label: 'Generate Report Template' },
];

const hTabs = [
    { key: 'main', label: 'Main' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'task', label: 'Tasks' },
    { key: 'organization', label: 'Organization' },
] as const;

const {
    activeKey,
    activeHTab,
    activeMission,
    selectKeyGuarded,
    selectHTabGuarded,
    openNoMissionModal,
    isMissionRequiredView,
    restoreActiveMissionOnMap,
} = useIncident();

const activeNavLabel = computed(() => {
    if (activeHTab.value !== 'main') {
        const tab = hTabs.find((item) => item.key === activeHTab.value);
        return tab?.label ?? 'Main';
    }
    const item = navItems.find((entry) => entry.kind !== 'header' && entry.key === activeKey.value);
    return item?.label ?? 'Create | Open';
});

watch([activeKey, activeHTab], () => {
    if (activeMission.value) return;
    if (!isMissionRequiredView(activeKey.value, activeHTab.value)) return;
    openNoMissionModal();
});

onMounted(() => {
    void restoreActiveMissionOnMap();
});
</script>
