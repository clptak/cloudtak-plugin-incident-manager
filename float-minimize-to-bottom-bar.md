# Minimize a CloudTAK floating pane to the bottom status bar

Plugin-only pattern (no CloudTAK core changes) to get a desktop float “out of the way” of the map, then restore it to the same size and position.

**Reference implementation:** this repo — `src/lib/floatMinimize.ts`, `src/components/MinimizePaneAction.vue`, `src/components/RestoreMinimizedChip.vue`, `src/index.ts`.

## Behavior

1. User opens your plugin as a desktop floating pane (`api.float`).
2. A **Minimize** control in the float header (next to Close) snapshots live `x / y / width / height`, removes the float, and registers a chip on the **bottom map status bar**.
3. Tapping the chip (or choosing the plugin menu item again) re-opens the float with the saved geometry and removes the chip.

Mobile stays on your normal `MenuTemplate` / menu route — this pattern is for **desktop floats** only.

```text
[Floating pane] --minimize--> [Map clear] + [Bottom bar chip]
[Bottom bar chip] --tap-----> [Floating pane at prior geometry]
```

## Host APIs (already in CloudTAK)

| API | Role |
|-----|------|
| `api.float.add({ uid, name, component, actions?, width, height, x, y })` | Create/replace the float. Pass `actions` for header buttons. |
| `api.float.remove(uid)` / `api.float.has(uid)` | Tear down / presence check. |
| `api.bottomBar.add({ key, component })` / `api.bottomBar.remove(key)` | Centre slot of the map status bar. |

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

Copy or mirror these four pieces into your plugin:

| Piece | Purpose |
|-------|---------|
| `lib/floatMinimize.ts` (or similar) | Module controller: bind API + components, open / minimize / restore / cleanup, hold `savedGeometry` + `minimized` |
| `MinimizePaneAction.vue` | Header `actions` slot: IconMinus → `minimizeDesktopPane()` |
| `RestoreMinimizedChip.vue` | Bottom-bar centre chip: label + click → `restoreDesktopPane()` |
| Plugin `enable()` / `disable()` | `bind…` on enable; call `open…` from desktop menu mount; `cleanup…` on disable |

Use **unique** `PANE_UID` and `BOTTOM_BAR_KEY` strings per plugin (e.g. `my-plugin`, `my-plugin-minimized`) so two plugins do not collide.

## Controller sketch

Keep callbacks in a module so the Vue chips need no props. Host `FloatingGeneric` binds the same `_props` to both your pane and your `actions` component — avoid stuffing minimize callbacks into `float.add({ props })` unless your pane ignores them.

```ts
// lib/floatMinimize.ts (conceptual)

const PANE_UID = 'my-plugin';
const BOTTOM_BAR_KEY = 'my-plugin-minimized';
const DEFAULT_GEOMETRY = { width: 800, height: 600, x: 80, y: 60 };

let api: PluginAPI | null = null;
let paneComponent /* HostComponent */ = null;
let actionsComponent = null;
let restoreChipComponent = null;
let savedGeometry = null;
let minimized = false;

export function bindFloatMinimize({ api: a, pane, actions, restoreChip }) {
  api = a;
  paneComponent = pane;
  actionsComponent = actions;
  restoreChipComponent = restoreChip;
}

function readGeometry() {
  const pane = useFloatStore(api!.pinia).panes.get(PANE_UID);
  if (!pane) return { ...(savedGeometry ?? DEFAULT_GEOMETRY) };
  return { x: pane.x, y: pane.y, width: pane.width, height: pane.height };
}

function showFloat(geometry) {
  api!.float.add({
    uid: PANE_UID,
    name: 'My Plugin',
    component: paneComponent!,
    actions: actionsComponent!,
    ...geometry,
  });
}

export function openDesktopPane() {
  if (minimized) {
    restoreDesktopPane();
    return;
  }
  if (api!.float.has(PANE_UID)) return; // already open — do not reset geometry
  showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
}

export function minimizeDesktopPane() {
  if (!api!.float.has(PANE_UID) || minimized) return;
  savedGeometry = readGeometry();
  api!.float.remove(PANE_UID);
  minimized = true;
  api!.bottomBar.add({ key: BOTTOM_BAR_KEY, component: restoreChipComponent! });
}

export function restoreDesktopPane() {
  api!.bottomBar.remove(BOTTOM_BAR_KEY);
  minimized = false;
  if (api!.float.has(PANE_UID)) return;
  showFloat(savedGeometry ?? DEFAULT_GEOMETRY);
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

### Bottom-bar restore chip

Keep it compact (status bar is ~50px). Outline button + short label works well over the dark bar:

```vue
<template>
  <button
    type='button'
    class='btn btn-sm btn-outline-light d-flex align-items-center gap-2 text-nowrap'
    title='Restore My Plugin'
    @click='restoreDesktopPane'
  >
    <IconDots :size='16' stroke='1.5' />
    <span>My Plugin</span>
  </button>
</template>
```

## Wire into the plugin class

On `enable()`:

1. `bindFloatMinimize({ api, pane, actions, restoreChip })`.
2. Desktop menu route `onMounted`: if not mobile → `openDesktopPane()` then navigate home so the side menu goes compact.
3. Pass the minimize component as `actions` whenever you `float.add` (the controller’s `showFloat` should always include it).

On `disable()`:

1. `cleanupFloatMinimize()` so the chip does not linger after the plugin is torn down.
2. Remove menu / routes as you already do.

Example (abbreviated):

```ts
async enable() {
  bindFloatMinimize({
    api: this.api,
    pane: MyPane as unknown as HostFloatComponent,
    actions: MinimizePaneAction as unknown as HostFloatComponent,
    restoreChip: RestoreMinimizedChip as unknown as HostBottomBarComponent,
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

If the plugin has its own `node_modules/vue` while the host typechecks against `api/web/node_modules/vue`, assigning async components into `float.add` / `bottomBar.add` can fail `vue-tsc`. Cast through the host API types (as in this plugin’s `src/index.ts`):

```ts
type HostFloatComponent = Parameters<PluginAPI['float']['add']>[0]['component'];
type HostBottomBarComponent = Parameters<PluginAPI['bottomBar']['add']>[0]['component'];
```

## Pitfalls

- **Re-`float.add` while open resets geometry.** Always `has(uid)` early-return (or restore-from-minimized) before adding again. Do not hard-code size/position on every menu click once the user has resized/moved the pane.
- **Close (X) vs Minimize.** Host Close deletes the float and does not notify the plugin. That is fine if no chip was registered. Only Minimized state owns a bottom-bar chip.
- **Menu reopen while minimized.** `openDesktopPane()` must treat `minimized` as restore, not as a fresh default open.
- **Key uniqueness.** Bottom bar skips duplicate keys with a console warning — use a namespaced key.
- **Mobile.** Skip float minimize; keep `MenuTemplate` / full menu route.

## Style notes (match host chrome)

- Minimize control: same size/stroke as the host Close (`IconX` is `size=24`, `stroke=1`) via `TablerIconButton`.
- Chip: light outline on the dark translucent status bar; avoid tall padding so it stays inside `--map-bottom-bar-size` (~50px).

## What this does *not* do

- Persist geometry across full page reload (optional enhancement: mirror `savedGeometry` in `sessionStorage`).
- Hide the float without remounting (that would need a CloudTAK `minimized` flag + `v-show` on floats).
- Minimize side-menu / mobile `TablerModal` shells — different host model.

## Copy reference from this repo

```text
src/lib/floatMinimize.ts
src/components/MinimizePaneAction.vue
src/components/RestoreMinimizedChip.vue
src/index.ts          # bind + openDesktopPane + cleanupFloatMinimize
```

Rename UIDs, labels, and icons for your plugin; keep the open / minimize / restore / cleanup lifecycle the same.
