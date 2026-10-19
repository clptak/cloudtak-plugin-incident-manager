# Event icons

Incident Core Events ([ADR-004](decisions/ADR-004-incident-core-events.md)) use
type `13061000001418000000` with a white marker unless this deployment
supplies an icon map.

## Turning it on

1. Copy `deployment.example/event-icons.json` to `deployment/` and edit it.
2. In `config.local.ts`, set `eventIconsFile: 'event-icons.json'`.
3. Rebuild CloudTAK's app.

An unset, missing or unreadable file falls back to the built-in symbol; it
never stops an event from being created.

## Format

```json
{
  "default": { "type": "13061000001418000000", "icon": "", "marker-color": "#FFFFFF" },
  "byCode": {
    "SUICEMS": { "type": "a-f-G-U-C", "icon": "<iconset uid>/<path>.png", "marker-color": "#FF0000" },
    "MISSING PERSON": { "marker-color": "#FFA500" }
  }
}
```

| Field | Meaning |
|---|---|
| `type` | The event's `type` (a CoT type or a code your event types use). |
| `icon` | CloudTAK icon path, `<iconset uid>/<file>`, as used in a feature's `style.icon`. Empty means no icon (the type's default symbol). |
| `marker-color` | Marker colour, `#RRGGBB`. |

**Keys in `byCode`** are the CAD Type code: the text in the last parentheses
of the call's Type line (`SUICIDAL SUBJECT STAGE MEDICS (SUICEMS)` →
`SUICEMS`). When the Type line has no parentheses, the key is the whole line.
Matching ignores case.

**Every field is optional.** A field missing from the `byCode` entry comes
from `default`, then from the built-in value.

**Which events use it**: incident (MGMT) events use the `byCode` entry for
their call's Type. Field events (one per OP) carry no CAD Type and always use
`default`.

## CAD time zone

CAD times have no time zone. The event's start time uses `cadUtcOffset` in
`config.local.ts` (default `-07:00`, Arizona, which does not observe daylight
saving). Set it for your dispatch centre, e.g. `'-06:00'`.
