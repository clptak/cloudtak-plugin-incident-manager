<template>
    <div>
        <h3 class='mb-3'>Wrap Up</h3>
        <IncidentPost />
    </div>
</template>

<script setup lang='ts'>
import { defineAsyncComponent } from 'vue';

// Wrap Up reuses the Incident POST report generator (active-mission patrol report).
const IncidentPost = defineAsyncComponent(() => import('./logger/IncidentPost.vue'));
</script>
