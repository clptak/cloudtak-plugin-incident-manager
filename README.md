# cloudtak-plugin-incidentManager

A CloudTAK floating-pane plugin: a SAR Incident Manager, porting the Incident
Manager tab from the ccsosar-tak Electron app into native CloudTAK Vue.

## What it is

A single plugin mounted under `api/web/plugins/incident-manager/`. It adds an
**Incident Manager** main-menu entry that opens a draggable/resizable floating
pane (built on the host `FloatingPane`). Inside: a left vertical nav and
horizontal **Main / Task / Dashboard** tabs.

## Features

- **Create | Open**
  - **Create Mission** — creates a DataSync (TAK Mission) via the CloudTAK API,
    with SAR detail fields, multi-format coordinate parsing, and an optional
    "Create Caltopo map" checkbox (delegated to the caltopo-sync plugin).
  - **Open Existing Mission** — lists missions and activates the selected one.
- **Logger** — Initial Information (incident details + MPS/CFS parse → mission logs), Search Area (LPB
  rings → mission features over CoT), Search Urgency, Search Scenarios, Risk
  Assessment (Objectives/Strategies/Tactics), Incident POST (patrol report .md).
- **Dashboard** — sortable combined log table for the active mission.
- CASIE / Task / Wrap Up — placeholders / report reuse, matching the source.

## Integration paths (all native, no core changes)

- Mission logs (write): `Subscription.load(guid).log.create(...)`.
- Mission logs (read): `sub.log.list({ refresh: true })`.
- Mission map features: `mapStore.worker.conn.sendCOT(feature)` with
  `properties.dest = [{ 'mission-guid': guid }]`.
- Caltopo: `window.__cloudtakCaltopo.createMap(...)` runtime contract.

## Dev

```sh
ln -sf "$PWD" ~/CloudTAK/api/web/plugins/incident-manager
cd ~/CloudTAK/api/web && npm run serve
```

Then open the **Incident Manager** entry from the CloudTAK main menu.
See `docs/build-plan.md` for the full breakdown.
