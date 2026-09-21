import { computed, ref } from 'vue';
import bundledAzlpb from '../data/azlpb_table.json';
import {
    loadPluginSettings,
    savePluginSettings,
    type AzlpbEntry,
    type PluginSettings,
} from '../lib/pluginSettings.ts';
import type { D4HMember } from '../lib/d4hTypes.ts';
import { normalizePersonnel } from '../lib/personnel.ts';
import {
    DEFAULT_SUBJECT_TYPES,
    normalizeSubjectTypes,
    subjectTypeEnumOptions,
} from '../lib/subjectTypes.ts';

const BUNDLED_LPB_TABLE = bundledAzlpb as AzlpbEntry[];

const state = ref<PluginSettings>(loadPluginSettings());

function persist(next: PluginSettings): void {
    state.value = {
        subjectTypes: normalizeSubjectTypes(next.subjectTypes),
        lpbTable: next.lpbTable,
        yourAgency: next.yourAgency.trim(),
        useD4hAidingAgencies: next.useD4hAidingAgencies,
        aidingAgencies: normalizeSubjectTypes(next.aidingAgencies),
        useD4hPersonnel: next.useD4hPersonnel,
        personnel: normalizePersonnel(next.personnel),
        searchOpTemplateId: next.searchOpTemplateId.trim(),
    };
    savePluginSettings(state.value);
}

export function usePluginSettings() {
    const subjectTypes = computed(() => state.value.subjectTypes);
    const lpbTable = computed(() => state.value.lpbTable ?? BUNDLED_LPB_TABLE);
    const lpbIsCustom = computed(() => state.value.lpbTable !== null);
    const lpbCategoryCount = computed(() => lpbTable.value.length);
    const yourAgency = computed(() => state.value.yourAgency);
    const useD4hAidingAgencies = computed(() => state.value.useD4hAidingAgencies);
    const aidingAgencies = computed(() => state.value.aidingAgencies);
    const useD4hPersonnel = computed(() => state.value.useD4hPersonnel);
    const personnel = computed(() => state.value.personnel);
    const searchOpTemplateId = computed(() => state.value.searchOpTemplateId);

    function setSubjectTypes(types: string[]): void {
        persist({ ...state.value, subjectTypes: types });
    }

    function resetSubjectTypes(): void {
        setSubjectTypes([...DEFAULT_SUBJECT_TYPES]);
    }

    function setLpbTable(table: AzlpbEntry[] | null): void {
        persist({ ...state.value, lpbTable: table });
    }

    function resetLpbTable(): void {
        setLpbTable(null);
    }

    function setYourAgency(name: string): void {
        persist({ ...state.value, yourAgency: name });
    }

    function setUseD4hAidingAgencies(enabled: boolean): void {
        persist({ ...state.value, useD4hAidingAgencies: enabled });
    }

    function setAidingAgencies(agencies: string[]): void {
        persist({ ...state.value, aidingAgencies: agencies });
    }

    function setUseD4hPersonnel(enabled: boolean): void {
        persist({ ...state.value, useD4hPersonnel: enabled });
    }

    function setPersonnel(members: D4HMember[]): void {
        persist({ ...state.value, personnel: members });
    }

    function setSearchOpTemplateId(id: string): void {
        persist({ ...state.value, searchOpTemplateId: id });
    }

    function enumOptions(current = ''): string[] {
        return subjectTypeEnumOptions(subjectTypes.value, current);
    }

    return {
        subjectTypes,
        lpbTable,
        lpbIsCustom,
        lpbCategoryCount,
        yourAgency,
        useD4hAidingAgencies,
        aidingAgencies,
        useD4hPersonnel,
        personnel,
        searchOpTemplateId,
        setSubjectTypes,
        resetSubjectTypes,
        setLpbTable,
        resetLpbTable,
        setYourAgency,
        setUseD4hAidingAgencies,
        setAidingAgencies,
        setUseD4hPersonnel,
        setPersonnel,
        setSearchOpTemplateId,
        enumOptions,
    };
}
