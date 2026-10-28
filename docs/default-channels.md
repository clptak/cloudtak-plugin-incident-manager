# Default channels

Create Mission can pre-select **Field Channels** and **Management Channels**.
The incident event from a pasted CAD call
([ADR-004](decisions/ADR-004-incident-core-events.md)) goes to the Management
Channels. With a default set, **Create event only** works right after pasting,
with no scrolling down to pick channels first.

The pickers stay editable. You can add channels beyond the defaults or remove
them for any incident.

## Per deployment

In `config.local.ts`, list exact channel names, then rebuild CloudTAK's app:

```ts
defaultFieldChannels: ['SAR Members'],
defaultMgmtChannels: ['IMT'],
```

## Per browser

**Settings → Default Channels** overrides the deployment lists in this browser.
**Reset to deployment** goes back to the `config.local.ts` values.

## Channels a user does not have

A default is pre-selected only when the user has that channel active with
receive (IN) on. A missing channel would be hidden in the picker yet still sent
with the mission, so it is skipped.
