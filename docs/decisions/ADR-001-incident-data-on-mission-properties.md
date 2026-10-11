# ADR-001: Store incident planning data as TAK Mission Properties

## Status
Accepted

## Date
2026-10-11

## Context
Each incident has a management ("MGMT") DataSync that only management channels
can see. Until now the plugin kept all planning data for the incident in one
file on that DataSync, `mission_schema.json`. Every save re-uploaded the whole
file, so two managers editing at the same time silently overwrote each other
(last writer wins), even when they were editing unrelated sections.

TAK Server 5.9 adds Mission Properties: key/value pairs on a mission, written
one key at a time with an atomic upsert. They follow the mission's group
rules, so properties on the MGMT DataSync are as hidden from field users as
the file was. Every write is announced to subscribers as a
`t-x-m-c-p` change. Property changes are **not** kept in the mission's change
history.

Support was added upstream so the plugin can use them:
node-tak #44 (client API), CloudTAK #1852 (`/api/marti/missions/:guid/property`
routes), node-cot #143 (parses the change CoT), and CloudTAK #1919 (broadcasts
it to the web app; open at the time of writing).

## Decision
Store the incident's planning data as Mission Properties on the MGMT DataSync,
one key per piece of data that people edit independently.

- **Layout** (`src/lib/schemaCodec.ts`, `src/lib/schemaCollections.ts`):
  `meta.schema` holds the layout version (currently `3`);
  `s.<field>` / `s.incident-response.<field>` hold one schema field each;
  `op.<n>.mission` one operational period; `op.<n>.debrief.<segment>.<id>`
  one debrief; `c.<collection>.<id>` one record of a busy collection
  (segments, ROW segments, resources, work assignments, op assignments,
  clues, CAD notes, and each IAP field per OP). Anything that cannot be given
  a safe, unique key stays in its field's `s.` key, so nothing is dropped.
- **Key characters** are limited to `[A-Za-z0-9.:-]`. The server's prefix
  filter is SQL `LIKE`, where `_` and `%` are wildcards, and `/` breaks the
  URL path; schema field names therefore use `-` in place of `_`.
- **Saves are diffs.** The plugin remembers what each loaded copy looked like
  and writes only the keys that changed, at most 8 at a time.
- **Same-key edits are refused, not overwritten.** Before writing, a save
  checks each key it would change against the server. If another manager
  changed one since the screen loaded, the save stops with "Another manager
  changed … Reload" (`SchemaConflictError`) and writes nothing. The IAP's
  `updated` timestamp keys are exempt (`isVolatileKey`).
- **Live updates.** Open screens re-list the properties every 15 s (paused
  while the tab is hidden). Once a push notice from CloudTAK #1919 is seen,
  polling drops to every 60 s as a safety net. Lists refresh themselves; form
  screens show a Reload banner and never reload over what someone is typing.
  A tab's own writes are filtered out.
- **Adoption.** New incidents start on properties when the server supports
  them. Existing incidents move with "Move to Mission Properties" on the
  Dashboard (read back and compared key by key). Incidents on servers without
  Mission Properties keep using `mission_schema.json` unchanged.
- **Layout upgrades** happen on the first save after a new layout ships
  (never on load, which may have no write token): the incident is re-encoded,
  the difference written, and `meta.schema` bumped last.

## Alternatives Considered

### Keep `mission_schema.json`, add locking or merging
- Pros: works on every TAK Server version.
- Cons: TAK has no conditional upload; any lock would be advisory and
  client-side. Merging whole-file JSON from several writers is error-prone.
- Rejected: does not remove the overwrite problem.

### Store data in CloudTAK Events (Core Entities)
- Pros: CloudTAK 13.107.3 Events can hold several DataSyncs (`missions[]`).
- Cons: the CloudTAK developer's direction is Events that group DataSyncs,
  not Events as a per-OP data store; Events do not inherit TAK group
  visibility the way MGMT DataSync properties do.
- Not chosen now. Grouping an incident's OP DataSyncs under a CloudTAK Event
  (possibly for incidents within an incident) remains a planned follow-up.

### One key per schema field only (layout v2)
- Pros: simple, and solved most cross-section overwrites.
- Cons: two people adding different segments, resources or CAD notes still
  wrote the same key.
- Superseded by per-record collection keys (layout v3).

## Consequences
- Requires TAK Server 5.9. Production use waits for AZTAK's 5.9 upgrade;
  older servers keep the file behaviour.
- Edits to the *same* record are still exclusive: the second saver is told to
  reload and re-apply. Edits to different records never collide.
- No server-side history of property changes. Anything that needs an audit
  trail (for example published CAD notes, POA locks) must record it in its
  own keys.
- An older build of the plugin cannot read a layout-3 incident (it would not
  see collection records). All CloudTAK instances against one TAK Server must
  run the same plugin build.
- First save after a layout upgrade can write 100+ keys (FLORES: about 150).
