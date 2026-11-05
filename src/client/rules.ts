/** Client interaction rules shared by the prompt, the swing start and the tests. Coordinates are sim space (x right, z forward), metres. */
export const RANGE = 2.5;                                     // Space within this distance of your ball takes the stance
export const WALK_SPEED = 13, SPRINT_SPEED = 18;              // m/s on foot (owner playtest: 9 felt slow); config values

export interface Pt { x: number; z: number }
/** Where the golfer stands next to a ball: just right of it and a little behind, as when a race starts or a hole begins. */
export const golferSpot = (ball: Pt): Pt => ({ x: ball.x + 1, z: ball.z - 0.5 });
export const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
/** The stance can start only on foot, within range of your own ball, with the ball at rest. */
export const canAddress = (golfer: Pt, ball: Pt, opts: { atRest: boolean; holedOut: boolean; inCart?: boolean }) =>
  opts.atRest && !opts.holedOut && !opts.inCart && distance(golfer, ball) <= RANGE;
