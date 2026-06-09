<template>
    <div>
        <div v-for='section in sections' :key='section.key' class='card mb-3'>
            <div class='card-header'><h3 class='card-title mb-0'>{{ section.title }}</h3></div>
            <div class='card-body'>
                <div v-for='(entry, i) in section.entries' :key='i' class='mb-2'>
                    <label class='form-label small mb-1'>{{ section.singular }} {{ i + 1 }}</label>
                    <textarea
                        v-model='section.entries[i]'
                        class='form-control form-control-sm'
                        rows='2'
                        :placeholder='`${section.singular} ${i + 1}`'
                    />
                </div>

                <button
                    class='btn btn-primary btn-sm'
                    :disabled='!activeMission || section.posting || !filledCount(section)'
                    @click='send(section)'
                >
                    {{ section.posting ? 'Sending…' : `Send ${filledCount(section)} to DataSync` }}
                </button>

                <div
                    v-if='section.status'
                    class='fw-bold mt-2'
                    :class='section.statusError ? "text-danger" : "text-success"'
                >
                    {{ section.status }}
                </div>
            </div>
        </div>

        <div v-if='!activeMission' class='form-text text-warning'>
            No active mission. Select one in Create | Open first.
        </div>
        <div v-else class='form-text'>Active DataSync: <strong>{{ activeMission.name }}</strong></div>
    </div>
</template>

<script setup lang='ts'>
import { reactive } from 'vue';
import Subscription from '@/base/subscription.ts';
import { useIncident } from '../../../composables/useIncident.ts';

const { activeMission } = useIncident();

interface Section {
    key: string;
    title: string;
    singular: string;
    keyword: string;
    entries: string[];
    posting: boolean;
    status: string;
    statusError: boolean;
}

function makeSection(key: string, title: string, singular: string, keyword: string, defaults: string[] = []): Section {
    const entries = Array.from({ length: 5 }, (_, i) => defaults[i] ?? '');
    return { key, title, singular, keyword, entries, posting: false, status: '', statusError: false };
}

const sections = reactive<Section[]>([
    makeSection('objectives', 'Objectives', 'Objective', 'objective', [
        'Provide for safety of incident personnel and public',
    ]),
    makeSection('strategies', 'Strategies', 'Strategy', 'strategy'),
    makeSection('tactics', 'Tactics', 'Tactic', 'tactic'),
]);

function filledCount(section: Section): number {
    return section.entries.filter((e) => e.trim()).length;
}

async function send(section: Section): Promise<void> {
    if (!activeMission.value || !filledCount(section)) return;
    section.posting = true; section.status = ''; section.statusError = false;
    let ok = 0, failed = 0;
    try {
        const sub = await Subscription.load(activeMission.value.guid, {
            token: activeMission.value.token ?? '',
        });
        let idx = 0;
        for (const entry of section.entries) {
            idx++;
            if (!entry.trim()) continue;
            try {
                await sub.log.create({
                    content: `${section.singular} ${idx}: ${entry.trim()}`,
                    keywords: ['risk-assessment', `${section.keyword}:${idx}`],
                });
                ok++;
            } catch {
                failed++;
            }
        }
        section.statusError = failed > 0;
        section.status = `Sent ${ok} ${section.title.toLowerCase()} to ${activeMission.value.name}`
            + (failed ? `, ${failed} failed.` : '.');
    } catch (err) {
        section.statusError = true;
        section.status = err instanceof Error ? err.message : String(err);
    } finally {
        section.posting = false;
    }
}
</script>
