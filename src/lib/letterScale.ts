/** A–I Likert color scale: A–D green, E neutral, F–I red. */

export type LetterScaleNeutral = 'primary' | 'secondary';

/** CSS classes for an A–I chip. E keeps Bootstrap primary/secondary. */
export function letterScaleClass(
    letter: string,
    selected: boolean,
    neutralSelected: LetterScaleNeutral = 'primary',
): string {
    if (letter === 'E') {
        return selected ? `btn-${neutralSelected}` : 'btn-outline-secondary';
    }
    const tint = `letter-scale-btn letter-scale-${letter}`;
    return selected ? `${tint} is-selected` : tint;
}

/** CSS classes for the matching legend letter (text color only). */
export function letterScaleLegendClass(letter: string): string {
    if (letter === 'E') return '';
    return `letter-scale-legend letter-scale-${letter}`;
}
