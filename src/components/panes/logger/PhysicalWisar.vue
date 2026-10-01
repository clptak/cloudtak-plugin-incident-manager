<template>
    <TablerBorder
        class='cloudtak-accent text-white'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0'>
                Travel Time
            </p>
        </template>

        <div>
            <p class='text-muted small mb-3'>
                Where could the subject physically be after a given time, at a
                given flat-ground speed? Calculated by WiSAR over terrain, land
                cover, trails and water.
            </p>

            <WisarIppPicker v-model='ipp' />

            <WisarTravelTimeForm
                :ipp='ipp'
                @result='onResult'
            />

            <WisarResults
                v-if='lastJob'
                :job='lastJob'
            />

            <!-- Still to come on this card: reference links (4f). -->
        </div>
    </TablerBorder>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { TablerBorder } from '@tak-ps/vue-tabler';
import WisarIppPicker from '../../wisar/WisarIppPicker.vue';
import WisarResults from '../../wisar/WisarResults.vue';
import WisarTravelTimeForm from '../../wisar/WisarTravelTimeForm.vue';
import type { Job } from '../../../lib/wisar.ts';
import type { WisarIppOption } from '../../../lib/wisarIpp.ts';

const ipp = ref<WisarIppOption | null>(null);
/** Latest succeeded Travel Time job, shown in Results. */
const lastJob = ref<Job | null>(null);

function onResult(job: Job): void {
    lastJob.value = job;
}
</script>
