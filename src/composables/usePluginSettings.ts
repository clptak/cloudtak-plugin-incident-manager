import { computed, ref } from 'vue';
import bundledAzlpb from '../data/azlpb_table.json';
import {
    loadPluginSettings,
    savePluginSettings,
    type AzlpbEntry,
    type PluginSettings,
} from '../lib/pluginSettings.ts';
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
        searchOpTemplateId,
        setSubjectTypes,
        resetSubjectTypes,
        setLpbTable,
        resetLpbTable,
        setYourAgency,
        setUseD4hAidingAgencies,
        setAidingAgencies,
        setSearchOpTemplateId,
        enumOptions,
    };
}
