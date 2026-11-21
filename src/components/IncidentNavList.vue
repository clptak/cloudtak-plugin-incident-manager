<template>
    <!-- Open Incident (Create | Open) pinned at the top (#41). -->
    <button
        type='button'
        class='incident-nav-item incident-nav-primary'
        :class='{ active: activeKey === createOpenNav.key && activeHTab === "main" }'
        :data-bs-dismiss='mobile ? "offcanvas" : undefined'
        :data-bs-target='mobile ? "#incident-manager-nav" : undefined'
        title='Create a new incident or open an existing one'
        @click='onSelect(createOpenNav.key)'
    >
        <IconFolderOpen
            :size='18'
            stroke='1.75'
        />
        <span>{{ createOpenNav.label }}</span>
    </button>

    <div class='incident-nav-scroll'>
        <template
            v-for='section in navSections'
            :key='section.key'
        >
            <NavSectionHeader
                :label='section.label'
                :help-key='section.helpKey'
                :expanded='sectionExpanded[section.key] !== false'
                @toggle='emit("toggleSection", section.key)'
            />
            <template v-if='sectionExpanded[section.key] !== false'>
                <template
                    v-for='(item, index) in section.items'
                    :key='item.key'
                >
                    <div
                        v-if='navGroupHeading(section.items, index)'
                        class='incident-nav-group'
                    >
                        {{ navGroupHeading(section.items, index) }}
                    </div>
                    <div
                        class='incident-nav-item-row'
                        :class='{ "incident-nav-item-row--with-help": !!item.helpKey }'
                    >
                        <button
                            type='button'
                            class='incident-nav-item incident-nav-sub'
                            :class='{ active: activeKey === item.key && activeHTab === "main" }'
                            :data-bs-dismiss='mobile ? "offcanvas" : undefined'
                            :data-bs-target='mobile ? "#incident-manager-nav" : undefined'
                            @click='onSelect(item.key)'
                        >
                            {{ item.label }}
                        </button>
                        <NavHelpButton
                            v-if='item.helpKey'
                            :help-key='item.helpKey'
                        />
                    </div>
                </template>
            </template>
        </template>
    </div>

    <!-- Settings pinned at the very bottom (#41). -->
    <button
        type='button'
        class='incident-nav-item incident-nav-settings'
        :class='{ active: activeKey === settingsNav.key && activeHTab === "main" }'
        :data-bs-dismiss='mobile ? "offcanvas" : undefined'
        :data-bs-target='mobile ? "#incident-manager-nav" : undefined'
        @click='onSelect(settingsNav.key)'
    >
        <IconSettings
            :size='18'
            stroke='1.75'
        />
        <span>{{ settingsNav.label }}</span>
    </button>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { IconFolderOpen, IconSettings } from '@tabler/icons-vue';
import NavSectionHeader from './NavSectionHeader.vue';
import NavHelpButton from './NavHelpButton.vue';
import {
    CREATE_OPEN_NAV,
    SETTINGS_NAV,
    navGroupHeading,
    visibleNavSections,
} from '../lib/incidentNav.ts';
import { useIncident } from '../composables/useIncident.ts';

defineProps<{
    mobile?: boolean;
    sectionExpanded: Record<string, boolean>;
    activeKey: string;
    activeHTab: string;
}>();

const emit = defineEmits<{
    toggleSection: [key: string];
}>();

const createOpenNav = CREATE_OPEN_NAV;
const settingsNav = SETTINGS_NAV;
const { selectKeyGuarded, isSearchIncident } = useIncident();
const navSections = computed(() => visibleNavSections(isSearchIncident.value));

function onSelect(key: string): void {
    selectKeyGuarded(key);
}
</script>
