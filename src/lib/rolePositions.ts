import type { RolePositionDef } from '../data/rolePositionTypes.ts';
import { INCIDENT_COMMAND_POSITIONS } from '../data/incidentCommandPositions.ts';
import {
    RESCUE_GROUP_LABELS,
    RESCUE_MANAGEMENT_POSITIONS,
    type RescueGroupLabel,
} from '../data/rescueManagementPositions.ts';
import type { D4HMember } from './d4hTypes.ts';
import type { PendingPaletteDrop, RoleCategory } from './hastyTeamTree.ts';

export interface SingleRoleSlotConfig {
    d4hMemberId: number | '';
    customName: string;
}

export interface MultipleRoleSlotConfig {
    d4hMemberIds: number[];
    customNames: string;
}

export type RoleSlotConfig = SingleRoleSlotConfig | MultipleRoleSlotConfig;

export function createEmptyRoleSlots(positions: RolePositionDef[]): Record<string, RoleSlotConfig> {
    return Object.fromEntries(
        positions.map((pos) => [
            pos.key,
            pos.assigneeMode === 'single'
                ? { d4hMemberId: '', customName: '' }
                : { d4hMemberIds: [], customNames: '' },
        ]),
    );
}

export function createEmptyIcsSlots(): Record<string, RoleSlotConfig> {
    return createEmptyRoleSlots(INCIDENT_COMMAND_POSITIONS);
}

export function createEmptyRescueSlots(): Record<string, RoleSlotConfig> {
    return createEmptyRoleSlots(RESCUE_MANAGEMENT_POSITIONS);
}

export function resolveSingleAssignee(
    slot: SingleRoleSlotConfig,
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

export function parseCustomNamesList(text: string): string[] {
    return text.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
}

export function resolveMultipleAssignees(
    slot: MultipleRoleSlotConfig,
    members: D4HMember[],
): { assigneeNames: string[]; d4hMemberIds: number[] } {
    const custom = slot.customNames.trim();
    if (custom) {
        return { assigneeNames: parseCustomNamesList(custom), d4hMemberIds: [] };
    }

    const d4hMemberIds = slot.d4hMemberIds
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));
    const assigneeNames = d4hMemberIds
        .map((id) => members.find((m) => m.id === id)?.name)
        .filter((name): name is string => Boolean(name));

    return { assigneeNames, d4hMemberIds };
}

export function rolePositionPreview(
    position: RolePositionDef,
    slot: RoleSlotConfig,
    members: D4HMember[],
): { title: string; description: string } {
    if (position.assigneeMode === 'single') {
        const { assigneeName } = resolveSingleAssignee(slot as SingleRoleSlotConfig, members);
        return {
            title: position.title,
            description: assigneeName ?? '',
        };
    }

    const { assigneeNames } = resolveMultipleAssignees(slot as MultipleRoleSlotConfig, members);
    return {
        title: position.title,
        description: assigneeNames.join(', '),
    };
}

export function rolePositionDropFromSlot(
    position: RolePositionDef,
    slot: RoleSlotConfig,
    members: D4HMember[],
): PendingPaletteDrop {
    if (position.assigneeMode === 'single') {
        const { assigneeName, d4hMemberId } = resolveSingleAssignee(slot as SingleRoleSlotConfig, members);
        return {
            kind: 'role-position',
            roleCategory: position.category,
            roleKey: position.key,
            roleTitle: position.title,
            assigneeMode: 'single',
            assigneeName,
            d4hMemberId,
            title: position.title,
            description: assigneeName ?? '',
        };
    }

    const { assigneeNames, d4hMemberIds } = resolveMultipleAssignees(slot as MultipleRoleSlotConfig, members);
    const description = assigneeNames.join(', ');
    return {
        kind: 'role-position',
        roleCategory: position.category,
        roleKey: position.key,
        roleTitle: position.title,
        assigneeMode: 'multiple',
        assigneeNames,
        d4hMemberIds,
        title: position.title,
        description,
    };
}

export function filterRolePositions(
    positions: RolePositionDef[],
    query: string,
    slots?: Record<string, RoleSlotConfig>,
    members?: D4HMember[],
): RolePositionDef[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...positions];

    return positions.filter((pos) => {
        if (pos.title.toLowerCase().includes(q)) return true;
        if (!slots || !members) return false;
        const preview = rolePositionPreview(pos, slots[pos.key], members);
        return preview.description.toLowerCase().includes(q);
    });
}

export function filterIcsPositions(
    query: string,
    slots?: Record<string, RoleSlotConfig>,
    members?: D4HMember[],
): RolePositionDef[] {
    return filterRolePositions(INCIDENT_COMMAND_POSITIONS, query, slots, members);
}

export function filterRescuePositions(
    query: string,
    slots?: Record<string, RoleSlotConfig>,
    members?: D4HMember[],
): RolePositionDef[] {
    return filterRolePositions(RESCUE_MANAGEMENT_POSITIONS, query, slots, members);
}

export function filterRescueGroupLabels(query: string): RescueGroupLabel[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...RESCUE_GROUP_LABELS];
    return RESCUE_GROUP_LABELS.filter((label) => label.title.toLowerCase().includes(q));
}

export function fixedRescueLabelDrop(label: RescueGroupLabel): PendingPaletteDrop {
    return {
        kind: 'role-position',
        roleCategory: 'rescue-management',
        roleKey: label.key,
        roleTitle: label.title,
        assigneeMode: 'single',
        title: label.title,
        description: '',
    };
}

export function isSingleRoleSlot(position: RolePositionDef): position is RolePositionDef & { assigneeMode: 'single' } {
    return position.assigneeMode === 'single';
}

export function isMultipleRoleSlot(position: RolePositionDef): position is RolePositionDef & { assigneeMode: 'multiple' } {
    return position.assigneeMode === 'multiple';
}

export function asSingleSlot(slot: RoleSlotConfig): SingleRoleSlotConfig {
    return slot as SingleRoleSlotConfig;
}

export function asMultipleSlot(slot: RoleSlotConfig): MultipleRoleSlotConfig {
    return slot as MultipleRoleSlotConfig;
}

export type { RoleCategory };
