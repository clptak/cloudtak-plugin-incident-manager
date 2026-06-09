import type { App } from 'vue';
import { defineAsyncComponent, markRaw } from 'vue';
import type { PluginAPI, PluginInstance, PluginStatic } from '@tak-ps/cloudtak';
import { IconClipboardList } from '@tabler/icons-vue';

const IncidentManagerPane = defineAsyncComponent(
    () => import('./components/IncidentManagerPane.vue')
);

const PANE_UID = 'incident-manager';

export default class IncidentManagerPlugin implements PluginInstance {
    constructor(private api: PluginAPI) {}

    static async install(_app: App, api: PluginAPI): Promise<PluginInstance> {
        return new IncidentManagerPlugin(api);
    }

    private open(): void {
        // Re-opening focuses the existing pane (float store keys on uid)
        this.api.float.add({
            uid: PANE_UID,
            name: 'Incident Manager',
            component: IncidentManagerPane,
            width: 980,
            height: 640,
            x: 80,
            y: 60,
        });
    }

    async enable(): Promise<void> {
        // Route is required for a menu entry; it simply triggers the float pane.
        this.api.routes.add({
            path: '/menu/incident-manager',
            name: 'home-menu-incident-manager',
            component: {
                // minimal component: opens the pane then returns to the map
                render: () => null,
                mounted: () => this.open(),
            },
        }, 'home-menu');

        this.api.menu.add({
            key: 'incident-manager',
            label: 'Incident Manager',
            route: 'home-menu-incident-manager',
            tooltip: 'SAR Incident Manager',
            description: 'Create/open missions, logger, dashboard',
            icon: markRaw(IconClipboardList),
        });
    }

    async disable(): Promise<void> {
        this.api.menu.remove('incident-manager');
        this.api.float.remove(PANE_UID);
    }
}

export const _typecheck: PluginStatic = IncidentManagerPlugin;
