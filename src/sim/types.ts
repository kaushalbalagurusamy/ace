// Contract for the pure simulation (server-owned). Units are SI unless a name says otherwise.
// See PRD/02 §3, PRD/03, PRD/04. Constants are placeholders until PRD/03 §8 sources are checked.

export interface Vec3 { x: number; y: number; z: number }

// ---- Ranking (PRD/04) ----
export interface PlayerResult {
  id: string;
  /** Seconds from Go to ball dropping in the 18th cup; undefined = did not finish. */
  finishTime?: number;
  strokes: number;
  holesCompleted: number;
  /** Metres from ball to hole when progress froze (non-finishers only). */
  distanceToHole?: number;
}
export interface Placement { id: string; place: number }
/** Group rule: anchor = fastest remaining; group = all within 1.000 s of anchor (inclusive);
 *  rank group by strokes (lower first), ties listed by time; equal strokes within a group share a place (dead heat, PRD/04).
 *  Finishers always outrank non-finishers; non-finishers: holesCompleted desc, distanceToHole asc, strokes asc.
 *  Returned in rank order. Place numbers use competition ranking (1,1,3). Does not mutate input. */
// contract: export function rankPlayers(players: readonly PlayerResult[]): Placement[];

// ---- Ball physics (PRD/03) ----
export type Surface = 'green' | 'fringe' | 'fairway' | 'firstCut' | 'rough' | 'bunker';
/** Constant rolling deceleration (m/s^2) on a flat surface. Green: Stimp S gives 36 / (2 * S) ft/s^2 converted to m/s^2. */
// contract: export function rollingDecel(surface: Surface, stimp?: number): number;
/** Distance (m) a ball rolling at speed v0 (m/s) travels on flat ground before stopping. */
// contract: export function rollDistance(v0: number, surface: Surface, stimp?: number): number;

export interface Launch {
  /** m/s */ ballSpeed: number;
  /** degrees above horizontal */ launchDeg: number;
  /** degrees, + = right of target line */ azimuthDeg: number;
  /** rpm */ backspinRpm: number;
  /** degrees, + tilts the spin axis so the ball curves right (right-hand golfer) */ spinAxisDeg: number;
}
export interface TrajectoryPoint { t: number; p: Vec3 }
export interface ShotResult {
  /** Sampled at 60 Hz from a 240 Hz RK4 integration; first sample is t=0 at launch position. */
  samples: TrajectoryPoint[];
  carryM: number;
  totalM: number;
  /** signed lateral miss from the target line in metres, + = right */ offlineM: number;
  flightTimeS: number;
  /** horizontal speed (m/s) at first ground contact; roll-out starts from LAND_ROLL_FRACTION of it */ landingSpeedMs: number;
}
/** Flat fairway, no wind, ISA sea level, ball starts at origin heading along +z (target line); x is right, y up.
 *  Deterministic: same Launch => identical ShotResult (bitwise-equal numbers). */
// contract: export function simulateShot(launch: Launch): ShotResult;
// contract: export const LAND_ROLL_FRACTION: number; // shared by the sim and the server's surface roll

export interface Club { key: string; label: string; loftDeg: number; maxClubSpeedMph: number }
// contract: export const BAG: readonly Club[];
/** Launch for a club and a Strike (delivery.ts): perfect delivery unless ball position, lie or max effort say otherwise. */
// contract: export function launchFor(club: Club, strike?: Strike): Launch;

// ---- Swing length: continuous, set by holding Space (docs/slices/space-hold-swing/spec.md) ----
// contract: export const MIN_LENGTH = 0.05, MAX_LENGTH = 1, FULL_TURN_MS = 750;
// contract: export function isValidLength(n: unknown): n is number;      // any finite number (clamping is separate)
// contract: export function clampLength(n: number): number;               // clamp to [MIN, MAX]; RangeError if not finite
// contract: export function lengthFromHold(heldMs: number): number;       // clampLength(heldMs / FULL_TURN_MS); RangeError if not finite
/** Club-speed multiplier: piecewise-linear through (0.05,0.18) (0.25,0.5) (0.5,0.68) (0.75,0.86) (1,1). RangeError outside [0.05,1]. */
// contract: export function lengthSpeedFactor(length: number): number;
/** Putt ball speed (m/s) = 15 x length (the old drawMs/1500 x 15 curve). RangeError outside [0.05,1]. */
// contract: export function puttSpeedMs(length: number): number;
// contract: export const MAX_EFFORT_HOLD_MS = 1100; effortFromHold(holdMs, putt): { length, maxEffort }  // RangeError if not finite
