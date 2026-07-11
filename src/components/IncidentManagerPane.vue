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
                        @click='selectKey(item.key)'
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
                        @click='selectKey(item.key)'
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
                            @click='activeHTab = tab.key'
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
                        <WrapUpPane v-else-if='activeKey === "wrapup"' />
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
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, defineAsyncComponent, computed } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconMenu2 } from '@tabler/icons-vue';
import NavSectionHeader from './NavSectionHeader.vue';
import type { NavSectionHelpKey } from '../lib/navSectionHelp.ts';
import {
    SESSION_NAV_KEY,
    useIncident,
    type PaneNavState,
} from '../composables/useIncident.ts';

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

    { kind: 'item', key: 'wrapup', label: 'Wrap Up' },
];

const hTabs = [
    { key: 'main', label: 'Main' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'task', label: 'Tasks' },
    { key: 'organization', label: 'Organization' },
] as const;

const navKeys = new Set(
    navItems.filter((item) => item.kind !== 'header').map((item) => item.key),
);

type HTabKey = typeof hTabs[number]['key'];

function isHTabKey(value: string): value is HTabKey {
    return hTabs.some((tab) => tab.key === value);
}

function loadNavFromSession(): { activeKey: string; activeHTab: HTabKey } {
    try {
        const raw = sessionStorage.getItem(SESSION_NAV_KEY);
        if (!raw) return { activeKey: 'create-open', activeHTab: 'main' };
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return { activeKey: 'create-open', activeHTab: 'main' };
        }
        let key = (parsed as PaneNavState).activeKey;
        let htab = (parsed as PaneNavState).activeHTab;
        // Legacy: org chart tab was stored as `assignments` before Organization / work-assignments split.
        if (htab === 'assignments') htab = 'organization';
        // Resources moved from horizontal tab into Main vertical nav.
        if (htab === 'resources') {
            htab = 'main';
            key = 'resources';
        }
        // Assignments moved from horizontal tab into Main vertical nav.
        if (htab === 'work-assignments') {
            htab = 'main';
            key = 'work-assignments';
        }
        return {
            activeKey: navKeys.has(key) ? key : 'create-open',
            activeHTab: isHTabKey(htab) ? htab : 'main',
        };
    } catch {
        return { activeKey: 'create-open', activeHTab: 'main' };
    }
}

function saveNavToSession(activeKey: string, activeHTab: string): void {
    try {
        sessionStorage.setItem(
            SESSION_NAV_KEY,
            JSON.stringify({ activeKey, activeHTab }),
        );
    } catch {
        // ignore quota / private-mode errors
    }
}

const savedNav = loadNavFromSession();
const activeKey = ref<string>(savedNav.activeKey);
const activeHTab = ref<string>(savedNav.activeHTab);

const activeNavLabel = computed(() => {
    if (activeHTab.value !== 'main') {
        const tab = hTabs.find((item) => item.key === activeHTab.value);
        return tab?.label ?? 'Main';
    }
    const item = navItems.find((entry) => entry.kind !== 'header' && entry.key === activeKey.value);
    return item?.label ?? 'Create | Open';
});

const { restoreActiveMissionOnMap } = useIncident();

watch([activeKey, activeHTab], ([key, htab]) => {
    saveNavToSession(key, htab);
});

onMounted(() => {
    void restoreActiveMissionOnMap();
});

function selectKey(key: string): void {
    activeKey.value = key;
    // match reference behavior: choosing a pane returns you to Main
    activeHTab.value = 'main';
}
</script>
