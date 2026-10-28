/** Pre-selecting the configured default channels on Create Mission. */

export interface ChannelLike {
    name: string;
    active: boolean;
    direction: string[];
}

/**
 * The defaults this user can pick in an IN, active-only GroupSelect, in the
 * configured order. A channel the user lacks would be invisible in the picker
 * yet still sent with the mission, so it is dropped.
 */
export function availableDefaults(defaults: readonly string[], channels: readonly ChannelLike[]): string[] {
    const usable = new Set(
        channels
            .filter((channel) => channel.active && channel.direction.includes('IN'))
            .map((channel) => channel.name),
    );
    return defaults.filter((name, index) => usable.has(name) && defaults.indexOf(name) === index);
}
