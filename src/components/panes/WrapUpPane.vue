<template>
    <div class='card'>
        <div class='card-header d-flex align-items-center'>
            <h3 class='card-title mb-0'>
                Generate Report Template
            </h3>
            <span class='badge bg-blue-lt ms-auto'>CCSO Patrol Report</span>
        </div>
        <div class='card-body'>
            <p class='text-muted small mb-3'>
                Produces a patrol report (.md) from the active DataSync mission's log entries.
            </p>

            <button
                class='btn btn-primary'
                :disabled='!activeMission || loading'
                @click='generate'
            >
                {{ loading ? 'Generating…' : 'Generate from active mission' }}
            </button>

            <div
                v-if='!activeMission'
                class='form-text text-warning'
            >
                No active mission. Select one in Create | Open first.
            </div>
            <div
                v-else
                class='form-text'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
            </div>
            <div
                v-if='error'
                class='text-danger small mt-1'
            >
                {{ error }}
            </div>

            <div
                v-if='report'
                class='mt-3'
            >
                <div class='d-flex align-items-center mb-2'>
                    <h4 class='mb-0'>
                        Report Preview
                    </h4>
                    <div class='ms-auto btn-list'>
                        <button
                            class='btn btn-success btn-sm'
                            @click='download'
                        >
                            Download .md
                        </button>
                        <button
                            class='btn btn-outline-secondary btn-sm'
                            @click='copy'
                        >
                            {{ copied ? 'Copied' : 'Copy' }}
                        </button>
                    </div>
                </div>
                <textarea
                    v-model='report'
                    class='form-control font-monospace'
                    style='font-size:0.82rem; min-height:380px; white-space:pre;'
                    spellcheck='false'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useIncident } from '../../composables/useIncident.ts';
import { loadIncidentSubscription } from '../../lib/incidentSubscription.ts';
import { loadMissionSchema, resolveAssignmentData } from '../../lib/missionSchema.ts';

const { activeMission } = useIncident();

const loading = ref(false);
const error = ref('');
const report = ref('');
const copied = ref(false);

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatReportDateTimeParts(epoch: number): { date: string; time: string } {
    const d = new Date(epoch);
    return {
        date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${d.getFullYear()}`,
        time: `${pad2(d.getHours())}${pad2(d.getMinutes())}`,
    };
}

/** Browser-local timestamp for the patrol report: MM-DD-YYYY at HHMM. */
function formatReportTime(epoch: number, raw?: string): string {
    if (epoch <= 0) return raw || '';
    const { date, time } = formatReportDateTimeParts(epoch);
    return `${date} at ${time}`;
}

function parseTime(raw?: string): { rawTime: string; epoch: number } {
    if (!raw) return { rawTime: '', epoch: 0 };
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return { rawTime: raw, epoch: 0 };
    return { rawTime: raw, epoch: ms };
}

function assignmentLines(data: { text: string; datetime: string } | null): string[] | null {
    if (!data) return null;

    const txt = data.text;
    const dtRaw = data.datetime;
    if (!txt && !dtRaw) return null;

    const { epoch } = parseTime(dtRaw);
    const { date, time } = epoch > 0
        ? formatReportDateTimeParts(epoch)
        : { date: '', time: '' };

    return [
        '## ASSIGNMENT:',
        '',
        `On ${date} at approximately ${time}, ${txt}`,
        '',
    ];
}

async function generate(): Promise<void> {
    if (!activeMission.value) return;
    loading.value = true; error.value = ''; report.value = '';
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        const { schema } = await loadMissionSchema(sub);
        const logs = await sub.log.list({ refresh: true });
        const assignmentData = resolveAssignmentData(schema, logs);
        const sortedLogs = [...logs].sort((a, b) => {
            const ea = parseTime(a.dtg || a.created).epoch;
            const eb = parseTime(b.dtg || b.created).epoch;
            return ea - eb;
        });

        const lines: string[] = [];
        lines.push(`# CCSO Patrol Report — ${activeMission.value.name}`);
        lines.push('');
        lines.push(`Generated: ${formatReportTime(Date.now())}`);
        lines.push(`Mission GUID: ${activeMission.value.guid}`);
        lines.push(`Log entries: ${logs.length}`);
        lines.push('');
        const assignment = assignmentLines(assignmentData);
        if (assignment) lines.push(...assignment);
        lines.push('## INVESTIGATION:');
        lines.push('');
        if (!sortedLogs.length) {
            lines.push('_No log entries found._');
        } else {
            for (const log of sortedLogs) {
                const { rawTime, epoch } = parseTime(log.dtg || log.created);
                const ts = formatReportTime(epoch, rawTime);
                const who = log.creatorUid ? ` _(${log.creatorUid})_` : '';
                lines.push(`${ts} — ${log.content || ''}${who}`);
            }
        }
        lines.push('');
        report.value = lines.join('\n');
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

function download(): void {
    const name = (activeMission.value?.name || 'patrol-report').replace(/[^a-z0-9_.-]/gi, '_');
    const blob = new Blob([report.value], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(report.value);
        copied.value = true;
        setTimeout(() => (copied.value = false), 1500);
    } catch {
        // ignore clipboard failures
    }
}
</script>
