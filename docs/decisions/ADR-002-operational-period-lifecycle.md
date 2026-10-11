# ADR-002: Operational periods are planned hidden, activated and closed by hand

## Status
Accepted

## Date
2026-10-11

## Context
Each operational period (OP) has its own DataSync that field users subscribe
to. Planning needs to build the next period's IAP, order resources against
it and publish assignments into it while the current period is still being
worked, without field users seeing the next period early. Teams coming off
the last shift may still need to debrief into the current period after the
next one starts.

TAK Server changes a mission's groups only when the caller is the mission
owner (MISSION_OWNER via the `MissionAuthorization` token, or an admin), is a
member of every group being assigned, and sends `allowGroupChange=true`. When
those conditions are not met it can still answer 200 and leave the groups
unchanged.

## Decision
- **Plan:** "Plan OP*n*" creates the OP DataSync on the incident's management
  channels only (status `planning`) and stores the field + management
  channels for later (`plannedChannels`). Only one OP can be in planning.
- **Activate:** applies the planned channels (status `open`) and publishes the
  IPP. The previous OP is left open.
- **Close** is always a separate, manual action with an inline confirmation.
  It removes field channels. It is never a side effect of activating the next
  OP.
- **Open now** remains available for opening an OP to the field immediately.
- Clues, field logs and the IPP go to the field's current OP
  (`currentOpPeriod`), which never returns a planning OP. "Work on" chooses
  which OP the assignments, roster and IPP controls apply to.
- **Every channel change is verified** against the groups TAK reports back;
  a mismatch is an error and the OP's status does not change.
- **The OP owner token** is captured at create and kept in the registry.
  Channel changes address the mission by guid, so CloudTAK can fall back to
  the caller's own stored subscription token when no owner token was saved.

## Alternatives Considered

### Close the current OP automatically on activation
- Rejected (Paul, 2026-10-11): someone must decide when a period ends; teams
  returning from the last shift still debrief into it.

### Open every OP to the field at creation (previous behaviour)
- Rejected: the next period's plan, assignments and IAP would be visible to
  the field before the period starts.

### Trust TAK's 200 response for group changes
- Rejected: TAK silently ignored group changes made without owner rights,
  which left OPs open to the field after "Close" without any error.

## Consequences
- Activation and close depend on the owner token. OPs created before the
  owner-token fix (2026-10-11) have none saved (node-tak dropped it when
  keywords were set at create); they rely on the creator's stored
  subscription token. If that does
  not carry owner rights, the change fails with an explicit error and a TAK
  admin must change the channels.
- A node-tak fix (keep the create token when keywords are applied) should go
  upstream; the plugin works around it by setting keywords after create.
- The management channels are read from the MGMT DataSync's groups; if they
  cannot be read, planning refuses rather than risk creating a field-visible
  OP.
