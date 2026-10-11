/**
 * Submit a filled Mission Template log to the current OP DataSync,
 * falling back to the common incident sync when no OP is open.
 */

import type { ActiveMission } from '../composables/useIncident.ts';
import type { OpPeriodRegistryEntry } from '../domain/entities.ts';
import { currentOpPeriod } from '../domain/registry.ts';
import type { MissionTemplateLogItem } from './missionTemplates.ts';

export interface TemplateLogTarget {
    guid: string;
    token?: string;
    label: string;
}

/** Current OP if one is open/debriefing; otherwise the common incident DataSync. */
export function templateLogTarget(
    mission: ActiveMission,
    registry: OpPeriodRegistryEntry[],
): TemplateLogTarget {
    const op = currentOpPeriod(registry);
    if (op) {
        return {
            guid: op.guid,
            token: op.ownerToken,
            label: op.name,
        };
    }
    return {
        guid: mission.guid,
        token: mission.missionToken ?? mission.token,
        label: mission.name,
    };
}

export async function resolveTemplateLogTarget(
    mission: ActiveMission,
): Promise<TemplateLogTarget> {
    if (!mission.mgmt) return templateLogTarget(mission, []);
    const { createRegistryStore } = await import('./registryPersistence.ts');
    const registry = await createRegistryStore(mission).load();
    return templateLogTarget(mission, registry);
}

export async function submitMissionTemplateLog(opts: {
    mission: ActiveMission;
    log: MissionTemplateLogItem;
    values: Record<string, unknown>;
}): Promise<TemplateLogTarget> {
    const target = await resolveTemplateLogTarget(opts.mission);
    const { default: Subscription } = await import('../../../../src/base/subscription.ts');
    const { stringify } = await import('yaml');
    const sub = await Subscription.load(target.guid, {
        missiontoken: target.token || undefined,
        subscribed: true,
        reload: false,
    });
    await sub.log.create({
        content: stringify(opts.values),
        keywords: [...opts.log.keywords, `template:${opts.log.id}`],
    });
    return target;
}
