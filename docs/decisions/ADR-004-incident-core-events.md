# ADR-004: Incident Core Events: one MGMT event per incident, one field event per OP

## Status
Accepted (implemented)

## Date
2026-10-19

## Context
CloudTAK Core Events (`/api/core/event`) put an incident on the Event Boards
of the channels it is shared with. A CAD call should become an event as soon
as it arrives, sometimes before anyone creates a DataSync. Two things make a
single event per incident a poor fit:

- An event is shared with a set of channels. The management view (CAD detail,
  caller information, every DataSync) must stay off the field channels.
- Field users need an event for the work they are doing now, which starts and
  ends with each operational period.

CloudTAK does not refuse a second user-created event with the same external
ID, so the plugin has to find an existing event for a CAD call itself.

## Decision
**MGMT event** (one per incident, one-to-many):
- Created from a pasted CAD call, on the **Management Channels** only, and put
  in the Nominated column of those channels' boards.
- Name and remarks: `{Case Number, else Event ID} - {Type}`. Location: the two
  cross streets, else the address text. Point: Address `LL(...)`. Started:
  Dispatched (else Created) at the deployment's CAD UTC offset (default
  `-07:00`). Priority: CAD 1 critical, 2 high, 3 medium, 4 or 5 low.
- External IDs: `CAD` (Event ID) at create; `Case_Number` and `DEMA` are kept
  in step with Initial Information on every save (an empty value removes one).
- Missions: the MGMT sync, the common map, and every OP sync (added at Plan or
  Open now).
- `metadata`: `{ role: 'mgmt', subjectProfile }`.
- Linked from the incident record as `core_event` (key `s.core-event`).
- Ended only by hand: **End the incident event** on Wrap Up and the Dashboard.

**Field event** (one per OP, one-to-one):
- Created when the OP is activated (or opened straight away), on the OP's
  channels minus the management channels, nominated on those boards.
- Operational detail only: `{incident id} - OP{n}`, the MGMT event's point,
  location and priority, the default symbol. No CAD Type, remarks or caller
  information, and no `CAD` external ID (it carries `OP` = the OP sync guid),
  so it is never mistaken for the incident event.
- `metadata`: `{ role: 'field', incidentEvent, opNumber }`. Linked from the
  OP's registry entry as `fieldEventId`. Ended when the OP is closed.

**Create Mission**:
- A **Create Event** toggle beside Fill form (on by default). With CAD text
  pasted, creating the mission reuses the active MGMT event whose `CAD` ID
  matches, or creates one.
- **Create event only** makes the MGMT event without a DataSync.
- Without CAD text, or with the toggle off, an **Incident event** picker lists
  active MGMT events; picking one fills Activity Number, Date and Location
  Coordinates and attaches the new mission to it.

**Symbols**: every event uses type `13061000001418000000` and a white marker
unless the deployment supplies an icon map (`eventIconsFile`, see
[Event icons](../event-icons.md)). The map applies to MGMT events by CAD Type
code; field events use its `default` entry.

Event steps never fail the incident step they follow: the mission, OP or
save is done, and an event problem is reported in the same notice.

## Alternatives Considered

### One event for the whole incident, shared with every channel
- Rejected: CAD and caller detail would reach the field channels.

### Create a new event whenever a mission is created
- Rejected: a second mission for the same call (for example a simultaneous
  operation) would duplicate the event. Matching the `CAD` ID reuses it.

### End the MGMT event automatically at demobilization
- Rejected (Paul): the event may outlive the search (follow-up, evidence).

## Consequences
- An incident created before this change has no `core_event`; nothing is
  created for it, and the OP steps skip events.
- A user who cannot see the MGMT event (not on its channels) gets no field
  event when activating an OP; the notice says why.
- The event list is read in pages of 100 to find a matching `CAD` ID; a very
  large number of visible events makes Create Mission slower.
