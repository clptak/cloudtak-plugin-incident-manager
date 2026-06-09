<template>
    <div class='row g-3'>
        <!-- IPP -->
        <div class='col-lg-5'>
            <div class='card mb-3'>
                <div class='card-header'><h3 class='card-title mb-0'>Initial Planning Point (IPP)</h3></div>
                <div class='card-body'>
                    <label class='form-label'>IPP Coordinates</label>
                    <input
                        v-model='ippInput'
                        type='text'
                        class='form-control'
                        placeholder='35.1862, -111.6404 or 35 11 10 -111 38 25'
                    >
                    <div class='form-text'>
                        <span v-if='ipp' class='text-success'>→ {{ ipp.lat.toFixed(5) }}, {{ ipp.lng.toFixed(5) }}</span>
                        <span v-else-if='ippInput' class='text-danger'>→ unrecognized format</span>
                        <span v-else>Supports decimal degrees, DMS, DM, and MPS.</span>
                    </div>
                </div>
            </div>

            <!-- Theoretical -->
            <div class='card'>
                <div class='card-header'><h3 class='card-title mb-0'>Theoretical Search Area</h3></div>
                <div class='card-body'>
                    <label class='form-label'>Time Missing</label>
                    <input v-model='timeMissing' type='datetime-local' class='form-control mb-2'>
                    <label class='form-label'>Travel Speed (mph)</label>
                    <input v-model.number='travelSpeed' type='number' min='0' step='0.1' class='form-control' placeholder='e.g. 2.5'>
                    <div v-if='theoreticalMiles' class='form-text'>
                        Radius: <strong>{{ theoreticalMiles.toFixed(2) }} mi</strong>
                        ({{ elapsedHours.toFixed(1) }} h × {{ travelSpeed }} mph)
                    </div>
                    <button
                        class='btn btn-orange text-white btn-sm mt-2'
                        :disabled='!canPushTheoretical || pushing'
                        @click='pushTheoretical'
                    >
                        Add to DataSync
                    </button>
                </div>
            </div>
        </div>

        <!-- Statistical / LPB -->
        <div class='col-lg-7'>
            <div class='card'>
                <div class='card-header'><h3 class='card-title mb-0'>Statistical Search Area (LPB)</h3></div>
                <div class='card-body'>
                    <label class='form-label'>Subject LPB Category</label>
                    <select v-model='category' class='form-select form-select-sm mb-2'>
                        <option v-for='c in categories' :key='c' :value='c'>{{ c }}</option>
                    </select>

                    <div class='table-responsive'>
                        <table class='table table-sm table-vcenter mb-0'>
                            <thead>
                                <tr>
                                    <th>Ring</th><th>Percentile</th><th>Distance</th><th>Send</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for='q in quartiles' :key='q.key'>
                                    <td>
                                        <span :style='`color:${q.color}`'>●</span> {{ q.key }}
                                    </td>
                                    <td>{{ q.pct }}</td>
                                    <td>{{ q.miles.toFixed(2) }} mi</td>
                                    <td>
                                        <input
                                            v-model='q.selected'
                                            type='checkbox'
                                            class='form-check-input'
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <button
                        class='btn btn-primary btn-sm mt-3'
                        :disabled='!canPushLpb || pushing'
                        @click='pushLpb'
                    >
                        {{ pushing ? 'Sending…' : 'Add selected rings to DataSync' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- shared status -->
        <div class='col-12'>
            <div v-if='!activeMission' class='form-text text-warning'>
                No active mission. Select one in Create | Open first.
            </div>
            <div v-else class='form-text'>Active DataSync: <strong>{{ activeMission.name }}</strong></div>
            <div v-if='status' class='fw-bold mt-1' :class='statusError ? "text-danger" : "text-success"'>
                {{ status }}
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, reactive, watch } from 'vue';
import azlpb from '../../../data/azlpb_table.json';
import { parseCoordinates } from '../../../lib/coords.ts';
import { circleRing, milesToMeters } from '../../../lib/rings.ts';
import { pushPolygonToMission } from '../../../lib/missionFeatures.ts';
import { useIncident } from '../../../composables/useIncident.ts';

interface AzlpbEntry {
    category: string;
    qAmi: number; qBmi: number; qCmi: number; qDmi: number;
}

const { activeMission } = useIncident();
const table = azlpb as AzlpbEntry[];

const ippInput = ref('');
const ipp = computed(() => parseCoordinates(ippInput.value));

const categories = table.map((t) => t.category);
const category = ref<string>(categories[0]);

const QUARTILE_COLORS = { A: '#2fb344', B: '#f59f00', C: '#f76707', D: '#d63939' };

const quartiles = reactive([
    { key: 'A', pct: '25%', miField: 'qAmi', color: QUARTILE_COLORS.A, miles: 0, selected: true },
    { key: 'B', pct: '50%', miField: 'qBmi', color: QUARTILE_COLORS.B, miles: 0, selected: true },
    { key: 'C', pct: '75%', miField: 'qCmi', color: QUARTILE_COLORS.C, miles: 0, selected: false },
    { key: 'D', pct: '90%', miField: 'qDmi', color: QUARTILE_COLORS.D, miles: 0, selected: false },
]);

function refreshQuartiles(): void {
    const entry = table.find((t) => t.category === category.value);
    if (!entry) return;
    for (const q of quartiles) {
        q.miles = (entry as unknown as Record<string, number>)[q.miField] ?? 0;
    }
}
watch(category, refreshQuartiles, { immediate: true });

// Theoretical
const timeMissing = ref('');
const travelSpeed = ref<number>(0);
const elapsedHours = computed(() => {
    if (!timeMissing.value) return 0;
    const ms = Date.now() - new Date(timeMissing.value).getTime();
    return ms > 0 ? ms / 3_600_000 : 0;
});
const theoreticalMiles = computed(() =>
    elapsedHours.value > 0 && travelSpeed.value > 0 ? elapsedHours.value * travelSpeed.value : 0
);

const pushing = ref(false);
const status = ref('');
const statusError = ref(false);

const canPushLpb = computed(() => !!ipp.value && !!activeMission.value && quartiles.some((q) => q.selected));
const canPushTheoretical = computed(() => !!ipp.value && !!activeMission.value && theoreticalMiles.value > 0);

async function pushRing(miles: number, label: string, color: string): Promise<void> {
    if (!ipp.value || !activeMission.value) return;
    const center: [number, number] = [ipp.value.lng, ipp.value.lat];
    const ring = circleRing(center[0], center[1], milesToMeters(miles));
    await pushPolygonToMission({
        missionGuid: activeMission.value.guid,
        callsign: label,
        ring,
        center,
        style: { stroke: color, fillOpacity: 0.1 },
    });
}

async function pushLpb(): Promise<void> {
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        let n = 0;
        for (const q of quartiles) {
            if (!q.selected) continue;
            await pushRing(q.miles, `${category.value} ${q.pct} (${q.miles.toFixed(1)}mi)`, q.color);
            n++;
        }
        status.value = `Sent ${n} LPB ring${n === 1 ? '' : 's'} to ${activeMission.value!.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}

async function pushTheoretical(): Promise<void> {
    pushing.value = true; status.value = ''; statusError.value = false;
    try {
        await pushRing(theoreticalMiles.value, `Theoretical ${theoreticalMiles.value.toFixed(1)}mi`, '#ff9900');
        status.value = `Sent theoretical ring (${theoreticalMiles.value.toFixed(1)} mi) to ${activeMission.value!.name}.`;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
    } finally {
        pushing.value = false;
    }
}
</script>
