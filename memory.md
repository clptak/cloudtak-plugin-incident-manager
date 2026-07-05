# Incident Manager plugin — deferred work & context

## Team assignment CoT ↔ mission log linkage (`entryUid`) — IMPLEMENTED

**Status:** Implemented on org chart sync (`syncOrgChartToDataSync`).

- Team nodes with `assignmentUid` → log `entryUid` + `uid:` keyword (`orgChartExport.ts`, `orgChartDataSync.ts`).
- Same log `content` mirrored to `properties.remarks` on the assignment CoT (`updateMissionFeatureRemarks` in `missionFeatures.ts`).
- Requires TAK websocket for remarks update (same as Search Area features).

**Open decisions (unchanged):**

- If assignment CoT is removed from a team, stale `entryUid` on an old log may remain until re-sync.
- Multiple teams sharing one assignment CoT: last synced team wins on remarks.

---

## Assignments — implemented context (for future sessions)

- Org chart tree: `assignments_org_chart` in `mission_schema.json` (auto-save debounced ~800ms).
- ICS 201 flatten export: `ics-org` mission logs on manual sync; not round-trip tree state.
- Palette slot config (ICS/rescue dropdowns before drag): **not** persisted yet.
