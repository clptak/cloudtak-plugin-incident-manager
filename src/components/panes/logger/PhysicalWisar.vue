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

            <!-- Built up step by step: Travel Time form (4c), results (4e), reference links (4f). -->
        </div>
    </TablerBorder>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { TablerBorder } from '@tak-ps/vue-tabler';
import WisarIppPicker from '../../wisar/WisarIppPicker.vue';
import type { WisarIppOption } from '../../../lib/wisarIpp.ts';

const ipp = ref<WisarIppOption | null>(null);
</script>
