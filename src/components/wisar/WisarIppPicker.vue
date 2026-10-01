<template>
    <div class='wisar-ipp-picker'>
        <div class='d-flex align-items-center mb-1'>
            <p class='text-uppercase text-white-50 small mb-0'>
                Initial Planning Point (IPP)
            </p>
            <button
                type='button'
                class='btn btn-sm btn-link ms-auto p-0'
                :disabled='loading || !activeMission'
                title='Reload markers from the DataSync'
                @click='load'
            >
                Refresh
            </button>
        </div>

        <div
            v-if='!activeMission'
            class='form-text text-muted'
        >
            Select or create an incident in Create | Open first.
        </div>
        <template v-else>
            <select
                :value='selectedUid'
                class='form-select form-select-sm'
                :disabled='loading || !options.length'
                aria-label='IPP marker'
                @change='onSelect(($event.target as HTMLSelectElement).value)'
            >
                <option value=''>
                    {{ loading ? 'Loading DataSync markers…' : options.length ? '— choose a marker —' : 'No point markers in the DataSync' }}
                </option>
                <option
                    v-for='o in options'
                    :key='o.uid'
                    :value='o.uid'
                >
                    {{ o.label }}
                </option>
            </select>
            <div class='form-text'>
                <span
                    v-if='loadError'
                    class='text-danger'
                >{{ loadError }}</span>
                <span v-else-if='modelValue'>
                    {{ formatLatLon(modelValue) }}<span v-if='modelValue.uid === defaultUid'> · incident IPP</span>
                </span>
                <span v-else-if='!loading && options.length'>
                    Pick the marker to start the analysis from.
                </span>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { useIncident } from '../../composables/useIncident.ts';
import { listIncidentPointFeatures } from '../../lib/ensureIncidentIpp.ts';
import { loadSchemaSubscription } from '../../lib/incidentSubscription.ts';
import { readIppFromSchema } from '../../lib/ippPersistence.ts';
import { loadMissionSchema } from '../../lib/missionSchema.ts';
import {
    defaultIppUid,
    formatLatLon,
    ippOptions,
    type IppMarker,
    type StoredIpp,
    type WisarIppOption,
} from '../../lib/wisarIpp.ts';

const props = defineProps<{
    /** The chosen IPP, or null. */
    modelValue: WisarIppOption | null;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: WisarIppOption | null];
}>();

const { activeMission } = useIncident();

const markers = ref<IppMarker[]>([]);
const stored = ref<StoredIpp | null>(null);
const loading = ref(false);
const loadError = ref('');

const options = computed(() => ippOptions(markers.value, stored.value));
const defaultUid = computed(() => defaultIppUid(options.value, stored.value));
const selectedUid = computed(() => props.modelValue?.uid ?? '');

function onSelect(uid: string): void {
    emit('update:modelValue', options.value.find((o) => o.uid === uid) ?? null);
}

let loadSeq = 0;

/** Read the stored IPP and the DataSync point markers; keep or preselect a choice. */
async function load(): Promise<void> {
    const mission = activeMission.value;
    const seq = ++loadSeq;
    markers.value = [];
    stored.value = null;
    loadError.value = '';
    if (!mission) {
        emit('update:modelValue', null);
        return;
    }
    loading.value = true;
    try {
        const [ipp, points] = await Promise.all([
            loadSchemaSubscription(mission)
                .then((sub) => loadMissionSchema(sub))
                .then((loaded) => readIppFromSchema(loaded.schema))
                .catch(() => null), // no stored IPP is normal; the markers still load
            listIncidentPointFeatures(mission),
        ]);
        if (seq !== loadSeq) return;
        stored.value = ipp;
        markers.value = points;
        // Keep the user's pick if it still exists; otherwise preselect the incident IPP.
        const keep = props.modelValue && options.value.find((o) => o.uid === props.modelValue?.uid);
        emit('update:modelValue', keep ?? options.value.find((o) => o.uid === defaultUid.value) ?? null);
    } catch (err) {
        if (seq !== loadSeq) return;
        loadError.value = err instanceof Error ? err.message : String(err);
    } finally {
        if (seq === loadSeq) loading.value = false;
    }
}

watch(() => activeMission.value?.guid, () => {
    void load();
});

onMounted(() => {
    void load();
});
</script>
