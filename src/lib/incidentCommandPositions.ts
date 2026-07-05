import { INCIDENT_COMMAND_POSITIONS, type IncidentCommandPositionDef } from '../data/incidentCommandPositions.ts';
import type { D4HMember } from './d4hTypes.ts';
import type { PendingPaletteDrop } from './hastyTeamTree.ts';

export interface IcsSlotConfig {
    d4hMemberId: number | '';
    customName: string;
}

export function createEmptyIcsSlots(): Record<string, IcsSlotConfig> {
    return Object.fromEntries(
        INCIDENT_COMMAND_POSITIONS.map((pos) => [pos.key, { d4hMemberId: '', customName: '' }]),
    );
}

export function resolveIcsAssignee(
    slot: IcsSlotConfig,
    members: D4HMember[],
): { assigneeName?: string; d4hMemberId?: number } {
    const custom = slot.customName.trim();
    if (custom) return { assigneeName: custom };

    if (slot.d4hMemberId !== '') {
        const memberId = Number(slot.d4hMemberId);
        const member = members.find((m) => m.id === memberId);
        if (member) return { assigneeName: member.name, d4hMemberId: member.id };
    }

    return {};
}

export function icsCommandPreview(
    position: IncidentCommandPositionDef,
    slot: IcsSlotConfig,
    members: D4HMember[],
): { title: string; description: string } {
    const { assigneeName } = resolveIcsAssignee(slot, members);
    return {
        title: position.title,
        description: assigneeName ?? '',
    };
}

export function icsCommandDropFromSlot(
    position: IncidentCommandPositionDef,
    slot: IcsSlotConfig,
    members: D4HMember[],
): PendingPaletteDrop {
    const { assigneeName, d4hMemberId } = resolveIcsAssignee(slot, members);
    return {
        kind: 'ics-command',
        icsPositionKey: position.key,
        icsPositionTitle: position.title,
        assigneeName,
        d4hMemberId,
        title: position.title,
        description: assigneeName ?? '',
    };
}

export function filterIcsPositions(
    query: string,
    slots?: Record<string, IcsSlotConfig>,
    members?: D4HMember[],
): IncidentCommandPositionDef[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...INCIDENT_COMMAND_POSITIONS];

    return INCIDENT_COMMAND_POSITIONS.filter((pos) => {
        if (pos.title.toLowerCase().includes(q)) return true;
        if (!slots || !members) return false;
        const preview = icsCommandPreview(pos, slots[pos.key], members);
        return preview.description.toLowerCase().includes(q);
    });
}
