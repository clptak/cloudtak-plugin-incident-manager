import type { App } from 'vue';
import { defineAsyncComponent, defineComponent, h, markRaw, onMounted } from 'vue';
import type { PluginAPI, PluginInstance, PluginStatic } from '../../../plugin.ts';
import { useAppStore } from '../../../src/stores/app.ts';
import { IconTarget } from '@tabler/icons-vue';
import MenuTemplate from './lib/MenuTemplate.vue';

const IncidentManagerPane = defineAsyncComponent(
    () => import('./components/IncidentManagerPane.vue')
);

const PANE_UID = 'incident-manager';
const ROUTE_NAME = 'home-menu-incident-manager';

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
        const api = this.api;
        const openFloat = () => this.open();

        this.api.routes.add({
            path: 'incident-manager',
            name: ROUTE_NAME,
            component: defineComponent({
                name: 'IncidentManagerEntry',
                setup() {
                    const appStore = useAppStore(api.pinia);
                    onMounted(() => {
                        if (!appStore.isMobileDetected) {
                            openFloat();
                            void api.router.replace({ name: 'home' });
                        }
                    });
                    return () => {
                        if (appStore.isMobileDetected) {
                            return h(MenuTemplate, { name: 'Incident Manager' }, {
                                default: () => h(IncidentManagerPane),
                            });
                        }
                        return null;
                    };
                },
            }),
        }, 'home-menu');

        this.api.menu.add({
            key: 'incident-manager',
            label: 'Incident Manager',
            route: ROUTE_NAME,
            tooltip: 'SAR Incident Manager',
            description: 'Create/open missions, logger, dashboard',
            icon: markRaw(IconTarget) as unknown as MenuItemIconType,
        } as MenuItemConfig);
    }

    async disable(): Promise<void> {
        this.api.menu.remove('incident-manager');
        this.api.float.remove(PANE_UID);
        if (this.api.router.hasRoute(ROUTE_NAME)) {
            this.api.router.removeRoute(ROUTE_NAME);
        }
    }
}

type MenuItemIconType = NonNullable<Parameters<PluginAPI['menu']['add']>[0]['icon']>;
type MenuItemConfig = Parameters<PluginAPI['menu']['add']>[0];

export const _typecheck = IncidentManagerPlugin as unknown as PluginStatic;
