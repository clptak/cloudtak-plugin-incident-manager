<template>
    <div>
        <TablerInlineAlert
            v-if='!activeMission'
            severity='warning'
            title='Mission Required'
            description='Select or create an incident in Create | Open first.'
        />
        <TablerInlineAlert
            v-else-if='!activeMission.mgmt'
            severity='warning'
            title='Management Sync Required'
            description='This incident predates the dual-sync model (no management DataSync), so operational periods cannot be managed here. Create a new incident with Management Channels set.'
        />

        <template v-else>
            <TablerInlineAlert
                v-if='error'
                class='mb-3'
                severity='danger'
                title='Error'
                :description='error'
            />
            <TablerInlineAlert
                v-if='notice'
                class='mb-3'
                severity='success'
                title='Done'
                :description='notice'
            />

            <!-- ── Operational Periods ─────────────────────────────────── -->
            <TablerBorder
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Operational Periods
                    </p>
                </template>

                <div
                    v-if='loadingRegistry'
                    class='text-muted small'
                >
                    Loading registry…
                </div>
                <template v-else>
                    <div
                        v-if='!registry.length'
                        class='text-muted small mb-2'
                    >
                        No operational periods yet. Opening OP1 begins the Area Search phase.
                    </div>
                    <div
                        v-for='op in registry'
                        :key='op.guid'
                        class='cloudtak-accent border rounded-3 mb-2 px-3 py-2 d-flex align-items-center gap-2'
                    >
                        <strong>OP{{ op.opNumber }}</strong>
                        <span class='text-muted small'>{{ op.name }}</span>
                        <span
                            class='badge ms-1'
                            :class='op.status === "closed" ? "bg-secondary-lt text-secondary" : "bg-success-lt text-success"'
                        >{{ op.status }}</span>
                        <span
                            v-if='currentOp && op.guid === currentOp.guid'
                            class='badge bg-blue-lt text-blue'
                        >current</span>
                        <span class='text-muted small ms-auto'>
                            {{ op.openedAt ? shortDt(op.openedAt) : '' }}
                            {{ op.closedAt ? `→ ${shortDt(op.closedAt)}` : '' }}
                        </span>
                        <button
                            class='btn btn-link btn-sm p-0'
                            :disabled='busy'
                            title='Generate the Incident Action Plan PDF for this operational period'
                            @click='onGenerateIap(op)'
                        >
                            IAP
                        </button>
                        <button
                            v-if='op.status !== "closed"'
                            class='btn btn-link btn-sm p-0'
                            :disabled='busy'
                            @click='makeMapActive(op.guid, op.name)'
                        >
                            Set active
                        </button>
                    </div>
                    <div class='form-text mb-1'>
                        Active mission = where new markers, clues, and logs land.
                        <button
                            class='btn btn-link btn-sm p-0 align-baseline'
                            :disabled='busy'
                            @click='makeMapActive(activeMission.guid, activeMission.name)'
                        >
                            Set common map active
                        </button>
                    </div>

                    <div
                        v-if='!currentOp'
                        class='mt-3'
                    >
                        <label class='form-label'>Channels for OP{{ nextOp }}</label>
                        <GroupSelect
                            v-model='opChannels'
                            :active='true'
                            direction='IN'
                        />
                        <div class='form-text'>
                            Field + management channels (defaults from the incident common map).
                            Subscribed volunteers can add markers and logs immediately.
                        </div>
                        <TablerEnum
                            v-if='!isSearchIncident'
                            v-model='opTemplateLabel'
                            class='mt-3'
                            label='Template'
                            :options='opTemplateOptions'
                            :disabled='templatesLoading'
                        />
                        <div
                            v-else
                            class='form-text mt-2'
                        >
                            <template v-if='templatesLoading'>
                                Loading the search OP template…
                            </template>
                            <template v-else-if='searchOpTemplateName'>
                                New OP DataSync uses the
                                <strong>{{ searchOpTemplateName }}</strong>
                                template from Settings.
                            </template>
                            <template v-else>
                                No SAR template found — OP will be created without a template.
                                Set one in Settings.
                            </template>
                        </div>
                        <button
                            class='btn btn-primary mt-2'
                            :disabled='busy || !opChannels.length'
                            @click='onOpenOp'
                        >
                            {{ busy ? 'Working…' : `Open OP${nextOp}` }}
                        </button>
                    </div>
                    <div
                        v-else
                        class='mt-3'
                    >
                        <button
                            class='btn btn-outline-primary me-2'
                            :disabled='busy'
                            @click='onPublishIpp'
                        >
                            Publish IPP to OP{{ currentOp.opNumber }}
                        </button>
                        <button
                            class='btn btn-outline-primary me-2'
                            :disabled='busy'
                            @click='openClueForm'
                        >
                            Add Influence of Clue
                        </button>
                        <button
                            class='btn btn-outline-danger'
                            :disabled='busy'
                            @click='onCloseOp'
                        >
                            {{ busy ? 'Working…' : `Close OP${currentOp.opNumber}` }}
                        </button>
                        <div class='form-text'>
                            Closing removes field channels from the OP sync — volunteers lose
                            access and visibility (fades as server caches expire).
                        </div>
                    </div>
                </template>
            </TablerBorder>

            <!-- ── IAP builder (editable, prefilled) ───────────────────── -->
            <TablerBorder
                v-if='iapOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Incident Action Plan
                    </p>
                </template>
                <IapBuilder
                    :key='iapOp.guid'
                    :op='iapOp'
                    :registry='registry'
                    :category='iapCategory'
                    @close='iapOp = null'
                />
            </TablerBorder>

            <!-- ── Influence of Clue (ISM 8.17/8.18) — inline, map stays usable ── -->
            <TablerBorder
                v-if='clueFormOpen && currentOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Add Influence of Clue — OP{{ clueForm.opNumber }}
                    </p>
                </template>

                <p class='form-text mt-0 mb-2'>
                    Rate what the clue suggests — assuming it is authentic — for R.O.W. and
                    every segment: A = strongly suggests subject IS here, E = says nothing,
                    I = strongly suggests subject is NOT here. Authenticity then discounts
                    the whole update.
                </p>

                <div class='row g-2'>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='clueForm.description'
                            label='Description'
                            placeholder='e.g. Wallet found in Segment 1'
                        />
                        <div
                            v-if='cluePointOptions.length'
                            class='mt-1'
                        >
                            <select
                                class='form-select form-select-sm'
                                @change='onCluePointPick($event)'
                            >
                                <option value=''>
                                    — or pick a clue marker from {{ currentOp.name }} —
                                </option>
                                <option
                                    v-for='m in cluePointOptions'
                                    :key='m.uid'
                                    :value='m.callsign'
                                >
                                    {{ m.callsign }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class='col-md-3'>
                        <label class='form-label'>Authenticity</label>
                        <select
                            v-model.number='clueForm.authIndex'
                            class='form-select form-select-sm'
                        >
                            <option
                                v-for='(opt, i) in CLUE_AUTHENTICITY_OPTIONS'
                                :key='opt.label'
                                :value='i'
                            >
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='clueForm.xref'
                            label='X Reference to paperwork'
                        />
                    </div>
                </div>

                <p class='text-uppercase text-white-50 small mb-1 mt-3'>
                    Relative importance of clue
                </p>
                <div class='row g-3'>
                    <div class='col-lg-7'>
                        <div class='table-responsive'>
                            <table class='table table-sm mb-0 align-middle w-auto'>
                                <tbody>
                                    <tr
                                        v-for='row in clueLetterRows'
                                        :key='row.key'
                                    >
                                        <td class='small text-muted pe-3 text-nowrap'>
                                            {{ row.label }}
                                        </td>
                                        <td>
                                            <div
                                                class='btn-group btn-group-sm'
                                                role='group'
                                            >
                                                <button
                                                    v-for='l in CLUE_LETTERS'
                                                    :key='l'
                                                    type='button'
                                                    class='btn px-2'
                                                    :class='letterScaleClass(l, clueForm.letters[row.key] === l, "secondary")'
                                                    :title='clueLetterHint(l)'
                                                    @click='clueForm.letters[row.key] = l'
                                                >
                                                    {{ l }}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class='col-lg-5'>
                        <div class='cloudtak-accent border rounded-3 p-2 h-100'>
                            <p class='text-uppercase text-white-50 small mb-1'>
                                Significance of Clue (ISM Table 8.17)
                            </p>
                            <div
                                v-for='l in CLUE_LETTERS'
                                :key='l'
                                class='small d-flex gap-2'
                            >
                                <strong
                                    :class='letterScaleLegendClass(l)'
                                    style='min-width: 1rem;'
                                >{{ l }}</strong>
                                <span :class='CLUE_SCALE[l] ? "" : "text-muted"'>
                                    {{ CLUE_SCALE[l] || '—' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class='d-flex gap-2 mt-3'>
                    <button
                        class='btn btn-primary btn-sm'
                        :disabled='busy || !clueForm.description.trim()'
                        @click='onAcceptClue'
                    >
                        {{ busy ? 'Working…' : 'Accept' }}
                    </button>
                    <button
                        class='btn btn-outline-secondary btn-sm'
                        :disabled='busy'
                        @click='clueFormOpen = false'
                    >
                        Cancel
                    </button>
                </div>
            </TablerBorder>

            <!-- ── Assignments ─────────────────────────────────────────── -->
            <TablerBorder
                v-if='currentOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        Assignments — OP{{ currentOp.opNumber }}
                    </p>
                </template>

                <p class='text-muted small mb-2 d-flex align-items-center gap-2'>
                    <span>
                        Publishing copies each {{ isSearchIncident ? 'segment polygon' : 'feature' }}
                        into {{ currentOp.name }} so field personnel receive it on their
                        channel, and adds it to the running assignment list (the basis
                        for this OP's IAP).
                    </span>
                    <button
                        v-if='!isSearchIncident'
                        class='btn btn-link btn-sm p-0 ms-auto text-nowrap'
                        :disabled='loadingTargets'
                        @click='loadFeatureTargets'
                    >
                        {{ loadingTargets ? 'Loading…' : 'Refresh features' }}
                    </button>
                </p>

                <div
                    v-if='!targets.length'
                    class='text-muted small'
                >
                    <template v-if='isSearchIncident'>
                        No segments registered. Draw and register segments in
                        Search Transition → Segmentation first.
                    </template>
                    <template v-else>
                        Nothing on the map to task yet. Draw or drop what this period is
                        working — a structure marker, a division polygon, a road line —
                        then hit Refresh features.
                    </template>
                </div>
                <template v-else>
                    <label
                        v-for='t in targets'
                        :key='t.uid'
                        class='form-check d-flex align-items-center gap-2 mb-1'
                    >
                        <input
                            v-model='selectedSegments'
                            type='checkbox'
                            class='form-check-input'
                            :value='t.uid'
                        >
                        <span class='form-check-label'>
                            {{ t.label }}
                            <span
                                v-if='t.detail'
                                class='text-muted small'
                            >· {{ t.detail }}</span>
                        </span>
                        <span
                            v-if='assignedThisOp.has(t.uid)'
                            class='badge bg-success-lt text-success'
                        >published OP{{ currentOp.opNumber }}</span>
                        <button
                            class='btn btn-link btn-sm p-0 ms-auto'
                            title='Center the map on this'
                            @click.prevent='flyToCandidate(t.uid)'
                        >
                            locate
                        </button>
                    </label>
                    <div class='row g-2 mt-1'>
                        <div class='col-md-6'>
                            <template v-if='opResourceOptions.length'>
                                <label class='form-label'>Team / Resource</label>
                                <select
                                    v-model='assignTeam'
                                    class='form-select form-select-sm'
                                >
                                    <option value=''>
                                        — unassigned —
                                    </option>
                                    <option
                                        v-for='r in opResourceOptions'
                                        :key='r'
                                        :value='r'
                                    >
                                        {{ r }}
                                    </option>
                                </select>
                                <div class='form-text'>
                                    Resources assigned to OP{{ currentOp.opNumber }} in the Resources screen.
                                </div>
                            </template>
                            <template v-else>
                                <TablerInput
                                    v-model='assignTeam'
                                    label='Team / Resource'
                                    placeholder='No resources assigned to this OP — set OP in Resources'
                                />
                            </template>
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='assignNotes'
                                label='Notes (optional)'
                            />
                        </div>
                    </div>
                    <button
                        class='btn btn-primary mt-2'
                        :disabled='busy || !selectedSegments.length'
                        @click='onPublishAssignments'
                    >
                        {{ busy ? 'Working…' : `Publish ${selectedSegments.length || ''} to OP${currentOp.opNumber}` }}
                    </button>
                </template>

                <div
                    v-if='assignments.length'
                    class='mt-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Running Assignment List ({{ assignments.length }})
                    </p>
                    <div
                        v-for='(a, i) in assignments'
                        :key='i'
                        class='small border-bottom py-1'
                    >
                        OP{{ a.opNumber }} · {{ a.label }}
                        <span
                            v-if='a.team'
                            class='text-muted'
                        > · {{ a.team }}</span>
                        <span
                            v-if='a.notes'
                            class='text-muted'
                        > · {{ a.notes }}</span>
                    </div>
                </div>
            </TablerBorder>

            <!-- ── Check-In ────────────────────────────────────────────── -->
            <TablerBorder
                v-if='currentOp'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0 d-flex align-items-center w-100'>
                        <span>Roster — OP{{ currentOp.opNumber }} Subscribers</span>
                        <button
                            class='btn btn-outline-primary btn-sm ms-auto'
                            :disabled='loadingSubscribers'
                            @click='refreshSubscribers'
                        >
                            {{ loadingSubscribers ? 'Loading…' : 'Refresh' }}
                        </button>
                    </p>
                </template>

                <div
                    v-if='!subscribers.length'
                    class='text-muted small'
                >
                    No subscribers yet. Volunteers appear here after subscribing to
                    {{ currentOp.name }}.
                </div>
                <div
                    v-for='sub in subscribers'
                    :key='sub.clientUid'
                    class='d-flex align-items-center gap-2 border-bottom py-1'
                >
                    <span>{{ sub.username }}</span>
                    <span class='badge bg-secondary-lt text-secondary'>{{ roleLabel(sub.role) }}</span>
                    <button
                        v-if='sub.role === "MISSION_READONLY_SUBSCRIBER"'
                        class='btn btn-outline-success btn-sm ms-auto'
                        :disabled='busy'
                        @click='onCheckIn(sub)'
                    >
                        Check In
                    </button>
                </div>
            </TablerBorder>

            <!-- ── Debrief / POD ───────────────────────────────────────── -->
            <TablerBorder
                v-if='registry.length'
                class='cloudtak-accent text-white mb-3'
                :fill-height='false'
                :shadow='false'
                gap='sm'
            >
                <template #label>
                    <p class='text-uppercase text-white-50 small mb-0'>
                        {{ isSearchIncident ? 'Add Complete Search Assignment' : 'Add Completed Assignment' }}
                    </p>
                </template>

                <div class='row g-2'>
                    <div class='col-md-6'>
                        <label class='form-label d-flex align-items-center'>
                            {{ targetNoun }}
                            <button
                                v-if='!isSearchIncident'
                                class='btn btn-link btn-sm p-0 ms-auto'
                                :disabled='loadingTargets'
                                @click='loadFeatureTargets'
                            >
                                {{ loadingTargets ? 'Loading…' : 'Refresh' }}
                            </button>
                        </label>
                        <select
                            v-model='debriefForm.segmentUid'
                            class='form-select form-select-sm'
                        >
                            <option value=''>
                                — select {{ targetNoun.toLowerCase() }} —
                            </option>
                            <option
                                v-for='t in targets'
                                :key='t.uid'
                                :value='t.uid'
                            >
                                {{ t.label }}{{ t.detail ? ` · ${t.detail}` : '' }}
                            </option>
                        </select>
                    </div>
                    <div
                        v-if='isSearchIncident'
                        class='col-md-2'
                    >
                        <TablerInput
                            v-model='debriefForm.pod'
                            label='POD %'
                            placeholder='0–100'
                        />
                    </div>
                    <div :class='isSearchIncident ? "col-md-2" : "col-md-4"'>
                        <TablerInput
                            v-model='debriefForm.coverage'
                            label='Completed %'
                            placeholder='100'
                        />
                    </div>
                    <div class='col-md-2'>
                        <label class='form-label'>OP</label>
                        <select
                            v-model.number='debriefForm.opNumber'
                            class='form-select form-select-sm'
                        >
                            <option
                                v-for='op in registry'
                                :key='op.opNumber'
                                :value='op.opNumber'
                            >
                                OP{{ op.opNumber }}
                            </option>
                        </select>
                    </div>
                    <div class='col-md-6'>
                        <template v-if='debriefResourceOptions.length'>
                            <label class='form-label'>Resource / Team</label>
                            <select
                                v-model='debriefForm.resource'
                                class='form-select form-select-sm'
                            >
                                <option value=''>
                                    — select resource —
                                </option>
                                <option
                                    v-for='r in debriefResourceOptions'
                                    :key='r'
                                    :value='r'
                                >
                                    {{ r }}
                                </option>
                            </select>
                        </template>
                        <TablerInput
                            v-else
                            v-model='debriefForm.resource'
                            label='Resource / Team'
                            placeholder='Team 3, K9-1, …'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='debriefForm.notes'
                            label='Notes'
                        />
                    </div>
                </div>
                <button
                    class='btn btn-primary mt-2'
                    :disabled='busy || !debriefForm.segmentUid'
                    @click='onRecordDebrief'
                >
                    Record Completed Assignment
                </button>

                <!-- ── Incomplete-segment split (ISM) — inline, map stays usable ── -->
                <div
                    v-if='splitPrompt'
                    class='cloudtak-accent border border-warning rounded-3 mt-3 p-3'
                >
                    <p class='text-uppercase text-warning small mb-1'>
                        Split {{ splitPrompt.label }} — only {{ splitPrompt.completedPct }}% completed
                    </p>
                    <p class='form-text mt-0 mb-2'>
                        The map stays live: edit {{ splitPrompt.label }}'s boundary on the MGMT
                        sync down to the searched portion, draw the remainder as
                        <strong>{{ splitNewName }}</strong>, then hit Refresh and select it below.
                        The searched portion keeps the POD; the remainder takes the rest of the POA.
                    </p>
                    <div class='row g-2'>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='splitRetainedPct'
                                label='POA retained in searched portion (%)'
                            />
                            <div class='form-text'>
                                Remainder gets {{ splitRemainderPct }}%.
                            </div>
                        </div>
                        <div class='col-md-4'>
                            <TablerInput
                                v-model='splitNewName'
                                label='New segment name'
                            />
                        </div>
                        <div class='col-md-4'>
                            <label class='form-label d-flex align-items-center'>
                                Remainder polygon
                                <button
                                    class='btn btn-link btn-sm p-0 ms-auto'
                                    :disabled='loadingRemainder'
                                    @click='loadRemainderCandidates'
                                >
                                    {{ loadingRemainder ? 'Loading…' : 'Refresh' }}
                                </button>
                            </label>
                            <div
                                v-if='!remainderCandidates.length'
                                class='text-muted small'
                            >
                                No unregistered polygons found yet.
                            </div>
                            <label
                                v-for='p in remainderCandidates'
                                :key='p.uid'
                                class='form-check d-flex align-items-center gap-2 mb-1'
                            >
                                <input
                                    v-model='selectedRemainderUid'
                                    type='radio'
                                    class='form-check-input'
                                    :value='p.uid'
                                >
                                <span class='form-check-label small'>
                                    {{ p.callsign }}
                                    <span class='text-muted'>· {{ formatSqMi(p.areaSqMi) }} mi² · {{ p.source }}</span>
                                </span>
                                <button
                                    class='btn btn-link btn-sm p-0 ms-auto'
                                    title='Center map on this polygon'
                                    @click.prevent='flyToCandidate(p.uid)'
                                >
                                    locate
                                </button>
                            </label>
                            <label class='form-check d-flex align-items-center gap-2 mb-1'>
                                <input
                                    v-model='selectedRemainderUid'
                                    type='radio'
                                    class='form-check-input'
                                    value=''
                                >
                                <span class='form-check-label small text-muted'>No polygon yet</span>
                            </label>
                        </div>
                    </div>
                    <div class='d-flex flex-wrap gap-2 mt-2'>
                        <button
                            class='btn btn-primary btn-sm'
                            :disabled='busy || !splitInputsValid'
                            @click='onSplitYes'
                        >
                            {{ busy ? 'Working…' : 'Split and record' }}
                        </button>
                        <button
                            class='btn btn-outline-secondary btn-sm'
                            :disabled='busy'
                            @click='onSplitNo'
                        >
                            Don't split — record partial coverage
                        </button>
                        <button
                            class='btn btn-link btn-sm'
                            :disabled='busy'
                            @click='splitPrompt = null'
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                <div
                    v-if='debriefs.length'
                    class='mt-3'
                >
                    <p class='text-uppercase text-white-50 small mb-1'>
                        Recorded ({{ debriefs.length }})
                    </p>
                    <div
                        v-for='(d, i) in debriefs'
                        :key='i'
                        class='border-bottom py-1'
                    >
                        <div class='small d-flex align-items-center gap-2'>
                            <span>
                                OP{{ d.opNumber }} · {{ d.label || segmentLabel(d.segmentUid) }}<span
                                    v-if='d.pod !== undefined'
                                > · POD {{ d.pod }}%</span><span
                                    v-if='d.coverage !== undefined'
                                > ({{ Math.round(d.coverage * 100) }}% completed)</span>
                                <span
                                    v-if='d.resource'
                                    class='text-muted'
                                > · {{ d.resource }}</span>
                            </span>
                            <button
                                class='btn btn-link btn-sm p-0 ms-auto d-flex align-items-center gap-1'
                                :disabled='trackBusy'
                                title='Attach a GPS track log to this completed assignment'
                                @click='toggleTrackPanel(d)'
                            >
                                <IconRoute
                                    :size='16'
                                    :stroke-width='2'
                                />
                                <span class='d-none d-md-inline'>Attach GPS Track Log</span>
                            </button>
                        </div>

                        <!-- Attached tracks -->
                        <div
                            v-for='t in (d.tracks || [])'
                            :key='t.uid'
                            class='small text-muted d-flex align-items-center gap-2 ps-3'
                        >
                            <IconRoute
                                :size='14'
                                :stroke-width='2'
                            />
                            <span>
                                {{ t.name }} · {{ t.lengthMi }} mi · {{ t.points }} pts<span
                                    v-if='t.sourcePoints'
                                > of {{ t.sourcePoints }}</span>
                                <span v-if='t.startedAt'> · {{ shortDt(t.startedAt) }}</span>
                            </span>
                            <button
                                class='btn btn-link btn-sm p-0 ms-auto'
                                title='Center the map on this track'
                                @click='flyToCandidate(t.uid)'
                            >
                                locate
                            </button>
                            <button
                                class='btn btn-link btn-sm p-0 text-danger'
                                :disabled='trackBusy'
                                title='Remove the reference — the line stays in the OP sync'
                                @click='onDetachTrack(d, t.uid)'
                            >
                                detach
                            </button>
                        </div>

                        <!-- ── Attach panel — inline, map stays usable ──────── -->
                        <div
                            v-if='trackPanel && trackPanel.key === debriefKeyOf(d)'
                            class='cloudtak-accent border border-info rounded-3 mt-2 mb-2 p-3'
                        >
                            <p class='text-uppercase text-info small mb-1'>
                                Attach GPS Track Log — {{ trackPanel.label }}
                            </p>
                            <p
                                v-if='!trackPanel.op'
                                class='form-text mt-0 mb-0 text-warning'
                            >
                                OP{{ d.opNumber }} is not in the registry, so there is no
                                DataSync to file a track into.
                            </p>
                            <template v-else>
                                <p class='form-text mt-0 mb-2'>
                                    Filed under the <strong>Track Logs</strong> folder in
                                    {{ trackPanel.op.name }}.
                                </p>

                                <div class='row g-3'>
                                    <div class='col-md-6'>
                                        <label class='form-label'>Upload a file</label>
                                        <input
                                            type='file'
                                            class='form-control form-control-sm'
                                            :accept='TRACK_FILE_ACCEPT'
                                            :disabled='trackBusy'
                                            @change='onTrackFile'
                                        >
                                        <div class='form-text'>
                                            GPX, KML, or GeoJSON. Multi-track files attach every
                                            track; long tracks are thinned for the map and the
                                            original fix count is kept.
                                        </div>

                                        <!-- Single-track file: name it before filing.
                                             Handheld exports carry generic track names, and
                                             one assignment often has several units out. -->
                                        <div
                                            v-if='pendingTrack'
                                            class='mt-2'
                                        >
                                            <TablerInput
                                                v-model='pendingTrack.callsign'
                                                label='Track name'
                                                :disabled='trackBusy'
                                                @keyup.enter='onConfirmPendingTrack'
                                            />
                                            <div class='form-text'>
                                                {{ pendingTrack.source }} ·
                                                {{ pendingTrack.lengthMi }} mi ·
                                                {{ pendingTrack.track.coords.length }} fixes<span
                                                    v-if='pendingTrack.sourceName'
                                                > · named "{{ pendingTrack.sourceName }}" in the file</span>
                                            </div>
                                            <div class='d-flex gap-2 mt-2'>
                                                <button
                                                    class='btn btn-primary btn-sm'
                                                    :disabled='trackBusy || !pendingTrack.callsign.trim()'
                                                    @click='onConfirmPendingTrack'
                                                >
                                                    {{ trackBusy ? 'Attaching…' : 'Attach track' }}
                                                </button>
                                                <button
                                                    class='btn btn-link btn-sm'
                                                    :disabled='trackBusy'
                                                    @click='pendingTrack = null'
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div class='col-md-6'>
                                        <label class='form-label d-flex align-items-center'>
                                            Or pick a line from the map
                                            <button
                                                class='btn btn-link btn-sm p-0 ms-auto'
                                                :disabled='loadingTracks'
                                                @click='loadTrackCandidates'
                                            >
                                                {{ loadingTracks ? 'Loading…' : 'Refresh' }}
                                            </button>
                                        </label>
                                        <div
                                            v-if='loadingTracks'
                                            class='text-muted small'
                                        >
                                            Looking for lines…
                                        </div>
                                        <div
                                            v-else-if='!trackCandidates.length'
                                            class='text-muted small'
                                        >
                                            No unfiled lines found. Draw the track on the map,
                                            then hit Refresh.
                                        </div>
                                        <div
                                            v-for='c in trackCandidates'
                                            :key='c.uid'
                                            class='d-flex align-items-center gap-2 mb-1'
                                        >
                                            <button
                                                class='btn btn-outline-primary btn-sm py-0'
                                                :disabled='trackBusy'
                                                @click='onAttachCandidate(c)'
                                            >
                                                Attach
                                            </button>
                                            <span class='small'>
                                                {{ c.callsign }}
                                                <span class='text-muted'>· {{ c.lengthMi }} mi · {{ c.source }}</span>
                                            </span>
                                            <button
                                                class='btn btn-link btn-sm p-0 ms-auto'
                                                title='Center map on this line'
                                                @click.prevent='flyToCandidate(c.uid)'
                                            >
                                                locate
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <div class='d-flex align-items-center gap-2 mt-2'>
                                <span
                                    v-if='trackBusy'
                                    class='text-muted small'
                                >Publishing to the OP sync…</span>
                                <button
                                    class='btn btn-link btn-sm ms-auto'
                                    :disabled='trackBusy'
                                    @click='trackPanel = null'
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </TablerBorder>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { IconRoute } from '@tabler/icons-vue';
import { TablerBorder, TablerEnum, TablerInlineAlert, TablerInput } from '@tak-ps/vue-tabler';
import OverlayManager from '../../../../../../src/base/overlay.ts';
import { useMapStore } from '../../../../../../src/stores/map.ts';
import { server } from '../../../../../../src/std.ts';
import GroupSelect from '../../../../../../src/components/CloudTAK/util/GroupSelect.vue';
import { useIncident } from '../../../composables/useIncident.ts';
import { usePluginSettings } from '../../../composables/usePluginSettings.ts';
import type { DebriefRecord, OpAssignment, OpPeriodRegistryEntry } from '../../../domain/entities.ts';
import { currentOpPeriod, nextOpNumber } from '../../../domain/registry.ts';
import {
    attachTrackLog,
    checkInSubscriber,
    closeOperationalPeriod,
    detachTrackLog,
    openOperationalPeriod,
    publishAssignments,
    recordDebrief,
} from '../../../domain/usecases.ts';
import {
    debriefKey,
    trackLengthMiles,
    trackLogCallsign,
    type ParsedTrack,
} from '../../../domain/trackLog.ts';
import {
    candidateToTrack,
    createTrackLogPublisher,
    listTrackCandidates,
    readTrackFile,
    TRACK_FILE_ACCEPT,
    type TrackCandidate,
} from '../../../lib/trackLogPersistence.ts';
import { addClueToMission, CLUE_AUTHENTICITY_OPTIONS } from '../../../lib/cluePersistence.ts';
import IapBuilder from './IapBuilder.vue';
import { createDebriefStore } from '../../../lib/debriefPersistence.ts';
import Subscription from '../../../../../../src/base/subscription.ts';
import { flyToFeature } from '../../../lib/flyToFeature.ts';
import { areaSqMi, formatSqMi } from '../../../lib/geometryArea.ts';
import { loadSchemaSubscription, schemaMission } from '../../../lib/incidentSubscription.ts';
import { incidentTypeKeyword, parseIncidentTypeFromRecord } from '../../../lib/incidentType.ts';
import { deletePolygonFromMission, pushPolygonToMission } from '../../../lib/missionFeatures.ts';
import { carveSegmentRemainder } from '../../../lib/segmentSplit.ts';
import {
    createAssignmentStore,
    createOpFeaturePublisher,
    createSegmentGeometrySource,
    listAssignableFeatures,
    publishIppToOp,
    type AssignableFeature,
} from '../../../lib/opAssignmentPersistence.ts';
import { loadResourceAssignmentsFromMission } from '../../../lib/resourceAssignmentPersistence.ts';
import { isActiveResource, type ResourceAssignment } from '../../../lib/resourceAssignments.ts';
import { loadMissionSchema } from '../../../lib/missionSchema.ts';
import {
    buildTemplateKeywords,
    DEFAULT_TEMPLATE_ID,
    DEFAULT_TEMPLATE_NAME,
    listMissionTemplates,
    resolveSearchOpTemplate,
    withDefaultTemplate,
    type MissionTemplateItem,
} from '../../../lib/missionTemplates.ts';
import { createOpPeriodGateway } from '../../../lib/opPeriodGateway.ts';
import { createRegistryStore } from '../../../lib/registryPersistence.ts';
import { segmentsFromSchema, type SegmentMap } from '../../../lib/segmentsPersistence.ts';
import { letterScaleClass, letterScaleLegendClass } from '../../../lib/letterScale.ts';
import '../../letterScale.css';

const { activeMission, isSearchIncident } = useIncident();
const { searchOpTemplateId } = usePluginSettings();

// ── Search vs. non-search ───────────────────────────────────────────────────
// Everything in this pane is type-agnostic except POD and the CASIE rollup.
// Search incidents task registered segments and report a probability of
// detection; every other type tasks any CoT on the map and just reports what
// was worked (Paul, 2026-08-30). One code path, one data shape.

/** Assignable targets: registered segments on a search, live CoTs otherwise. */
const featureTargets = ref<AssignableFeature[]>([]);
const loadingTargets = ref(false);

const targets = computed<{ uid: string; label: string; detail?: string }[]>(() => {
    if (isSearchIncident.value) {
        return segmentUids.value.map((uid) => ({ uid, label: segmentLabel(uid) }));
    }
    return featureTargets.value.map((f) => ({
        uid: f.uid,
        label: f.callsign,
        detail: `${f.kind} · ${f.source}`,
    }));
});

const targetNoun = computed(() => (isSearchIncident.value ? 'Segment' : 'Map feature'));

async function loadFeatureTargets(): Promise<void> {
    const mission = activeMission.value;
    if (!mission || isSearchIncident.value) return;
    loadingTargets.value = true;
    try {
        featureTargets.value = await listAssignableFeatures(mission, currentOp.value ?? undefined);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingTargets.value = false;
    }
}

const registry = ref<OpPeriodRegistryEntry[]>([]);
const segments = ref<SegmentMap>({});
const debriefs = ref<DebriefRecord[]>([]);
const assignments = ref<OpAssignment[]>([]);
const selectedSegments = ref<string[]>([]);
const assignTeam = ref('');
const assignNotes = ref('');
const subscribers = ref<{ clientUid: string; username: string; role: string }[]>([]);
const opChannels = ref<string[]>([]);

const loadingRegistry = ref(false);
const loadingSubscribers = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const gateway = createOpPeriodGateway();

const missionTemplates = ref<MissionTemplateItem[]>([]);
const templatesLoading = ref(false);
const selectedOpTemplateId = ref(DEFAULT_TEMPLATE_ID);

const pickerTemplates = computed(() => withDefaultTemplate(missionTemplates.value));
const searchOpTemplateName = computed(() =>
    resolveSearchOpTemplate(missionTemplates.value, searchOpTemplateId.value)?.name ?? '',
);
const opTemplateOptions = computed(() =>
    pickerTemplates.value.map((item) => item.name),
);
const opTemplateLabel = computed({
    get: () => pickerTemplates.value.find((item) => item.id === selectedOpTemplateId.value)?.name
        ?? DEFAULT_TEMPLATE_NAME,
    set: (name: string) => {
        const found = pickerTemplates.value.find((item) => item.name === name);
        selectedOpTemplateId.value = found?.id ?? DEFAULT_TEMPLATE_ID;
    },
});

async function loadMissionTemplates(): Promise<void> {
    templatesLoading.value = true;
    try {
        missionTemplates.value = await listMissionTemplates();
    } catch {
        missionTemplates.value = [];
    } finally {
        templatesLoading.value = false;
    }
}

function opCreateKeywords(): string[] {
    const keywords: string[] = [];
    const type = activeMission.value?.incidentType;
    if (type) keywords.push(incidentTypeKeyword(type));
    const template = isSearchIncident.value
        ? resolveSearchOpTemplate(missionTemplates.value, searchOpTemplateId.value)
        : pickerTemplates.value.find((item) => item.id === selectedOpTemplateId.value);
    for (const keyword of buildTemplateKeywords(template)) {
        if (!keywords.includes(keyword)) keywords.push(keyword);
    }
    return keywords;
}

const currentOp = computed(() => currentOpPeriod(registry.value));
const nextOp = computed(() => nextOpNumber(registry.value));
const segmentUids = computed(() => Object.keys(segments.value));
const resources = ref<ResourceAssignment[]>([]);
/**
 * Resource identifiers assigned (in the Resources screen) to the current OP,
 * excluding demobilized/cancelled resources.
 */
const opResourceOptions = computed(() => {
    const op = currentOp.value;
    if (!op) return [];
    return resources.value
        .filter((r) => r.opNumber === op.opNumber && r.resourceIdentifier.trim() && isActiveResource(r))
        .map((r) => r.resourceIdentifier.trim());
});
/** Same idea for the debrief form, but keyed to the OP selected there. */
const debriefResourceOptions = computed(() => resources.value
    .filter((r) => r.opNumber === debriefForm.opNumber && r.resourceIdentifier.trim() && isActiveResource(r))
    .map((r) => r.resourceIdentifier.trim()));
const assignedThisOp = computed(() => new Set(
    assignments.value
        .filter((a) => a.opNumber === currentOp.value?.opNumber)
        .map((a) => a.segmentUid),
));

const debriefForm = reactive({
    segmentUid: '',
    pod: '',
    coverage: '',
    opNumber: 1,
    resource: '',
    notes: '',
});

function shortDt(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
}

function roleLabel(role: string): string {
    if (role === 'MISSION_OWNER') return 'owner';
    if (role === 'MISSION_SUBSCRIBER') return 'checked in';
    if (role === 'MISSION_READONLY_SUBSCRIBER') return 'read-only';
    return role || 'unknown';
}

/**
 * Human label for an assignment target. Segments first (search), then live map
 * features, then any label snapshotted on a past record — a non-search target
 * has no registry behind it, so the CoT may have been renamed or deleted since.
 */
function segmentLabel(uid: string): string {
    const segment = segments.value[uid]?.callsign;
    if (segment) return segment;
    const feature = featureTargets.value.find((f) => f.uid === uid);
    if (feature?.callsign) return feature.callsign;
    const recorded = debriefs.value.find((d) => d.segmentUid === uid && d.label);
    if (recorded?.label) return recorded.label;
    const assigned = assignments.value.find((a) => a.segmentUid === uid && a.label);
    return assigned?.label || uid;
}

async function missionChannels(guid: string): Promise<string[]> {
    try {
        const { data } = await server.GET('/api/marti/missions/{:guid}', {
            params: { path: { ':guid': guid }, query: { changes: false, logs: false } },
        });
        const groups = (data as { groups?: string | string[] } | undefined)?.groups;
        if (Array.isArray(groups)) return groups;
        if (typeof groups === 'string' && groups) return [groups];
    } catch {
        /* fall through */
    }
    return [];
}

async function refresh(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    loadingRegistry.value = true;
    error.value = '';
    try {
        const store = createRegistryStore(mission);
        registry.value = await store.load();

        const sub = await loadSchemaSubscription(mission);
        const { schema } = await loadMissionSchema(sub);
        segments.value = segmentsFromSchema(schema);
        debriefs.value = await createDebriefStore(mission).load();
        assignments.value = await createAssignmentStore(mission).load();
        resources.value = (await loadResourceAssignmentsFromMission(mission)).assignments;

        if (!opChannels.value.length) {
            opChannels.value = await missionChannels(mission.guid);
        }
        if (!isSearchIncident.value) await loadFeatureTargets();
        if (!currentOp.value) await loadMissionTemplates();

        if (currentOp.value) {
            debriefForm.opNumber = currentOp.value.opNumber;
            await ensureOpOverlay(currentOp.value);
            await refreshSubscribers();
        } else if (registry.value.length) {
            debriefForm.opNumber = registry.value[registry.value.length - 1].opNumber;
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingRegistry.value = false;
    }
}

async function refreshSubscribers(): Promise<void> {
    const op = currentOp.value;
    if (!op) return;
    loadingSubscribers.value = true;
    try {
        subscribers.value = await gateway.listSubscribers(op);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingSubscribers.value = false;
    }
}

async function onOpenOp(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        if (!missionTemplates.value.length) await loadMissionTemplates();
        const keywords = opCreateKeywords();
        const entry = await openOperationalPeriod(
            { registry: createRegistryStore(mission), gateway },
            {
                incidentName: mission.name,
                channels: opChannels.value,
                keywords: keywords.length ? keywords : undefined,
            },
        );
        await ensureOpOverlay(entry);
        // The new OP becomes the working mission: clues/logs land there by default.
        await makeMapActive(entry.guid, entry.name);
        // Every OP carries the incident IPP (idempotent per-OP uid).
        let ippNote = '';
        try {
            const ippUid = await publishIppToOp(mission, entry);
            ippNote = ippUid ? ' IPP published.' : ' No IPP set yet — publish it from Search Area, then reopen this pane.';
        } catch (ippErr) {
            ippNote = ` IPP publish failed: ${ippErr instanceof Error ? ippErr.message : String(ippErr)}`;
        }
        notice.value = `Opened ${entry.name}.${ippNote}`;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onCloseOp(): Promise<void> {
    const mission = activeMission.value;
    const op = currentOp.value;
    if (!mission?.mgmt || !op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        let retain = await missionChannels(mission.mgmt.guid);
        if (!retain.length) retain = op.channels.length ? [op.channels[0]] : [];
        const closed = await closeOperationalPeriod(
            { registry: createRegistryStore(mission), gateway },
            op,
            { retainChannels: retain },
        );
        notice.value = `Closed ${closed.name}; volunteers demoted and field channels removed.`;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

const mapStore = useMapStore();

/**
 * Make a mission the MAP's active mission — where drawn markers, clues, and
 * logs go by default. Distinct from the plugin's incident selection.
 */
async function makeMapActive(guid: string, label: string): Promise<void> {
    try {
        const sub = await mapStore.loadMission(guid);
        if (sub) {
            await mapStore.makeActiveMission(sub);
            notice.value = `${label} is now the active mission — new markers and logs go there.`;
        }
    } catch (err) {
        error.value = `Could not activate ${label}: ${err instanceof Error ? err.message : String(err)}`;
    }
}

/** Incident category (search / wildland-fire / disaster) from mission keywords. */
async function incidentCategory(): Promise<string> {
    const mission = activeMission.value;
    if (!mission) return 'search';
    if (mission.incidentType) return mission.incidentType;
    try {
        const sub = await Subscription.load(mission.guid, {
            missiontoken: mission.missionToken || undefined,
            reload: false,
        });
        return parseIncidentTypeFromRecord(sub) || 'search';
    } catch {
        return 'search';
    }
}

/** Open the editable IAP builder for this operational period. */
const iapOp = ref<OpPeriodRegistryEntry | null>(null);
const iapCategory = ref('search');

async function onGenerateIap(op: OpPeriodRegistryEntry): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    error.value = ''; notice.value = '';
    iapCategory.value = await incidentCategory();
    iapOp.value = op;
}

/** Make sure the OP mission renders as a map overlay on this device. */
async function ensureOpOverlay(op: OpPeriodRegistryEntry): Promise<void> {
    try {
        if (OverlayManager.loadedByMode('mission', op.guid)) return;
        await OverlayManager.createLoaded({
            name: op.name,
            url: `/mission/${encodeURIComponent(op.guid)}`,
            type: 'geojson',
            mode: 'mission',
            mode_id: op.guid,
            token: op.ownerToken,
        });
    } catch (err) {
        console.warn('Failed to attach OP overlay', op.name, err);
    }
}

/** Re-publish the incident IPP into the current OP (idempotent — same uid). */
async function onPublishIpp(): Promise<void> {
    const mission = activeMission.value;
    const op = currentOp.value;
    if (!mission?.mgmt || !op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const uid = await publishIppToOp(mission, op);
        notice.value = uid
            ? `Published IPP to ${op.name}.`
            : 'No IPP found on the incident map — set it in Search Area first.';
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onPublishAssignments(): Promise<void> {
    const mission = activeMission.value;
    const op = currentOp.value;
    if (!mission?.mgmt || !op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const published = await publishAssignments({
            // Pass the registry so a target drawn on an OP sync (common on
            // non-search incidents) is still resolvable.
            geometry: createSegmentGeometrySource(mission, registry.value),
            publisher: createOpFeaturePublisher(),
            assignments: createAssignmentStore(mission),
        }, op, {
            segmentUids: selectedSegments.value,
            team: assignTeam.value,
            notes: assignNotes.value,
        });
        notice.value = `Published ${published.length} assignment${published.length === 1 ? '' : 's'} to ${op.name}.`;
        selectedSegments.value = [];
        assignTeam.value = '';
        assignNotes.value = '';
        assignments.value = await createAssignmentStore(mission).load();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

async function onCheckIn(sub: { clientUid: string; username: string }): Promise<void> {
    const op = currentOp.value;
    if (!op) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        await checkInSubscriber(gateway, op, sub);
        notice.value = `Checked in ${sub.username}.`;
        await refreshSubscribers();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

// ── Influence of Clue (ISM 8.17/8.18) ──────────────────────────────────
const CLUE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
/** ISM Table 8.17 — anchor letters have text; B/D/F/H are in-between. */
const CLUE_SCALE: Record<string, string> = {
    A: 'Clue strongly suggests subject is in this segment',
    C: 'Clue suggests subject is in this segment',
    E: 'Clue suggests nothing about the subject being in or out of this segment',
    G: 'Clue suggests subject is not in this segment',
    I: 'Clue strongly suggests subject is not in this segment',
};
const clueFormOpen = ref(false);
const clueForm = reactive({
    description: '',
    authIndex: 0,
    xref: '',
    opNumber: 1,
    letters: { ROW: 'E' } as Record<string, string>,
});
const cluePointOptions = ref<{ uid: string; callsign: string }[]>([]);

/** R.O.W. first, then segments in ascending (numeric-aware) label order. */
const clueLetterRows = computed(() => [
    { key: 'ROW', label: 'R.O.W.' },
    ...segmentUids.value
        .map((uid) => ({ key: uid, label: segmentLabel(uid) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
]);

function clueLetterHint(letter: string): string {
    if (letter === 'A') return 'Clue strongly suggests subject IS in this segment';
    if (letter === 'C') return 'Clue suggests subject is in this segment';
    if (letter === 'E') return 'Clue says nothing about this segment';
    if (letter === 'G') return 'Clue suggests subject is NOT in this segment';
    if (letter === 'I') return 'Clue strongly suggests subject is NOT in this segment';
    return `Between ${String.fromCharCode(letter.charCodeAt(0) - 1)} and ${String.fromCharCode(letter.charCodeAt(0) + 1)}`;
}

function openClueForm(): void {
    const op = currentOp.value;
    if (!op) return;
    clueForm.description = '';
    clueForm.authIndex = 0;
    clueForm.xref = '';
    clueForm.opNumber = op.opNumber;
    clueForm.letters = { ROW: 'E' };
    for (const uid of segmentUids.value) clueForm.letters[uid] = 'E';
    clueFormOpen.value = true;
    void loadCluePoints();
}

/** Point markers in the current OP sync — likely field-reported clues. */
async function loadCluePoints(): Promise<void> {
    const op = currentOp.value;
    if (!op) return;
    try {
        const sub = await Subscription.load(op.guid, {
            missiontoken: op.ownerToken || undefined,
            reload: false,
        });
        const feats = await sub.feature.list({ refresh: true }) as unknown as {
            id?: string | number;
            properties?: { callsign?: string };
            geometry?: { type?: string };
        }[];
        cluePointOptions.value = feats
            .filter((f) => f.geometry?.type === 'Point' && f.properties?.callsign)
            .map((f) => ({ uid: String(f.id ?? ''), callsign: f.properties!.callsign! }));
    } catch {
        cluePointOptions.value = [];
    }
}

function onCluePointPick(event: Event): void {
    const callsign = (event.target as HTMLSelectElement).value;
    if (callsign) clueForm.description = callsign;
}

async function onAcceptClue(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !clueForm.description.trim()) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const auth = CLUE_AUTHENTICITY_OPTIONS[clueForm.authIndex];
        await addClueToMission(mission, {
            opNumber: clueForm.opNumber,
            description: clueForm.description.trim(),
            authenticity: auth.alpha,
            authenticityLabel: auth.label,
            letters: { ...clueForm.letters },
            xref: clueForm.xref.trim() || undefined,
        }, Object.fromEntries(segmentUids.value.map((uid) => [uid, segmentLabel(uid)])));
        notice.value = `Clue influence recorded: "${clueForm.description.trim()}" (${auth.label}). CASIE POAs updated.`;
        clueFormOpen.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

// ── Incomplete-segment split prompt (ISM) ──────────────────────────────
const splitPrompt = ref<{ label: string; completedPct: number } | null>(null);
const splitRetainedPct = ref('');
const splitNewName = ref('');

interface RemainderCandidate {
    uid: string;
    callsign: string;
    source: string;
    sourceGuid: string;
    sourceToken?: string;
    onMgmt: boolean;
    geometry: unknown;
    areaSqMi?: number;
    style?: { stroke?: string; fill?: string };
}

/**
 * Next segment name in numeric sequence: highest integer callsign + 1,
 * zero-padded to the prevailing width (e.g. segments 01–04 → "05").
 */
function nextSegmentName(): string {
    let max = 0;
    let width = 2;
    for (const uid of Object.keys(segments.value)) {
        const callsign = (segments.value[uid]?.callsign ?? '').trim();
        const match = /^(\d+)$/.exec(callsign);
        if (!match) continue;
        const n = Number(match[1]);
        if (n > max) {
            max = n;
            width = match[1].length;
        }
    }
    return String(max + 1).padStart(width, '0');
}

async function flyToCandidate(uid: string): Promise<void> {
    const found = await flyToFeature(uid);
    if (!found) error.value = 'Polygon is not rendered on your map — check its mission overlay is loaded.';
}
const remainderCandidates = ref<RemainderCandidate[]>([]);
const selectedRemainderUid = ref('');
const loadingRemainder = ref(false);

function polyRing(geometry: unknown): [number, number][] | null {
    const geom = geometry as { type?: string; coordinates?: unknown };
    const coords = geom?.type === 'Polygon' ? geom.coordinates
        : geom?.type === 'MultiPolygon' && Array.isArray(geom.coordinates)
            ? (geom.coordinates as unknown[])[0]
            : null;
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
    const ring: [number, number][] = [];
    for (const point of coords[0] as unknown[]) {
        if (!Array.isArray(point) || point.length < 2) return null;
        ring.push([Number(point[0]), Number(point[1])]);
    }
    return ring.length >= 4 ? ring : null;
}

function polyCentroid(ring: [number, number][]): [number, number] {
    let lon = 0; let lat = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return [lon / ring.length, lat / ring.length];
}

/** Unregistered polygons from the common map, MGMT sync, and current OP sync. */
async function loadRemainderCandidates(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    loadingRemainder.value = true;
    try {
        const registered = new Set(segmentUids.value);
        const sources: { label: string; guid: string; token?: string; onMgmt: boolean }[] = [
            { label: 'common map', guid: mission.guid, token: mission.missionToken, onMgmt: false },
            { label: 'MGMT', guid: mission.mgmt.guid, token: mission.mgmt.missionToken, onMgmt: true },
        ];
        if (currentOp.value) {
            sources.push({
                label: currentOp.value.name,
                guid: currentOp.value.guid,
                token: currentOp.value.ownerToken,
                onMgmt: false,
            });
        }
        const found: RemainderCandidate[] = [];
        const seen = new Set<string>();
        for (const source of sources) {
            try {
                const sub = await Subscription.load(source.guid, {
                    missiontoken: source.token || undefined,
                    reload: false,
                });
                const feats = await sub.feature.list({ refresh: true }) as unknown as {
                    id?: string | number;
                    properties?: { callsign?: string; stroke?: string; fill?: string };
                    geometry?: { type?: string };
                }[];
                for (const f of feats) {
                    const uid = String(f.id ?? '');
                    const type = f.geometry?.type;
                    if (!uid || seen.has(uid) || registered.has(uid)) continue;
                    if (type !== 'Polygon' && type !== 'MultiPolygon') continue;
                    seen.add(uid);
                    found.push({
                        uid,
                        callsign: f.properties?.callsign || uid,
                        source: source.label,
                        sourceGuid: source.guid,
                        sourceToken: source.token,
                        onMgmt: source.onMgmt,
                        geometry: f.geometry,
                        areaSqMi: areaSqMi(f.geometry),
                        style: { stroke: f.properties?.stroke, fill: f.properties?.fill },
                    });
                }
            } catch { /* source unreachable — skip */ }
        }
        remainderCandidates.value = found;
    } finally {
        loadingRemainder.value = false;
    }
}

// Selecting a drawn polygon adopts its callsign as the new segment name.
watch(selectedRemainderUid, (uid) => {
    const candidate = remainderCandidates.value.find((c) => c.uid === uid);
    if (candidate) splitNewName.value = candidate.callsign;
});

/**
 * Resolve the remainder segment identity: when a drawn polygon is selected it
 * is moved to the MGMT sync (segments' home) and its uid is used; otherwise a
 * fresh uid registers a polygon-less segment.
 */
async function resolveRemainder(): Promise<{ uid: string; callsign: string }> {
    const mission = activeMission.value!;
    const callsign = splitNewName.value.trim();
    const candidate = remainderCandidates.value.find((c) => c.uid === selectedRemainderUid.value);
    if (!candidate) return { uid: globalThis.crypto.randomUUID(), callsign };
    if (candidate.onMgmt) return { uid: candidate.uid, callsign };

    const ring = polyRing(candidate.geometry);
    if (!ring) return { uid: globalThis.crypto.randomUUID(), callsign };
    const planning = schemaMission(mission);
    const newUid = await pushPolygonToMission({
        missionGuid: planning.guid,
        missionToken: planning.missionToken,
        callsign,
        ring,
        center: polyCentroid(ring),
        style: candidate.style,
    });
    try {
        await deletePolygonFromMission({
            missionGuid: candidate.sourceGuid,
            uid: candidate.uid,
            missiontoken: candidate.sourceToken || undefined,
        });
    } catch { /* stale source copy is cosmetic */ }
    return { uid: newUid, callsign };
}

const splitRemainderPct = computed(() => {
    const retained = Number(splitRetainedPct.value);
    return Number.isFinite(retained) ? Math.round((100 - retained) * 100) / 100 : '—';
});
const splitInputsValid = computed(() => {
    const retained = Number(splitRetainedPct.value);
    return Number.isFinite(retained) && retained > 0 && retained < 100
        && splitNewName.value.trim().length > 0;
});

function buildDebriefRecord(): DebriefRecord {
    const record: DebriefRecord = {
        opNumber: debriefForm.opNumber,
        segmentUid: debriefForm.segmentUid,
        // Snapshot the label: non-search targets have no registry, so the CoT
        // can be renamed or deleted and the case file must still read.
        label: segmentLabel(debriefForm.segmentUid),
    };
    // POD is search-only — left absent rather than 0 so a reader can tell
    // "not applicable" from "searched and found nothing".
    if (isSearchIncident.value) record.pod = Number(debriefForm.pod);
    const coveragePct = debriefForm.coverage.trim();
    if (coveragePct) record.coverage = Number(coveragePct) / 100;
    if (debriefForm.resource.trim()) record.resource = debriefForm.resource.trim();
    if (debriefForm.notes.trim()) record.notes = debriefForm.notes.trim();
    return record;
}

async function saveDebriefRecord(record: DebriefRecord, note: string): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;
    await recordDebrief(createDebriefStore(mission), record);
    notice.value = note;
    debriefForm.pod = '';
    debriefForm.coverage = '';
    debriefForm.notes = '';
    debriefs.value = await createDebriefStore(mission).load();
}

async function onRecordDebrief(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt) return;

    // Incomplete segment → ISM split prompt before recording. Search only:
    // splitting redistributes POA between parent and remainder, which is a
    // CASIE concept with no meaning on a fire or a disaster.
    const coveragePct = Number(debriefForm.coverage.trim() || '100');
    if (isSearchIncident.value
        && Number.isFinite(coveragePct) && coveragePct > 0 && coveragePct < 100) {
        const label = segmentLabel(debriefForm.segmentUid);
        splitRetainedPct.value = String(coveragePct);
        splitNewName.value = nextSegmentName();
        selectedRemainderUid.value = '';
        splitPrompt.value = { label, completedPct: coveragePct };
        void loadRemainderCandidates();
        return;
    }

    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const record = buildDebriefRecord();
        await saveDebriefRecord(record, record.pod !== undefined
            ? `Recorded POD ${record.pod}% for ${segmentLabel(record.segmentUid)}.`
            : `Recorded completed assignment for ${segmentLabel(record.segmentUid)}.`);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

/** Split: parent keeps retained POA + gets the POD at full coverage; remainder becomes a new segment. */
async function onSplitYes(): Promise<void> {
    const mission = activeMission.value;
    if (!mission?.mgmt || !splitPrompt.value) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const parentUid = debriefForm.segmentUid;
        const parentLabel = segmentLabel(parentUid);
        const remainder = await resolveRemainder();
        const newName = remainder.callsign;
        await carveSegmentRemainder(mission, parentUid, Number(splitRetainedPct.value) / 100, remainder);
        const record = buildDebriefRecord();
        delete record.coverage; // reduced segment was fully searched
        await saveDebriefRecord(
            record,
            `Split ${parentLabel} (${splitRetainedPct.value}% POA retained, remainder → ${newName}) and recorded POD ${record.pod}%.`,
        );
        splitPrompt.value = null;
        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

/** No split: record with partial coverage as entered (POD scaled by coverage). */
async function onSplitNo(): Promise<void> {
    if (!splitPrompt.value) return;
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
        const record = buildDebriefRecord();
        await saveDebriefRecord(
            record,
            `Recorded POD ${record.pod}% over ${splitPrompt.value.completedPct}% of ${segmentLabel(record.segmentUid)}.`,
        );
        splitPrompt.value = null;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        busy.value = false;
    }
}

// ── GPS track logs ──────────────────────────────────────────────────────────
// A track log is the breadcrumb trail behind a reported POD, so it hangs off
// the completed assignment rather than floating on the map. Tracks are filed
// into the OP sync's "Track Logs" folder (created with the OP), which means the
// field sees their own coverage and the tracks travel with that OP's mission
// archive in the demob package.

const trackPublisher = createTrackLogPublisher();
const trackPanel = ref<{
    key: string;
    label: string;
    record: DebriefRecord;
    op: OpPeriodRegistryEntry | undefined;
} | null>(null);
const trackCandidates = ref<TrackCandidate[]>([]);
const loadingTracks = ref(false);
const trackBusy = ref(false);
/**
 * A single-track file waiting on a name. Files with several tracks skip this
 * and auto-name each one — naming five lines in a row is worse than the
 * generic names it would fix.
 */
const pendingTrack = ref<{
    track: ParsedTrack;
    source: string;
    sourceName: string;
    lengthMi: number;
    callsign: string;
} | null>(null);

/** Exposed to the template — records have no id, so identity is derived. */
function debriefKeyOf(record: DebriefRecord): string {
    return debriefKey(record);
}

function toggleTrackPanel(record: DebriefRecord): void {
    const key = debriefKey(record);
    if (trackPanel.value?.key === key) {
        trackPanel.value = null;
        return;
    }
    trackCandidates.value = [];
    pendingTrack.value = null;
    trackPanel.value = {
        key,
        label: `OP${record.opNumber} · ${segmentLabel(record.segmentUid)}`
            + (record.resource ? ` · ${record.resource}` : ''),
        record,
        op: registry.value.find((o) => o.opNumber === record.opNumber),
    };
    void loadTrackCandidates();
}

async function loadTrackCandidates(): Promise<void> {
    const mission = activeMission.value;
    const panel = trackPanel.value;
    if (!mission || !panel?.op) return;
    loadingTracks.value = true;
    try {
        trackCandidates.value = await listTrackCandidates(mission, panel.op, debriefs.value);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loadingTracks.value = false;
    }
}

/**
 * Attach one or more parsed tracks to the panel's record, then reload the
 * debrief list so the new references render. Each track is published and
 * recorded in turn — a partial success leaves the earlier tracks attached,
 * which is better than rolling back CoTs that already reached the field.
 */
async function attachTracks(
    tracks: { track: ParsedTrack; existingUid?: string; callsign?: string }[],
    source: string,
): Promise<void> {
    const mission = activeMission.value;
    const panel = trackPanel.value;
    if (!mission || !panel?.op) return;

    trackBusy.value = true;
    error.value = ''; notice.value = '';
    try {
        const deps = {
            gateway,
            publisher: trackPublisher,
            debriefs: createDebriefStore(mission),
        };
        // Re-read the record: the panel captured it when it opened, and
        // attaching a second track must build on the first, not replace it.
        let record = panel.record;
        const fresh = (await deps.debriefs.load()).find((r) => debriefKey(r) === panel.key);
        if (fresh) record = fresh;

        let attached = 0;
        for (const [index, entry] of tracks.entries()) {
            const trackRef = await attachTrackLog(deps, panel.op, record, {
                track: entry.track,
                source,
                segmentLabel: segmentLabel(record.segmentUid),
                callsign: entry.callsign,
                existingUid: entry.existingUid,
                index: index + 1,
                total: tracks.length,
            });
            record = { ...record, tracks: [...(record.tracks ?? []), trackRef] };
            attached += 1;
        }

        await refresh();
        trackCandidates.value = [];
        void loadTrackCandidates();
        notice.value = `Attached ${attached} track${attached === 1 ? '' : 's'} to ${panel.label}.`;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        trackBusy.value = false;
    }
}

/**
 * Parse the chosen file. A file holding exactly ONE track pauses for a name —
 * handheld GPS units export generic names ("Track 001", "ACTIVE LOG 003"), and
 * an assignment commonly has several tracks (one per unit carried) that have to
 * be told apart on the map. Multi-track files attach straight through with
 * derived names; naming each of five lines is worse than the problem.
 */
async function onTrackFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const panel = trackPanel.value;
    if (!file || !panel?.op) return;
    pendingTrack.value = null;
    error.value = '';
    try {
        const parsed = await readTrackFile(file);
        if (parsed.length === 1) {
            const track = parsed[0];
            const record = debriefs.value.find((r) => debriefKey(r) === panel.key) ?? panel.record;
            pendingTrack.value = {
                track,
                source: file.name,
                sourceName: track.name,
                lengthMi: Math.round(trackLengthMiles(track.coords) * 100) / 100,
                // Seed with what we would have published anyway, then let it
                // be rewritten however the manager wants.
                callsign: trackLogCallsign({
                    opNumber: panel.op.opNumber,
                    segmentLabel: segmentLabel(record.segmentUid),
                    resource: record.resource,
                    sourceName: track.name,
                }),
            };
            return;
        }
        await attachTracks(parsed.map((track) => ({ track })), file.name);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        // Clear so re-selecting the same file fires `change` again.
        input.value = '';
    }
}

async function onConfirmPendingTrack(): Promise<void> {
    const pending = pendingTrack.value;
    if (!pending || !pending.callsign.trim()) return;
    await attachTracks(
        [{ track: pending.track, callsign: pending.callsign }],
        pending.source,
    );
    pendingTrack.value = null;
}

async function onAttachCandidate(candidate: TrackCandidate): Promise<void> {
    await attachTracks([candidateToTrack(candidate)], 'map');
}

async function onDetachTrack(record: DebriefRecord, uid: string): Promise<void> {
    const mission = activeMission.value;
    if (!mission) return;
    trackBusy.value = true;
    error.value = ''; notice.value = '';
    try {
        await detachTrackLog(createDebriefStore(mission), record, uid);
        await refresh();
        if (trackPanel.value) void loadTrackCandidates();
        notice.value = 'Track detached. The line is still in the OP sync\'s Track Logs folder.';
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        trackBusy.value = false;
    }
}

onMounted(refresh);
watch(() => activeMission.value?.guid, refresh);
</script>
