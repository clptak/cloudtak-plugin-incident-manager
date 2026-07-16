<template>
    <button
        type='button'
        class='incident-nav-item'
        :class='{ active: activeKey === createOpenNav.key && activeHTab === "main" }'
        :data-bs-dismiss='mobile ? "offcanvas" : undefined'
        :data-bs-target='mobile ? "#incident-manager-nav" : undefined'
        @click='onSelect(createOpenNav.key)'
    >
        {{ createOpenNav.label }}
    </button>

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
            <div
                v-for='item in section.items'
                :key='item.key'
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

<script setup lang='ts'>
import NavSectionHeader from './NavSectionHeader.vue';
import NavHelpButton from './NavHelpButton.vue';
import {
    CREATE_OPEN_NAV,
    NAV_SECTIONS,
    type NavSection,
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
const navSections: NavSection[] = NAV_SECTIONS;

const { selectKeyGuarded } = useIncident();

function onSelect(key: string): void {
    selectKeyGuarded(key);
}
</script>
