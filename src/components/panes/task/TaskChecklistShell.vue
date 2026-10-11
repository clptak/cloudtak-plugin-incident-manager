<template>
    <TablerBorder
        class='cloudtak-accent text-white mt-4'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <div class='d-flex align-items-center justify-content-between w-100'>
                <p class='text-uppercase text-white-50 small mb-0'>
                    {{ title }}
                </p>
                <button
                    type='button'
                    class='btn btn-sm btn-outline-secondary'
                    @click='$emit("close")'
                >
                    Close
                </button>
            </div>
        </template>

        <slot />
    </TablerBorder>
</template>

<script setup lang='ts'>
import { TablerBorder } from '@tak-ps/vue-tabler';

defineProps<{ title: string }>();
defineEmits<{ close: [] }>();
</script>
