<template>
    <!-- Open Incident (Create | Open) pinned at the top (#41). -->
    <button
        type='button'
        class='incident-nav-item incident-nav-primary'
        :class='{ active: activeKey === createOpenNav.key }'
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

    <!-- Incident-wide views, pinned (not scrolled); formerly the horizontal tabs (#44). -->
    <div class='incident-nav-fixed'>
        <div class='incident-nav-section-header'>
            Incident
        </div>
        <button
            v-for='item in incidentItems'
            :key='item.key'
            type='button'
            class='incident-nav-item incident-nav-sub'
            :class='{ active: activeKey === item.key }'
            :data-bs-dismiss='mobile ? "offcanvas" : undefined'
            :data-bs-target='mobile ? "#incident-manager-nav" : undefined'
            @click='onSelect(item.key)'
        >
            <component
                :is='NAV_ICONS[item.key]'
                v-if='NAV_ICONS[item.key]'
                class='incident-nav-icon'
                :size='18'
                stroke='1.75'
            />
            <span>{{ item.label }}</span>
        </button>
    </div>

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
                            :class='{ active: activeKey === item.key }'
                            :data-bs-dismiss='mobile ? "offcanvas" : undefined'
                            :data-bs-target='mobile ? "#incident-manager-nav" : undefined'
                            @click='onSelect(item.key)'
                        >
                            <component
                                :is='NAV_ICONS[item.key]'
                                v-if='NAV_ICONS[item.key]'
                                class='incident-nav-icon'
                                :size='18'
                                stroke='1.75'
                            />
                            <span>{{ item.label }}</span>
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
        :class='{ active: activeKey === settingsNav.key }'
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
import type { Component } from 'vue';
import {
    IconAlertCircle,
    IconChecklist,
    IconClockRecord,
    IconColumns3,
    IconDashboard,
    IconFilePercent,
    IconFileText,
    IconFileZip,
    IconFolderOpen,
    IconHelpCircle,
    IconInfoHexagon,
    IconInfoSquare,
    IconLogs,
    IconMan,
    IconMapSearch,
    IconPolygon,
    IconPresentation,
    IconRoute2,
    IconSettings,
    IconTarget,
    IconUsers,
    IconUrgent,
    IconUserSearch,
    IconUsersCog,
    IconWalk,
} from '@tabler/icons-vue';
import NavSectionHeader from './NavSectionHeader.vue';
import NavHelpButton from './NavHelpButton.vue';
import {
    CREATE_OPEN_NAV,
    SETTINGS_NAV,
    navGroupHeading,
    visibleIncidentNavItems,
    visibleNavSections,
} from '../lib/incidentNav.ts';
import { useIncident } from '../composables/useIncident.ts';

defineProps<{
    mobile?: boolean;
    sectionExpanded: Record<string, boolean>;
    activeKey: string;
}>();

const emit = defineEmits<{
    toggleSection: [key: string];
}>();

/** Icons beside nav items so they're quick to spot (#46). Every nav item has one. */
const NAV_ICONS: Record<string, Component> = {
    'dashboard': IconDashboard,
    'incident-summary': IconInfoHexagon,
    'logs': IconLogs,
    'task': IconChecklist,
    'organization': IconUsers,
    'resources': IconUsersCog,
    'clues': IconHelpCircle,
    'initial-information': IconInfoSquare,
    'subject-info': IconUserSearch,
    'search-urgency': IconUrgent,
    'search-scenarios': IconRoute2,
    'physical-wisar': IconWalk,
    'lpb-distances': IconMan,
    'ir-briefing': IconPresentation,
    'incident-post': IconColumns3,
    'ics-201': IconFileText,
    'search-area': IconMapSearch,
    'segmentation': IconPolygon,
    'initial-consensus': IconFilePercent,
    'operational-periods': IconClockRecord,
    'casie': IconTarget,
    'risk-assessment': IconAlertCircle,
    'generate-closing-package': IconFileZip,
};

const createOpenNav = CREATE_OPEN_NAV;
const settingsNav = SETTINGS_NAV;
const { selectKeyGuarded, isSearchIncident } = useIncident();
const navSections = computed(() => visibleNavSections(isSearchIncident.value));
const incidentItems = computed(() => visibleIncidentNavItems(isSearchIncident.value));

function onSelect(key: string): void {
    selectKeyGuarded(key);
}
</script>
