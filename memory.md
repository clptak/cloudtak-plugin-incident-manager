# Incident Manager plugin — deferred work & context

## Team assignment CoT ↔ mission log linkage (`entryUid`) — DEFERRED

**Status:** Not implemented; revisit when ready.

**User intent:** When creating a team in Assignments with an **assignment CoT** selected from the palette dropdown, link that mission CoT uuid to the team’s DataSync mission log entry so Node-CoT / downstream tooling can resolve log ↔ CoT.

**Existing data (already in place):**

- Palette: `teamAssignmentUid` → `AssignmentsTab.vue` CoT dropdown (`listMissionCots`).
- On drag: `assignmentUid` and `assignmentCallsign` stored on team node (`hastyTeamTree.ts` → `teamNodeFromPaletteDrop`).
- Chart structure persists in `mission_schema.json` → `assignments_org_chart` (`orgChartPersistence.ts`).
- ICS export: team lines via **Sync org chart to DataSync** → `ics-org` logs (`orgChartExport.ts`, `orgChartDataSync.ts`); no `entryUid` today.

**Prior art in this repo:** Search Area writes logs with `entryUid: <cot-uuid>` and `uid:<uuid>` keyword — see `writeAreaLog()` in `src/components/panes/logger/SearchArea.vue`.

**Proposed implementation (when approved):**

1. `OrgChartExportLine`: add optional `entryUid?: string`.
2. `orgChartLinesFromTree`: for team nodes, set `entryUid` from `self.assignmentUid`.
3. `buildOrgChartLogKeywords`: add `uid:${entryUid}` when present.
4. `orgChartDataSync.upsertOrgLine`: pass `entryUid` on `sub.log.create` / `update` (cast log API like SearchArea’s `LogWriteBody`).
5. **CoT Remarks mirror (same sync pass):** after each team log upsert that has `entryUid`, load that mission CoT by uuid, set `properties.remarks` to the **same string** as the log `content` (e.g. `Team 1: Jane Smith, Bob Jones`), and push via `sub.feature.update(worker, cot)` — same stack as `pushFeatureToMission()` in `src/lib/missionFeatures.ts`.

**CoT remarks — technical notes:**

- CloudTAK uses `feature.properties.remarks` (see upstream `COT.styleProperties` in `api/web/src/base/cot.ts`; defaults to `'None'` if missing).
- **Do not** create a new feature; load existing from `sub.feature.list({ refresh: true })`, merge remarks only, preserve geometry/callsign/type/`dest`, then `COT.load(feat, { mode: MISSION, mode_id }, { skipSave: true })` + `sub.feature.update`.
- Requires TAK websocket open (`ensureConnOpen` in `missionFeatures.ts`) — same constraint as Search Area polygons.
- Suggested helper: `updateMissionCotRemarks({ missionGuid, missionToken, uid, remarks })` in `missionCots.ts` or `missionFeatures.ts`.
- **Overwrite** remarks with log content (user asked for “same entry as the log entry”), not append — unless later UX wants append.
- If uuid not found on mission, skip with sync warning (don’t fail whole org sync).
- If multiple teams share one assignment CoT, last synced team wins on remarks (same as duplicate-CoT open question).

**Open decisions:**

- **When to write:** Sync-only (simplest; matches ICS 201 flow) vs immediate log on team drop (faster CoT link, more log churn).
- **Clearing links:** If assignment CoT is removed from a team, does `log.update` need an explicit clear of `entryUid`?
- **Duplicate CoTs:** Multiple teams could share one assignment uuid — acceptable?

**Files to touch:** `src/lib/orgChartExport.ts`, `src/lib/orgChartDataSync.ts`, `src/lib/missionCots.ts` or `src/lib/missionFeatures.ts` (remarks update), optionally `AssignmentsTab.vue` help text + sync result message (e.g. “N assignment CoTs updated”).

---

## Assignments — implemented context (for future sessions)

- Org chart tree: `assignments_org_chart` in `mission_schema.json` (auto-save debounced ~800ms).
- ICS 201 flatten export: `ics-org` mission logs on manual sync; not round-trip tree state.
- Palette slot config (ICS/rescue dropdowns before drag): **not** persisted yet.
