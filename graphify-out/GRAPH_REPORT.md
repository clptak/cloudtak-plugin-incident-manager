# Graph Report - cloudtak-plugin-incident-manager  (2026-10-18)

## Corpus Check
- 307 files · ~242,185 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 7, .css 3, .log 1)

## Summary
- 4268 nodes · 10188 edges · 145 communities (143 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 223 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Search Area Map Tools
- Area Search Schema Reload
- Area Search Assignments
- WiSAR TARR Form
- ICS 202 Objectives Form
- Dashboard Initial Information
- CASIE Split and Expand
- Mission Properties Storage
- Chip Bar Minimize
- Plugin Settings Pane
- Subject Information Form
- LPB Distance Table
- WiSAR API Client
- Risk Assessment Pane
- Organization Chart Tab
- Subject Briefing Coordinates
- Dashboard Track Logs
- Search Urgency Rating
- Plugin Package Dependencies
- PDF Library Core
- Search Scenarios Pane
- POA Lock Card
- ICS 201 Form Model
- CASIE Segmentation Actions
- Resource Assignments Tab
- Hasty Team Org Chart
- Complacency and SPE Risk
- Subject Profile Settings
- WiSAR Results Pane
- Debrief Records
- PDF AcroForm Types
- Assignment Publishing
- ICS 201 Editor
- Track Log Geometry
- Dashboard PDF Export
- CASIE Consensus Rollup
- IR Briefing Pane
- Mission Property Keys
- Clue Log Pane
- Dashboard Directory Users
- Physical WiSAR Pane
- Create Open Mission
- Incident Navigation Shell
- Urgency Chart PDF
- Plugin Entry Point
- WiSAR Contour DataSync
- Org Chart DataSync Sync
- Live Incident Watcher
- Help Content Imports
- Incident Pane Navigation
- ICS Position Palettes
- ICS 201 PDF Layout
- Initial Consensus Pane
- Operational Period Ports
- SAR Briefing Modern PDF
- Work Assignment Rows
- Open Existing Mission
- Incident Post Objectives
- Responder Consensus Modal
- IAP Form Templates
- ICS 234 PDF Drawing
- Area Search Debrief Editing
- Mission Schema Defaults
- Dashboard Risk Actions
- WiSAR Travel Time Form
- Mission Template Logs
- WC3 Consensus Export
- IAP Builder Pane
- Subject Profile Uploads
- Demobilization Package
- Scenarios Record Sheet PDF
- WiSAR Content Modal
- IAP Form Plan
- Plugin Dev Dependencies
- SAR Briefing PDF
- D4H Roster
- Default IPP Resolver
- Operational Period Status
- In-memory Mission Properties
- Org Chart Drag and Drop
- IAP Plan Persistence
- Incident Post Save
- WiSAR Overlay Keep
- Incident Changed Banner
- Settings Folder Target
- Debrief Property Keys
- WiSAR Map Preview
- Mission Template Log Modal
- Consensus Table UI
- Collection Property Keys
- Task Checklists
- Logger Pane Sections
- Resource Assignment State
- MPS CAD Parser
- PDF Library Helpers
- WiSAR Job Client
- Personnel Settings
- Demob Manifest
- CASIE Tests
- Schema Property Backend
- Assignment Resources
- Work Assignment State
- WiSAR Overlay Layers
- TypeScript Config
- Objective Strategies Editor
- Search Scenario Model
- Schema Storage Card
- Consensus Setup Modal
- Incident Post Rows
- Deployment Defaults
- Local Date and Mission Name
- Assignment Row Editing
- Mission File Upload
- WiSAR Tools Float
- ICS 234 Datetime
- IAP Form Selection
- Org Chart Persistence
- PDF Library Encoding
- Create Mission Map Confirm
- Map Fly To
- Risk Factor Labels
- Scenario PDF Header
- CalTopo Map Create
- ICS 201 Persistence
- PDF Library Glyphs A
- PDF Library Glyphs B
- Work Assignment Persist
- Dashboard Risk Severity
- Risk Tactic Labels
- PDF Library Strings
- PDF Library Paths
- Feature Callsign Cell
- GAR Score
- Scenario PDF Download
- WiSAR URL Settings
- Work Assignment Schema
- Asset Import Types
- PDF Library Streams
- PDF Library Images
- PDF Library Text
- Assignment Phase Log
- Mission IPP Location
- PDF Library Fonts
- Docker Check Script
- PDF Library Pair

## God Nodes (most connected - your core abstractions)
1. `loadSchemaSubscription()` - 120 edges
2. `loadMissionSchema()` - 97 edges
3. `vue` - 66 edges
4. `saveMissionSchema()` - 55 edges
5. `requireActiveMission()` - 54 edges
6. `useIncident()` - 54 edges
7. `schemaMissionToken()` - 54 edges
8. `@tak-ps/vue-tabler` - 45 edges
9. `ActiveMission` - 41 edges
10. `@tabler/icons-vue` - 40 edges

## Surprising Connections (you probably didn't know these)
- `TARR ring labels use applied distance` --semantically_similar_to--> `Statistical Method`  [INFERRED] [semantically similar]
  wisar-tarr-ring-labels.md → src/content/help/establishing_search_area_2_statistical.md
- `ICS-201 Resource Summary` --conceptually_related_to--> `Operational period plan, activate, and close`  [INFERRED]
  src/content/help/resource_summary.md → docs/decisions/ADR-002-operational-period-lifecycle.md
- `Segment size` --conceptually_related_to--> `Operational period plan, activate, and close`  [INFERRED]
  src/content/help/segmenting.md → docs/decisions/ADR-002-operational-period-lifecycle.md
- `In-app help versus MkDocs` --references--> `Area Search`  [INFERRED]
  docs/index.md → src/content/help/area_search.md
- `Vendored pdf-lib` --conceptually_related_to--> `Local plugin checkout skips WEB_PLUGINS clone`  [INFERRED]
  src/vendor/README.md → README.md

## Import Cycles
- 3-file cycle: `src/components/ClueTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue -> src/components/ClueTaskbarChip.vue`
- 3-file cycle: `src/components/AssignmentsTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue -> src/components/AssignmentsTaskbarChip.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/IncidentManagerTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/LpbTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/ResourcesTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/SegmentsTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`

## Hyperedges (group relationships)
- **Four methods intersect to bound the search area** — src_content_help_establishing_search_area_0_main_establishing_the_search_area, src_content_help_establishing_search_area_1_theoretical_theoretical_method, src_content_help_establishing_search_area_2_statistical_statistical_method, src_content_help_establishing_search_area_3_subjective_subjective_method, src_content_help_establishing_search_area_4_deductive_deductive_method [EXTRACTED 1.00]
- **Route search through segmentation and consensus to area search** — src_content_help_route_and_location_search_route_and_location_search, src_content_help_route_and_location_search_hasty_search, src_content_help_establishing_search_area_0_main_establishing_the_search_area, src_content_help_segmenting_segmenting_the_search_area, src_content_help_consensus_summary_initial_consensus, src_content_help_area_search_area_searches [INFERRED 0.95]
- **POA lock, debrief corrections, and property history** — docs_decisions_adr_003_poa_lock_and_debrief_corrections_poa_lock, docs_decisions_adr_003_poa_lock_and_debrief_corrections_debrief_correction, docs_decisions_adr_003_poa_lock_and_debrief_corrections_cumulative_pod, docs_decisions_adr_001_incident_data_on_mission_properties_adr_001_store_incident_planning_data_as_tak_mission_properties [EXTRACTED 1.00]
- **Incident Action Plan components listed on ICS 202** — src_assets_iap_ics202_incident_objectives, src_assets_iap_ics202_incident_action_plan, src_assets_iap_ics203_organization_assignment_list, src_assets_iap_ics204_assignment_list, src_assets_iap_ics205_radio_communications_plan, src_assets_iap_ics205a_communications_list, src_assets_iap_ics206_medical_plan, src_assets_iap_ics207_incident_organization_chart, src_assets_iap_ics208_safety_message_plan [EXTRACTED 1.00]
- **Objectives decomposed into strategies, tactics, and division assignments** — src_assets_iap_ics202_incident_objectives, src_assets_ics_234_template_work_analysis_matrix, src_assets_ics_234_template_ics_202_cg, src_assets_iap_ics204_assignment_list, src_assets_iap_ics204_operational_planning_worksheet, src_assets_ics_234_template_ics_215_cg [INFERRED 0.85]
- **Activated ICS organization on the briefing, assignment list, and wall chart** — src_assets_ics_201_template_incident_briefing, src_assets_iap_ics203_organization_assignment_list, src_assets_iap_ics207_incident_organization_chart [INFERRED 0.85]

## Communities (145 total, 2 thin omitted)

### Community 0 - "Search Area Map Tools"
Cohesion: 0.02
Nodes (115): { activeMission, requireActiveMission }, addCustomRange(), addDeductive(), addSubjective(), availableRowPolygons, canAddDeductive, canAddSubjective, canPushCustomLpb (+107 more)

### Community 1 - "Area Search Schema Reload"
Cohesion: 0.07
Nodes (83): reloadLists(), loadIncidentInfo(), loadSchemaSub(), loadSub(), postLogs(), saveIncidentInfo(), syncSchemaFromForm(), loadSchemaPrefills() (+75 more)

### Community 2 - "Area Search Assignments"
Cohesion: 0.03
Nodes (85): { activeMission, isSearchIncident }, assignedThisOp, assignments, assignNotes, assignTeam, busy, closeIap(), CLUE_LETTERS (+77 more)

### Community 3 - "WiSAR TARR Form"
Cohesion: 0.04
Nodes (70): arizonaBlocked, arizonaRow, arizonaRows, baseValues, busy, calibration, category, categoryNames (+62 more)

### Community 4 - "ICS 202 Objectives Form"
Cohesion: 0.05
Nodes (72): Command and General Staff Meeting, Documentation Unit, Incident Action Plan, Incident Commander, ICS 202 Incident Objectives, IAP Map or Chart, Operational Period, Planning Section (+64 more)

### Community 5 - "Dashboard Initial Information"
Cohesion: 0.04
Nodes (68): initialInfoRows, { activeMission, setActiveMission, requireActiveMission }, allSelected, applySubjectNameSuggestion(), cadText, cfsExpanded, demaInvalid, incidentForm (+60 more)

### Community 6 - "CASIE Split and Expand"
Cohesion: 0.03
Nodes (60): { activeMission, casieExpandRequested }, auditTrail, buildSplitRows(), canBuildSplit, cancelSplit(), canCompute, computeDraft(), deleteScenario() (+52 more)

### Community 7 - "Mission Properties Storage"
Cohesion: 0.05
Nodes (24): MGMT DataSync, mission_schema.json, Cumulative POD and POA update, IAP and briefing PDF exports, In-app help versus MkDocs, MkDocs documentation site, main and ccso branches, Logger and Dashboard features (+16 more)

### Community 8 - "Chip Bar Minimize"
Cohesion: 0.06
Nodes (57): { activeMission }, attachObservers(), dragging, dragOrigin, hidden, hideBar(), isUndocked, laidOut (+49 more)

### Community 9 - "Plugin Settings Pane"
Cohesion: 0.04
Nodes (54): agencyFileInput, agencyUploadError, aidingAgenciesDirty, choosingFolder, clearPersonnel(), d4hAgencyCount, d4hMemberCount, deploymentConfigured (+46 more)

### Community 10 - "Subject Information Form"
Cohesion: 0.05
Nodes (45): { activeMission, requireActiveMission }, addSubject(), availableNumbers, blankForm(), displayNumber(), drafts, draftSummary(), effectiveAge() (+37 more)

### Community 11 - "LPB Distance Table"
Cohesion: 0.06
Nodes (53): { activeMission, requireActiveMission }, canPlot, closeModal(), error, filter, filteredRows, ippCenter, ippInput (+45 more)

### Community 12 - "WiSAR API Client"
Cohesion: 0.05
Nodes (46): abortError(), checkWisarConnection(), ConnectionCheck, ConnectionStatus, CONTENT_IDS, ContourProperties, createWisarClient(), getJob() (+38 more)

### Community 13 - "Risk Assessment Pane"
Cohesion: 0.05
Nodes (48): { activeMission, requireActiveMission }, assessments, assignmentOptions, { assignments, loadForMission }, blankGarFactors(), blankGarMitigations(), busy, clearCompRespondentFields() (+40 more)

### Community 14 - "Organization Chart Tab"
Cohesion: 0.04
Nodes (51): { activeMission, requireActiveMission }, { assignments: resourceAssignments, loadForMission: loadResourceAssignments, updateAssignment: updateResourceAssignment }, assignmentSelectLabel, configurationMembers, emptyPersonnelDescription, emptyPersonnelTitle, filteredMissionCots, filteredRescueGroupLabels (+43 more)

### Community 15 - "Subject Briefing Coordinates"
Cohesion: 0.07
Nodes (51): onDobChange(), onYesNoLabelChange(), SentSubject, SubjectDraft, subject(), BRIEFING_SUBJECT_NUMBERS, DEFAULT_SAFETY_MESSAGE, IrBriefingSources (+43 more)

### Community 16 - "Dashboard Track Logs"
Cohesion: 0.08
Nodes (48): refresh(), attachFileTracks(), attachTracks(), ensureOpOverlay(), loadFeatureTargets(), loadMissionTemplates(), loadTrackCandidates(), missionChannels() (+40 more)

### Community 17 - "Search Urgency Rating"
Cohesion: 0.05
Nodes (49): { activeMission, requireActiveMission }, addPdfToDataSync(), applyFactors(), blankPdfHeader(), clampedTotal, contentHash, currentFactors(), downloadPdf() (+41 more)

### Community 18 - "Plugin Package Dependencies"
Cohesion: 0.07
Nodes (38): @tabler/icons-vue, openAssignments(), { selectKeyGuarded }, openClueLog(), { selectHTabGuarded, isSearchIncident }, emit, openLpb(), { selectKeyGuarded, isSearchMission } (+30 more)

### Community 19 - "PDF Library Core"
Cohesion: 0.05
Nodes (20): ao(), Be(), Da(), Ei(), Ia(), Ii(), It(), kr() (+12 more)

### Community 20 - "Search Scenarios Pane"
Cohesion: 0.05
Nodes (45): { activeMission, requireActiveMission }, applyScenarioToDraft(), availableLetters, blankDraft(), buildKeywords(), cancelEdit(), contentHash, Draft (+37 more)

### Community 21 - "POA Lock Card"
Cohesion: 0.08
Nodes (42): { activeMission }, busy, error, latest, loadLocks(), lockInputs, locks, onLock() (+34 more)

### Community 22 - "ICS 201 Form Model"
Cohesion: 0.08
Nodes (50): actionCapacity, actionRowCapacity(), actionRowsHaveContent(), actionsFromLogsAndPost(), applyPartialIcs201Form(), blankActionRow(), blankIcs201Form(), blankResourceRow() (+42 more)

### Community 23 - "CASIE Segmentation Actions"
Cohesion: 0.07
Nodes (44): applyExpansion(), applySplit(), refresh(), uidForPolygon(), addPdfToDataSync(), addRowSegments(), removeRowSegment(), addPdfToDataSync() (+36 more)

### Community 24 - "Resource Assignments Tab"
Cohesion: 0.05
Nodes (43): { activeMission, requireActiveMission, selectHTabGuarded }, agencyFormOptions, agencyOptions, applyEffectiveDefaultToForm(), {
    assignments,
    defaultAgency,
    loading,
    saving,
    statusMessage,
    statusError,
    blankResourceAssignmentForm,
    loadForMission,
    addAssignment,
    removeAssignment,
    updateAssignment,
    updateDefaultAgency,
}, canCreate, d4hContextName, d4hExternalResources (+35 more)

### Community 25 - "Hasty Team Org Chart"
Cohesion: 0.05
Nodes (42): BlockSlotProps, childOuterWidth, childrenBandStyle, childrenEndX, childrenStartX, childSubtreeWidths, connectorBandStyle, containerRef (+34 more)

### Community 26 - "Complacency and SPE Risk"
Cohesion: 0.08
Nodes (42): compResult, speResult, BAND_SEVERITY, ComplacencyRiskEntry, ComplacencyRiskMap, ComplacencyRiskRespondent, CONFIDENCE_OPTIONS, EXPERIENCE_OPTIONS (+34 more)

### Community 27 - "Subject Profile Settings"
Cohesion: 0.11
Nodes (42): onSubjectFileChange(), BUNDLED_LPB_TABLE, state, D4HMember, applyDeploymentDefaults(), AzlpbEntry, defaultPluginSettings(), deploymentFromConfig() (+34 more)

### Community 28 - "WiSAR Results Pane"
Cohesion: 0.06
Nodes (40): { activeMission }, addError, adding, addStatus, addToDataSync(), chosen(), { client }, contours (+32 more)

### Community 29 - "Debrief Records"
Cohesion: 0.07
Nodes (27): correctedDebrief(), resourceId(), sameResourceDebriefs(), OpAssignment, AssignmentStore, DebriefStore, closeRegistryEntry(), MAX_TRACK_POINTS (+19 more)

### Community 30 - "PDF AcroForm Types"
Cohesion: 0.04
Nodes (14): PDFAcroField, PDFCheckBox, PDFDocument, PDFEmbeddedPage, PDFField, PDFFont, PDFForm, PDFPage (+6 more)

### Community 31 - "Assignment Publishing"
Cohesion: 0.09
Nodes (36): softEnsureAssignmentFolder(), onPublishAssignments(), ensureMissionFolder(), findLayerByName(), missionFolderDest(), missionLayerHeaders(), persistLocalLayer(), unwrapMissionLayer() (+28 more)

### Community 32 - "ICS 201 Editor"
Cohesion: 0.07
Nodes (40): { activeMission, requireActiveMission }, addActionContinuationPage(), addPdfToDataSync(), addPlannedObjective(), downloadPdf(), ensureObjectiveEditors(), exporting, form (+32 more)

### Community 33 - "Track Log Geometry"
Cohesion: 0.12
Nodes (39): TrackLogRef, coordsFromArray(), douglasPeucker(), finalize(), geoJsonName(), geoJsonTimes(), gpxPoints(), haversineMiles() (+31 more)

### Community 34 - "Dashboard PDF Export"
Cohesion: 0.09
Nodes (41): buildPdf(), addLine(), addText(), addThreeColumnSection(), addWrappedBlock(), ensureSpace(), newPage(), charWidth() (+33 more)

### Community 35 - "CASIE Consensus Rollup"
Cohesion: 0.11
Nodes (32): history, realOpNumbers, ClueRecord, DebriefRecord, RollupResult, SegmentRollup, SegmentState, applyClue() (+24 more)

### Community 36 - "IR Briefing Pane"
Cohesion: 0.07
Nodes (37): { activeMission, requireActiveMission }, addPdfNewToDataSync(), addPdfToDataSync(), downloadPdf(), downloadPdfNew(), exporting, exportingNew, form (+29 more)

### Community 37 - "Mission Property Keys"
Cohesion: 0.11
Nodes (32): MissionPropertyError, isDebriefKey(), META_SCHEMA_KEY, opNumberFromMissionKey(), SCHEMA_VERSION, loadRaw(), byOpNumber(), byRecordedAt() (+24 more)

### Community 38 - "Clue Log Pane"
Cohesion: 0.08
Nodes (38): ClueLog, { activeMission }, busy, clues, error, form, loading, loadingMarkers (+30 more)

### Community 39 - "Dashboard Directory Users"
Cohesion: 0.05
Nodes (37): { activeMission, requireActiveMission }, ALL_IDS, directoryAccess, DirectoryUser, displayRows, displaySource(), emailFromUid(), error (+29 more)

### Community 40 - "Physical WiSAR Pane"
Cohesion: 0.08
Nodes (33): ipp, landsarExpanded, lastJob, wisarExpanded, PhysicalWisar, open, { activeMission }, defaultUid (+25 more)

### Community 41 - "Create Open Mission"
Cohesion: 0.06
Nodes (35): addingLocation, buildKeywords(), caltopoReady, createMission(), CreateOpenCard, derivedName, { enumOptions: subjectProfileEnumOptions }, expandedCard (+27 more)

### Community 42 - "Incident Navigation Shell"
Cohesion: 0.08
Nodes (34): onSelect(), {
    noMissionModalOpen,
    closeNoMissionModal,
    goToCreateOpen,
}, syncMissionToken(), goToExpand(), openLpb(), openSection(), paneOpen, { selectKeyGuarded, isSearchIncident, isSearchMission } (+26 more)

### Community 43 - "Urgency Chart PDF"
Cohesion: 0.11
Nodes (38): toPdfWinAnsiText(), urgencyLevelFromTotal(), buildUrgencyRatingChartPdf(), COLOR_BOX_STROKE, COLOR_HIGH, COLOR_HIGH_LT, COLOR_LOWER, COLOR_LOWER_LT (+30 more)

### Community 44 - "Plugin Entry Point"
Cohesion: 0.08
Nodes (27): HostFloatComponent, IncidentManagerFloatShell, IncidentManagerPane, IncidentManagerPlugin, MenuItemConfig, MenuItemIconType, _typecheck, bindFloatMinimize() (+19 more)

### Community 45 - "WiSAR Contour DataSync"
Cohesion: 0.11
Nodes (33): rank(), recallRows, ContourFeature, Job, addContoursToDataSync(), DataSyncAddResult, LogApi, compareWisarAreas() (+25 more)

### Community 46 - "Org Chart DataSync Sync"
Cohesion: 0.10
Nodes (37): HastyTreeNode, MissionLogLike, existingOrgLogs(), OrgChartLogWriteBody, OrgChartSyncResult, syncOrgChartToDataSync(), upsertOrgLine(), buildCombinedIncidentCommandContent() (+29 more)

### Community 47 - "Live Incident Watcher"
Cohesion: 0.10
Nodes (24): useIncidentChanges(), attach(), incidentWatcher(), onVisible(), ownWrites, pushSubscriber(), watchers, ChangeListener (+16 more)

### Community 48 - "Help Content Imports"
Cohesion: 0.08
Nodes (22): bodyHtml, helpDoc, helpOpen, modalTitle, parsed, props, emit, NavSection (+14 more)

### Community 49 - "Incident Pane Navigation"
Cohesion: 0.08
Nodes (29): {
    activeKey,
    activeHTab,
    activeMission,
    isSearchMission,
    selectHTabGuarded,
    openNoMissionModal,
    isMissionRequiredView,
    restoreActiveMissionOnMap,
}, activeNavLabel, AssignmentsTab, CasiePane, CreateOpenPane, DashboardTab, DEFAULT_SECTION_EXPANDED, expandSectionForActiveKey() (+21 more)

### Community 50 - "ICS Position Palettes"
Cohesion: 0.09
Nodes (29): filteredIcsPositions, filteredRescuePositions, onRolePositionDragStart(), rolePositionPreview(), INCIDENT_COMMAND_POSITIONS, RESCUE_GROUP_LABELS, RESCUE_MANAGEMENT_POSITIONS, RescueGroupLabel (+21 more)

### Community 51 - "ICS 201 PDF Layout"
Cohesion: 0.11
Nodes (33): buildMapSketchText(), collapseActionText(), actionsFieldContentWidth(), actionSheetOutputPageIndex(), BriefingPdfForm, buildIcs201Pdf(), collectPaintJobs(), drawFitted() (+25 more)

### Community 52 - "Initial Consensus Pane"
Cohesion: 0.07
Nodes (32): { activeMission, requireActiveMission }, compareCallsign(), consensus, contentHash, incidentName, loadAll(), loading, onGenerateWc3() (+24 more)

### Community 53 - "Operational Period Ports"
Cohesion: 0.08
Nodes (22): OpPeriodRegistryEntry, AssignmentPayload, MissionContentsUploader, OpFeaturePublisher, OpPeriodGateway, PolygonPayload, PolygonStyle, RegistryStore (+14 more)

### Community 54 - "SAR Briefing Modern PDF"
Cohesion: 0.11
Nodes (32): appendTemplatePage2(), BriefingPdfForm, COLOR_ACCENT, COLOR_BADGE, COLOR_BAND, COLOR_COL_HEADER, COLOR_MUTED, COLOR_RULE (+24 more)

### Community 55 - "Work Assignment Rows"
Cohesion: 0.08
Nodes (27): { activeMission, selectKey, requireActiveMission }, assignmentFormOptions, assignmentNumberInvalid, assignmentRowOptions, {
    assignments,
    loading,
    saving,
    sending,
    statusMessage,
    statusError,
    blankWorkAssignmentForm,
    loadForMission,
    addAssignment,
    removeAssignment,
    updateAssignment,
    sendPhaseLog,
}, {
    assignments: resourceTeams,
    loading: loadingResourceTeams,
    loadForMission: loadResourceTeams,
}, assignmentSelectLabel, canAdd (+19 more)

### Community 56 - "Open Existing Mission"
Cohesion: 0.12
Nodes (26): { activeMission, setActiveMission }, error, fetchMission(), filter, filtered, list, loading, mapStore (+18 more)

### Community 57 - "Incident Post Objectives"
Cohesion: 0.08
Nodes (24): { activeMission, requireActiveMission }, downloadPdf(), exporting, filledRowCount, generatePdfBytes(), loading, objectiveStatusLabels, onSaveSchema() (+16 more)

### Community 58 - "Responder Consensus Modal"
Cohesion: 0.11
Nodes (24): emit, error, flyError, isMattson, isOconnor, isProportional, letters, mattsonTotal (+16 more)

### Community 59 - "IAP Form Templates"
Cohesion: 0.09
Nodes (14): onGenerate(), download(), describeSave(), buildIapPdf(), FilledForm, fillIcsForm(), fitFontSize(), IapFormId (+6 more)

### Community 60 - "ICS 234 PDF Drawing"
Cohesion: 0.11
Nodes (24): buildFormPage(), buildIcs234Pdf(), drawFormContent(), drawGridLines(), drawHLine(), drawSingleLine(), drawVLine(), drawWrappedCell() (+16 more)

### Community 61 - "Area Search Debrief Editing"
Cohesion: 0.10
Nodes (28): buildDebriefRecord(), cancelEdit(), clueLetterRows, debriefKeyOf(), nextSegmentName(), onAcceptClue(), onDeleteDebrief(), onDuplicateAddAnother() (+20 more)

### Community 62 - "Mission Schema Defaults"
Cohesion: 0.09
Nodes (25): exportPdf(), appendMpsRowsToSchema(), AssignmentData, ContentLike, defaultMissionSchema(), delete(), fillIfEmpty(), findLatestSchemaLog() (+17 more)

### Community 63 - "Dashboard Risk Actions"
Cohesion: 0.12
Nodes (27): onRefresh(), onAddPdfToDataSync(), onSaveIncidentInfo(), assignmentForChoice(), closeMitigationModal(), confirmSaveWithoutMitigations(), keyForForm(), onCompDeleteRespondent() (+19 more)

### Community 64 - "WiSAR Travel Time Form"
Cohesion: 0.13
Nodes (23): busy, emit, intervals, { job, phase, error, startedAt, now, run, cancel }, problem, props, runAnalysis(), setUnit() (+15 more)

### Community 65 - "Mission Template Logs"
Cohesion: 0.12
Nodes (23): ../../../../src/base/mission-template-logs.ts, ../../../../src/std.ts, loadLogTemplates(), opCreateKeywords(), pickerTemplates, searchOpTemplateName, refreshMissionTemplates(), resolvedSearchOpTemplate (+15 more)

### Community 66 - "WC3 Consensus Export"
Cohesion: 0.17
Nodes (25): onExportWc3(), consensusForSegment(), consensusRow(), mean(), buildStoreZip(), buildWc3Files(), buildWc3Trail(), concatBytes() (+17 more)

### Community 67 - "IAP Builder Pane"
Cohesion: 0.10
Nodes (24): { activeMission }, busy, ctx, emit, error, formsLabel, fromLocalInput(), hasUas (+16 more)

### Community 68 - "Subject Profile Uploads"
Cohesion: 0.11
Nodes (26): mergeUploadedSubjectProfiles(), onD4hPersonnelToggle(), onD4hToggle(), onLpbFileChange(), replaceUploadedSubjectProfiles(), resetLpb(), resetSubjectProfilesToDefaults(), resetWisarUrl() (+18 more)

### Community 69 - "Demobilization Package"
Cohesion: 0.12
Nodes (23): { activeMission, requireActiveMission }, assignmentLines(), copied, demob, error, formatGenerationDate(), formatReportDateTimeParts(), formatReportTime() (+15 more)

### Community 70 - "Scenarios Record Sheet PDF"
Cohesion: 0.15
Nodes (25): buildScenariosRecordSheetPdf(), colRects(), COLS, drawColumnHeaders(), drawFilledRect(), drawHLine(), drawLabeledBox(), drawPageChrome() (+17 more)

### Community 71 - "WiSAR Content Modal"
Cohesion: 0.13
Nodes (19): { content, loading, error }, emit, props, { content }, cache, SafeContent, toSafe(), useWisarContent() (+11 more)

### Community 72 - "IAP Form Plan"
Cohesion: 0.20
Nodes (24): IncidentCategory, buildIapSections(), header(), IapContext, IapInputs, ics202(), ics203(), ics204() (+16 more)

### Community 73 - "Plugin Dev Dependencies"
Cohesion: 0.08
Nodes (23): dependencies, puppeteer, description, devDependencies, @tak-ps/cloudtak, typescript, vue-tsc, license (+15 more)

### Community 74 - "SAR Briefing PDF"
Cohesion: 0.13
Nodes (20): BriefingSubjectColumn, IrBriefingForm, BriefingPdfForm, buildFieldLayoutMap(), buildSarBriefingPdf(), collectFieldValues(), drawSingleLine(), drawWrapped() (+12 more)

### Community 75 - "D4H Roster"
Cohesion: 0.12
Nodes (21): filteredMembers, refreshRoster(), refreshD4hAgencyCount(), compareD4hRefAsc(), D4H_META_KEY, D4H_ROSTER_KEY, externalResourceMatchesFilter(), filterAndSortExternalResources() (+13 more)

### Community 76 - "Default IPP Resolver"
Cohesion: 0.15
Nodes (21): parsedCoords, ipp, parsedIpp, parseCoordinates(), asRecord(), caseOrder(), DefaultIpp, finiteNumber() (+13 more)

### Community 77 - "Operational Period Status"
Cohesion: 0.14
Nodes (21): activeOp, activeOps, nextOp, planningOp, currentOp, loadOpRegistry(), defaultTarget(), OpStatus (+13 more)

### Community 78 - "In-memory Mission Properties"
Cohesion: 0.12
Nodes (9): MemoryPropertyServer, assertValidKey(), MissionProperty, MissionPropertyClient, MissionPropertyClientOpts, PropertyTransport, PropertyTransportRequest, PropertyTransportResponse (+1 more)

### Community 79 - "Org Chart Drag and Drop"
Cohesion: 0.14
Nodes (20): onDropNode(), onDropRoot(), removeNode(), appendPaletteDrop(), applyPaletteToRoot(), AssignmentNodeSelf, AssignmentNodeType, deleteNodeFromTree() (+12 more)

### Community 80 - "IAP Plan Persistence"
Cohesion: 0.11
Nodes (21): blankAircraftRow(), blankCommsListRow(), blankContactRow(), IapAircraftRow, IapAssignmentPlan, IapCommsListRow, IapCommsRow, IapContactRow (+13 more)

### Community 81 - "Incident Post Save"
Cohesion: 0.12
Nodes (20): onSave(), save(), upsertCell(), buildObjectiveLogKeywords(), DEFAULT_OBJECTIVE, formatNumberedList(), formatStrategiesForDisplay(), formatTacticsForDisplay() (+12 more)

### Community 82 - "WiSAR Overlay Keep"
Cohesion: 0.15
Nodes (10): keep(), keepBusy(), cloudTakKeepDeps(), KeepDeps, KeepOptions, keepOverlay(), KeepPhase, keptLayerName() (+2 more)

### Community 83 - "Incident Changed Banner"
Cohesion: 0.17
Nodes (17): { activeKey, activeHTab }, changed, changedLabels, emit, onReload(), screen, isVolatileKey(), COLLECTION_LABELS (+9 more)

### Community 84 - "Settings Folder Target"
Cohesion: 0.16
Nodes (16): onChooseFolder(), onClearFolder(), refreshFolder(), chooseFileTarget(), clearFileTarget(), DirectoryHandleLike, downloadFallback(), ensureWritable() (+8 more)

### Community 85 - "Debrief Property Keys"
Cohesion: 0.22
Nodes (15): debriefRecordFromValue(), createMemoryPropertyServer(), debriefPrefix(), debriefPropertyKey(), OP_PREFIX, opMissionKey(), shortHash(), uidSegment() (+7 more)

### Community 86 - "WiSAR Map Preview"
Cohesion: 0.19
Nodes (10): ContourCollection, clearPreview(), layerIds(), PREVIEW_FILL, PREVIEW_LINE, PREVIEW_SOURCE, PreviewMap, previewSourceId() (+2 more)

### Community 87 - "Mission Template Log Modal"
Cohesion: 0.15
Nodes (14): ../../../../src/base/subscription.ts, busy, destinationLabel, emit, EMPTY_SCHEMA, error, formSchema, onDismiss() (+6 more)

### Community 88 - "Consensus Table UI"
Cohesion: 0.13
Nodes (16): emit, entryIndex, methodIndex, onEntryAccept(), onMethodAccept(), props, SegmentRef, emit (+8 more)

### Community 89 - "Collection Property Keys"
Cohesion: 0.16
Nodes (15): ArraySpec, COLLECTION_PREFIX, ensureParent(), extractCollections(), FieldMapSpec, fieldToSeg(), isRecord(), MapSpec (+7 more)

### Community 90 - "Task Checklists"
Cohesion: 0.15
Nodes (10): @tak-ps/vue-tabler, ActionSection, activeChecklist, ChecklistKey, ContainChecklist, expandedSections, InvestigateChecklist, SearchChecklist (+2 more)

### Community 91 - "Logger Pane Sections"
Cohesion: 0.11
Nodes (17): LoggerPane, AreaSearch, Ics201, IncidentPost, InitialConsensus, InitialInformation, IrBriefing, labels (+9 more)

### Community 92 - "Resource Assignment State"
Cohesion: 0.14
Nodes (17): createAssignment(), removeAssignmentRecord(), resetForm(), assignments, defaultAgency, loading, saving, schemaHash (+9 more)

### Community 93 - "MPS CAD Parser"
Cohesion: 0.18
Nodes (17): parseCadIdentifiers(), annotateRemarks(), getEventId(), getMpsRows(), getRemarksDates(), getRemarksSection(), mergeNearbyRows(), find() (+9 more)

### Community 94 - "PDF Library Helpers"
Cohesion: 0.23
Nodes (17): e(), fi(), gi(), Gr(), gt(), Hr(), i(), s() (+9 more)

### Community 95 - "WiSAR Job Client"
Cohesion: 0.21
Nodes (13): vue, elapsed, props, useWisar(), wisarClientFor(), useWisarJob(), run(), stopTicker() (+5 more)

### Community 96 - "Personnel Settings"
Cohesion: 0.23
Nodes (14): onPersonnelFileChange(), MAX_PERSONNEL, membersFromJson(), mergePersonnelById(), normalizePersonnel(), OPTIONAL_FIELDS, optionalString(), parseCsvLine() (+6 more)

### Community 97 - "Demob Manifest"
Cohesion: 0.24
Nodes (14): archivableSources(), buildManifest(), defaultDemobOptions(), DemobOptions, DemobSourceRef, DemobVariant, ManifestEntry, retainedSources() (+6 more)

### Community 98 - "CASIE Tests"
Cohesion: 0.21
Nodes (8): splitSharesOk, templateLogTarget, allocateParentValue(), defaultPoaShares(), POA_SHARE_TOLERANCE, poaSharesMatchSource(), round2(), sumPoaShares()

### Community 99 - "Schema Property Backend"
Cohesion: 0.19
Nodes (11): load(), loadForMission(), MissionSchema, SchemaPropertyBackend, mergeLegacyComplacencyAssessments(), tacticAssessmentsFromSchemaValue(), tacticEntryToSchemaRecord(), applyTacticAssessmentsToSchema() (+3 more)

### Community 100 - "Assignment Resources"
Cohesion: 0.23
Nodes (14): onResourceTeamDragStart(), ASSIGNMENT_RESOURCES, AssignmentResource, DEFAULT_AGENCY, mergeResourceAssignmentPatch(), normalizeEta(), normalizeOpNumber(), normalizeResourceAssignment() (+6 more)

### Community 101 - "Work Assignment State"
Cohesion: 0.17
Nodes (14): assignments, loading, saving, schemaHash, sending, statusError, statusMessage, buildWorkAssignmentLogContent() (+6 more)

### Community 102 - "WiSAR Overlay Layers"
Cohesion: 0.24
Nodes (7): Bounds, clearOverlay(), imageCoordinates(), OVERLAY_OPACITY, OverlayMap, showOverlay(), B

### Community 103 - "TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, baseUrl, esModuleInterop, jsx, module, moduleResolution, noEmit, paths (+7 more)

### Community 104 - "Objective Strategies Editor"
Cohesion: 0.19
Nodes (14): addStrategy(), addTactic(), emit, queueDelete(), removeStrategy(), removeTactic(), strategies, blankStrategy() (+6 more)

### Community 105 - "Search Scenario Model"
Cohesion: 0.21
Nodes (14): scenarioKeyFromLog(), buildSearchScenario(), isScenarioLetter(), parseMobility(), parsePriority(), parseResponsiveness(), SCENARIO_LETTERS, ScenarioLetter (+6 more)

### Community 106 - "Schema Storage Card"
Cohesion: 0.21
Nodes (13): busy, check(), confirming, emit, error, migrate(), migratedKeys, props (+5 more)

### Community 107 - "Consensus Setup Modal"
Cohesion: 0.17
Nodes (12): emit, error, filename, incidentName, onAccept(), props, respondentCount, respondentCountLabel (+4 more)

### Community 108 - "Incident Post Rows"
Cohesion: 0.20
Nodes (12): loadRows(), parsePostTag(), reset(), loadObjectiveRowsFromLogs(), parsePostTag(), blankObjectiveRows(), hasPostKeyword(), parseObjectiveStatusFromKeywords() (+4 more)

### Community 109 - "Deployment Defaults"
Cohesion: 0.27
Nodes (9): deploymentDefaults, asText(), basenameOf(), DeploymentBundle, DeploymentConfig, DeploymentModule, loadDeploymentBundle(), readConfig() (+1 more)

### Community 110 - "Local Date and Mission Name"
Cohesion: 0.35
Nodes (8): shortDt(), shortDt(), fmtDtg(), shortDt(), buildMissionName(), localDateString(), localDateTimeLabel(), pad2()

### Community 111 - "Assignment Row Editing"
Cohesion: 0.22
Nodes (10): addRow(), callsignForUid(), fileCotsIntoAssignmentFolder(), onAddClick(), onRowAssignmentChange(), onRowAssignmentLabelChange(), onRowTeamChange(), onRowTeamLabelChange() (+2 more)

### Community 112 - "Mission File Upload"
Cohesion: 0.33
Nodes (6): bytesToArrayBuffer(), extractUploadContentHash(), fetchMissionFileText(), formatUploadError(), tryContentHash(), uploadMissionFile()

### Community 113 - "WiSAR Tools Float"
Cohesion: 0.25
Nodes (5): emit, HostFloatComponent, openWisarTools(), WISAR_TOOLS_UID, WisarToolsFloatShell

### Community 114 - "ICS 234 Datetime"
Cohesion: 0.39
Nodes (8): refreshPdfHeader(), toDatetimeLocalInput(), defaultIcs234DatetimeFields(), formatDatetimeForPdf(), nowDatetimeLocal(), pad2(), toDatetimeLocalValue(), todayDatetimeLocal()

### Community 115 - "IAP Form Selection"
Cohesion: 0.33
Nodes (7): IapFormId, iapFormPlan(), IapPlanInput, isUasLabel(), UAS_KEYWORDS, usesExtendedIcsSet(), isUasResource()

### Community 116 - "Org Chart Persistence"
Cohesion: 0.44
Nodes (8): emptyTree(), applyOrgChartToSchema(), deleteLegacyOrgChartLogs(), latestOrgChartFromLogs(), loadOrgChartFromMission(), ORG_CHART_TREE_KEYWORD, orgChartFromSchemaValue(), parseOrgChartTreeFromLogContent()

### Community 117 - "PDF Library Encoding"
Cohesion: 0.28
Nodes (9): ce(), de(), he(), ie(), Ke(), le(), oe(), qe() (+1 more)

### Community 118 - "Create Mission Map Confirm"
Cohesion: 0.29
Nodes (5): centerPendingLocation(), onLocationConfirmNo(), onLocationConfirmYes(), flyToCoords(), focusMainWindow()

### Community 119 - "Map Fly To"
Cohesion: 0.25
Nodes (8): onFlyTo(), flyToCandidate(), onFlyTo(), onFlyTo(), onFlyTo(), onFlyTo(), onFlyTo(), flyToFeature()

### Community 120 - "Risk Factor Labels"
Cohesion: 0.43
Nodes (8): compConfidenceLabel, compExperienceLabel, compRepetitionLabel, factorLabelToValue(), factorValueToLabel(), speExposureLabel, speProbabilityLabel, speSeverityLabel

### Community 121 - "Scenario PDF Header"
Cohesion: 0.43
Nodes (8): blankPdfHeader(), loadAll(), prefillPdfHeader(), blankIrBriefingForm(), blankSubjectColumn(), nowBriefingDate(), nowBriefingTime(), pad2()

### Community 122 - "CalTopo Map Create"
Cohesion: 0.32
Nodes (6): caltopoAvailable(), CaltopoCreateRequest, CaltopoCreateResult, CaltopoProvider, createCaltopoMap(), Window

### Community 123 - "ICS 201 Persistence"
Cohesion: 0.25
Nodes (8): buildIcs201Content(), buildIcs201Keywords(), formatObjectivesForPdf(), formatPlannedObjectiveDateDisplay(), normalizeObjectivesFromPartial(), saveIcs201ToMission(), serializeIcs201Form(), syncObjectivesSnapshot()

### Community 124 - "PDF Library Glyphs A"
Cohesion: 0.39
Nodes (8): Ba(), Ea(), La(), Na(), Oa(), qa(), Ra(), Ua()

### Community 125 - "PDF Library Glyphs B"
Cohesion: 0.39
Nodes (8): Dt(), Et(), Ht(), jt(), Kt(), Pt(), Vt(), Xt()

### Community 126 - "Work Assignment Persist"
Cohesion: 0.43
Nodes (7): resetForm(), useWorkAssignments(), addAssignment(), persist(), removeAssignment(), updateAssignment(), blankWorkAssignmentForm()

### Community 127 - "Dashboard Risk Severity"
Cohesion: 0.29
Nodes (7): canExport, savedGroups, complacencySeverity(), entryHasRespondents(), worstComplacencyRespondent(), worstGarRespondent(), worstSpeRespondent()

### Community 128 - "Risk Tactic Labels"
Cohesion: 0.38
Nodes (7): compTacticLabel, garTacticLabel, speTacticLabel, tacticChoiceToLabel(), tacticLabelToChoice(), tacticOptions, tacticPlaceholderLabel()

### Community 129 - "PDF Library Strings"
Cohesion: 0.38
Nodes (7): as(), es(), hs(), os(), ss(), ts(), zs()

### Community 130 - "PDF Library Paths"
Cohesion: 0.38
Nodes (7): ee(), ge(), pe(), re(), ve(), We(), ye()

### Community 131 - "Feature Callsign Cell"
Cohesion: 0.33
Nodes (4): copied, emit, modalOpen, props

### Community 132 - "GAR Score"
Cohesion: 0.40
Nodes (6): buildGarRespondent(), garResult, onGarSaveClick(), factorsNeedingMitigation(), garLevelForScore(), garScoreFromFactors()

### Community 133 - "Scenario PDF Download"
Cohesion: 0.33
Nodes (6): downloadPdf(), generatePdfBytes(), onSave(), saveCount, scenariosForSave(), defaultScenariosRecordSheetFilename()

### Community 134 - "WiSAR URL Settings"
Cohesion: 0.40
Nodes (6): draftWisarUrlInvalid, testWisarConnection(), wisarUrlDirty, parseWisarUrl(), normalizeBaseUrl(), resolveWisarUrl()

### Community 135 - "Work Assignment Schema"
Cohesion: 0.60
Nodes (5): mergeWorkAssignmentPatch(), normalizeAssignmentNumber(), normalizeWorkAssignment(), workAssignmentsFromSchemaValue(), workAssignmentToSchemaRecord()

### Community 136 - "Asset Import Types"
Cohesion: 0.33
Nodes (4): ImportMeta, *.md, *.md?raw, *.pdf?url

### Community 137 - "PDF Library Streams"
Cohesion: 0.40
Nodes (6): $a(), cs(), ds(), fs(), Ms(), us()

### Community 138 - "PDF Library Images"
Cohesion: 0.47
Nodes (6): ai(), bi(), hi(), ki(), wi(), xi()

### Community 139 - "PDF Library Text"
Cohesion: 0.40
Nodes (6): li(), pi(), ui(), vi(), yi(), Zi()

### Community 140 - "Assignment Phase Log"
Cohesion: 0.40
Nodes (5): onSendComplete(), onSendStart(), sendComplete(), sendStart(), sendPhaseLog()

### Community 141 - "Mission IPP Location"
Cohesion: 0.70
Nodes (4): formatLatLng(), kwValue(), pointCoords(), resolveMissionIppLocation()

### Community 142 - "PDF Library Fonts"
Cohesion: 0.60
Nodes (5): Jr(), Mr(), Vr(), Wr(), Xr()

## Ambiguous Edges - Review These
- `Incident Action Plan` → `ICS 207 Incident Organization Chart`  [AMBIGUOUS]
  src/assets/iap/ics207.pdf · relation: conceptually_related_to
- `SAR Unit Log` → `ICS 214 Unit Log`  [AMBIGUOUS]
  src/assets/sar-briefing-template.pdf · relation: semantically_similar_to

## Knowledge Gaps
- **36 isolated node(s):** `@tak-ps/cloudtak`, `typescript`, `vue-tsc`, `puppeteer`, `ADR-0003` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1543 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `WiSAR Job Client` to `Search Area Map Tools`, `Area Search Assignments`, `Feature Callsign Cell`, `WiSAR TARR Form`, `Dashboard Initial Information`, `CASIE Split and Expand`, `Chip Bar Minimize`, `Plugin Settings Pane`, `Subject Information Form`, `LPB Distance Table`, `Risk Assessment Pane`, `Organization Chart Tab`, `Search Urgency Rating`, `Plugin Package Dependencies`, `Search Scenarios Pane`, `POA Lock Card`, `CASIE Segmentation Actions`, `Resource Assignments Tab`, `Hasty Team Org Chart`, `Subject Profile Settings`, `WiSAR Results Pane`, `ICS 201 Editor`, `IR Briefing Pane`, `Clue Log Pane`, `Dashboard Directory Users`, `Physical WiSAR Pane`, `Create Open Mission`, `Incident Navigation Shell`, `Plugin Entry Point`, `Live Incident Watcher`, `Help Content Imports`, `Incident Pane Navigation`, `Initial Consensus Pane`, `Work Assignment Rows`, `Open Existing Mission`, `Incident Post Objectives`, `Responder Consensus Modal`, `WiSAR Travel Time Form`, `IAP Builder Pane`, `Demobilization Package`, `WiSAR Content Modal`, `Plugin Dev Dependencies`, `Incident Changed Banner`, `Mission Template Log Modal`, `Consensus Table UI`, `Task Checklists`, `Logger Pane Sections`, `Resource Assignment State`, `Work Assignment State`, `Schema Storage Card`, `Consensus Setup Modal`, `WiSAR Tools Float`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **What connects `@tak-ps/cloudtak`, `typescript`, `vue-tsc` to the rest of the system?**
  _36 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Search Area Map Tools` be split into smaller, more focused modules?**
  _Cohesion score 0.024914765276685024 - nodes in this community are weakly interconnected._
- **Why does `@tak-ps/vue-tabler` connect `Task Checklists` to `Search Area Map Tools`, `Area Search Assignments`, `Feature Callsign Cell`, `Dashboard Initial Information`, `CASIE Split and Expand`, `Chip Bar Minimize`, `Plugin Settings Pane`, `Subject Information Form`, `LPB Distance Table`, `Risk Assessment Pane`, `Organization Chart Tab`, `Search Urgency Rating`, `Plugin Package Dependencies`, `Search Scenarios Pane`, `POA Lock Card`, `CASIE Segmentation Actions`, `Resource Assignments Tab`, `Hasty Team Org Chart`, `ICS 201 Editor`, `IR Briefing Pane`, `Clue Log Pane`, `Dashboard Directory Users`, `Physical WiSAR Pane`, `Create Open Mission`, `Incident Navigation Shell`, `Plugin Entry Point`, `Incident Pane Navigation`, `Initial Consensus Pane`, `Work Assignment Rows`, `Open Existing Mission`, `Incident Post Objectives`, `Responder Consensus Modal`, `IAP Builder Pane`, `Demobilization Package`, `Plugin Dev Dependencies`, `Mission Template Log Modal`, `Consensus Table UI`, `Logger Pane Sections`, `Objective Strategies Editor`, `Schema Storage Card`, `Consensus Setup Modal`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Area Search Schema Reload` be split into smaller, more focused modules?**
  _Cohesion score 0.0748040313549832 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Incident Action Plan` and `ICS 207 Incident Organization Chart`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `SAR Unit Log` and `ICS 214 Unit Log`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._