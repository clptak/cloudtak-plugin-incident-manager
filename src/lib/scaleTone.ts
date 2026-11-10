/**
 * Colours for a numbered scale shown as buttons: green → amber → red, or the
 * reverse. Tones are Tabler colour names (Tabler's "yellow" is amber).
 */

export type ScaleTone = 'green' | 'lime' | 'yellow' | 'orange' | 'red';

const RAMPS: Record<number, ScaleTone[]> = {
    2: ['green', 'red'],
    3: ['green', 'yellow', 'red'],
    4: ['green', 'yellow', 'orange', 'red'],
    5: ['green', 'lime', 'yellow', 'orange', 'red'],
};

/**
 * Tone of the option at `index` out of `count`. `lowIsRed` flips the ramp so
 * the first option is red (Search Urgency: 1 = most urgent).
 */
export function scaleTone(index: number, count: number, lowIsRed = false): ScaleTone {
    const ramp = RAMPS[count] ?? RAMPS[5];
    const i = Math.max(0, Math.min(ramp.length - 1, lowIsRed ? ramp.length - 1 - index : index));
    return ramp[i];
}
