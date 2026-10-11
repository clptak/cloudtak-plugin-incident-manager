<template>
    <div class='wisar-tools p-3 text-white'>
        <div class='row g-2 mb-1'>
            <div
                v-for='m in MODES'
                :key='m.key'
                class='col-6 d-flex flex-column'
            >
                <button
                    type='button'
                    class='btn w-100 flex-grow-1 text-start wisar-mode'
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
                <div class='small text-center mt-1'>
                    <WisarContentLink
                        :id='m.explainer'
                        :label='m.explainerLabel'
                    />
                </div>
            </div>
        </div>
        <WisarScopeNote />

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

        <WisarContentFooter />
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useIncident } from '../../composables/useIncident.ts';
import type { ContentId, Job } from '../../lib/wisar.ts';
import type { WisarIppOption } from '../../lib/wisarIpp.ts';
import WisarContentFooter from './WisarContentFooter.vue';
import WisarContentLink from './WisarContentLink.vue';
import WisarIppPicker from './WisarIppPicker.vue';
import WisarResults from './WisarResults.vue';
import WisarScopeNote from './WisarScopeNote.vue';
import WisarTarrForm from './WisarTarrForm.vue';
import WisarTravelTimeForm from './WisarTravelTimeForm.vue';

type Mode = 'tarr' | 'travel-time';

/** Titles and descriptions from the WiSAR web tool's start screen. */
const MODES: { key: Mode; title: string; desc: string; explainer: ContentId; explainerLabel: string }[] = [
    { key: 'tarr', title: 'TARR Analysis', desc: 'Terrain-Aware Range Rings from an IPP using a Lost Person Behavior subject profile.',
        explainer: 'tarr-explainer', explainerLabel: 'What’s a TARR?' },
    { key: 'travel-time', title: 'Travel Time', desc: 'Where a subject could reach over time at a given travel speed. No LPB profile needed.',
        explainer: 'travel-time-explainer', explainerLabel: 'What’s Travel Time?' },
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
