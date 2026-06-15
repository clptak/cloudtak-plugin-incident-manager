<template>
    <div class='card mt-4'>
        <div class='card-header py-2 d-flex align-items-center justify-content-between'>
            <h3 class='card-title mb-0'>
                {{ title }}
            </h3>
            <button
                type='button'
                class='btn btn-sm btn-outline-secondary'
                @click='$emit("close")'
            >
                Close
            </button>
        </div>
        <div class='card-body'>
            <slot />
        </div>
    </div>
</template>

<script setup lang='ts'>
defineProps<{ title: string }>();
defineEmits<{ close: [] }>();
</script>
