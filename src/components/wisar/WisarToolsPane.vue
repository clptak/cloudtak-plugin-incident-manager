<template>
    <div class='wisar-tools p-3 text-white'>
        <div class='row g-2 mb-2'>
            <div
                v-for='m in MODES'
                :key='m.key'
                class='col-6'
            >
                <button
                    type='button'
                    class='btn w-100 h-100 text-start wisar-mode'
                    :class='mode === m.key ? "btn-primary" : "btn-outline-secondary"'
                    @click='mode = m.key'
                >
                    <div class='fw-semibold'>
                        {{ m.title }}
                    </div>
                    <div class='small opacity-75'>
                        {{ m.desc }}
                    </div>
                </button>
            </div>
        </div>
        <!-- "What's a TARR?" / "What's Travel Time?", the scope note and footer links arrive with 4f. -->

        <template v-if='!activeMission'>
            <p class='text-muted small mt-3'>
                Select or create an incident in Incident Manager (Create | Open) first.
            </p>
        </template>
        <template v-else>
            <div class='mt-3'>
                <WisarIppPicker v-model='ipp' />
            </div>

            <template v-if='mode === "tarr"'>
                <WisarTarrForm
                    :ipp='ipp'
                    @result='tarrJob = $event'
                />
                <WisarResults
                    v-if='tarrJob'
                    :job='tarrJob'
                />
            </template>
            <template v-else>
                <WisarTravelTimeForm
                    :ipp='ipp'
                    @result='ttJob = $event'
                />
                <WisarResults
                    v-if='ttJob'
                    :job='ttJob'
                />
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useIncident } from '../../composables/useIncident.ts';
import type { Job } from '../../lib/wisar.ts';
import type { WisarIppOption } from '../../lib/wisarIpp.ts';
import WisarIppPicker from './WisarIppPicker.vue';
import WisarResults from './WisarResults.vue';
import WisarTarrForm from './WisarTarrForm.vue';
import WisarTravelTimeForm from './WisarTravelTimeForm.vue';

type Mode = 'tarr' | 'travel-time';

/** Titles and descriptions from the WiSAR web tool's start screen. */
const MODES: { key: Mode; title: string; desc: string }[] = [
    { key: 'tarr', title: 'TARR Analysis', desc: 'Terrain-Aware Range Rings from an IPP using a Lost Person Behavior subject profile.' },
    { key: 'travel-time', title: 'Travel Time', desc: 'Where a subject could reach over time at a given travel speed. No LPB profile needed.' },
];

const { activeMission } = useIncident();
const mode = ref<Mode>('tarr');
const ipp = ref<WisarIppOption | null>(null);
const tarrJob = ref<Job | null>(null);
const ttJob = ref<Job | null>(null);
</script>

<style scoped>
.wisar-mode {
    white-space: normal;
}
</style>
