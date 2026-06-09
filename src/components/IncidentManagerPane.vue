<template>
    <div class='d-flex gap-3 p-3 h-100 w-100'>
        <!-- ── Left: vertical nav (always visible) ── -->
        <div
            class='nav flex-column nav-pills flex-shrink-0'
            style='min-width: 160px;'
        >
            <template
                v-for='item in vNav'
                :key='item.key'
            >
                <button
                    type='button'
                    class='nav-link text-start'
                    :class='{ active: activeVPane === item.key && activeHTab === "main" }'
                    @click='selectVPane(item.key)'
                >
                    {{ item.label }}
                </button>

                <!-- Logger sub-nav (sibling, not nested in a button) -->
                <div
                    v-if='item.key === "logger" && activeVPane === "logger"'
                    class='ms-2 mt-1 mb-1 d-flex flex-column'
                >
                    <button
                        v-for='sub in loggerSubs'
                        :key='sub.key'
                        type='button'
                        class='nav-link text-start py-1'
                        :class='{ active: activeLoggerSub === sub.key && activeHTab === "main" }'
                        style='padding-left: 0.75rem;'
                        @click='selectLoggerSub(sub.key)'
                    >
                        {{ sub.label }}
                    </button>
                </div>
            </template>
        </div>

        <!-- ── Right: horizontal tabs + content ── -->
        <div class='flex-fill' style='min-width: 0;'>
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
                    <CreateOpenPane v-if='activeVPane === "create-open"' />
                    <LoggerPane
                        v-else-if='activeVPane === "logger"'
                        :sub='activeLoggerSub'
                    />
                    <CasiePane v-else-if='activeVPane === "casie"' />
                    <WrapUpPane v-else-if='activeVPane === "wrapup"' />
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

const vNav = [
    { key: 'create-open', label: 'Create | Open' },
    { key: 'logger', label: 'Logger' },
    { key: 'casie', label: 'CASIE' },
    { key: 'wrapup', label: 'Wrap Up' },
] as const;

const loggerSubs = [
    { key: 'addcallnotes', label: 'Add Callnotes' },
    { key: 'search-area', label: 'Search Area' },
    { key: 'search-urgency', label: 'Search Urgency' },
    { key: 'search-scenarios', label: 'Search Scenarios' },
    { key: 'risk-assessment', label: 'Risk Assessment' },
    { key: 'incident-post', label: 'Incident POST' },
] as const;

const hTabs = [
    { key: 'main', label: 'Main' },
    { key: 'task', label: 'Task' },
    { key: 'dashboard', label: 'Dashboard' },
] as const;

const activeVPane = ref<string>('create-open');
const activeLoggerSub = ref<string>('addcallnotes');
const activeHTab = ref<string>('main');

function selectVPane(key: string): void {
    activeVPane.value = key;
    // match reference behavior: choosing a vertical pane returns you to Main
    activeHTab.value = 'main';
}

function selectLoggerSub(key: string): void {
    activeVPane.value = 'logger';
    activeLoggerSub.value = key;
    activeHTab.value = 'main';
}
</script>
