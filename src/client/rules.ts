/** Client interaction rules shared by the prompt, the swing start and the tests. Coordinates are sim space (x right, z forward), metres. */
export const RANGE = 2.5;                                     // Space within this distance of your ball takes the stance
export const WALK_SPEED = 15, PRECISE_SPEED = 5;              // m/s on foot; hold Shift for the precise walk (owner: 15 felt right, 5 for greens)
export const PRECISE_LOOK = 0.5;                              // Shift also halves the look sensitivity (fine aim, putting lines)

export interface Pt { x: number; z: number }
/** Where the golfer stands next to a ball: just right of it and a little behind, as when a race starts or a hole begins. */
export const golferSpot = (ball: Pt): Pt => ({ x: ball.x + 1, z: ball.z - 0.5 });
export const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
/** The stance can start only on foot, within range of your own ball, with the ball at rest. */
export const canAddress = (golfer: Pt, ball: Pt, opts: { atRest: boolean; holedOut: boolean; inCart?: boolean }) =>
  opts.atRest && !opts.holedOut && !opts.inCart && distance(golfer, ball) <= RANGE;

/** Movement is the arrow keys only (up = forward, right = right). WASD belongs to the stance (ball position). */
export function moveAxis(keys: ReadonlySet<string>): { f: number; r: number } {
  return { f: Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown')), r: Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')) };
}
/** Held Shift on either side. */
export const shiftHeld = (keys: ReadonlySet<string>) => keys.has('ShiftLeft') || keys.has('ShiftRight');
export const walkSpeed = (keys: ReadonlySet<string>) => (shiftHeld(keys) ? PRECISE_SPEED : WALK_SPEED);
/** Look multiplier on top of the saved sensitivity: 0.5 while Shift is held, 1 otherwise. */
export const lookScale = (keys: ReadonlySet<string>) => (shiftHeld(keys) ? PRECISE_LOOK : 1);
