import type { SwingLength } from './types';

export const SWING_LENGTHS: readonly SwingLength[] = [25, 50, 75, 100];

export const isSwingLength = (n: unknown): n is SwingLength => n === 25 || n === 50 || n === 75 || n === 100;

/** Tunable config (docs/slices/partial-swing/spec.md). Downswing duration relative to a full swing. */
const DURATION: Record<SwingLength, number> = { 25: 0.6, 50: 0.75, 75: 0.9, 100: 1 };
/** Tunable config: club-speed multiplier per length, tuned so a perfect 25% 62-degree swing carries 40 to 75 yd (PS-5). */
const SPEED: Record<SwingLength, number> = { 25: 0.5, 50: 0.68, 75: 0.86, 100: 1 };

export function assertLength(length: unknown): asserts length is SwingLength {
  if (!isSwingLength(length)) throw new RangeError(`invalid swing length: ${String(length)}`);
}
export const durationScale = (length: SwingLength): number => { assertLength(length); return DURATION[length]; };
export const lengthSpeedFactor = (length: SwingLength): number => { assertLength(length); return SPEED[length]; };
