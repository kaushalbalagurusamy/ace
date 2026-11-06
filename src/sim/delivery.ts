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
export const PATH_PER_IO_DEG = 1; // halved after the owner playtest: Away +2 drew a driver 50 yd, now about 25 yd
/** Max effort (owner, 2026-11-05): club speed x1.1 (130 -> 143 mph driver) at 75% accuracy, i.e. random face and path
 *  errors of sigma 1.0 degrees each (1.2 degrees was the earlier 70% setting; sigma scales with 1 - accuracy). */
export const MAX_EFFORT = { speedFactor: 1.1, accuracy: 0.75, sigmaFaceDeg: 1.0, sigmaPathDeg: 1.0 } as const;

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
