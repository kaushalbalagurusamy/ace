import type { SwingInput, SwingScore } from './types';

export const IDEAL_MS = { z: 0, x: 60, c: 150 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Returns normalised error and direction sign (-1 early, +1 late, 0 missing/on time). */
function key(press: number | undefined, ideal: number): { n: number; sign: number } {
  if (press === undefined || !Number.isFinite(press)) return { n: 1, sign: 0 };
  const e = press - ideal;
  return { n: clamp01(Math.abs(e) / 120), sign: Math.sign(e) };
}

export function scoreSwing(input: SwingInput): SwingScore {
  const z = key(input.zMs, IDEAL_MS.z);
  const x = key(input.xMs, IDEAL_MS.x);
  const c = key(input.cMs, IDEAL_MS.c);
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
