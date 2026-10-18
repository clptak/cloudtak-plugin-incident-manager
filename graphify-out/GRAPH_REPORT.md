# Graph Report - cloudtak-plugin-incident-manager  (2026-10-18)

## Corpus Check
- 292 files · ~241,584 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 7, .css 3, .log 1)

## Summary
- 4247 nodes · 10055 edges · 162 communities (153 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b6d347e8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- missionSchema.ts
- AreaSearch.vue
- SearchArea.vue
- WisarTarrForm.vue
- IncidentPost.vue
- loadSchemaSubscription
- RiskAssessment.vue
- CasiePane.vue
- SettingsPane.vue
- SubjectInformation.vue
- usecases.ts
- OrganizationTab.vue
- ics201.ts
- wisar.ts
- pdf-lib.esm.min.js
- floatMinimize.ts
- trackLog.ts
- ResourcesTab.vue
- PoaLockCard.vue
- tacticRisk.ts
- SearchUrgency.vue
- WisarResults.vue
- HastyTeamRoot.vue
- SearchScenarios.vue
- AssignmentsTab.vue
- DashboardTab.vue
- LpbTab.vue
- pdf-lib.esm.min.d.ts
- useIncident.ts
- IrBriefing.vue
- schemaCodec.ts
- ics201Pdf.ts
- ClueLog.vue
- WisarTravelTimeForm.vue
- CreateOpenPane.vue
- wisarResults.ts
- urgencyRatingChartPdf.ts
- ics234Pdf.ts
- dashboardExport.ts
- orgChartExport.ts
- IncidentManagerPane.vue
- liveIncident.ts
- Ics201.vue
- pluginSettings.ts
- sarBriefingModernPdf.ts
- Segmentation.vue
- useWorkAssignments.ts
- NavHelpButton.vue
- OpenExistingMission.vue
- rolePositions.ts
- debriefKey
- InitialConsensus.vue
- registry.ts
- usePluginSettings
- IncidentManagerChipBar.vue
- scenariosRecordSheetPdf.ts
- iapPdf.ts
- loadAreas
- missionProperties.ts
- irBriefing.ts
- ResponderEntryModal.vue
- WrapUpPane.vue
- wc3Export.ts
- missionTemplates.ts
- package.json
- WisarIppPicker.vue
- chipBarPosition.ts
- ensureIncidentIpp.ts
- sarBriefingPdf.ts
- requireActiveMission
- IapBuilder.vue
- iapData.ts
- hastyTeamTree.ts
- propertyStores.ts
- iapPlanPersistence.ts
- Persistent plugin chip bar + float minimize (CloudTAK plugins)
- d4hRoster.ts
- subjectInfo.ts
- fileTarget.ts
- wisarPreview.ts
- src/index.ts
- @tak-ps/vue-tabler
- demobPackage.ts
- defaultIpp.ts
- MissionSchema
- MissionTemplateLogModal.vue
- cloudtak-plugin-incidentManager
- entities.ts
- IncidentChangedBanner.vue
- ConsensusTable.vue
- WisarToolsPane.vue
- subjectsPersistence.ts
- schemaCollections.ts
- schemaMission
- LoggerPane.vue
- useResourceAssignments.ts
- mpsParser.ts
- r
- history.ts
- addRowSegments
- resourceAssignments.ts
- personnel.ts
- opAssignmentPersistence.ts
- searchScenarios.ts
- wisarOverlays.test.ts
- wisarKeep.ts
- compilerOptions
- ADR-001: Store incident planning data as TAK Mission Properties
- missionFeatures.ts
- SchemaStorageCard.vue
- dashboardPanels.ts
- vue
- rollup.ts
- consensus.ts
- nowBriefingDate
- Segment Boundaries
- loadIapInputs
- ConsensusSetupModal.vue
- popout.ts
- subjectProfiles.ts
- deploymentDefaults.ts
- ADR-002: Operational periods are planned hidden, activated and closed by hand
- ADR-003: POA lock is explicit, and debrief corrections mark a lock stale
- ensureMissionFolder
- localDateString
- ippPersistence.ts
- wisarContent.ts
- trackLogPersistence.ts
- casiePersistence.ts
- layout
- orgChartPersistence.ts
- wisarTools.ts
- poaShares.ts
- ce
- flyToFeature.ts
- flyToFeature
- caltopo.ts
- tacticRiskPersistence.ts
- Ba
- jt
- es
- ge
- FeatureCallsignCell.vue
- send
- assets.d.ts
- ds
- ki
- yi
- buildSplitRows
- Vr
- vendor/README.md
- Initial Consensus
- Establishing the Search Area
- check-like-docker.sh
- Establishing the Search Area
- Establishing the Search Area
- Establishing the Search Area
- Resource Summary
- area_search.md
- establishing_search_area_0_main.md
- route_and_location_search.md
- en

## God Nodes (most connected - your core abstractions)
1. `loadSchemaSubscription()` - 120 edges
2. `loadMissionSchema()` - 97 edges
3. `vue` - 66 edges
4. `useIncident()` - 55 edges
5. `saveMissionSchema()` - 55 edges
6. `requireActiveMission()` - 54 edges
7. `schemaMissionToken()` - 54 edges
8. `@tak-ps/vue-tabler` - 45 edges
9. `ActiveMission` - 41 edges
10. `@tabler/icons-vue` - 40 edges

## Surprising Connections (you probably didn't know these)
- `Decision` --references--> `currentOpPeriod()`  [INFERRED]
  docs/decisions/ADR-002-operational-period-lifecycle.md → src/domain/registry.ts
- `Host APIs` --references--> `add()`  [INFERRED]
  float-minimize-to-bottom-bar.md → src/components/NumberedTextList.vue
- `Pitfalls` --references--> `add()`  [INFERRED]
  float-minimize-to-bottom-bar.md → src/components/NumberedTextList.vue
- `Why remount is OK` --references--> `useIncident()`  [INFERRED]
  float-minimize-to-bottom-bar.md → src/composables/useIncident.ts
- `Behavior (this plugin)` --references--> `openDesktopPane()`  [INFERRED]
  float-minimize-to-bottom-bar.md → src/lib/floatMinimize.ts

## Import Cycles
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/IncidentManagerTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`
- 3-file cycle: `src/components/AssignmentsTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue -> src/components/AssignmentsTaskbarChip.vue`
- 3-file cycle: `src/components/ClueTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue -> src/components/ClueTaskbarChip.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/LpbTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/ResourcesTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`
- 3-file cycle: `src/components/IncidentManagerChipBar.vue -> src/components/SegmentsTaskbarChip.vue -> src/lib/floatMinimize.ts -> src/components/IncidentManagerChipBar.vue`

## Communities (162 total, 9 thin omitted)

### Community 0 - "missionSchema.ts"
Cohesion: 0.04
Nodes (102): resetForm(), { activeMission, setActiveMission, requireActiveMission }, allSelected, applySubjectNameSuggestion(), cadText, cfsExpanded, demaInvalid, incidentForm (+94 more)

### Community 1 - "AreaSearch.vue"
Cohesion: 0.03
Nodes (95): { activeMission, isSearchIncident }, assignedThisOp, assignments, assignNotes, assignTeam, busy, closeIap(), CLUE_LETTERS (+87 more)

### Community 2 - "SearchArea.vue"
Cohesion: 0.03
Nodes (81): { activeMission, requireActiveMission }, addCustomRange(), availableRowPolygons, canAddDeductive, canAddSubjective, canPushCustomLpb, canPushLpb, canPushTheoretical (+73 more)

### Community 3 - "WisarTarrForm.vue"
Cohesion: 0.04
Nodes (70): arizonaBlocked, arizonaRow, arizonaRows, baseValues, busy, calibration, category, categoryNames (+62 more)

### Community 4 - "IncidentPost.vue"
Cohesion: 0.05
Nodes (67): { activeMission, requireActiveMission }, exporting, loading, loadRows(), objectiveStatusLabels, onAddPdfToDataSync(), onSave(), parsePostTag() (+59 more)

### Community 5 - "loadSchemaSubscription"
Cohesion: 0.10
Nodes (63): exportPdf(), refresh(), onPublishAssignments(), reloadLists(), loadSchemaPrefills(), loadSent(), send(), loadIppAndMarkers() (+55 more)

### Community 6 - "RiskAssessment.vue"
Cohesion: 0.04
Nodes (65): { activeMission, requireActiveMission }, assessments, assignmentOptions, { assignments, loadForMission }, blankGarFactors(), blankGarMitigations(), busy, clearCompRespondentFields() (+57 more)

### Community 7 - "CasiePane.vue"
Cohesion: 0.04
Nodes (55): { activeMission, casieExpandRequested }, auditTrail, canBuildSplit, cancelSplit(), canCompute, computeDraft(), deleteScenario(), draft (+47 more)

### Community 8 - "SettingsPane.vue"
Cohesion: 0.04
Nodes (56): agencyFileInput, agencyUploadError, aidingAgenciesDirty, choosingFolder, d4hAgencyCount, d4hMemberCount, deploymentConfigured, draftAidingAgencies (+48 more)

### Community 9 - "SubjectInformation.vue"
Cohesion: 0.04
Nodes (47): { activeMission, requireActiveMission }, addSubject(), availableNumbers, blankForm(), displayNumber(), drafts, draftSummary(), effectiveAge() (+39 more)

### Community 10 - "usecases.ts"
Cohesion: 0.06
Nodes (31): correctedDebrief(), resourceId(), sameResourceDebriefs(), OpPeriodRegistryEntry, AssignmentPayload, DebriefStore, MissionContentsUploader, OpFeaturePublisher (+23 more)

### Community 11 - "OrganizationTab.vue"
Cohesion: 0.04
Nodes (51): { activeMission, requireActiveMission }, { assignments: resourceAssignments, loadForMission: loadResourceAssignments, updateAssignment: updateResourceAssignment }, assignmentSelectLabel, configurationMembers, emptyPersonnelDescription, emptyPersonnelTitle, filteredMissionCots, filteredRescueGroupLabels (+43 more)

### Community 12 - "ics201.ts"
Cohesion: 0.08
Nodes (54): actionCapacity, generatePdfBytes(), loadAll(), actionRowCapacity(), actionRowsHaveContent(), actionsFromLogsAndPost(), applyPartialIcs201Form(), blankActionRow() (+46 more)

### Community 13 - "wisar.ts"
Cohesion: 0.05
Nodes (43): abortError(), checkWisarConnection(), ConnectionCheck, ConnectionStatus, CONTENT_IDS, ContourProperties, createWisarClient(), getJob() (+35 more)

### Community 14 - "pdf-lib.esm.min.js"
Cohesion: 0.05
Nodes (20): ao(), Be(), Da(), Ei(), Ia(), Ii(), It(), kr() (+12 more)

### Community 15 - "floatMinimize.ts"
Cohesion: 0.07
Nodes (39): @tabler/icons-vue, openAssignments(), { selectKeyGuarded }, openClueLog(), { selectHTabGuarded, isSearchIncident }, openLpb(), { selectKeyGuarded, isSearchMission }, emit (+31 more)

### Community 16 - "trackLog.ts"
Cohesion: 0.10
Nodes (47): onTrackFile(), TrackLogRef, coordsFromArray(), douglasPeucker(), finalize(), geoJsonName(), geoJsonTimes(), gpxPoints() (+39 more)

### Community 17 - "ResourcesTab.vue"
Cohesion: 0.05
Nodes (45): refreshRoster(), { activeMission, requireActiveMission, selectHTabGuarded }, agencyFormOptions, agencyOptions, applyEffectiveDefaultToForm(), {
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
}, canCreate, d4hContextName (+37 more)

### Community 18 - "PoaLockCard.vue"
Cohesion: 0.08
Nodes (42): { activeMission }, busy, error, latest, loadLocks(), lockInputs, locks, onLock() (+34 more)

### Community 19 - "tacticRisk.ts"
Cohesion: 0.07
Nodes (47): buildGarRespondent(), compResult, garResult, speResult, BAND_SEVERITY, ComplacencyRiskEntry, ComplacencyRiskMap, ComplacencyRiskRespondent (+39 more)

### Community 20 - "SearchUrgency.vue"
Cohesion: 0.05
Nodes (46): { activeMission, requireActiveMission }, applyFactors(), blankPdfHeader(), clampedTotal, contentHash, currentFactors(), downloadPdf(), exporting (+38 more)

### Community 21 - "WisarResults.vue"
Cohesion: 0.06
Nodes (44): { activeMission }, addError, adding, addStatus, addToDataSync(), chosen(), { client }, contours (+36 more)

### Community 22 - "HastyTeamRoot.vue"
Cohesion: 0.05
Nodes (42): BlockSlotProps, childOuterWidth, childrenBandStyle, childrenEndX, childrenStartX, childSubtreeWidths, connectorBandStyle, containerRef (+34 more)

### Community 23 - "SearchScenarios.vue"
Cohesion: 0.05
Nodes (40): { activeMission, requireActiveMission }, availableLetters, contentHash, downloadPdf(), Draft, editingKeys, editorLetters, exporting (+32 more)

### Community 24 - "AssignmentsTab.vue"
Cohesion: 0.06
Nodes (42): { activeMission, selectKey, requireActiveMission }, addRow(), assignmentFormOptions, assignmentNumberInvalid, assignmentRowOptions, {
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
}, assignmentSelectLabel (+34 more)

### Community 25 - "DashboardTab.vue"
Cohesion: 0.05
Nodes (42): { activeMission, requireActiveMission }, ALL_IDS, canExport, directoryAccess, DirectoryUser, displayRows, displaySource(), emailFromUid() (+34 more)

### Community 26 - "LpbTab.vue"
Cohesion: 0.07
Nodes (42): { activeMission, requireActiveMission }, canPlot, closeModal(), error, filter, filteredRows, ippCenter, ippInput (+34 more)

### Community 27 - "pdf-lib.esm.min.d.ts"
Cohesion: 0.04
Nodes (14): PDFAcroField, PDFCheckBox, PDFDocument, PDFEmbeddedPage, PDFField, PDFFont, PDFForm, PDFPage (+6 more)

### Community 28 - "useIncident.ts"
Cohesion: 0.07
Nodes (37): onSelect(), {
    noMissionModalOpen,
    closeNoMissionModal,
    goToCreateOpen,
}, syncMissionToken(), goToExpand(), openLpb(), openSection(), paneOpen, { selectKeyGuarded, isSearchIncident, isSearchMission } (+29 more)

### Community 29 - "IrBriefing.vue"
Cohesion: 0.07
Nodes (37): { activeMission, requireActiveMission }, addPdfNewToDataSync(), addPdfToDataSync(), downloadPdf(), downloadPdfNew(), exporting, exportingNew, form (+29 more)

### Community 30 - "schemaCodec.ts"
Cohesion: 0.11
Nodes (31): Decision, isDebriefKey(), META_SCHEMA_KEY, SCHEMA_VERSION, byOpNumber(), byRecordedAt(), DecodeResult, decodeSchema() (+23 more)

### Community 31 - "ics201Pdf.ts"
Cohesion: 0.09
Nodes (37): buildMapSketchText(), Ics201ActionRow, Ics201Sources, MAX_ACTION_ROWS, MAX_RESOURCE_ROWS, actionsFieldContentWidth(), actionSheetOutputPageIndex(), BriefingPdfForm (+29 more)

### Community 32 - "ClueLog.vue"
Cohesion: 0.08
Nodes (38): ClueLog, { activeMission }, busy, clues, error, form, loading, loadingMarkers (+30 more)

### Community 33 - "WisarTravelTimeForm.vue"
Cohesion: 0.09
Nodes (34): elapsed, props, busy, emit, intervals, { job, phase, error, startedAt, now, run, cancel }, problem, props (+26 more)

### Community 34 - "CreateOpenPane.vue"
Cohesion: 0.06
Nodes (35): addingLocation, buildKeywords(), caltopoReady, createMission(), CreateOpenCard, derivedName, { enumOptions: subjectProfileEnumOptions }, expandedCard (+27 more)

### Community 35 - "wisarResults.ts"
Cohesion: 0.10
Nodes (33): rows, ContourFeature, OUTPUT_NAMES, OutputName, ResolvedTarr, addContoursToDataSync(), DataSyncAddResult, LogApi (+25 more)

### Community 36 - "urgencyRatingChartPdf.ts"
Cohesion: 0.10
Nodes (39): urgencyLevelFromTotal(), buildUrgencyRatingChartPdf(), COLOR_BOX_STROKE, COLOR_HIGH, COLOR_HIGH_LT, COLOR_LOWER, COLOR_LOWER_LT, COLOR_MODERATE (+31 more)

### Community 37 - "ics234Pdf.ts"
Cohesion: 0.09
Nodes (36): downloadPdf(), filledRowCount, generatePdfBytes(), onSaveSchema(), toDatetimeLocalInput(), objectivesFromPost(), defaultIcs234DatetimeFields(), formatDatetimeForPdf() (+28 more)

### Community 38 - "dashboardExport.ts"
Cohesion: 0.11
Nodes (37): savedGroups, buildPdf(), addLine(), addText(), addThreeColumnSection(), addWrappedBlock(), ensureSpace(), newPage() (+29 more)

### Community 39 - "orgChartExport.ts"
Cohesion: 0.10
Nodes (37): HastyTreeNode, existingOrgLogs(), OrgChartLogWriteBody, OrgChartSyncResult, syncOrgChartToDataSync(), upsertOrgLine(), buildCombinedIncidentCommandContent(), buildOrgChartLogContent() (+29 more)

### Community 40 - "IncidentManagerPane.vue"
Cohesion: 0.08
Nodes (30): {
    activeKey,
    activeHTab,
    activeMission,
    isSearchMission,
    selectHTabGuarded,
    openNoMissionModal,
    isMissionRequiredView,
    restoreActiveMissionOnMap,
}, activeNavLabel, AssignmentsTab, CasiePane, CreateOpenPane, DashboardTab, DEFAULT_SECTION_EXPANDED, expandSectionForActiveKey() (+22 more)

### Community 41 - "liveIncident.ts"
Cohesion: 0.10
Nodes (24): useIncidentChanges(), attach(), incidentWatcher(), onVisible(), ownWrites, pushSubscriber(), watchers, ChangeListener (+16 more)

### Community 42 - "Ics201.vue"
Cohesion: 0.07
Nodes (33): { activeMission, requireActiveMission }, addActionContinuationPage(), addPlannedObjective(), downloadPdf(), ensureObjectiveEditors(), exporting, form, ippDefaultText (+25 more)

### Community 43 - "pluginSettings.ts"
Cohesion: 0.14
Nodes (33): BUNDLED_LPB_TABLE, state, D4HMember, normalizePersonnel(), applyDeploymentDefaults(), AzlpbEntry, defaultPluginSettings(), deploymentFromConfig() (+25 more)

### Community 44 - "sarBriefingModernPdf.ts"
Cohesion: 0.12
Nodes (33): toPdfWinAnsiText(), appendTemplatePage2(), BriefingPdfForm, buildSarBriefingModernPdf(), COLOR_ACCENT, COLOR_BADGE, COLOR_BAND, COLOR_COL_HEADER (+25 more)

### Community 45 - "Segmentation.vue"
Cohesion: 0.08
Nodes (32): {
    activeMission,
    casieExpandRequested,
    requireActiveMission,
    selectHTabGuarded,
}, availablePolygons, contentHash, isIntegerCallsign(), loadFeatures(), loadingFeatures, loadingSegments, loadSegments() (+24 more)

### Community 46 - "useWorkAssignments.ts"
Cohesion: 0.12
Nodes (30): load(), assignments, loading, saving, schemaHash, sending, statusError, statusMessage (+22 more)

### Community 47 - "NavHelpButton.vue"
Cohesion: 0.09
Nodes (18): bodyHtml, helpDoc, helpOpen, modalTitle, parsed, props, NAV_SECTION_HELP, NavSectionHelpDoc (+10 more)

### Community 48 - "OpenExistingMission.vue"
Cohesion: 0.12
Nodes (24): { activeMission, setActiveMission }, error, fetchMission(), filter, filtered, list, loading, mapStore (+16 more)

### Community 49 - "rolePositions.ts"
Cohesion: 0.10
Nodes (25): filteredIcsPositions, filteredRescuePositions, onRolePositionDragStart(), rolePositionPreview(), INCIDENT_COMMAND_POSITIONS, RESCUE_GROUP_LABELS, RESCUE_MANAGEMENT_POSITIONS, RescueGroupLabel (+17 more)

### Community 50 - "debriefKey"
Cohesion: 0.10
Nodes (30): attachFileTracks(), attachTracks(), buildDebriefRecord(), cancelEdit(), clueLetterRows, debriefKeyOf(), loadTrackCandidates(), nextSegmentName() (+22 more)

### Community 51 - "InitialConsensus.vue"
Cohesion: 0.08
Nodes (27): { activeMission, requireActiveMission }, compareCallsign(), consensus, contentHash, incidentName, loadAll(), loading, onGenerateWc3() (+19 more)

### Community 52 - "registry.ts"
Cohesion: 0.11
Nodes (25): activeOp, activeOps, nextOp, planningOp, currentOp, loadOpRegistry(), defaultTarget(), OpStatus (+17 more)

### Community 53 - "usePluginSettings"
Cohesion: 0.09
Nodes (29): clearPersonnel(), onD4hPersonnelToggle(), onD4hToggle(), onLpbFileChange(), replaceUploadedPersonnel(), resetLpb(), resetSubjectProfilesToDefaults(), resetWisarUrl() (+21 more)

### Community 54 - "IncidentManagerChipBar.vue"
Cohesion: 0.08
Nodes (25): { activeMission }, dragging, dragOrigin, hidden, hideBar(), isUndocked, laidOut, logTemplates (+17 more)

### Community 55 - "scenariosRecordSheetPdf.ts"
Cohesion: 0.14
Nodes (25): buildScenariosRecordSheetPdf(), colRects(), COLS, drawColumnHeaders(), drawFilledRect(), drawHLine(), drawLabeledBox(), drawPageChrome() (+17 more)

### Community 56 - "iapPdf.ts"
Cohesion: 0.09
Nodes (13): onGenerate(), download(), describeSave(), FilledForm, fillIcsForm(), fitFontSize(), IapFormId, IapSection (+5 more)

### Community 57 - "loadAreas"
Cohesion: 0.14
Nodes (23): addDeductive(), addSubjective(), insertLpbRing(), loadAreas(), loadSub(), LogApi, lpbFolderName(), lpbRingCallsign() (+15 more)

### Community 58 - "missionProperties.ts"
Cohesion: 0.11
Nodes (10): MemoryPropertyServer, assertValidKey(), MissionProperty, MissionPropertyClient, MissionPropertyClientOpts, MissionPropertyError, PropertyTransport, PropertyTransportRequest (+2 more)

### Community 59 - "irBriefing.ts"
Cohesion: 0.13
Nodes (22): parsedCoords, refreshPdfHeader(), ipp, parsedIpp, parseCoordinates(), BRIEFING_SUBJECT_NUMBERS, DEFAULT_SAFETY_MESSAGE, formatIppAsUtm() (+14 more)

### Community 60 - "ResponderEntryModal.vue"
Cohesion: 0.11
Nodes (21): emit, error, flyError, isMattson, isOconnor, isProportional, letters, mattsonTotal (+13 more)

### Community 61 - "WrapUpPane.vue"
Cohesion: 0.13
Nodes (22): { activeMission, requireActiveMission }, assignmentLines(), copied, demob, error, formatGenerationDate(), formatReportDateTimeParts(), formatReportTime() (+14 more)

### Community 62 - "wc3Export.ts"
Cohesion: 0.18
Nodes (24): consensusForSegment(), consensusRow(), mean(), buildStoreZip(), buildWc3Files(), buildWc3Trail(), concatBytes(), crc32() (+16 more)

### Community 63 - "missionTemplates.ts"
Cohesion: 0.13
Nodes (21): ../../../../src/base/mission-template-logs.ts, ../../../../src/std.ts, loadLogTemplates(), pickerTemplates, searchOpTemplateName, refreshMissionTemplates(), resolvedSearchOpTemplate, sarTemplateMissing (+13 more)

### Community 64 - "package.json"
Cohesion: 0.08
Nodes (23): dependencies, puppeteer, description, devDependencies, @tak-ps/cloudtak, typescript, vue-tsc, license (+15 more)

### Community 65 - "WisarIppPicker.vue"
Cohesion: 0.14
Nodes (21): { activeMission }, defaultUid, emit, load(), loadError, loading, markers, onSelect() (+13 more)

### Community 66 - "chipBarPosition.ts"
Cohesion: 0.13
Nodes (22): CHIP_BAR_HIDDEN_KEY, CHIP_BAR_POS_KEY, clampOutFromNav(), DESKTOP_MIN_PX, DOCK_GAP, dockedMaxWidth(), loadHidden(), loadSavedPos() (+14 more)

### Community 67 - "ensureIncidentIpp.ts"
Cohesion: 0.14
Nodes (21): EnsureIncidentIppInput, EnsureIncidentIppResult, findExistingIppLog(), IncidentPointFeature, IppLogRef, isPointFeature(), kwValue(), listFeatures() (+13 more)

### Community 68 - "sarBriefingPdf.ts"
Cohesion: 0.14
Nodes (20): BriefingSubjectColumn, IrBriefingForm, BriefingPdfForm, buildFieldLayoutMap(), buildSarBriefingPdf(), collectFieldValues(), drawSingleLine(), drawWrapped() (+12 more)

### Community 69 - "requireActiveMission"
Cohesion: 0.15
Nodes (23): onRefresh(), assignmentForChoice(), keyForForm(), onCompDeleteRespondent(), onCompSave(), onDeleteAll(), onGarDeleteRespondent(), onGarSaveClick() (+15 more)

### Community 70 - "IapBuilder.vue"
Cohesion: 0.12
Nodes (21): { activeMission }, busy, ctx, emit, error, fromLocalInput(), hasUas, load() (+13 more)

### Community 71 - "iapData.ts"
Cohesion: 0.23
Nodes (22): formsLabel, IncidentCategory, buildIapSections(), hasMedicalContent(), header(), IapContext, iapFormPlanFor(), IapInputs (+14 more)

### Community 72 - "hastyTeamTree.ts"
Cohesion: 0.14
Nodes (20): onDropNode(), onDropRoot(), removeNode(), appendPaletteDrop(), applyPaletteToRoot(), AssignmentNodeSelf, AssignmentNodeType, deleteNodeFromTree() (+12 more)

### Community 73 - "propertyStores.ts"
Cohesion: 0.20
Nodes (18): debriefRecordFromValue(), registryEntryFromValue(), createMemoryPropertyServer(), debriefPrefix(), debriefPropertyKey(), OP_PREFIX, opMissionKey(), opNumberFromMissionKey() (+10 more)

### Community 74 - "iapPlanPersistence.ts"
Cohesion: 0.11
Nodes (21): blankAircraftRow(), blankCommsListRow(), blankContactRow(), IapAircraftRow, IapAssignmentPlan, IapCommsListRow, IapCommsRow, IapContactRow (+13 more)

### Community 75 - "Persistent plugin chip bar + float minimize (CloudTAK plugins)"
Cohesion: 0.13
Nodes (18): Behavior (this plugin), Controller sketch (persistent chip), Copy from this repo, Duplicate Vue `Component` types, Header minimize (optional), Host APIs, Out of scope, Permanent taskbar chip (+10 more)

### Community 76 - "d4hRoster.ts"
Cohesion: 0.13
Nodes (19): filteredMembers, refreshD4hAgencyCount(), D4H_META_KEY, D4H_ROSTER_KEY, externalResourceMatchesFilter(), filterAndSortExternalResources(), filterAndSortPaletteMembers(), formatD4hSyncTime() (+11 more)

### Community 77 - "subjectInfo.ts"
Cohesion: 0.18
Nodes (20): onDobChange(), subjectToColumn(), buildParts(), buildSubjectKeywords(), calculateAgeFromDateOfBirth(), effectiveSubjectAge(), fieldsFromLog(), formatDateOfBirth() (+12 more)

### Community 78 - "fileTarget.ts"
Cohesion: 0.16
Nodes (16): onChooseFolder(), onClearFolder(), refreshFolder(), chooseFileTarget(), clearFileTarget(), DirectoryHandleLike, downloadFallback(), ensureWritable() (+8 more)

### Community 79 - "wisarPreview.ts"
Cohesion: 0.19
Nodes (11): ContourCollection, clearPreview(), layerIds(), PREVIEW_FILL, PREVIEW_LINE, PREVIEW_SOURCE, PreviewMap, previewSourceId() (+3 more)

### Community 80 - "src/index.ts"
Cohesion: 0.12
Nodes (12): emit, HostFloatComponent, IncidentManagerFloatShell, IncidentManagerPane, MenuItemConfig, MenuItemIconType, _typecheck, appStore (+4 more)

### Community 81 - "@tak-ps/vue-tabler"
Cohesion: 0.13
Nodes (11): @tak-ps/vue-tabler, TaskTab, ActionSection, activeChecklist, ChecklistKey, ContainChecklist, expandedSections, InvestigateChecklist (+3 more)

### Community 82 - "demobPackage.ts"
Cohesion: 0.20
Nodes (17): archivableSources(), buildManifest(), defaultDemobOptions(), DemobOptions, DemobSourceRef, DemobVariant, ManifestEntry, retainedSources() (+9 more)

### Community 83 - "defaultIpp.ts"
Cohesion: 0.17
Nodes (17): asRecord(), DefaultIpp, finiteNumber(), ippAfterSavedForm(), ippFromSubjects(), IppLatLng, IppSchema, IppSubject (+9 more)

### Community 84 - "MissionSchema"
Cohesion: 0.16
Nodes (14): applyMissionContextToSchema(), MissionSchema, applyDefaultAgencyToSchema(), applyResourceAssignmentsToSchema(), defaultAgencyFromSchema(), loadResourceAssignmentsFromMission(), resourceAssignmentsFromSchema(), saveResourceAssignmentsToMission() (+6 more)

### Community 85 - "MissionTemplateLogModal.vue"
Cohesion: 0.15
Nodes (14): ../../../../src/base/subscription.ts, busy, destinationLabel, emit, EMPTY_SCHEMA, error, formSchema, onDismiss() (+6 more)

### Community 86 - "cloudtak-plugin-incidentManager"
Cohesion: 0.11
Nodes (17): Branches, cloudtak-plugin-incidentManager, Dev, Features, First use notes, Important: local plugin copy on the VPS, Installation (VPS / Docker Compose), Integration paths (all native, no core changes) (+9 more)

### Community 87 - "entities.ts"
Cohesion: 0.16
Nodes (8): ClueRecord, DebriefRecord, RollupResult, SegmentRollup, Scenario, PoaLockInputs, templateLogTarget, RollupInputs

### Community 88 - "IncidentChangedBanner.vue"
Cohesion: 0.19
Nodes (16): { activeKey, activeHTab }, changed, changedLabels, emit, onReload(), screen, COLLECTION_LABELS, keyLabel() (+8 more)

### Community 89 - "ConsensusTable.vue"
Cohesion: 0.13
Nodes (16): emit, entryIndex, methodIndex, onEntryAccept(), onMethodAccept(), props, SegmentRef, emit (+8 more)

### Community 90 - "WisarToolsPane.vue"
Cohesion: 0.13
Nodes (14): ipp, landsarExpanded, lastJob, wisarExpanded, PhysicalWisar, open, { activeMission }, ipp (+6 more)

### Community 91 - "subjectsPersistence.ts"
Cohesion: 0.17
Nodes (18): onYesNoLabelChange(), SentSubject, SubjectDraft, ParsedSubject, parseSubjectYesNo(), SubjectForm, ensureSubjectsArray(), isSchemaSubjectRecord() (+10 more)

### Community 92 - "schemaCollections.ts"
Cohesion: 0.16
Nodes (15): ArraySpec, COLLECTION_PREFIX, ensureParent(), extractCollections(), FieldMapSpec, fieldToSeg(), isRecord(), MapSpec (+7 more)

### Community 93 - "schemaMission"
Cohesion: 0.17
Nodes (15): applyExpansion(), applySplit(), refresh(), uidForPolygon(), addPdfToDataSync(), addPdfToDataSync(), addPdfToDataSync(), addPdfToDataSync() (+7 more)

### Community 94 - "LoggerPane.vue"
Cohesion: 0.11
Nodes (17): LoggerPane, AreaSearch, Ics201, IncidentPost, InitialConsensus, InitialInformation, IrBriefing, labels (+9 more)

### Community 95 - "useResourceAssignments.ts"
Cohesion: 0.14
Nodes (17): createAssignment(), removeAssignmentRecord(), resetForm(), assignments, defaultAgency, loading, saving, schemaHash (+9 more)

### Community 96 - "mpsParser.ts"
Cohesion: 0.18
Nodes (17): parseCadIdentifiers(), annotateRemarks(), getEventId(), getMpsRows(), getRemarksDates(), getRemarksSection(), mergeNearbyRows(), find() (+9 more)

### Community 97 - "r"
Cohesion: 0.23
Nodes (17): e(), fi(), gi(), Gr(), gt(), Hr(), i(), s() (+9 more)

### Community 98 - "history.ts"
Cohesion: 0.20
Nodes (14): history, realOpNumbers, SegmentState, applyClue(), clampPct(), CLUE_WEIGHTS, computeOpHistory(), computeScenario() (+6 more)

### Community 99 - "addRowSegments"
Cohesion: 0.15
Nodes (15): addRowSegments(), isPointFeature(), isPolygonFeature(), listMissionFeatures(), loadCommonSub(), loadFeatures(), mergeFeaturesByUid(), onAddRowSegments() (+7 more)

### Community 100 - "resourceAssignments.ts"
Cohesion: 0.21
Nodes (15): onResourceTeamDragStart(), ASSIGNMENT_RESOURCES, AssignmentResource, DEFAULT_AGENCY, mergeResourceAssignmentPatch(), normalizeEta(), normalizeOpNumber(), normalizeResourceAssignment() (+7 more)

### Community 101 - "personnel.ts"
Cohesion: 0.20
Nodes (14): mergeUploadedPersonnel(), onPersonnelFileChange(), MAX_PERSONNEL, membersFromJson(), mergePersonnelById(), OPTIONAL_FIELDS, optionalString(), parseCsvLine() (+6 more)

### Community 102 - "opAssignmentPersistence.ts"
Cohesion: 0.19
Nodes (13): loadFeatureTargets(), OpAssignment, AssignmentStore, AssignableFeature, centroid(), lineFromFeature(), listAssignableFeatures(), payloadFromFeature() (+5 more)

### Community 103 - "searchScenarios.ts"
Cohesion: 0.20
Nodes (15): scenarioKeyFromLog(), buildSearchScenario(), isScenarioLetter(), parseMobility(), parsePriority(), parseResponsiveness(), SCENARIO_LETTERS, ScenarioLetter (+7 more)

### Community 104 - "wisarOverlays.test.ts"
Cohesion: 0.24
Nodes (7): Bounds, clearOverlay(), imageCoordinates(), OVERLAY_OPACITY, OverlayMap, showOverlay(), B

### Community 105 - "wisarKeep.ts"
Cohesion: 0.20
Nodes (8): KeepDeps, KeepOptions, keepOverlay(), KeepPhase, keptLayerName(), pad(), AZ_TARR, TT_FOLDER_NAME

### Community 106 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, baseUrl, esModuleInterop, jsx, module, moduleResolution, noEmit, paths (+7 more)

### Community 107 - "ADR-001: Store incident planning data as TAK Mission Properties"
Cohesion: 0.13
Nodes (13): ADR-001: Store incident planning data as TAK Mission Properties, Alternatives Considered, Consequences, Context, Date, Keep `mission_schema.json`, add locking or merging, One key per schema field only (layout v2), Status (+5 more)

### Community 108 - "missionFeatures.ts"
Cohesion: 0.29
Nodes (12): ensureConnOpen(), plainCenter(), plainRing(), pushFeatureToMission(), pushLineToMission(), pushPointToMission(), pushPolygonToMission(), RingStyle (+4 more)

### Community 109 - "SchemaStorageCard.vue"
Cohesion: 0.21
Nodes (13): busy, check(), confirming, emit, error, migrate(), migratedKeys, props (+5 more)

### Community 110 - "dashboardPanels.ts"
Cohesion: 0.23
Nodes (13): compareD4hRefAsc(), DashboardTeamRoster, DashboardTeamRosterEntry, dashboardTeamsFromOrgChart(), LOCAL_TIME_OPTS, memberRefMap(), refForMemberId(), rosterEntriesForNode() (+5 more)

### Community 111 - "vue"
Cohesion: 0.19
Nodes (10): vue, { content, loading, error }, emit, props, { content }, cache, SafeContent, useWisarContent() (+2 more)

### Community 112 - "rollup.ts"
Cohesion: 0.29
Nodes (11): onExportWc3(), clampFraction(), clampPct(), computeRollup(), cumulativePod(), debriefsBySegment(), fractionsFromAreas(), missProbability() (+3 more)

### Community 113 - "consensus.ts"
Cohesion: 0.23
Nodes (11): onSetupAccept(), respondent(), SEGS, alignRespondentToSegments(), ConsensusRespondent, defaultConsensusState(), defaultRespondent(), OCONNOR_WEIGHTS (+3 more)

### Community 114 - "nowBriefingDate"
Cohesion: 0.21
Nodes (14): applyScenarioToDraft(), blankDraft(), blankPdfHeader(), cancelEdit(), drafts, loadAll(), prefillPdfHeader(), recallSchema() (+6 more)

### Community 115 - "Segment Boundaries"
Cohesion: 0.14
Nodes (13): 2-Dimensional Map., Explanation, How to Segment, Identify Segments, Paper, Practical Matters, ROW, Segment Boundaries (+5 more)

### Community 116 - "loadIapInputs"
Cohesion: 0.19
Nodes (12): IapFormId, iapFormPlan(), IapPlanInput, isUasLabel(), UAS_KEYWORDS, usesExtendedIcsSet(), isUasResource(), loadIapInputs() (+4 more)

### Community 117 - "ConsensusSetupModal.vue"
Cohesion: 0.17
Nodes (12): emit, error, filename, incidentName, onAccept(), props, respondentCount, respondentCountLabel (+4 more)

### Community 118 - "popout.ts"
Cohesion: 0.31
Nodes (12): addStyleClone(), cleanup(), cloneStyleNode(), closePopout(), copyStyles(), onPopoutClosed(), openPopout(), POPOUT_WINDOW_NAME (+4 more)

### Community 119 - "subjectProfiles.ts"
Cohesion: 0.24
Nodes (11): onAgencyFileChange(), onSubjectFileChange(), MAX_AIDING_AGENCIES, MAX_SUBJECT_PROFILES, parseAidingAgenciesText(), parseStringListCsv(), parseStringListJson(), parseStringListText() (+3 more)

### Community 120 - "deploymentDefaults.ts"
Cohesion: 0.27
Nodes (9): deploymentDefaults, asText(), basenameOf(), DeploymentBundle, DeploymentConfig, DeploymentModule, loadDeploymentBundle(), readConfig() (+1 more)

### Community 121 - "ADR-002: Operational periods are planned hidden, activated and closed by hand"
Cohesion: 0.18
Nodes (10): ADR-002: Operational periods are planned hidden, activated and closed by hand, Alternatives Considered, Close the current OP automatically on activation, Consequences, Context, Date, Decision, Open every OP to the field at creation (previous behaviour) (+2 more)

### Community 122 - "ADR-003: POA lock is explicit, and debrief corrections mark a lock stale"
Cohesion: 0.18
Nodes (10): ADR-003: POA lock is explicit, and debrief corrections mark a lock stale, Alternatives Considered, Block changes to debriefs a lock has used, Consequences, Context, Date, Decision, Recompute the locked POA automatically after a correction (+2 more)

### Community 123 - "ensureMissionFolder"
Cohesion: 0.27
Nodes (9): softEnsureAssignmentFolder(), ensureMissionFolder(), findLayerByName(), missionFolderDest(), missionLayerHeaders(), persistLocalLayer(), sleep(), unwrapMissionLayer() (+1 more)

### Community 124 - "localDateString"
Cohesion: 0.35
Nodes (8): shortDt(), shortDt(), fmtDtg(), shortDt(), buildMissionName(), localDateString(), localDateTimeLabel(), pad2()

### Community 125 - "ippPersistence.ts"
Cohesion: 0.25
Nodes (10): persistIppToSchemaAndOp(), ensureIncidentIpp(), writeIppAreaLog(), applyIppToSchema(), asRecord(), finiteNumber(), parseIppType(), readIppFromSchema() (+2 more)

### Community 126 - "wisarContent.ts"
Cohesion: 0.33
Nodes (9): toSafe(), ALLOWED, cleanElement(), cleanStyle(), cssVariableStyle(), DROP_WITH_CONTENT, isSafeUrl(), sanitizeWisarHtml() (+1 more)

### Community 127 - "trackLogPersistence.ts"
Cohesion: 0.20
Nodes (9): ParsedTrack, createTrackContentsUploader(), createTrackLogPublisher(), FeatureLister, lineCoords(), LineFeatureLike, linesFrom(), TRACK_FILE_ACCEPT (+1 more)

### Community 128 - "casiePersistence.ts"
Cohesion: 0.31
Nodes (10): applyConsensusToSchema(), asNumber(), asString(), consensusFromSchema(), loadCasieFromMission(), LoadedCasie, METHODS, sanitizeRespondent() (+2 more)

### Community 129 - "layout"
Cohesion: 0.29
Nodes (10): attachObservers(), layout(), onGripPointerMove(), clampToShell(), dockedPosition(), isDesktopWidth(), queryActiveMission(), queryLeftControls() (+2 more)

### Community 130 - "orgChartPersistence.ts"
Cohesion: 0.42
Nodes (9): emptyTree(), normalizeLogKeywords(), applyOrgChartToSchema(), deleteLegacyOrgChartLogs(), latestOrgChartFromLogs(), loadOrgChartFromMission(), ORG_CHART_TREE_KEYWORD, orgChartFromSchemaValue() (+1 more)

### Community 131 - "wisarTools.ts"
Cohesion: 0.25
Nodes (5): emit, HostFloatComponent, openWisarTools(), WISAR_TOOLS_UID, WisarToolsFloatShell

### Community 132 - "poaShares.ts"
Cohesion: 0.44
Nodes (7): splitSharesOk, allocateParentValue(), defaultPoaShares(), POA_SHARE_TOLERANCE, poaSharesMatchSource(), round2(), sumPoaShares()

### Community 133 - "ce"
Cohesion: 0.28
Nodes (9): ce(), de(), he(), ie(), Ke(), le(), oe(), qe() (+1 more)

### Community 134 - "flyToFeature.ts"
Cohesion: 0.29
Nodes (5): centerPendingLocation(), onLocationConfirmNo(), onLocationConfirmYes(), flyToCoords(), focusMainWindow()

### Community 135 - "flyToFeature"
Cohesion: 0.25
Nodes (8): onFlyTo(), flyToCandidate(), onFlyTo(), onFlyTo(), onFlyTo(), onFlyTo(), onFlyTo(), flyToFeature()

### Community 136 - "caltopo.ts"
Cohesion: 0.32
Nodes (6): caltopoAvailable(), CaltopoCreateRequest, CaltopoCreateResult, CaltopoProvider, createCaltopoMap(), Window

### Community 137 - "tacticRiskPersistence.ts"
Cohesion: 0.46
Nodes (7): mergeLegacyComplacencyAssessments(), tacticAssessmentsFromSchemaValue(), tacticEntryToSchemaRecord(), applyTacticAssessmentsToSchema(), loadTacticAssessmentsFromMission(), riskAssessmentForUid(), tacticAssessmentsFromSchema()

### Community 138 - "Ba"
Cohesion: 0.39
Nodes (8): Ba(), Ea(), La(), Na(), Oa(), qa(), Ra(), Ua()

### Community 139 - "jt"
Cohesion: 0.39
Nodes (8): Dt(), Et(), Ht(), jt(), Kt(), Pt(), Vt(), Xt()

### Community 140 - "es"
Cohesion: 0.38
Nodes (7): as(), es(), hs(), os(), ss(), ts(), zs()

### Community 141 - "ge"
Cohesion: 0.38
Nodes (7): ee(), ge(), pe(), re(), ve(), We(), ye()

### Community 142 - "FeatureCallsignCell.vue"
Cohesion: 0.33
Nodes (4): copied, emit, modalOpen, props

### Community 143 - "send"
Cohesion: 0.33
Nodes (6): buildKeywords(), fieldsFromLog(), loadSent(), onSend(), send(), summarize()

### Community 144 - "assets.d.ts"
Cohesion: 0.33
Nodes (4): ImportMeta, *.md, *.md?raw, *.pdf?url

### Community 145 - "ds"
Cohesion: 0.40
Nodes (6): $a(), cs(), ds(), fs(), Ms(), us()

### Community 146 - "ki"
Cohesion: 0.47
Nodes (6): ai(), bi(), hi(), ki(), wi(), xi()

### Community 147 - "yi"
Cohesion: 0.40
Nodes (6): li(), pi(), ui(), vi(), yi(), Zi()

### Community 148 - "buildSplitRows"
Cohesion: 0.50
Nodes (5): buildSplitRows(), loadExpandCandidates(), nextSegmentNumber(), rebuildExpansionRows(), startExpansion()

### Community 149 - "Vr"
Cohesion: 0.60
Nodes (5): Jr(), Mr(), Vr(), Wr(), Xr()

### Community 150 - "vendor/README.md"
Cohesion: 0.40
Nodes (4): Updating, Updating, vue-hasty-team (org chart), Why this is vendored

### Community 151 - "Initial Consensus"
Cohesion: 0.50
Nodes (3): ASSUMPTIONS, Initial Consensus, RULES

### Community 152 - "Establishing the Search Area"
Cohesion: 0.50
Nodes (3): Deductive Reasoning Method, Establishing the Search Area, Final Steps in Establishing the Search Area

## Knowledge Gaps
- **8 isolated node(s):** `@tak-ps/cloudtak`, `typescript`, `vue-tsc`, `puppeteer`, `ADR-0003` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1581 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `vue` to `missionSchema.ts`, `AreaSearch.vue`, `SearchArea.vue`, `WisarTarrForm.vue`, `IncidentPost.vue`, `wisarTools.ts`, `RiskAssessment.vue`, `CasiePane.vue`, `SettingsPane.vue`, `SubjectInformation.vue`, `OrganizationTab.vue`, `FeatureCallsignCell.vue`, `floatMinimize.ts`, `ResourcesTab.vue`, `PoaLockCard.vue`, `SearchUrgency.vue`, `WisarResults.vue`, `HastyTeamRoot.vue`, `SearchScenarios.vue`, `AssignmentsTab.vue`, `DashboardTab.vue`, `LpbTab.vue`, `useIncident.ts`, `IrBriefing.vue`, `ClueLog.vue`, `WisarTravelTimeForm.vue`, `CreateOpenPane.vue`, `IncidentManagerPane.vue`, `liveIncident.ts`, `Ics201.vue`, `pluginSettings.ts`, `Segmentation.vue`, `useWorkAssignments.ts`, `NavHelpButton.vue`, `OpenExistingMission.vue`, `InitialConsensus.vue`, `usePluginSettings`, `IncidentManagerChipBar.vue`, `ResponderEntryModal.vue`, `WrapUpPane.vue`, `package.json`, `WisarIppPicker.vue`, `IapBuilder.vue`, `src/index.ts`, `@tak-ps/vue-tabler`, `MissionTemplateLogModal.vue`, `IncidentChangedBanner.vue`, `ConsensusTable.vue`, `WisarToolsPane.vue`, `LoggerPane.vue`, `useResourceAssignments.ts`, `SchemaStorageCard.vue`, `ConsensusSetupModal.vue`, `popout.ts`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useIncident()` (e.g. with `Why remount is OK` and `closeNoMissionModal()`) actually correct?**
  _`useIncident()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tak-ps/cloudtak`, `typescript`, `vue-tsc` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `missionSchema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.036357458375807 - nodes in this community are weakly interconnected._
- **Why does `@tak-ps/vue-tabler` connect `@tak-ps/vue-tabler` to `missionSchema.ts`, `AreaSearch.vue`, `SearchArea.vue`, `IncidentPost.vue`, `RiskAssessment.vue`, `CasiePane.vue`, `SettingsPane.vue`, `SubjectInformation.vue`, `OrganizationTab.vue`, `FeatureCallsignCell.vue`, `floatMinimize.ts`, `ResourcesTab.vue`, `PoaLockCard.vue`, `SearchUrgency.vue`, `HastyTeamRoot.vue`, `SearchScenarios.vue`, `AssignmentsTab.vue`, `DashboardTab.vue`, `LpbTab.vue`, `useIncident.ts`, `IrBriefing.vue`, `ClueLog.vue`, `CreateOpenPane.vue`, `IncidentManagerPane.vue`, `Ics201.vue`, `Segmentation.vue`, `OpenExistingMission.vue`, `InitialConsensus.vue`, `IncidentManagerChipBar.vue`, `ResponderEntryModal.vue`, `WrapUpPane.vue`, `package.json`, `IapBuilder.vue`, `src/index.ts`, `MissionTemplateLogModal.vue`, `ConsensusTable.vue`, `WisarToolsPane.vue`, `LoggerPane.vue`, `SchemaStorageCard.vue`, `ConsensusSetupModal.vue`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `AreaSearch.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.027179188507086 - nodes in this community are weakly interconnected._
- **Why does `@tabler/icons-vue` connect `floatMinimize.ts` to `missionSchema.ts`, `AreaSearch.vue`, `SearchArea.vue`, `wisarTools.ts`, `IncidentPost.vue`, `RiskAssessment.vue`, `CasiePane.vue`, `SettingsPane.vue`, `SubjectInformation.vue`, `OrganizationTab.vue`, `FeatureCallsignCell.vue`, `ResourcesTab.vue`, `SearchUrgency.vue`, `HastyTeamRoot.vue`, `SearchScenarios.vue`, `DashboardTab.vue`, `useIncident.ts`, `IrBriefing.vue`, `CreateOpenPane.vue`, `IncidentManagerPane.vue`, `Ics201.vue`, `NavHelpButton.vue`, `IncidentManagerChipBar.vue`, `package.json`, `src/index.ts`, `@tak-ps/vue-tabler`, `WisarToolsPane.vue`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._