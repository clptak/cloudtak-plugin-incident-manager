import type { App } from 'vue';
import { defineAsyncComponent, defineComponent, h, markRaw, onMounted } from 'vue';
import type { PluginAPI, PluginInstance, PluginStatic } from '../../../plugin.ts';
import { useAppStore } from '../../../src/stores/app.ts';
import { IconTarget } from '@tabler/icons-vue';
import MenuTemplate from './lib/MenuTemplate.vue';
import {
    bindFloatMinimize,
    cleanupFloatMinimize,
    openDesktopPane,
} from './lib/floatMinimize.ts';

const IncidentManagerFloatShell = defineAsyncComponent(
    () => import('./components/IncidentManagerFloatShell.vue')
);
const IncidentManagerPane = defineAsyncComponent(
    () => import('./components/IncidentManagerPane.vue')
);
const IncidentManagerTaskbarChip = defineAsyncComponent(
    () => import('./components/IncidentManagerTaskbarChip.vue')
);
const ResourcesTaskbarChip = defineAsyncComponent(
    () => import('./components/ResourcesTaskbarChip.vue')
);

const ROUTE_NAME = 'home-menu-incident-manager';

export default class IncidentManagerPlugin implements PluginInstance {
    constructor(private api: PluginAPI) {}

    static async install(_app: App, api: PluginAPI): Promise<PluginInstance> {
        return new IncidentManagerPlugin(api);
    }

    async enable(): Promise<void> {
        const api = this.api;

        bindFloatMinimize({
            api,
            shell: IncidentManagerFloatShell as unknown as HostFloatComponent,
            restoreChip: IncidentManagerTaskbarChip as unknown as HostBottomBarComponent,
            resourcesChip: ResourcesTaskbarChip as unknown as HostBottomBarComponent,
        });

        this.api.routes.add({
            path: 'incident-manager',
            name: ROUTE_NAME,
            component: defineComponent({
                name: 'IncidentManagerEntry',
                setup() {
                    const appStore = useAppStore(api.pinia);
                    onMounted(() => {
                        if (!appStore.isMobileDetected) {
                            openDesktopPane();
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
        cleanupFloatMinimize();
        if (this.api.router.hasRoute(ROUTE_NAME)) {
            this.api.router.removeRoute(ROUTE_NAME);
        }
    }
}

type MenuItemIconType = NonNullable<Parameters<PluginAPI['menu']['add']>[0]['icon']>;
type MenuItemConfig = Parameters<PluginAPI['menu']['add']>[0];
type HostFloatComponent = Parameters<PluginAPI['float']['add']>[0]['component'];
type HostBottomBarComponent = Parameters<PluginAPI['bottomBar']['add']>[0]['component'];

export const _typecheck = IncidentManagerPlugin as unknown as PluginStatic;
