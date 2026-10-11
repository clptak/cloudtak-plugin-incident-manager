<template>
    <TablerIconButton
        title='Minimize to task bar'
        @click='minimizeDesktopPane'
    >
        <IconMinus
            :size='24'
            stroke='1'
        />
    </TablerIconButton>
</template>

<script setup lang='ts'>
import { IconMinus } from '@tabler/icons-vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { minimizeDesktopPane } from '../lib/floatMinimize.ts';
</script>
