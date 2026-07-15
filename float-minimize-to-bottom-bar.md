# Minimize a CloudTAK floating pane to the bottom status bar

Plugin-only pattern (no CloudTAK core changes) to get a desktop float “out of the way” of the map, then restore it to the same size and position — with a **permanent** bottom-bar launcher so you can open the plugin anytime without minimizing first.

**Reference implementation:** this repo — `src/lib/floatMinimize.ts`, `src/components/MinimizePaneAction.vue`, `src/components/IncidentManagerTaskbarChip.vue`, `src/components/IncidentManagerFloatShell.vue`, `src/index.ts`.

## Behavior

1. On plugin `enable()`, register a chip on the **bottom map status bar** and leave it there for the life of the plugin.
2. Chip click (or the plugin menu item) opens/restores the desktop float — **no-op if already visible**.
3. A **Minimize** control in the float header snapshots live `x / y / width / height` and removes the float (map is clear). The taskbar chip stays.
4. Tapping the chip again re-opens the float at the saved geometry.
5. On `disable()`, remove the chip and any open float.

Mobile stays on your normal `MenuTemplate` / menu route — this pattern is for **desktop floats** only.

```text
[Plugin enable] -------------------> [Bottom bar chip stays]
[Bottom bar chip] --tap-----------> [Floating pane]
[Floating pane] --minimize-------> [Map clear] (chip still there)
[Bottom bar chip] --tap-----------> [Floating pane at prior geometry]
```

## Host APIs (already in CloudTAK)

| API | Role |
|-----|------|
| Float store `add` / `api.float.remove` / `api.float.has` | Create/tear down / presence. Prefer the store (or a custom shell) if you need a non-text title (e.g. icon + name). `api.float.add` always wraps `FloatingGeneric`. |
| `api.bottomBar.add({ key, component })` / `api.bottomBar.remove(key)` | Centre slot of the map status bar — register **once** on enable. |

Live geometry is maintained by the host `FloatingPane` in the Pinia float store. The public plugin API has no `float.get()`, so read geometry via:

```ts
import { useFloatStore } from '../../../src/stores/float.ts'; // adjust depth for your file

const pane = useFloatStore(api.pinia).panes.get(YOUR_PANE_UID);
// pane.x, pane.y, pane.width, pane.height
```

Deep-importing host stores is the same pattern many CloudTAK plugins already use; it does not require editing CloudTAK.

## Why remount is OK

Minimize uses `float.remove` + later `float.add`, so your pane **Vue component remounts**. Anything only in component-local `ref`s is lost.

Survive remount by keeping important state in:

- Module-scope refs / a small store (this plugin’s `useIncident` composable), and/or
- `sessionStorage` / mission persistence

Unsaved in-field drafts that are not persisted yet will reset. Design for that, or persist on blur/change if it matters.

## File checklist

| Piece | Purpose |
|-------|---------|
| `lib/floatMinimize.ts` (or similar) | Module controller: bind API + shell + chip, open / minimize / cleanup, hold `savedGeometry` + `minimized`; register chip on bind |
| Custom float shell (optional) | `FloatingPane` + title/icon + minimize action + pane body (skips `FloatingGeneric`) |
| `MinimizePaneAction.vue` | Header action: IconMinus → `minimizeDesktopPane()` |
| `*TaskbarChip.vue` | Permanent bottom-bar chip: click → `openDesktopPane()` |
| Plugin `enable()` / `disable()` | `bind…` on enable (registers chip); `cleanup…` on disable (removes chip) |

Use **unique** `PANE_UID` and `BOTTOM_BAR_KEY` strings per plugin (e.g. both `my-plugin`) so two plugins do not collide.

## Controller sketch

Keep callbacks in a module so the Vue chip needs no props. Register the chip once; minimize/open must **not** add/remove it.

```ts
// lib/floatMinimize.ts (conceptual)

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
  if (api.float.has(PANE_UID)) return; // already open
  showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
}

export function minimizeDesktopPane() {
  ensureBottomBarChip();
  if (!api.float.has(PANE_UID) || minimized) return;
  savedGeometry = readGeometry();
  api.float.remove(PANE_UID);
  minimized = true;
  // chip stays registered
}

export function cleanupFloatMinimize() {
  try { api?.bottomBar.remove(BOTTOM_BAR_KEY); } catch { /* map may be gone */ }
  minimized = false;
  if (api?.float.has(PANE_UID)) api.float.remove(PANE_UID);
}
```

### Header minimize button

```vue
<template>
  <TablerIconButton
    title='Minimize to status bar'
    @click='minimizeDesktopPane'
  >
    <IconMinus :size='24' stroke='1' />
  </TablerIconButton>
</template>

<script setup lang='ts'>
import { IconMinus } from '@tabler/icons-vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { minimizeDesktopPane } from '../lib/floatMinimize.ts';
</script>
```

### Permanent taskbar chip

Keep it compact (status bar is ~50px). Outline button + short label works well over the dark bar:

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

## Wire into the plugin class

On `enable()`:

1. `bindFloatMinimize({ api, shell, restoreChip })` — registers the permanent chip.
2. Desktop menu route `onMounted`: if not mobile → `openDesktopPane()` then navigate home so the side menu goes compact.

On `disable()`:

1. `cleanupFloatMinimize()` so the chip does not linger after the plugin is torn down.
2. Remove menu / routes as you already do.

Example (abbreviated):

```ts
async enable() {
  bindFloatMinimize({
    api: this.api,
    shell: MyFloatShell as unknown as HostFloatComponent,
    restoreChip: MyTaskbarChip as unknown as HostBottomBarComponent,
  });

  // routes… onMounted desktop:
  //   openDesktopPane();
  //   void api.router.replace({ name: 'home' });
}

async disable() {
  this.api.menu.remove('my-plugin');
  cleanupFloatMinimize();
  // removeRoute…
}
```

### Duplicate Vue `Component` types

If the plugin has its own `node_modules/vue` while the host typechecks against `api/web/node_modules/vue`, assigning async components into float / `bottomBar.add` can fail `vue-tsc`. Cast through the host API types (as in this plugin’s `src/index.ts`):

```ts
type HostFloatComponent = Parameters<PluginAPI['float']['add']>[0]['component'];
type HostBottomBarComponent = Parameters<PluginAPI['bottomBar']['add']>[0]['component'];
```

## Pitfalls

- **Re-`float.add` while open resets geometry.** Always `has(uid)` early-return before adding again.
- **Close (X) vs Minimize.** Host Close deletes the float and does not notify the plugin. Chip stays; user can reopen from the taskbar. If you care about “closed vs minimized,” treat X the same as minimize only if you hook it — by default X just removes the float; next open still uses `savedGeometry` if you last minimized.
- **Permanent chip.** Do not remove the chip on restore/open — only on plugin `disable`.
- **Key uniqueness.** Bottom bar skips duplicate keys with a console warning — use a namespaced key; `ensureBottomBarChip` is idempotent.
- **Mobile.** Skip float minimize; keep `MenuTemplate` / full menu route.

## Style notes (match host chrome)

- Minimize control: same size/stroke as the host Close (`IconX` is `size=24`, `stroke=1`) via `TablerIconButton`.
- Chip: light outline on the dark translucent status bar; avoid tall padding so it stays inside `--map-bottom-bar-size` (~50px).

## What this does *not* do

- Toggle the float closed when tapping the chip while open (click is a no-op if already visible; use Minimize to hide).
- Persist geometry across full page reload (optional enhancement: mirror `savedGeometry` in `sessionStorage`).
- Hide the float without remounting (that would need a CloudTAK `minimized` flag + `v-show` on floats).
- Minimize side-menu / mobile `TablerModal` shells — different host model.

## Copy reference from this repo

```text
src/lib/floatMinimize.ts
src/components/MinimizePaneAction.vue
src/components/IncidentManagerTaskbarChip.vue
src/components/IncidentManagerFloatShell.vue
src/index.ts          # bind + openDesktopPane + cleanupFloatMinimize
```

Rename UIDs, labels, and icons for your plugin; keep the open / minimize / permanent-chip / cleanup lifecycle the same.
