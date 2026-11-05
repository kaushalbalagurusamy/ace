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

// ---- Swing scoring (PRD/02 §3) ----
export interface SwingInput {
  /** ms, relative to the top of the backswing (t = 0). undefined = key not pressed by impact or released early. */
  zMs?: number; xMs?: number; cMs?: number;
}
export interface SwingScore {
  nZ: number; nX: number; nC: number;
  E: number;
  /** speed_max multiplier: 1 - 0.25E */ speedFactor: number;
  /** smash_max multiplier: 1 - 0.10E */ smashFactor: number;
  /** degrees, + = right (late X), - = left (early X): 6 * nX with sign */ pathDeg: number;
  /** degrees, + = open (late C), - = closed (early C): 5 * nC with sign */ faceToPathDeg: number;
}
// contract: export const IDEAL_MS: { z: 0; x: 60; c: 150 };
/** Pure function of the inputs only (no frame counts, no clocks). Missing key => n = 1 with sign 0 (no direction). */
// contract: export function scoreSwing(input: SwingInput): SwingScore;

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
}
/** Flat fairway, no wind, ISA sea level, ball starts at origin heading along +z (target line); x is right, y up.
 *  Deterministic: same Launch => identical ShotResult (bitwise-equal numbers). */
// contract: export function simulateShot(launch: Launch): ShotResult;

export interface Club { key: string; label: string; loftDeg: number; maxClubSpeedMph: number }
// contract: export const BAG: readonly Club[];
/** Launch for a given club and swing score on a flat fairway-equivalent strike (aimed straight at azimuth 0). */
// contract: export function launchFor(club: Club, score: SwingScore): Launch;

// ---- Swing length (docs/slices/partial-swing/spec.md) ----
export type SwingLength = 25 | 50 | 75 | 100;
// contract: export const SWING_LENGTHS: readonly SwingLength[];            // [25, 50, 75, 100]
// contract: export function isSwingLength(n: unknown): n is SwingLength;
/** Downswing duration scale (<= 1): ideal X/C offsets and the 120 ms error window are multiplied by it. 100 -> 1. */
// contract: export function durationScale(length: SwingLength): number;
/** Club-speed multiplier by length; 100 -> 1. Tunable config. */
// contract: export function lengthSpeedFactor(length: SwingLength): number;
// contract (extended): scoreSwing(input: SwingInput, length?: SwingLength): SwingScore   // default 100, throws RangeError on an invalid length
// contract (extended): launchFor(club: Club, score: SwingScore, length?: SwingLength): Launch // default 100, throws RangeError on an invalid length
