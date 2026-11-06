// Simple-swing delivery: the ball position, the lie and max effort are the only sources of variation (docs/slices/simple-swing/spec.md).
export interface BallPos { fb: number; io: number }
export const CENTRE: BallPos = { fb: 0, io: 0 };

/** Ball-position steps per axis, -BALL_STEPS..+BALL_STEPS (owner 2026-11-05: 7x7 for stingers, hooks and slices). */
export const BALL_STEPS = 3;
const step = (n: unknown): boolean => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= BALL_STEPS;
export function isValidBallPos(p: unknown): p is BallPos {
  return typeof p === 'object' && p !== null && step((p as BallPos).fb) && step((p as BallPos).io);
}

/** Dynamic loft per forward (fb) step, degrees (the first step; outer steps grow, see LOFT_STEPS_DEG). */
export const LOFT_PER_FB_DEG = 1.5;
/** Swing path per away-from-body (io) step, degrees; + = in-to-out (first step; see PATH_STEPS_DEG). */
export const PATH_PER_IO_DEG = 1; // halved after the owner playtest: Away +2 drew a driver 50 yd, now about 25 yd
/** Loft change by |fb| step: the outer step is a stinger (back) or a towering shot (forward). */
export const LOFT_STEPS_DEG = [0, 1.5, 3, 6] as const;
/** Path change by |io| step: the outer step is a hook (away) or a slice (closer). */
export const PATH_STEPS_DEG = [0, 1, 2, 4] as const;
const signedStep = (table: readonly number[], n: number) => Math.sign(n) * table[Math.min(Math.abs(n), BALL_STEPS)]!;
export const loftForFb = (fb: number) => signedStep(LOFT_STEPS_DEG, fb);
export const pathForIo = (io: number) => signedStep(PATH_STEPS_DEG, io);
/** Player-facing name of a ball position's shot shape, e.g. "Stinger · Hook"; "Stock" at the centre. */
export function shotShape(fb: number, io: number): string {
  const h = ['Towering', 'Higher', 'High', '', 'Low', 'Punch', 'Stinger'][3 - fb] ?? '';
  const c = ['Slice', 'Fade', 'Slight fade', '', 'Slight draw', 'Draw', 'Hook'][io + 3] ?? '';
  return [h, c].filter(Boolean).join(' · ') || 'Stock';
}
/** Max effort (owner, 2026-11-05): club speed x1.1 (130 -> 143 mph driver) at 75% accuracy, i.e. random face and path
 *  errors of sigma 1.0 degrees each (1.2 degrees was the earlier 70% setting; sigma scales with 1 - accuracy). */
export const MAX_EFFORT = { speedFactor: 1.1, accuracy: 0.75, sigmaFaceDeg: 1.0, sigmaPathDeg: 1.0 } as const;

export type Lie = 'tee' | 'fairway' | 'firstCut' | 'rough' | 'bunker' | 'fringe' | 'green';

export interface Strike {
  length?: number; ballPos?: BallPos; maxEffort?: boolean; seed?: number; lie?: Lie; dispersionScale?: number;
  /** stance slope at the ball (shared/height stanceSlope): alongDeg + = uphill, sideDeg + = ball above the feet. Ignored on the tee box. */
  slope?: { alongDeg: number; sideDeg: number };
}

/** UNVERIFIED design constants (docs/research/elevation.md §4): on an up/downhill lie the dynamic loft follows the slope degree for degree and the
 *  attack angle half of it, so spin loft grows uphill (higher, spinnier, shorter) and shrinks downhill. */
export const SLOPE_LOFT_SHARE = 1, SLOPE_ATTACK_SHARE = 0.5;
/** Face change from a side slope: a ball above the feet tilts the toe up, and a lofted face tilted by phi points atan(tan(loft)·sin(phi)) left of
 *  where it would (the lie-angle rule: about 0.7° per degree for a 7-iron, 0.14° for a driver). + = face right. Uses the static loft. */
export const sideSlopeFaceDeg = (staticLoftDeg: number, sideDeg: number) =>
  (-Math.atan(Math.tan((staticLoftDeg * Math.PI) / 180) * Math.sin((sideDeg * Math.PI) / 180)) * 180) / Math.PI;

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
