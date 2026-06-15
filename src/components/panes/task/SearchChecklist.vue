<template>
    <TaskChecklistShell
        title='Search Checklist'
        @close='$emit("close")'
    >
        <p class='text-muted mb-0'>
            Checklist items will be added here.
        </p>
    </TaskChecklistShell>
</template>

<script setup lang='ts'>
import TaskChecklistShell from './TaskChecklistShell.vue';

defineEmits<{ close: [] }>();
</script>
