<template>
    <TablerBorder
        class='cloudtak-accent text-white'
        :fill-height='false'
        :shadow='false'
        gap='sm'
    >
        <template #label>
            <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center gap-2 w-100'>
                <span>Generate Report Template</span>
                <span class='badge bg-blue-lt ms-auto'>Patrol Report</span>
            </p>
        </template>

        <p class='text-muted small mb-0'>
            Produces a patrol report (.md) from the active DataSync mission's log entries.
        </p>

        <div>
            <button
                class='btn btn-primary'
                :disabled='loading'
                @click='onGenerate'
            >
                {{ loading ? 'Generating…' : 'Generate from active mission' }}
            </button>

            <TablerInlineAlert
                v-if='!activeMission'
                class='mt-2'
                severity='warning'
                title='Mission Required'
                description='No active mission. Select one in Create | Open first.'
            />
            <p
                v-else
                class='form-text mt-2 mb-0'
            >
                Active DataSync: <strong>{{ activeMission.name }}</strong>
            </p>
            <TablerInlineAlert
                v-if='error'
                class='mt-2'
                severity='danger'
                title='Error'
                :description='error'
            />
        </div>

        <div v-if='report'>
            <div class='d-flex align-items-center mb-2'>
                <h4 class='mb-0 text-white'>
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
            <TablerInput
                v-model='report'
                class='report-textarea'
                :rows='16'
            />
        </div>
    </TablerBorder>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    TablerBorder,
    TablerInput,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { useIncident } from '../../composables/useIncident.ts';
import { loadIncidentSubscription } from '../../lib/incidentSubscription.ts';
import {
    assignmentDataFromSchema,
    incidentFormFromSchema,
    loadMissionSchema,
    type MissionSchema,
} from '../../lib/missionSchema.ts';

const { activeMission, requireActiveMission } = useIncident();

const loading = ref(false);
const error = ref('');
const report = ref('');
const copied = ref(false);

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatGenerationDate(epoch: number): string {
    const d = new Date(epoch);
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
}

function resolveReportMeta(
    schema: MissionSchema,
): { reportNumber: string; icCoordinator: string } {
    const form = incidentFormFromSchema(schema);
    return {
        reportNumber: form.incidentId.trim(),
        icCoordinator: form.icCoordinator.trim(),
    };
}

function reportHeaderLines(
    reportNumber: string,
    icCoordinator: string,
    generatedAt: number,
): string[] {
    return [
        `Report # ${reportNumber}`,
        `Coordinator ${icCoordinator}`,
        `C: ${formatGenerationDate(generatedAt)}`,
        '',
    ];
}

function reportFooterLines(reportNumber: string): string[] {
    const mapFile = reportNumber
        ? `${reportNumber}_Incident_Map.pdf`
        : 'Incident_Map.pdf';
    return [
        '',
        'ENCLOSURES:',
        '',
        `1. ${mapFile}`,
        '',
        'DISPOSITION:',
        '',
        'Case Closed - Non-Crime | Refer to other Agency Report # | Refer to Original Report | Investigation Continued',
    ];
}
function formatReportDateTimeParts(epoch: number): { date: string; time: string } {
    const d = new Date(epoch);
    return {
        date: `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`,
        time: `${pad2(d.getHours())}${pad2(d.getMinutes())}`,
    };
}

/** Browser-local timestamp for the patrol report: MM/DD/YYYY at HHMM. */
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

    const sentence = date && time
        ? `On ${date} at approximately ${time} hours, ${txt}`
        : date
            ? `On ${date}, ${txt}`
            : time
                ? `At approximately ${time} hours, ${txt}`
                : txt;

    return [
        '## ASSIGNMENT:',
        '',
        sentence,
        '',
    ];
}

async function onGenerate(): Promise<void> {
    if (!requireActiveMission()) return;
    await generate();
}

async function generate(): Promise<void> {
    if (!activeMission.value) return;
    loading.value = true; error.value = ''; report.value = '';
    try {
        const sub = await loadIncidentSubscription(activeMission.value);
        const { schema } = await loadMissionSchema(sub);
        const logs = await sub.log.list({ refresh: true });
        const assignmentData = assignmentDataFromSchema(schema);
        const generatedAt = Date.now();
        const { reportNumber, icCoordinator } = resolveReportMeta(schema);
        const sortedLogs = [...logs].sort((a, b) => {
            const ea = parseTime(a.dtg || a.created).epoch;
            const eb = parseTime(b.dtg || b.created).epoch;
            return ea - eb;
        });

        const lines: string[] = [];
        lines.push(...reportHeaderLines(reportNumber, icCoordinator, generatedAt));
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
        lines.push(...reportFooterLines(reportNumber));
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

<style scoped>
.report-textarea :deep(textarea) {
    font-size: 0.82rem;
    min-height: 380px;
    white-space: pre;
    font-family: var(--tblr-font-monospace, monospace);
}
</style>
