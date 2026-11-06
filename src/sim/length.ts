// Swing length is a continuous fraction set by holding Space (docs/slices/space-hold-swing/spec.md).
export const MIN_LENGTH = 0.05;
export const MAX_LENGTH = 1;
/** Tunable config: a full backswing turn takes this long when Space is held. */
export const FULL_TURN_MS = 750;

export const isValidLength = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function clampLength(n: number): number {
  if (!isValidLength(n)) throw new RangeError(`invalid swing length: ${String(n)}`);
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n));
}
/** Holding Space this long (or more) releases a full swing as a max-effort shot. */
export const MAX_EFFORT_HOLD_MS = 1100;
export function effortFromHold(holdMs: number, putt: boolean): { length: number; maxEffort: boolean } {
  if (!isValidLength(holdMs)) throw new RangeError(`invalid hold: ${String(holdMs)}`);
  return { length: clampLength(holdMs / FULL_TURN_MS), maxEffort: !putt && holdMs >= MAX_EFFORT_HOLD_MS };
}
export const lengthFromHold = (heldMs: number): number => clampLength(heldMs / FULL_TURN_MS);

function assertLength(n: unknown): asserts n is number {
  if (!isValidLength(n) || n < MIN_LENGTH || n > MAX_LENGTH) throw new RangeError(`swing length outside [${MIN_LENGTH}, ${MAX_LENGTH}]: ${String(n)}`);
}
type Pts = readonly (readonly [number, number])[];
function interp(pts: Pts, x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1]![1];
}

/** Tunable config. Club speed by length, tuned so a perfect 25% 62-degree swing carries 40 to 75 yd. */
const SPEED: Pts = [[0.05, 0.18], [0.25, 0.5], [0.5, 0.68], [0.75, 0.86], [1, 1]];

export function lengthSpeedFactor(length: number): number { assertLength(length); return interp(SPEED, length); }
/** Putt ball speed (m/s): 15 m/s x length, the old drawMs / 1500 x 15 curve. */
export function puttSpeedMs(length: number): number { assertLength(length); return 15 * length; }
