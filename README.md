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

## Installation (VPS / Docker Compose)

This is a **build-time** CloudTAK web plugin. It is not a separate container or service. To install it on a VPS, you rebuild the CloudTAK `api` image with the plugin repo included in `WEB_PLUGINS`.

If you do not already have CloudTAK running on your VPS, start with the official docs: `https://docs.cloudtak.io/deploy/`.

### Prerequisites

- A working CloudTAK Docker Compose deployment (usually a `~/CloudTAK` clone on the VPS).
- SSH access to the VPS with permission to run Docker (typically your user is in the `docker` group).
- Outbound HTTPS access during `docker compose build` (Docker will clone the plugin repo during the build).

### Step-by-step

1. SSH into your VPS.
2. Change into your CloudTAK directory (adjust if yours is different):

```bash
cd ~/CloudTAK
```

3. Rebuild the `api` image with this plugin pinned to a known release tag:

```bash
docker compose build \
  --build-arg WEB_PLUGINS="https://github.com/clptak/cloudtak-plugin-incidentManager.git#v0.1.0" \
  api
```

4. Restart CloudTAK:

```bash
docker compose up -d
```

### Persist the plugin across future rebuilds (recommended)

If you later run `./cloudtak.sh update` or `docker compose build` without re-supplying `WEB_PLUGINS`, the plugin will not be included in the rebuilt image. The most reliable approach is to persist it in `docker-compose.override.yml` next to your `docker-compose.yml`.

Create or edit `docker-compose.override.yml` and add this under the `api` service:

```yaml
services:
  api:
    build:
      args:
        WEB_PLUGINS: "https://github.com/clptak/cloudtak-plugin-incidentManager.git#v0.1.0"
```

If you already use `WEB_PLUGINS` for other plugins, set it to a **comma-separated list** of git URLs (no spaces):

```text
WEB_PLUGINS="https://github.com/org/plugin-a.git,https://github.com/org/plugin-b.git,https://github.com/clptak/cloudtak-plugin-incidentManager.git#v0.1.0"
```

### Verify it worked

- Open your CloudTAK web UI and do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).
- Open the main menu and confirm there is an **Incident Manager** entry.
- Click it and confirm the floating pane loads.

### First use notes

- To create/open missions and write mission logs, you must be logged in.
- For mission log writes, you generally need to **Subscribe** to the mission on the map first (and enter the mission password if required by your TAK Server).

### Updating the plugin

To update, change the pinned tag/commit in `WEB_PLUGINS`, rebuild the `api` image, restart CloudTAK, and hard refresh your browser.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No “Incident Manager” menu entry | Plugin is not in the image you are running | Rebuild `api` with `WEB_PLUGINS` and restart (`docker compose up -d`) |
| It worked before, but disappeared after an update | `WEB_PLUGINS` was not persisted | Add the `docker-compose.override.yml` snippet above, then rebuild `api` |
| `docker compose build` fails when cloning plugin | VPS/network blocks outbound HTTPS | Verify the VPS can reach `https://github.com/` and try the build again |
| Pane loads but mission actions fail | You are not subscribed / not authorized for the mission | Subscribe to the mission on the map (mission password if required) |
| UI looks unchanged after rebuild | Browser cache | Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) |

## Optional integrations

- **Caltopo**: The “Create Caltopo map” checkbox calls a runtime provider published by a separate plugin (via `window.__cloudtakCaltopo`). If that provider is not installed/enabled, Caltopo creation is skipped.
- **D4H**: The Organization/Resources tabs can read roster data written into CloudTAK KV (keys like `d4h:roster`). If the D4H plugin is not installed/enabled, those screens will prompt you to sync there.

## Roadmap

CSV upload support for personnel and equipment rosters will be added in a future update.

## Dev

```sh
ln -sf "$PWD" ~/CloudTAK/api/web/plugins/incident-manager
cd ~/CloudTAK/api/web && npm run serve
```

Then open the **Incident Manager** entry from the CloudTAK main menu.
To validate like the CloudTAK Docker build gate, run `bash scripts/check-like-docker.sh ~/CloudTAK/api/web`.
