# ADR-003: POA lock is explicit, and debrief corrections mark a lock stale

## Status
Accepted (implemented)

## Date
2026-10-11

## Context
Search incidents shift each segment's probability of area (POA) after every
debrief: POA × (1 − POD/100), renormalized with the rest of the world (ROW).
Debriefs on the same segment in the same OP combine as independent searches
(cumulative POD = 1 − Π(1 − POD·coverage)), and cumulative probability of
success compounds across OPs.

Two problems came up while testing concurrent edits:

1. A second debrief for the same resource on the same segment in the same OP
   was stored as another search, so a *correction* was counted twice
   (for example 50% then a corrected 30% became 65%).
2. Planning needs a fixed POA to build the next period's IAP and priorities,
   while debriefs from the current period keep arriving and may be corrected.

## Decision
**Debrief corrections** (implemented):
- Recording a debrief for a resource that already has one on that segment in
  that OP prompts **Replace it / Add as another sortie / Cancel**. The check
  reads the server, so it also catches an entry made moments earlier in
  another window.
- Replace and Edit overwrite the existing record in place: it keeps its
  recorded time and attached tracks, and gains `correctedAt`. Delete removes
  the record; attached track lines stay in the OP DataSync.

**POA lock** (CASIE tab, `src/domain/poaLock.ts`):
- Locking the POA is an explicit planning action for an upcoming OP, stored
  under its own key (`op.<n>.poa.<lockedAt>`). It records the POA values and
  exactly which debriefs it was computed from, with a fingerprint of each.
- **Corrections remain allowed after a lock.** When a debrief a lock used is
  replaced, edited or deleted, the lock is shown as **stale** ("based on a
  debrief that changed since — re-lock?"). Planning decides whether to
  re-lock; nothing changes the locked values automatically.
- A lock for OP *n* uses the Initial Consensus plus every debrief and clue
  recorded for OPs before *n*. It also goes stale when one of those is added
  late, or when the consensus or segments change. Only what moves the POA
  counts: attaching a track, renaming a debrief's label, or a correction that
  keeps the same POD and coverage does not make a lock stale.
- Re-locking writes a new key; earlier locks for the OP are kept.

## Alternatives Considered

### Block changes to debriefs a lock has used
- Pros: a lock could never silently disagree with the record.
- Cons: a wrong POD would stay in the incident record, or be "fixed" only by
  adding another sortie, which double-counts it.
- Rejected (Paul, 2026-10-11).

### Recompute the locked POA automatically after a correction
- Rejected: the IAP and assignments built on the lock would change under
  planning without a decision being made.

### Treat every debrief as a new sortie (previous behaviour)
- Rejected: corrections were counted twice in the rollup.

## Consequences
- The rollup counts a corrected debrief once.
- A lock can become stale; the UI must make that visible wherever the lock is
  used (POA display, IAP).
- Because Mission Properties keep no history (ADR-001), the lock's own key is
  the record of what planning used.
