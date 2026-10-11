# CloudTAK Incident Manager

A CloudTAK floating-pane plugin for SAR incident management: create/open DataSync
missions, logger workflows (initial information, search area, urgency, risk),
dashboard logs, and IAP / briefing PDF exports.

## Install and develop

See the repository [README](https://github.com/clptak/cloudtak-plugin-incident-manager#readme)
for VPS / Docker Compose installation and local symlink development against CloudTAK.

## In-app help

Section help shown in the plugin UI lives under `src/content/help/` (bundled at
build time). This MkDocs site is for project documentation only.

## Design decisions

Significant design decisions are recorded as ADRs under [`decisions/`](decisions/ADR-001-incident-data-on-mission-properties.md).
Add a new numbered ADR for a new decision; when one changes, write a new ADR that supersedes it rather than editing history.

