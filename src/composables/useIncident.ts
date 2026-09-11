import { computed, ref, watch } from 'vue';
import { useMapStore } from '../../../../src/stores/map.ts';
import OverlayManager from '../../../../src/base/overlay.ts';
import Subscription from '../../../../src/base/subscription.ts';
import {
    isSearchIncidentType,
    parseIncidentTypeFromRecord,
    SEARCH_ONLY_HTAB_KEYS,
    SEARCH_ONLY_NAV_KEYS,
} from '../lib/incidentType.ts';
import { resolveIncidentTypeFromFamily } from '../lib/incidentTypeResolve.ts';

/**
 * Shared, app-wide state for the Incident Manager plugin.
 * Singleton (module-scope refs) plus sessionStorage so the active mission and
 * pane navigation survive closing the float pane (and page reloads in-tab).
 */

/** Reference to a DataSync mission (guid + name + owner/subscription token). */
export interface MissionRef {
    guid: string;
    name: string;
    /** Mission password/token for MissionAuthorization (DataSync writes). */
    missionToken?: string;
}

export interface ActiveMission {
    guid: string;
    name: string;
    /** Mission password/token for MissionAuthorization (DataSync writes). */
    missionToken?: string;
    /** @deprecated Use missionToken. Kept for older sessionStorage entries. */
    token?: string;
    /**
     * Sworn-only management DataSync holding mission_schema.json and planning
     * products (Phase 1, multi-op architecture). Absent on incidents created
     * before the dual-sync model — schema I/O then falls back to the main sync.
     */
    mgmt?: MissionRef;
    /** Canonical incident type slug from mission keywords (e.g. `search`, `rescue`). */
    incidentType?: string;
}

export interface PaneNavState {
    activeKey: string;
    activeHTab: string;
}

export const SESSION_MISSION_KEY = 'incident-manager:active-mission';
export const SESSION_NAV_KEY = 'incident-manager:pane-nav';

const VALID_NAV_KEYS = new Set([
    'create-open',
    'settings',
    'initial-information',
    'subject-info',
    'search-urgency',
    'ir-briefing',
    'resources',
    'work-assignments',
    'ics-201',
    'search-scenarios',
    'search-area',
    'segmentation',
    'initial-consensus',
    'operational-periods',
    'incident-post',
    'generate-closing-package',
]);

const VALID_HTAB_KEYS = new Set(['main', 'dashboard', 'task', 'clues', 'casie', 'organization', 'risk-assessment']);

function loadNavFromSession(): PaneNavState {
    try {
        const raw = sessionStorage.getItem(SESSION_NAV_KEY);
        if (!raw) return { activeKey: 'create-open', activeHTab: 'main' };
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return { activeKey: 'create-open', activeHTab: 'main' };
        }
        let key = (parsed as PaneNavState).activeKey;
        let htab = (parsed as PaneNavState).activeHTab;
        // Legacy: org chart tab was stored as `assignments` before Organization / work-assignments split.
        if (htab === 'assignments') htab = 'organization';
        // Resources moved from horizontal tab into Main vertical nav.
        if (htab === 'resources') {
            htab = 'main';
            key = 'resources';
        }
        // Assignments moved from horizontal tab into Main vertical nav.
        if (htab === 'work-assignments') {
            htab = 'main';
            key = 'work-assignments';
        }
        // Wrap Up split into section header + Generate Closing Package sub-pane.
        if (key === 'wrapup') key = 'generate-closing-package';
        // Risk Assessment moved from Main vertical nav into a horizontal tab.
        if (key === 'risk-assessment') {
            key = 'create-open';
            if (htab === 'main') htab = 'risk-assessment';
        }
        // CASIE moved from Main vertical nav into a horizontal tab.
        if (key === 'casie') {
            key = 'create-open';
            if (htab === 'main') htab = 'casie';
        }
        // Clue Log moved from the Area Search nav into its own horizontal tab.
        if (key === 'clue-log') {
            key = 'create-open';
            if (htab === 'main') htab = 'clues';
        }
        return {
            activeKey: VALID_NAV_KEYS.has(key) ? key : 'create-open',
            activeHTab: VALID_HTAB_KEYS.has(htab) ? htab : 'main',
        };
    } catch {
        return { activeKey: 'create-open', activeHTab: 'main' };
    }
}

function saveNavToSession(activeKey: string, activeHTab: string): void {
    try {
        sessionStorage.setItem(
            SESSION_NAV_KEY,
            JSON.stringify({ activeKey, activeHTab }),
        );
    } catch {
        // ignore quota / private-mode errors
    }
}

function loadMissionFromSession(): ActiveMission | null {
    try {
        const raw = sessionStorage.getItem(SESSION_MISSION_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (
            parsed
            && typeof parsed === 'object'
            && typeof (parsed as ActiveMission).guid === 'string'
            && typeof (parsed as ActiveMission).name === 'string'
        ) {
            const m = parsed as ActiveMission & { missionToken?: string };
            const mgmt = m.mgmt
                && typeof m.mgmt === 'object'
                && typeof m.mgmt.guid === 'string'
                && typeof m.mgmt.name === 'string'
                ? {
                    guid: m.mgmt.guid,
                    name: m.mgmt.name,
                    missionToken: typeof m.mgmt.missionToken === 'string' ? m.mgmt.missionToken : undefined,
                }
                : undefined;
            return {
                guid: m.guid,
                name: m.name,
                missionToken: typeof m.missionToken === 'string'
                    ? m.missionToken
                    : (typeof m.token === 'string' ? m.token : undefined),
                token: typeof m.token === 'string' ? m.token : undefined,
                mgmt,
                incidentType: typeof m.incidentType === 'string' ? m.incidentType : undefined,
            };
        }
    } catch {
        // ignore corrupt session data
    }
    return null;
}

function saveMissionToSession(m: ActiveMission | null): void {
    try {
        if (m) {
            sessionStorage.setItem(SESSION_MISSION_KEY, JSON.stringify(m));
        } else {
            sessionStorage.removeItem(SESSION_MISSION_KEY);
        }
    } catch {
        // ignore quota / private-mode errors
    }
}

const activeMission = ref<ActiveMission | null>(loadMissionFromSession());
const savedNav = loadNavFromSession();
const activeKey = ref(savedNav.activeKey);
const activeHTab = ref(savedNav.activeHTab);
/** Create Mission dropdown while no mission is active. */
const draftIncidentType = ref('');

const effectiveIncidentType = computed(() => {
    if (activeMission.value) return activeMission.value.incidentType ?? '';
    return draftIncidentType.value;
});
const isSearchIncident = computed(() => isSearchIncidentType(effectiveIncidentType.value));

const MISSION_EXEMPT_NAV_KEYS = new Set(['create-open', 'settings']);

const noMissionModalOpen = ref(false);

/** One-shot signal: open the CASIE tab with the Expand Search Area form open. */
const casieExpandRequested = ref(false);

export function isMissionRequiredView(key: string, htab: string): boolean {
    if (htab === 'dashboard' || htab === 'organization' || htab === 'risk-assessment' || htab === 'clues') return true;
    if (htab !== 'main') return false;
    return !MISSION_EXEMPT_NAV_KEYS.has(key);
}

function selectKey(key: string): void {
    activeKey.value = key;
    activeHTab.value = 'main';
}

function openNoMissionModal(): void {
    noMissionModalOpen.value = true;
}

function closeNoMissionModal(): void {
    noMissionModalOpen.value = false;
}

function requireActiveMission(): boolean {
    if (activeMission.value) return true;
    openNoMissionModal();
    return false;
}

function bounceHiddenSearchViews(): void {
    if (isSearchIncident.value) return;
    let key = activeKey.value;
    let htab = activeHTab.value;
    if (SEARCH_ONLY_HTAB_KEYS.has(htab)) htab = 'main';
    if (SEARCH_ONLY_NAV_KEYS.has(key)) {
        key = 'create-open';
        htab = 'main';
    }
    if (key !== activeKey.value) activeKey.value = key;
    if (htab !== activeHTab.value) activeHTab.value = htab;
}

function selectKeyGuarded(key: string): void {
    if (!isSearchIncident.value && SEARCH_ONLY_NAV_KEYS.has(key)) {
        selectKey('create-open');
        return;
    }
    if (activeMission.value || !isMissionRequiredView(key, 'main')) {
        selectKey(key);
        return;
    }
    openNoMissionModal();
}

function selectHTabGuarded(htab: string): void {
    if (!isSearchIncident.value && SEARCH_ONLY_HTAB_KEYS.has(htab)) {
        activeHTab.value = 'main';
        return;
    }
    if (activeMission.value || !isMissionRequiredView(activeKey.value, htab)) {
        activeHTab.value = htab;
        return;
    }
    openNoMissionModal();
}

function goToCreateOpen(): void {
    closeNoMissionModal();
    selectKey('create-open');
}

watch([activeKey, activeHTab], ([key, htab]) => {
    saveNavToSession(key, htab);
});

watch(activeMission, (m) => {
    if (m) closeNoMissionModal();
});

watch(isSearchIncident, () => {
    bounceHiddenSearchViews();
}, { immediate: true });

export function useIncident() {
    function setActiveMission(m: ActiveMission | null): void {
        activeMission.value = m;
        saveMissionToSession(m);
        bounceHiddenSearchViews();
    }

    function setDraftIncidentType(type: string): void {
        draftIncidentType.value = type;
    }

    /** Re-attach map overlay + active mission after pane reopen or page reload. */
    async function restoreActiveMissionOnMap(): Promise<void> {
        const m = activeMission.value;
        if (!m) return;

        if (!OverlayManager.loadedByMode('mission', m.guid)) {
            try {
                await OverlayManager.createLoaded({
                    name: m.name,
                    url: `/mission/${encodeURIComponent(m.name)}`,
                    type: 'geojson',
                    mode: 'mission',
                    mode_id: m.guid,
                    token: m.missionToken ?? m.token,
                });
            } catch (err) {
                // `POST /api/profile/overlay` proxies a TAK mission subscribe,
                // so it fails two quite different ways and the distinction
                // matters when reading the console:
                //  - timeout (core aborts every request at 20s, std.ts): the
                //    API reached TAK but the subscribe was too slow. Usually
                //    means the API is far from the TAK server (e.g. running
                //    locally against a remote TAK) or the mission is large.
                //  - 404: the remembered incident is genuinely gone.
                // Either way this must NOT abort the restore — letting it throw
                // leaves the pane mounted with no active mission and no
                // explanation ("no missions get pulled up"). The overlay may
                // also already exist server-side, in which case the mission
                // load below still succeeds.
                const detail = String(err instanceof Error ? err.message : err);
                const cause = /timed out/i.test(detail)
                    ? 'the request timed out — the API took too long to subscribe to the mission on TAK Server'
                    : 'the remembered incident may no longer exist on this server';
                console.warn(
                    `Incident Manager: could not add the map overlay for "${m.name}" — ${cause}. `
                    + 'Continuing to restore it.',
                    err,
                );
            }
        }

        const mapStore = useMapStore();
        let sub;
        try {
            sub = await mapStore.loadMission(m.guid);
        } catch (err) {
            console.warn(`Incident Manager: could not load mission "${m.name}".`, err);
        }
        if (sub) await mapStore.makeActiveMission(sub);

        const nextToken = sub?.missiontoken && sub.missiontoken !== m.missionToken
            ? sub.missiontoken
            : m.missionToken;
        let parsedType = m.incidentType;
        if (!parsedType) {
            parsedType = parseIncidentTypeFromRecord(sub);
            if (!parsedType) {
                try {
                    const loaded = await Subscription.load(m.guid, {
                        missiontoken: (nextToken ?? m.token) || undefined,
                        reload: false,
                    });
                    parsedType = parseIncidentTypeFromRecord(loaded);
                } catch {
                    parsedType = '';
                }
            }
            if (!parsedType) {
                parsedType = await resolveIncidentTypeFromFamily(m.name);
            }
        }
        if (nextToken !== m.missionToken || parsedType !== m.incidentType) {
            setActiveMission({
                ...m,
                missionToken: nextToken,
                incidentType: parsedType,
            });
        }
    }

    return {
        activeMission,
        activeKey,
        activeHTab,
        casieExpandRequested,
        noMissionModalOpen,
        isSearchIncident,
        effectiveIncidentType,
        setActiveMission,
        setDraftIncidentType,
        selectKey,
        selectKeyGuarded,
        selectHTabGuarded,
        requireActiveMission,
        openNoMissionModal,
        closeNoMissionModal,
        goToCreateOpen,
        isMissionRequiredView,
        restoreActiveMissionOnMap,
    };
}
