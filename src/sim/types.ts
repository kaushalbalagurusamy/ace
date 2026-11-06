// Contract for the pure simulation (server-owned). Units are SI unless a name says otherwise.
// See PRD/02 §3, PRD/03, PRD/04. Physics constants cite docs/research/trackman-physics.md.

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
/** The ball as it first meets the ground: speed (m/s), descent angle (degrees below horizontal), backspin (rpm, + = backspin). */
export interface Landing { speedMs: number; angleDeg: number; spinRpm: number }
export interface ShotResult {
  /** Flight only, sampled at 60 Hz from a 120 Hz RK4 integration; first sample is t=0 at launch position, last is the landing. */
  samples: TrajectoryPoint[];
  carryM: number;
  totalM: number;
  /** signed lateral miss from the target line in metres, + = right */ offlineM: number;
  flightTimeS: number;
  /** highest point of the flight (m) */ apexM: number;
  landing: Landing;
}
/** Flat fairway, no wind, standard air (21 °C, 50% RH, sea level) unless `air` says otherwise; ball starts at origin heading along +z
 *  (target line); x is right, y up. carry/total/offline include the bounce and roll on flat fairway (bounceRoll).
 *  Deterministic: same Launch => identical ShotResult (bitwise-equal numbers). */
// contract: export function simulateShot(launch: Launch, air?: Air): ShotResult;
// contract: export function bounceRoll(landing: Landing, surface: Surface): RunOut; // shared by the sim and the server's surface roll
// contract: export function captureSpeed(offsetM: number): number; // max speed (m/s) at which a ball crossing the cup at this offset drops

export interface Club { key: string; label: string; loftDeg: number; maxClubSpeedMph: number }
// contract: export const BAG: readonly Club[];
/** Launch for a club and a Strike (delivery.ts): perfect delivery unless ball position, lie or max effort say otherwise. */
// contract: export function launchFor(club: Club, strike?: Strike): Launch;

// ---- Swing length: continuous, set by holding Space (docs/slices/space-hold-swing/spec.md) ----
// contract: export const MIN_LENGTH = 0.05, MAX_LENGTH = 1, FULL_TURN_MS = 750;
// contract: export function isValidLength(n: unknown): n is number;      // any finite number (clamping is separate)
// contract: export function clampLength(n: number): number;               // clamp to [MIN, MAX]; RangeError if not finite
// contract: export function lengthFromHold(heldMs: number): number;       // clampLength(heldMs / FULL_TURN_MS); RangeError if not finite
/** Club-speed multiplier: piecewise-linear through (0.05,0.25) (0.25,0.62) (0.5,0.76) (0.75,0.86) (1,1). RangeError outside [0.05,1]. */
// contract: export function lengthSpeedFactor(length: number): number;
/** Putt ball speed (m/s) = PUTT_MAX_MS x sqrt(length), so roll distance is proportional to the hold; a full hold rolls about 30 m on Stimp 10. RangeError outside [0.05,1]. */
// contract: export function puttSpeedMs(length: number): number;
// contract: export const MAX_EFFORT_HOLD_MS = 1100; effortFromHold(holdMs, putt): { length, maxEffort }  // RangeError if not finite
