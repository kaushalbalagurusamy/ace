// Simple-swing delivery: the ball position, the lie and max effort are the only sources of variation (docs/slices/simple-swing/spec.md).
export interface BallPos { fb: number; io: number }
export const CENTRE: BallPos = { fb: 0, io: 0 };

const step = (n: unknown): boolean => typeof n === 'number' && Number.isInteger(n) && n >= -2 && n <= 2;
export function isValidBallPos(p: unknown): p is BallPos {
  return typeof p === 'object' && p !== null && step((p as BallPos).fb) && step((p as BallPos).io);
}

/** Dynamic loft per forward (fb) step, degrees. */
export const LOFT_PER_FB_DEG = 1.5;
/** Swing path per away-from-body (io) step, degrees; + = in-to-out. */
export const PATH_PER_IO_DEG = 2;
/** Max effort: carry x1.2 (solved through the sim), 70% accuracy = 3x the normal-shot reference sigma/3. */
export const MAX_EFFORT = { distanceFactor: 1.2, accuracy: 0.7, sigmaFaceDeg: 1.2, sigmaPathDeg: 1.2 } as const;

export type Lie = 'tee' | 'fairway' | 'firstCut' | 'rough' | 'bunker' | 'fringe' | 'green';

export interface Strike {
  length?: number; ballPos?: BallPos; maxEffort?: boolean; seed?: number; lie?: Lie; dispersionScale?: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller. */
export function gauss(rng: () => number): number {
  const u = 1 - rng(); // (0, 1]
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
