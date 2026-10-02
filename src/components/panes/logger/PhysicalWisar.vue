<template>
    <div>
        <div
            v-if='!wisarExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='wisarExpanded = true'
            @keydown.enter.prevent='wisarExpanded = true'
            @keydown.space.prevent='wisarExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                Physical – WiSAR
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='wisarExpanded = false'
                    @keydown.enter.prevent='wisarExpanded = false'
                    @keydown.space.prevent='wisarExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Physical – WiSAR
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <div>
                <p class='text-uppercase text-white-50 small mb-2'>
                    Travel Time
                </p>
                <p class='text-muted small mb-3'>
                    Where could the subject physically be after a given time, at a
                    given flat-ground speed? Calculated by WiSAR over terrain, land
                    cover, trails and water.
                    <WisarContentLink
                        id='travel-time-explainer'
                        label='What’s Travel Time?'
                    />
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

                <WisarContentFooter />
            </div>
        </TablerBorder>

        <div
            v-if='!landsarExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='landsarExpanded = true'
            @keydown.enter.prevent='landsarExpanded = true'
            @keydown.space.prevent='landsarExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                LandSAR
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='landsarExpanded = false'
                    @keydown.enter.prevent='landsarExpanded = false'
                    @keydown.space.prevent='landsarExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        LandSAR
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <p class='text-muted mb-0'>
                LandSAR tools will go here.
            </p>
        </TablerBorder>

        <div
            v-if='!lpbExpanded'
            class='cloudtak-accent border rounded-3 text-white mb-3 px-3 py-2 d-flex align-items-center cursor-pointer user-select-none'
            role='button'
            tabindex='0'
            :aria-expanded='false'
            @click='lpbExpanded = true'
            @keydown.enter.prevent='lpbExpanded = true'
            @keydown.space.prevent='lpbExpanded = true'
        >
            <p class='text-uppercase text-white-50 small mb-0'>
                LPB Distances
            </p>
            <IconChevronDown
                class='ms-auto transition-transform text-white-50 rotate-180'
                :size='20'
                stroke='1.5'
            />
        </div>
        <TablerBorder
            v-else
            class='cloudtak-accent text-white mb-3'
            :fill-height='false'
            :shadow='false'
            gap='sm'
        >
            <template #label>
                <div
                    class='d-flex align-items-center w-100 cursor-pointer user-select-none'
                    role='button'
                    tabindex='0'
                    :aria-expanded='true'
                    @click='lpbExpanded = false'
                    @keydown.enter.prevent='lpbExpanded = false'
                    @keydown.space.prevent='lpbExpanded = false'
                >
                    <p class='text-uppercase text-white-50 small mb-0'>
                        LPB Distances
                    </p>
                    <IconChevronDown
                        class='ms-auto transition-transform text-white-50'
                        :size='20'
                        stroke='1.5'
                    />
                </div>
            </template>

            <LpbTab />
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { onMounted, ref, watch } from 'vue';
import { TablerBorder } from '@tak-ps/vue-tabler';
import { IconChevronDown } from '@tabler/icons-vue';
import LpbTab from '../LpbTab.vue';
import WisarContentFooter from '../../wisar/WisarContentFooter.vue';
import WisarContentLink from '../../wisar/WisarContentLink.vue';
import WisarIppPicker from '../../wisar/WisarIppPicker.vue';
import WisarResults from '../../wisar/WisarResults.vue';
import WisarTravelTimeForm from '../../wisar/WisarTravelTimeForm.vue';
import { useIncident } from '../../../composables/useIncident.ts';
import type { Job } from '../../../lib/wisar.ts';
import type { WisarIppOption } from '../../../lib/wisarIpp.ts';

const { lpbDistancesRequested } = useIncident();

const wisarExpanded = ref(true);
const landsarExpanded = ref(false);
const lpbExpanded = ref(false);
const ipp = ref<WisarIppOption | null>(null);
/** Latest succeeded Travel Time job, shown in Results. */
const lastJob = ref<Job | null>(null);

function onResult(job: Job): void {
    lastJob.value = job;
}

/** Map chip, popout chip, and a restored LPB tab all land here with the card open. */
function consumeLpbRequest(): void {
    if (!lpbDistancesRequested.value) return;
    lpbDistancesRequested.value = false;
    lpbExpanded.value = true;
}

onMounted(consumeLpbRequest);
watch(lpbDistancesRequested, consumeLpbRequest);
</script>
