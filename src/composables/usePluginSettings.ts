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
    };
    savePluginSettings(state.value);
}

export function usePluginSettings() {
    const subjectTypes = computed(() => state.value.subjectTypes);
    const lpbTable = computed(() => state.value.lpbTable ?? BUNDLED_LPB_TABLE);
    const lpbIsCustom = computed(() => state.value.lpbTable !== null);
    const lpbCategoryCount = computed(() => lpbTable.value.length);

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

    function enumOptions(current = ''): string[] {
        return subjectTypeEnumOptions(subjectTypes.value, current);
    }

    return {
        subjectTypes,
        lpbTable,
        lpbIsCustom,
        lpbCategoryCount,
        setSubjectTypes,
        resetSubjectTypes,
        setLpbTable,
        resetLpbTable,
        enumOptions,
    };
}
