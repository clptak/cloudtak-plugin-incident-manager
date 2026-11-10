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

const GREEN: [number, number, number] = [47, 179, 68];
const AMBER: [number, number, number] = [245, 159, 0];
const RED: [number, number, number] = [214, 57, 57];

/**
 * Blended colour for long scales (GAR 0–10): green at the start, amber in the
 * middle, red at the end. Returns "r, g, b" for use in rgba().
 */
export function scaleRgb(index: number, count: number, lowIsRed = false): string {
    const t0 = count > 1 ? Math.max(0, Math.min(1, index / (count - 1))) : 0;
    const t = lowIsRed ? 1 - t0 : t0;
    const [a, b, u] = t <= 0.5 ? [GREEN, AMBER, t / 0.5] : [AMBER, RED, (t - 0.5) / 0.5];
    return a.map((c, i) => Math.round(c + (b[i] - c) * u)).join(', ');
}

/** Dark text on bright colours (amber, lime), white on the rest. */
export function scaleTextOn(rgb: string): string {
    const [r, g, b] = rgb.split(',').map(Number);
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1d273b' : '#fff';
}
