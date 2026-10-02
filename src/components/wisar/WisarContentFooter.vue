<template>
    <div class='wisar-footer small text-muted text-center mt-3 pt-2 border-top'>
        WiSAR Decision Support Tool — Coconino County SAR<br>
        <WisarContentLink
            id='metadata'
            label='Metadata'
        /> |
        <WisarContentLink
            id='changelog'
            label='Changelog'
        /> |
        <WisarContentLink
            id='validation'
            label='Validation'
        />
    </div>
</template>

<script setup lang='ts'>
import WisarContentLink from './WisarContentLink.vue';
</script>
