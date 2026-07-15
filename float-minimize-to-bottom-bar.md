# Persistent bottom status bar + float minimize (CloudTAK plugins)

Plugin-only pattern (no CloudTAK core changes) for:

1. A **permanent launcher chip** on the map bottom status bar (open your UI anytime), and
2. Optional **minimize** on a desktop floating pane (hide for map work, reopen at the same size/position).

**Reference implementation:** this repo —

- [`src/lib/floatMinimize.ts`](src/lib/floatMinimize.ts)
- [`src/components/IncidentManagerTaskbarChip.vue`](src/components/IncidentManagerTaskbarChip.vue)
- [`src/components/MinimizePaneAction.vue`](src/components/MinimizePaneAction.vue)
- [`src/components/IncidentManagerFloatShell.vue`](src/components/IncidentManagerFloatShell.vue)
- [`src/index.ts`](src/index.ts)

## Shared status bar (multiple plugins)

CloudTAK’s map chrome has a fixed bottom bar (`--map-bottom-bar-size`, ~50px). The **centre slot** is a list of plugin-registered Vue components:

```ts
api.bottomBar.add({ key: 'my-unique-key', component: MyChip });
api.bottomBar.remove('my-unique-key');
```

Each enabled plugin can add **one (or more) chips**. They sit side-by-side in the centre. Keys must be unique across plugins; duplicates are skipped with a console warning.

| Do | Don’t |
|----|--------|
| Register on `enable()`, remove on `disable()` | Register only while minimized (users can’t launch without finding the menu first) |
| Use a namespaced key (`d4h`, `caltopo-sync`, `incident-manager`) | Reuse another plugin’s key |
| Keep the chip compact (icon + short label) | Tall padding that overflows the 50px bar |
| Call `add` again safely if map wasn’t ready (`ensure…` + host skip-duplicates) | Remove the chip when opening/restoring the float |

Incident Manager’s key is `incident-manager` (`BOTTOM_BAR_KEY`). Copy that idea; do not reuse that string.

## Behavior (this plugin)

1. On `enable()`, register the taskbar chip once; it stays for the life of the plugin.
2. Chip click → `openDesktopPane()` (open/restore; **no-op if already visible**).
3. Float header **Minimize** snapshots `x/y/width/height`, removes the float; **chip stays**.
4. Chip / menu again → float returns at saved geometry.
5. On `disable()`, remove chip + float.

Desktop floats only. Mobile keeps `MenuTemplate` / menu route.

```text
[Plugin A enable] --> chip A in centre bar
[Plugin B enable] --> chip A | chip B
chip A tap ---------> Plugin A float
float Minimize -----> map free, chip A still there
chip A tap ---------> Plugin A float (prior geometry)
[Plugin A disable] -> chip A gone; chip B remains
```

## Host APIs

| API | Role |
|-----|------|
| `api.bottomBar.add` / `remove` | Permanent (or temporary) centre chips |
| Float store `add` / `api.float.remove` / `has` | Desktop pane; prefer store + custom shell for icon+title (`api.float.add` always wraps `FloatingGeneric`) |

Read live geometry (no `float.get()` on the public API):

```ts
import { useFloatStore } from '../../../src/stores/float.ts'; // adjust path depth

const pane = useFloatStore(api.pinia).panes.get(YOUR_PANE_UID);
// pane.x, pane.y, pane.width, pane.height
```

## Porting checklist (another plugin)

Minimal **launcher-only** (no minimize):

1. Add `MyPluginTaskbarChip.vue` — button calling your `open…()`.
2. On `enable()`: `api.bottomBar.add({ key: 'my-plugin', component: MyChip })`.
3. On `disable()`: `api.bottomBar.remove('my-plugin')`.
4. Chip click opens your float (or navigates your menu route on mobile).

Full **launcher + minimize** (match this repo):

| Piece | Purpose |
|-------|---------|
| `lib/floatMinimize.ts` (rename/adapt) | Bind API + shell + chip; `open` / `minimize` / `cleanup`; `savedGeometry` + `minimized`; `ensureBottomBarChip()` on bind and on open/minimize |
| Float shell (optional) | Custom `FloatingPane` header (icon + title) + minimize action + body |
| `MinimizePaneAction.vue` | Header `IconMinus` → minimize |
| `*TaskbarChip.vue` | Permanent centre chip → `openDesktopPane()` |
| `enable` / `disable` | Bind (registers chip); cleanup (removes chip) |

Use distinct `PANE_UID` and `BOTTOM_BAR_KEY` (often the same string, e.g. `my-plugin`).

## Controller sketch (persistent chip)

Register once; **never** remove on open/restore — only on cleanup.

```ts
const PANE_UID = 'my-plugin';
const BOTTOM_BAR_KEY = 'my-plugin';
const DEFAULT_GEOMETRY = { width: 800, height: 600, x: 80, y: 60 };

let api = null;
let shellComponent = null;
let chipComponent = null;
let savedGeometry = null;
let minimized = false;

export function bindFloatMinimize({ api: a, shell, restoreChip }) {
  api = a;
  shellComponent = shell;
  chipComponent = restoreChip;
  ensureBottomBarChip();
}

function ensureBottomBarChip() {
  try {
    api.bottomBar.add({ key: BOTTOM_BAR_KEY, component: chipComponent });
  } catch { /* map may not be ready — retry on open/minimize */ }
}

function readGeometry() {
  const pane = useFloatStore(api.pinia).panes.get(PANE_UID);
  if (!pane) return { ...(savedGeometry ?? DEFAULT_GEOMETRY) };
  return { x: pane.x, y: pane.y, width: pane.width, height: pane.height };
}

function showFloat(geometry) {
  useFloatStore(api.pinia).add({
    uid: PANE_UID,
    name: 'My Plugin',
    component: markRaw(shellComponent),
    ...geometry,
  });
}

export function openDesktopPane() {
  ensureBottomBarChip();
  if (minimized) {
    minimized = false;
    if (!api.float.has(PANE_UID)) showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
    return;
  }
  if (api.float.has(PANE_UID)) return;
  showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
}

export function minimizeDesktopPane() {
  ensureBottomBarChip();
  if (!api.float.has(PANE_UID) || minimized) return;
  savedGeometry = readGeometry();
  api.float.remove(PANE_UID);
  minimized = true;
  // chip stays
}

export function cleanupFloatMinimize() {
  try { api?.bottomBar.remove(BOTTOM_BAR_KEY); } catch { /* */ }
  minimized = false;
  if (api?.float.has(PANE_UID)) api.float.remove(PANE_UID);
}
```

### Permanent taskbar chip

```vue
<template>
  <button
    type='button'
    class='btn btn-sm btn-outline-light d-flex align-items-center gap-2 text-nowrap'
    title='Open My Plugin'
    @click='openDesktopPane'
  >
    <IconDots :size='16' stroke='1.5' />
    <span>My Plugin</span>
  </button>
</template>
```

### Header minimize (optional)

```vue
<template>
  <TablerIconButton
    title='Minimize to status bar'
    @click='minimizeDesktopPane'
  >
    <IconMinus :size='24' stroke='1' />
  </TablerIconButton>
</template>
```

Match host Close control: `size=24`, `stroke=1`.

## Wire in `enable` / `disable`

```ts
async enable() {
  bindFloatMinimize({
    api: this.api,
    shell: MyFloatShell as unknown as HostFloatComponent,
    restoreChip: MyTaskbarChip as unknown as HostBottomBarComponent,
  });
  // menu + routes… desktop onMounted: openDesktopPane(); router.replace({ name: 'home' });
}

async disable() {
  this.api.menu.remove('my-plugin');
  cleanupFloatMinimize();
}
```

### Duplicate Vue `Component` types

If plugin `node_modules/vue` diverges from host `api/web/node_modules/vue`, cast through host API types:

```ts
type HostFloatComponent = Parameters<PluginAPI['float']['add']>[0]['component'];
type HostBottomBarComponent = Parameters<PluginAPI['bottomBar']['add']>[0]['component'];
```

## Why remount is OK

Minimize `remove` + later `add` remounts the pane. Survive via module-scope state / `sessionStorage` / mission persistence (this plugin: `useIncident`). Unsaved local field drafts may reset.

## Pitfalls

- **Shared centre bar.** Every plugin’s chip is always visible to everyone; keep labels short.
- **Unique keys.** Collisions = silent skip.
- **Don’t tie chip lifetime to minimize.** Persistent launcher = add on enable, remove on disable only.
- **Re-`add` while open resets geometry.** `has(uid)` early-return.
- **Close (X)** does not notify the plugin; chip remains so users can reopen.
- **Mobile:** no bottom-bar float pattern; use menu route / `MenuTemplate`.

## Out of scope

- Toggle closed on chip click while open (here: no-op; use Minimize).
- Geometry across full page reload (`sessionStorage` if you need it).
- Core `minimized` + `v-show` (hide without remount).

## Copy from this repo

```text
src/lib/floatMinimize.ts
src/components/IncidentManagerTaskbarChip.vue
src/components/MinimizePaneAction.vue
src/components/IncidentManagerFloatShell.vue
src/index.ts
```

Rename keys, labels, and icons; keep **persistent chip on enable / remove on disable**, and optional minimize that leaves the chip in place.
