import type { SwingInput, SwingLength, SwingScore } from './types';
import { durationScale } from './length';

export const IDEAL_MS = { z: 0, x: 60, c: 150 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Returns normalised error and direction sign (-1 early, +1 late, 0 missing/on time). */
function key(press: number | undefined, ideal: number, window: number): { n: number; sign: number } {
  if (press === undefined || !Number.isFinite(press)) return { n: 1, sign: 0 };
  const e = press - ideal;
  return { n: clamp01(Math.abs(e) / window), sign: Math.sign(e) };
}

/** `length` shortens the downswing: ideal X/C offsets and the 120 ms window scale with durationScale (default 100 = unchanged). */
export function scoreSwing(input: SwingInput, length: SwingLength = 100): SwingScore {
  const d = durationScale(length); // throws RangeError on an invalid length
  const z = key(input.zMs, IDEAL_MS.z, 120 * d);
  const x = key(input.xMs, IDEAL_MS.x * d, 120 * d);
  const c = key(input.cMs, IDEAL_MS.c * d, 120 * d);
  const E = 0.4 * z.n + 0.3 * x.n + 0.3 * c.n;
  return {
    nZ: z.n,
    nX: x.n,
    nC: c.n,
    E,
    speedFactor: 1 - 0.25 * E,
    smashFactor: 1 - 0.1 * E,
    pathDeg: 6 * x.n * x.sign + 0, // + 0 turns -0 into 0
    faceToPathDeg: 5 * c.n * c.sign + 0,
  };
}
