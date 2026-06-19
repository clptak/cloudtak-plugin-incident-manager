<template>
    <div class='d-flex gap-3 p-3 h-100 w-100'>
        <!-- ── Left: vertical nav (always visible) ── -->
        <div
            class='nav flex-column nav-pills flex-shrink-0'
            style='min-width: 160px;'
        >
            <template
                v-for='item in navItems'
                :key='item.key'
            >
                <div
                    v-if='item.kind === "header"'
                    class='text-muted text-uppercase fw-bold px-2 mt-3 mb-1'
                    style='font-size: 0.72rem; letter-spacing: 0.04em;'
                >
                    {{ item.label }}
                </div>
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

        <!-- ── Right: horizontal tabs + content ── -->
        <div
            class='flex-fill'
            style='min-width: 0;'
        >
            <ul class='nav nav-tabs mb-3'>
                <li
                    v-for='tab in hTabs'
                    :key='tab.key'
                    class='nav-item'
                >
                    <button
                        type='button'
                        class='nav-link'
                        :class='{ active: activeHTab === tab.key }'
                        @click='activeHTab = tab.key'
                    >
                        {{ tab.label }}
                    </button>
                </li>
            </ul>

            <div class='tab-content'>
                <!-- Main: shows the active vertical pane -->
                <div v-show='activeHTab === "main"'>
                    <CreateOpenPane v-if='activeKey === "create-open"' />
                    <CasiePane v-else-if='activeKey === "casie"' />
                    <WrapUpPane v-else-if='activeKey === "wrapup"' />
                    <LoggerPane
                        v-else
                        :sub='activeKey'
                    />
                </div>

                <TaskTab v-show='activeHTab === "task"' />
                <DashboardTab v-show='activeHTab === "dashboard"' />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, defineAsyncComponent } from 'vue';

const CreateOpenPane = defineAsyncComponent(() => import('./panes/CreateOpenPane.vue'));
const LoggerPane = defineAsyncComponent(() => import('./panes/LoggerPane.vue'));
const CasiePane = defineAsyncComponent(() => import('./panes/CasiePane.vue'));
const WrapUpPane = defineAsyncComponent(() => import('./panes/WrapUpPane.vue'));
const TaskTab = defineAsyncComponent(() => import('./panes/TaskTab.vue'));
const DashboardTab = defineAsyncComponent(() => import('./panes/DashboardTab.vue'));

interface NavEntry {
    kind: 'item' | 'header' | 'sub';
    key: string;
    label: string;
}

const navItems: NavEntry[] = [
    { kind: 'item', key: 'create-open', label: 'Create | Open' },

    { kind: 'header', key: 'h-initial', label: 'Initial Response' },
    { kind: 'sub', key: 'initial-information', label: 'Initial Information' },
    { kind: 'sub', key: 'subject-info', label: 'Subject Information' },
    { kind: 'sub', key: 'search-urgency', label: 'Search Urgency' },

    { kind: 'header', key: 'h-area', label: 'Area Search' },
    { kind: 'sub', key: 'search-scenarios', label: 'Search Scenarios' },
    { kind: 'sub', key: 'search-area', label: 'Search Area' },
    { kind: 'sub', key: 'risk-assessment', label: 'Risk Assessment' },
    { kind: 'sub', key: 'incident-post', label: 'Incident POST' },
    { kind: 'sub', key: 'casie', label: 'CASIE' },

    { kind: 'item', key: 'wrapup', label: 'Wrap Up' },
];

const hTabs = [
    { key: 'main', label: 'Main' },
    { key: 'task', label: 'Task' },
    { key: 'dashboard', label: 'Dashboard' },
] as const;

const activeKey = ref<string>('create-open');
const activeHTab = ref<string>('main');

function selectKey(key: string): void {
    activeKey.value = key;
    // match reference behavior: choosing a pane returns you to Main
    activeHTab.value = 'main';
}
</script>
