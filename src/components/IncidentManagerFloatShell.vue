<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
    >
        <template #header>
            <div
                class='mx-2 text-sm text-truncate d-flex align-items-center gap-2'
                style='max-width: calc(100% - 100px);'
            >
                <IconTarget
                    class='flex-shrink-0'
                    :size='20'
                    stroke='1.5'
                />
                <span>Incident Manager</span>
            </div>
        </template>

        <template #actions>
            <MinimizePaneAction />
        </template>

        <div class='h-100 w-100 overflow-auto'>
            <IncidentManagerPane />
        </div>
    </FloatingPane>
</template>

<script setup lang='ts'>
import { IconTarget } from '@tabler/icons-vue';
import FloatingPane from '../../../../src/components/CloudTAK/util/FloatingPane.vue';
import MinimizePaneAction from './MinimizePaneAction.vue';
import IncidentManagerPane from './IncidentManagerPane.vue';

defineProps({
    uid: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(['close']);
</script>
