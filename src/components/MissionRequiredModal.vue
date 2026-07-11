<template>
    <div
        v-if='noMissionModalOpen'
        class='modal modal-blur show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='closeNoMissionModal'
    >
        <div
            class='modal-dialog modal-dialog-centered'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title'>
                        DataSync mission required
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='closeNoMissionModal'
                    />
                </div>
                <div class='modal-body'>
                    <p class='mb-0'>
                        Please
                        <button
                            type='button'
                            class='btn btn-link p-0 align-baseline'
                            @click='goToCreateOpen'
                        >
                            Open or Create
                        </button>
                        a DataSync Mission.
                    </p>
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn btn-secondary'
                        @click='closeNoMissionModal'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div
        v-if='noMissionModalOpen'
        class='modal-backdrop fade show'
    />
</template>

<script setup lang='ts'>
import { useIncident } from '../composables/useIncident.ts';

const {
    noMissionModalOpen,
    closeNoMissionModal,
    goToCreateOpen,
} = useIncident();
</script>
