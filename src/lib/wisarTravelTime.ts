/**
 * Travel Time form logic, mirroring the WiSAR web tool (app.js setIsoUnit,
 * setIsoSpeedPreset, runIsochroneAnalysis). Pure, so node:test can run it.
 */
import type { TravelTimeJobRequest } from './wisar.ts';

export type SpeedUnit = 'mph' | 'kmh';

export const MPH_TO_KMH = 1.609344;
/** The API's limit (20 km/h). */
export const MAX_SPEED_KMH = 20;

/** Presets from the web tool, all in mph. */
export const SPEED_PRESETS: readonly { mph: number; label: string }[] = [
    { mph: 0.5, label: 'Impaired' },
    { mph: 1.0, label: 'Slow' },
    { mph: 2.0, label: 'Moderate' },
    { mph: 3.1, label: 'Fit hiker' },
];

/** Interval checkboxes from the web tool; all checked by default there. */
export const INTERVAL_OPTIONS: readonly number[] = [2, 4, 6, 8, 10, 12];

export function unitLabel(unit: SpeedUnit): string {
    return unit === 'kmh' ? 'km/h' : 'mph';
}

/**
 * Value shown after switching units, rounded to 0.1 like the web tool.
 * Blank or invalid input stays as it is.
 */
export function convertSpeedText(text: string, from: SpeedUnit, to: SpeedUnit): string {
    if (from === to) return text;
    const v = Number(text);
    if (!text.trim() || !Number.isFinite(v) || v <= 0) return text;
    const out = to === 'kmh' ? v * MPH_TO_KMH : v / MPH_TO_KMH;
    return out.toFixed(1);
}

export function speedKmh(value: number, unit: SpeedUnit): number {
    return unit === 'kmh' ? value : value * MPH_TO_KMH;
}

/** Why the form can't run yet, or null. */
export function travelTimeProblem(
    ipp: { lat: number; lon: number } | null,
    speedText: string,
    unit: SpeedUnit,
    intervals: readonly number[],
): string | null {
    if (!ipp) return 'Choose an IPP.';
    const v = Number(speedText);
    if (!speedText.trim() || !Number.isFinite(v) || v <= 0) return 'Enter a travel speed.';
    if (speedKmh(v, unit) > MAX_SPEED_KMH + 1e-9) {
        return `Speed must be at most ${MAX_SPEED_KMH} km/h (${(MAX_SPEED_KMH / MPH_TO_KMH).toFixed(1)} mph).`;
    }
    if (!intervals.length) return 'Select at least one time interval.';
    return null;
}

export function travelTimeRequest(
    ipp: { lat: number; lon: number },
    speedText: string,
    unit: SpeedUnit,
    intervals: readonly number[],
): TravelTimeJobRequest {
    return {
        ipp: { lat: ipp.lat, lon: ipp.lon },
        speed: { value: Number(speedText), unit },
        intervals_hours: [...new Set(intervals)].sort((a, b) => a - b),
    };
}

/** "1:05" / "12:00" style elapsed time. */
export function formatElapsed(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
