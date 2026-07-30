<template>
    <span class='d-inline-flex align-items-center gap-1'>
        <button
            type='button'
            class='btn btn-link p-0 border-0 align-baseline text-start'
            title='Center the map on this feature'
            @click='emit("fly")'
        >
            {{ callsign }}
        </button>
        <TablerIconButton
            title='Show CoT UID'
            @click='modalOpen = true'
        >
            <IconInfoCircle
                :size='16'
                stroke='1.5'
            />
        </TablerIconButton>
    </span>

    <!-- Rendered in place (no Teleport) so the modal also works inside the popout window. -->
    <div
        v-if='modalOpen'
        class='modal modal-blur show d-block'
        tabindex='-1'
        role='dialog'
        @click.self='modalOpen = false'
    >
        <div
            class='modal-dialog modal-sm modal-dialog-centered'
            role='document'
        >
            <div class='modal-content'>
                <div class='modal-header'>
                    <h5 class='modal-title text-truncate'>
                        {{ callsign }}
                    </h5>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='modalOpen = false'
                    />
                </div>
                <div class='modal-body'>
                    <div class='text-muted small mb-1'>
                        CoT UID
                    </div>
                    <code class='small text-break user-select-all'>{{ uid }}</code>
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn btn-outline-primary btn-sm'
                        @click='copyUid'
                    >
                        {{ copied ? 'Copied!' : 'Copy' }}
                    </button>
                    <button
                        type='button'
                        class='btn btn-secondary btn-sm'
                        @click='modalOpen = false'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div
        v-if='modalOpen'
        class='modal-backdrop fade show'
    />
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';

const props = defineProps<{
    uid: string;
    callsign: string;
}>();

const emit = defineEmits(['fly']);

const modalOpen = ref(false);
const copied = ref(false);

watch(modalOpen, () => {
    copied.value = false;
});

async function copyUid(): Promise<void> {
    try {
        await navigator.clipboard.writeText(props.uid);
        copied.value = true;
    } catch {
        // Clipboard unavailable (permissions / insecure context) — the UID
        // stays selectable in the modal body.
    }
}
</script>
