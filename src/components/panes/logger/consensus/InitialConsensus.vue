<template>
    <div>
        <ConsensusTable
            v-if='view === "table" && consensus'
            :respondents='consensus.respondents'
            :segments='segments'
            :saving='saving'
            :status='status'
            :status-error='statusError'
            @update-respondent='onUpdateRespondent'
            @accept='onTableAccept'
            @back='openSetup'
            @cancel='onTableCancel'
        />

        <div
            v-else
            class='card'
        >
            <div class='card-header d-flex align-items-center'>
                <h3 class='card-title mb-0 flex-grow-1'>
                    Initial Consensus
                </h3>
                <button
                    type='button'
                    class='btn btn-primary btn-sm'
                    @click='openSetup'
                >
                    {{ consensus && consensus.accepted ? 'Edit Consensus' : 'Create Consensus' }}
                </button>
            </div>
            <div class='card-body'>
                <div
                    v-if='loading'
                    class='text-muted small'
                >
                    Loading…
                </div>
                <template v-else-if='consensus && consensus.accepted'>
                    <div class='table-responsive'>
                        <table class='table table-sm table-vcenter mb-0'>
                            <thead>
                                <tr>
                                    <th>Area</th>
                                    <th
                                        v-for='(resp, idx) in consensus.respondents'
                                        :key='idx'
                                        class='text-end'
                                    >
                                        {{ resp.name }}
                                    </th>
                                    <th class='text-end'>
                                        Consensus
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class='text-success'>
                                        R.O.W.
                                    </td>
                                    <td
                                        v-for='(resp, idx) in consensus.respondents'
                                        :key='idx'
                                        class='text-end text-primary'
                                    >
                                        {{ formatPoa(resp.row) }}
                                    </td>
                                    <td class='text-end text-success'>
                                        {{ formatPoa(consensusRow(consensus.respondents)) }}
                                    </td>
                                </tr>
                                <tr
                                    v-for='seg in segments'
                                    :key='seg.uid'
                                >
                                    <td>
                                        <button
                                            type='button'
                                            class='btn btn-link p-0 border-0 align-baseline text-start'
                                            title='Center the map on this segment'
                                            @click='onFlyTo(seg.uid)'
                                        >
                                            Seg. {{ seg.callsign }}
                                        </button>
                                    </td>
                                    <td
                                        v-for='(resp, idx) in consensus.respondents'
                                        :key='idx'
                                        class='text-end text-primary'
                                    >
                                        <span
                                            v-if='resp.method === "oconnor" && resp.letters[seg.uid]'
                                            class='text-secondary me-1'
                                        >({{ resp.letters[seg.uid] }})</span>{{ formatPoa(resp.values[seg.uid] ?? 0) }}
                                    </td>
                                    <td class='text-end text-success'>
                                        {{ formatPoa(consensusForSegment(consensus.respondents, seg.uid)) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </template>
                <p
                    v-else
                    class='text-muted mb-0'
                >
                    No consensus yet. Click "Create Consensus" to begin.
                </p>
                <div
                    v-if='status && view !== "table"'
                    class='fw-bold mt-2'
                    :class='statusError ? "text-danger" : "text-success"'
                >
                    {{ status }}
                </div>
            </div>
        </div>

        <ConsensusSetupModal
            v-if='showSetup'
            :initial-incident-name='setupIncidentName'
            :initial-filename='setupFilename'
            :initial-use-my-documents='setupUseMyDocuments'
            :initial-respondent-count='setupRespondentCount'
            :segment-count='segments.length'
            :saving='saving'
            @accept='onSetupAccept'
            @cancel='onSetupCancel'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import ConsensusSetupModal from './ConsensusSetupModal.vue';
import type { SetupResult } from './ConsensusSetupModal.vue';
import ConsensusTable from './ConsensusTable.vue';
import type { SegmentRef } from './ResponderEntryModal.vue';
import { useIncident } from '../../../../composables/useIncident.ts';
import {
    loadCasieFromMission,
    saveCasieToMission,
} from '../../../../lib/casiePersistence.ts';
import {
    alignRespondentToSegments,
    consensusForSegment,
    consensusRow,
    defaultConsensusState,
    formatPoa,
    resizeRespondents,
    type ConsensusRespondent,
    type InitialConsensusState,
} from '../../../../lib/consensus.ts';
import { flyToFeature } from '../../../../lib/flyToFeature.ts';

/** ICS segment labels are numeric; sort them numerically for display. */
function compareCallsign(a: string, b: string): number {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
}

const { activeMission, requireActiveMission } = useIncident();

const loading = ref(false);
const saving = ref(false);
const status = ref('');
const statusError = ref(false);

const consensus = ref<InitialConsensusState | null>(null);
const incidentName = ref('');
const segments = ref<SegmentRef[]>([]);
const contentHash = ref<string | undefined>();

const view = ref<'card' | 'table'>('card');
const showSetup = ref(false);

const setupIncidentName = ref('');
const setupFilename = ref('');
const setupUseMyDocuments = ref(false);
const setupRespondentCount = ref(3);

const segmentUids = computed(() => segments.value.map((s) => s.uid));

async function onFlyTo(uid: string): Promise<void> {
    status.value = '';
    statusError.value = false;
    const found = await flyToFeature(uid);
    if (!found) {
        statusError.value = true;
        status.value = 'Feature is not on the map yet — try Refresh map objects in Segmentation.';
    }
}

async function loadAll(): Promise<void> {
    if (!activeMission.value) {
        consensus.value = null;
        segments.value = [];
        return;
    }
    loading.value = true;
    status.value = '';
    statusError.value = false;
    try {
        const loaded = await loadCasieFromMission(activeMission.value);
        incidentName.value = loaded.incidentName;
        contentHash.value = loaded.contentHash;
        segments.value = Object.entries(loaded.segments)
            .map(([uid, rec]) => ({ uid, callsign: rec.callsign || uid }))
            .sort((a, b) => compareCallsign(a.callsign, b.callsign));

        if (loaded.consensus) {
            for (const resp of loaded.consensus.respondents) {
                alignRespondentToSegments(resp, segmentUids.value);
            }
            consensus.value = loaded.consensus;
        } else {
            consensus.value = null;
        }
    } catch (err) {
        statusError.value = true;
        status.value = `Could not load consensus: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
        loading.value = false;
    }
}

function openSetup(): void {
    if (!requireActiveMission()) return;
    if (!segments.value.length) {
        statusError.value = true;
        status.value = 'Add segments in Segmentation before creating a consensus.';
        return;
    }
    setupIncidentName.value = consensus.value?.incident_name || incidentName.value;
    setupFilename.value = consensus.value?.filename || incidentName.value;
    setupUseMyDocuments.value = consensus.value?.use_my_documents ?? false;
    setupRespondentCount.value = consensus.value?.respondents.length || 3;
    showSetup.value = true;
}

async function persist(next: InitialConsensusState, incidentNameOverride?: string): Promise<void> {
    if (!activeMission.value) return;
    saving.value = true;
    status.value = '';
    statusError.value = false;
    try {
        contentHash.value = await saveCasieToMission(activeMission.value, next, {
            incidentName: incidentNameOverride,
            contentHash: contentHash.value,
        });
        if (incidentNameOverride && incidentNameOverride.trim()) {
            incidentName.value = incidentNameOverride.trim();
        }
        consensus.value = next;
    } catch (err) {
        statusError.value = true;
        status.value = err instanceof Error ? err.message : String(err);
        throw err;
    } finally {
        saving.value = false;
    }
}

async function onSetupAccept(result: SetupResult): Promise<void> {
    const existing = consensus.value;
    let next: InitialConsensusState;
    if (existing) {
        next = {
            ...existing,
            incident_name: result.incidentName,
            filename: result.filename,
            use_my_documents: result.useMyDocuments,
            respondents: resizeRespondents(
                existing.respondents,
                result.respondentCount,
                segmentUids.value,
            ),
        };
        for (const resp of next.respondents) alignRespondentToSegments(resp, segmentUids.value);
    } else {
        next = defaultConsensusState(
            result.incidentName,
            segmentUids.value,
            result.respondentCount,
        );
        next.filename = result.filename;
        next.use_my_documents = result.useMyDocuments;
    }
    try {
        await persist(next, result.incidentName);
        showSetup.value = false;
        view.value = 'table';
    } catch {
        // status already reflects the error; keep the modal open.
    }
}

function onSetupCancel(): void {
    showSetup.value = false;
    if (view.value !== 'table') view.value = 'card';
}

async function onUpdateRespondent(index: number, respondent: ConsensusRespondent): Promise<void> {
    if (!consensus.value) return;
    const respondents = consensus.value.respondents.slice();
    respondents[index] = respondent;
    const next: InitialConsensusState = { ...consensus.value, respondents };
    try {
        await persist(next);
    } catch {
        // status already reflects the error.
    }
}

async function onTableAccept(): Promise<void> {
    if (!consensus.value) return;
    const next: InitialConsensusState = { ...consensus.value, accepted: true };
    try {
        await persist(next);
        status.value = 'Consensus saved.';
        statusError.value = false;
        view.value = 'card';
    } catch {
        // status already reflects the error.
    }
}

function onTableCancel(): void {
    view.value = 'card';
    void loadAll();
}

watch(activeMission, () => {
    view.value = 'card';
    showSetup.value = false;
    void loadAll();
});

onMounted(() => {
    void loadAll();
});
</script>
