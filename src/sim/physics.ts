// Ball physics calibrated to TrackMan-grade numbers. Every constant cites docs/research/trackman-physics.md (§ = section there).
import type { Club, Landing, Launch, ShotResult, Surface, TrajectoryPoint } from './types';
import { lengthSpeedFactor } from './length';
import { CENTRE, LOFT_PER_FB_DEG, MAX_EFFORT, PATH_PER_IO_DEG, gauss, mulberry32 } from './delivery';
import type { Lie, Strike } from './delivery';

const MASS = 0.04593;                 // kg, Rules of Golf max (§3.1)
const RADIUS = 0.021335;              // m (§5.1)
const AREA = Math.PI * RADIUS * RADIUS;
const G = 9.80665;
const MPH = 0.44704;
const FT = 0.3048;
const RAD = Math.PI / 180;
const DT = 1 / 120;                   // RK4 step: finer than the 0.01 s §3.5 recommends and a whole number of steps per 60 Hz sample
const SAMPLE_EVERY = 2;
const MAX_STEPS = 120 * 30;
const LAMBDA = 2.0e-5;                // spin decay dω/dt = -λ·v·ω/R (§3.3, Smits & Smith)

// ---- Air (§3.4, Nathan). Standard conditions for the game and the §6 validation cases: 21 °C, 50% RH, sea level, 760 mmHg. ----
export interface Air { tempC?: number; elevM?: number; rhPct?: number; mmHg?: number }
export function airDensity({ tempC = 21, elevM = 0, rhPct = 50, mmHg = 760 }: Air = {}): number {
  const svp = 4.5841 * Math.exp(((18.687 - tempC / 234.5) * tempC) / (257.14 + tempC));
  return (1.2929 * (273 / (tempC + 273)) * (mmHg * Math.exp(-1.217e-4 * elevM) - (0.3783 * rhPct * svp) / 100)) / 760;
}
const viscosity = (tempC: number) => (1.512e-6 * (tempC + 273.16) ** 1.5) / (tempC + 273.16 + 120); // Sutherland, Pa·s

// ---- Drag and lift (§3.2): set A for irons and wedges, set B for driver and woods, blended on the launch spin ratio over 0.10-0.14. ----
const SET_A = { cdH: 0.2213, cdS: 0.1816, cdL: 0.5038, clA: 0.4566, clP: 0.4005 };
const SET_B = { cdH: 0.2149, cdS: 0.0099, cdL: 0.5038, clA: 0.2555, clP: 0.2 };
function coeffs(set: typeof SET_A, s: number, re: number): [number, number] {
  const base = re <= 5e4 ? set.cdL : re >= 1e5 ? set.cdH : set.cdL + ((set.cdH - set.cdL) * (re - 5e4)) / 5e4;
  return [base + set.cdS * s, set.clA * s ** set.clP];
}

// ---- Rolling (§4.2, §4.3) ----
/** Firm-fairway rolling deceleration, tuned so the §6 case 10 driver landing bounces and rolls 30 yd (§4.2: "not found", tune to targets). */
const FAIRWAY_DECEL = 4.5;
// UNVERIFIED: no source for the other surfaces; they keep the old placeholder ratios to the fairway.
const DECEL: Record<Exclude<Surface, 'green' | 'bunker'>, number> = {
  fringe: FAIRWAY_DECEL * (1.1 / 1.4), fairway: FAIRWAY_DECEL, firstCut: FAIRWAY_DECEL * (2.5 / 1.4), rough: FAIRWAY_DECEL * (5 / 1.4),
};
const STIMP_RELEASE_MS = 6 * FT;      // Stimpmeter release speed, 6.00 ft/s (§4.3)

export function rollingDecel(surface: Surface, stimp = 10): number {
  if (surface === 'bunker') return Infinity;
  if (surface === 'green') return (STIMP_RELEASE_MS * STIMP_RELEASE_MS) / (2 * stimp * FT);
  return DECEL[surface];
}

export function rollDistance(v0: number, surface: Surface, stimp = 10): number {
  if (v0 <= 0) return 0;
  return (v0 * v0) / (2 * rollingDecel(surface, stimp)); // Infinity decel => 0
}

// ---- Cup capture (§5.2, Penner): the fastest a ball can cross the cup at offset b from its centre and still drop. ----
const CUP_R = 0.054;
export function captureSpeed(b: number): number {
  if (Math.abs(b) >= CUP_R) return 0;
  return Math.max(0, 2 * Math.sqrt(CUP_R * CUP_R - b * b) - RADIUS) * Math.sqrt(G / (2 * RADIUS));
}

// ---- Bounce (§4.1): rigid bounce with friction off a Penner tilted plane, natural tee turf (Campaign B Penner fit). ----
const TURF = { e: 0.222, mu: 0.999, kP: 2.973e-4 };
const HOP_MIN_MS = 0.3;               // design constant: a rebound slower than this (a 5 mm hop) ends the hops and the ball rolls

/** One bounce. vx along the travel line (may be negative), vy < 0, w > 0 is backspin for +vx travel (rad/s). */
function bounce(vx: number, vy: number, w: number): [number, number, number] {
  const sg = vx < 0 ? -1 : 1;                                  // mirror a backward-moving ball so the plane tilts toward it
  vx *= sg; w *= sg;
  const beta = TURF.kP * (Math.hypot(vx, vy) / RADIUS) * Math.atan2(-vy, vx);
  const c = Math.cos(beta), s = Math.sin(beta);
  let tx = vx * c + vy * s, ty = -vx * s + vy * c, rw = RADIUS * w;
  const J = (1 + TURF.e) * ty, lim = 3.5 * TURF.mu * (1 + TURF.e), slip = (tx + rw) / -ty;
  if (slip > lim) { tx += TURF.mu * J; rw += 2.5 * TURF.mu * J; }
  else if (slip < -lim) { tx -= TURF.mu * J; rw -= 2.5 * TURF.mu * J; }
  else { tx = (5 * tx - 2 * rw) / 7; rw = -tx; }               // grips and leaves rolling
  ty = -TURF.e * ty;
  return [sg * (tx * c - ty * s), tx * s + ty * c, (sg * rw) / RADIUS];
}

export interface RunOut {
  /** hop samples along the travel line: t from landing (s), s along the line (m), y height (m); ends on the ground */
  hops: { t: number; s: number; y: number }[];
  /** signed distance the hops cover (m) and the speed the ball then rolls at (m/s, negative = spins back) */
  hopM: number; rollMs: number;
  /** hops plus the roll on `surface` (m, signed) */
  distanceM: number;
}

/** Bounces and roll after landing on flat `surface`. A bunker plugs the ball. Pure and deterministic. */
export function bounceRoll(l: Landing, surface: Surface): RunOut {
  if (surface === 'bunker') return { hops: [], hopM: 0, rollMs: 0, distanceM: 0 };
  let vx = l.speedMs * Math.cos(l.angleDeg * RAD), vy = -l.speedMs * Math.sin(l.angleDeg * RAD), w = (l.spinRpm * 2 * Math.PI) / 60;
  const hops: RunOut['hops'] = [];
  let s = 0, t = 0;
  for (let i = 0; i < 30; i++) {
    [vx, vy, w] = bounce(vx, vy, w);
    if (vy < HOP_MIN_MS) break;
    const tf = (2 * vy) / G;
    for (let k = 1; k * (1 / 60) < tf; k++) { const h = k / 60; hops.push({ t: t + h, s: s + vx * h, y: vy * h - 0.5 * G * h * h }); }
    s += vx * tf; t += tf; vy = -vy;
    hops.push({ t, s, y: 0 });
  }
  const rollMs = (5 * vx - 2 * RADIUS * w) / 7;                // skid to roll (§4.1)
  return { hops, hopM: s, rollMs, distanceM: s + Math.sign(rollMs) * rollDistance(Math.abs(rollMs), surface) };
}

// ---- Flight (§3.1): drag, Magnus lift along ω̂ × v, gravity, spin decay; RK4 at a fixed step. ----
type S = { x: number; y: number; z: number; vx: number; vy: number; vz: number; w: number };

export function simulateShot(launch: Launch, air: Air = {}): ShotResult {
  const rho = airDensity(air), mu = viscosity(air.tempC ?? 21), k = (rho * AREA) / (2 * MASS);
  const la = launch.launchDeg * RAD, az = launch.azimuthDeg * RAD, th = launch.spinAxisDeg * RAD;
  // spin axis for heading +z: backspin = -x, tilt by th rotates toward +y so lift gains +x (curves right)
  const ax = -Math.cos(th), ay = Math.sin(th);
  const w0 = (launch.backspinRpm * 2 * Math.PI) / 60;
  const s0: S = {
    x: 0, y: 0, z: 0, w: w0,
    vx: launch.ballSpeed * Math.cos(la) * Math.sin(az), vy: launch.ballSpeed * Math.sin(la), vz: launch.ballSpeed * Math.cos(la) * Math.cos(az),
  };
  const blend = Math.min(1, Math.max(0, ((w0 * RADIUS) / Math.max(launch.ballSpeed, 1e-9) - 0.1) / 0.04)); // 0 = set B, 1 = set A

  const deriv = (s: S): S => {
    const v = Math.hypot(s.vx, s.vy, s.vz) || 1e-9, sr = (s.w * RADIUS) / v, re = (rho * v * 2 * RADIUS) / mu;
    const [cdA, clA] = coeffs(SET_A, sr, re), [cdB, clB] = coeffs(SET_B, sr, re);
    const dragK = k * (cdB + blend * (cdA - cdB)) * v, liftK = k * (clB + blend * (clA - clB)) * v;
    return {
      x: s.vx, y: s.vy, z: s.vz,
      vx: -dragK * s.vx + liftK * (ay * s.vz),
      vy: -dragK * s.vy + liftK * (-ax * s.vz) - G,
      vz: -dragK * s.vz + liftK * (ax * s.vy - ay * s.vx),
      w: (-LAMBDA * v * s.w) / RADIUS,
    };
  };
  const add = (s: S, d: S, h: number): S => ({
    x: s.x + d.x * h, y: s.y + d.y * h, z: s.z + d.z * h, vx: s.vx + d.vx * h, vy: s.vy + d.vy * h, vz: s.vz + d.vz * h, w: s.w + d.w * h,
  });

  const samples: TrajectoryPoint[] = [{ t: 0, p: { x: 0, y: 0, z: 0 } }];
  let s = s0, t = 0, apex = 0, landed = false;
  for (let n = 1; n <= MAX_STEPS; n++) {
    const k1 = deriv(s), k2 = deriv(add(s, k1, DT / 2)), k3 = deriv(add(s, k2, DT / 2)), k4 = deriv(add(s, k3, DT));
    const sum = (key: keyof S) => s[key] + (DT / 6) * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key]);
    const nx: S = { x: sum('x'), y: sum('y'), z: sum('z'), vx: sum('vx'), vy: sum('vy'), vz: sum('vz'), w: sum('w') };
    if (nx.y <= 0) {
      const f = s.y / (s.y - nx.y); // linear interpolation to y = 0 (§3.5)
      s = add(s, { x: nx.x - s.x, y: nx.y - s.y, z: nx.z - s.z, vx: nx.vx - s.vx, vy: nx.vy - s.vy, vz: nx.vz - s.vz, w: nx.w - s.w }, f);
      s.y = 0; t += DT * f; landed = true;
      break;
    }
    s = nx; t = n * DT; apex = Math.max(apex, s.y);
    if (n % SAMPLE_EVERY === 0) samples.push({ t, p: { x: s.x, y: s.y, z: s.z } });
  }
  if (!landed) s = { ...s, y: 0 }; // safety cap: never reached for sane launches
  samples.push({ t, p: { x: s.x, y: 0, z: s.z } });

  const vh = Math.hypot(s.vx, s.vz);
  const landing: Landing = { speedMs: Math.hypot(vh, s.vy), angleDeg: Math.atan2(-s.vy, vh) / RAD, spinRpm: (s.w * 60) / (2 * Math.PI) };
  // One run-out model for sim and server: the sim bounces and rolls on flat fairway; the server uses the real surfaces.
  const run = bounceRoll(landing, 'fairway');
  const dirx = vh > 0 ? s.vx / vh : 0, dirz = vh > 0 ? s.vz / vh : 1;
  const endX = s.x + dirx * run.distanceM, endZ = s.z + dirz * run.distanceM;
  return { samples, carryM: Math.hypot(s.x, s.z), totalM: Math.hypot(endX, endZ), offlineM: endX, flightTimeS: t, apexM: apex, landing };
}

// ---- Impact (§2, D-plane) ----
export interface Delivery {
  clubMph: number; attackDeg: number; /** dynamic loft */ loftDeg: number; faceDeg?: number; pathDeg?: number;
  /** smash at zero spin loft: smash = smashBase·cos(SL) (§2.4) */ smashBase: number;
  /** a constant smash instead of the cos law (the UNVERIFIED wedges: §2.4 is fitted on SL 15-26° only) */ smashFixed?: number;
  /** spin = k·clubMph·sin(SL) (§2.3) */ k: number;
  /** path share of the start direction (§2.1): 0.15 driver, 0.25 irons */ kappaH?: number;
}
/** Vertical path share of launch, κ(SL). Deviation recorded in the slice spec: base 0.23, not the research's 0.15, so case 4 launches 10.4°. */
const kappaV = (slDeg: number) => Math.min(0.35, Math.max(0.12, 0.23 + 0.004 * (slDeg - 15)));

export function impact(d: Delivery): Launch {
  const A = d.attackDeg * RAD, L = d.loftDeg * RAD, F = (d.faceDeg ?? 0) * RAD, P = (d.pathDeg ?? 0) * RAD, kh = d.kappaH ?? 0.25;
  const pn = Math.cos(A) * Math.cos(P) * Math.cos(L) * Math.cos(F) + Math.cos(A) * Math.sin(P) * Math.cos(L) * Math.sin(F) + Math.sin(A) * Math.sin(L);
  const sl3 = Math.acos(Math.min(1, pn));                       // true 3-D spin loft (§2.2)
  const sl = d.loftDeg - d.attackDeg;
  return {
    ballSpeed: d.clubMph * MPH * (d.smashFixed ?? d.smashBase * Math.cos(sl3)),
    launchDeg: d.attackDeg + (1 - kappaV(sl)) * sl,
    azimuthDeg: (1 - kh) * (d.faceDeg ?? 0) + kh * (d.pathDeg ?? 0) + 0,
    backspinRpm: d.k * d.clubMph * Math.sin(sl3),
    spinAxisDeg: Math.atan2(Math.cos(L) * Math.sin(F - P), Math.sin(L - A)) / RAD + 0,
  };
}

// ---- Bag (§1.1 PGA TOUR 2024 averages). Club speed = 130 × tour speed / 115 (the tour driver); delivery struck down as on tour. ----
const TOUR_DRIVER_MPH = 115, GAME_DRIVER_MPH = 130;
interface ClubFit { tourMph: number; attackDeg: number; loftDeg: number; smashBase: number; smashFixed?: number; k: number }
/** Back out the spin loft from a tour row's launch and attack angle (launch = A + (1-κ(SL))·SL), then K and the smash base. */
function fitRow(tourMph: number, attackDeg: number, smash: number, launchDeg: number, spin: number): ClubFit {
  let sl = 20;
  for (let i = 0; i < 50; i++) sl = (launchDeg - attackDeg) / (1 - kappaV(sl));
  return { tourMph, attackDeg, loftDeg: attackDeg + sl, smashBase: smash / Math.cos(sl * RAD), k: spin / (tourMph * Math.sin(sl * RAD)) };
}
const ROWS: Record<string, ClubFit> = {
  '1': fitRow(115, -0.9, 1.49, 10.4, 2545),
  '2': fitRow(110, -2.3, 1.47, 9.3, 3663),
  '3': fitRow(100, -2.5, 1.46, 10.3, 4404),                  // the 18° utility plays the 3-iron row
  '4': fitRow(98, -2.9, 1.44, 10.8, 4782),
  '5': fitRow(96, -3.4, 1.41, 11.9, 5280),
  '6': fitRow(94, -3.7, 1.39, 14.0, 6204),
  '7': fitRow(92, -3.9, 1.34, 16.1, 7124),
  '8': fitRow(89, -4.2, 1.33, 17.8, 8078),
  '9': fitRow(87, -4.3, 1.29, 20.0, 8793),
  '0': fitRow(84, -4.7, 1.24, 23.7, 9316),
};
/** UNVERIFIED (§1.5: no tour wedge row exists). Wedges extend the 9i→PW trend per degree of static loft past the PW's 46°:
 *  -0.75 mph, -0.1° attack, -0.0125 smash (held constant); dynamic loft rises degree for degree; the PW's spin constant K.
 *  Launch and spin then follow the impact model. */
function wedgeRow(loft: number): ClubFit {
  const pw = ROWS['0']!, d = loft - 46, smash = 1.24 - 0.0125 * d;
  return { tourMph: pw.tourMph - 0.75 * d, attackDeg: pw.attackDeg - 0.1 * d, loftDeg: pw.loftDeg + d, smashBase: smash, smashFixed: smash, k: pw.k };
}
ROWS['-'] = wedgeRow(50); ROWS['='] = wedgeRow(54); ROWS['O'] = wedgeRow(62);
ROWS['P'] = { tourMph: 10 * (TOUR_DRIVER_MPH / GAME_DRIVER_MPH), attackDeg: 0, loftDeg: 3, smashBase: 1, k: 0 }; // putter: not used for putts

const club = (key: string, label: string, loftDeg: number): Club => ({ key, label, loftDeg, maxClubSpeedMph: (ROWS[key]!.tourMph * GAME_DRIVER_MPH) / TOUR_DRIVER_MPH });
export const BAG: readonly Club[] = [
  club('1', 'Driver', 8), club('2', '3W', 15), club('3', '18° UT', 18), club('4', '4i', 23), club('5', '5i', 26), club('6', '6i', 30), club('7', '7i', 34),
  club('8', '8i', 38), club('9', '9i', 42), club('0', 'PW', 46), club('-', '50°', 50), club('=', '54°', 54), club('O', '62°', 62), club('P', 'Putter', 3),
];

/** Lie and turf (PRD/03 §4, UNVERIFIED effects). Bunker speed is `speed` for non-wedges and `wedgeSpeed` for lofts >= 50. */
export const LIE: Record<Lie, { speed: number; wedgeSpeed?: number; spin: number; launch: number }> = {
  tee: { speed: 1, spin: 1, launch: 0 },
  fairway: { speed: 1, spin: 1, launch: 0 },
  firstCut: { speed: 0.97, spin: 0.85, launch: 0.5 },
  rough: { speed: 0.85, spin: 0.55, launch: 1.5 },
  bunker: { speed: 0.55, wedgeSpeed: 0.75, spin: 0.6, launch: 2 },
  fringe: { speed: 0.9, spin: 1, launch: 0 },
  green: { speed: 0.9, spin: 1, launch: 0 },
};
const ROUGH_FACE_NOISE_DEG = 1.5;

/** Owner decision (PRD/03 §2): off the tee the driver swings up +5° at 16° dynamic loft and the 3-wood +2°; off the ground both play the tour delivery. */
function deliveryAt(c: Club, lie: Lie): { attackDeg: number; loftDeg: number } {
  const r = ROWS[c.key]!;
  if (lie === 'tee' && c.key === '1') return { attackDeg: 5, loftDeg: 16 };
  if (lie === 'tee' && c.key === '2') return { attackDeg: 2, loftDeg: r.loftDeg };
  return r;
}

function launchAt(c: Club, strike: Strike, speedMul: number): Launch {
  const putter = c.key === 'P';
  const lie = strike.lie ?? 'tee';
  const { fb, io } = putter ? CENTRE : (strike.ballPos ?? CENTRE);
  const seed = strike.seed ?? 0;
  const L = LIE[lie], r = ROWS[c.key]!;
  const lieSpeed = lie === 'bunker' && c.loftDeg >= 50 ? L.wedgeSpeed! : putter && (lie === 'fringe' || lie === 'green') ? 1 : L.speed;
  let F = 0, P = PATH_PER_IO_DEG * io;
  if (!putter && strike.maxEffort) {
    const rng = mulberry32(seed), s = strike.dispersionScale ?? 1;
    F += gauss(rng) * MAX_EFFORT.sigmaFaceDeg * s;
    P += gauss(rng) * MAX_EFFORT.sigmaPathDeg * s;
  }
  if (lie === 'rough' && !putter) F += (mulberry32(seed + 0x9e3779b9)() * 2 - 1) * ROUGH_FACE_NOISE_DEG;
  const d = deliveryAt(c, lie);
  const l = impact({
    clubMph: c.maxClubSpeedMph * lengthSpeedFactor(strike.length ?? 1) * speedMul, attackDeg: d.attackDeg, loftDeg: d.loftDeg + LOFT_PER_FB_DEG * fb,
    faceDeg: F, pathDeg: P, smashBase: r.smashBase, smashFixed: r.smashFixed, k: r.k, kappaH: c.loftDeg < 20 ? 0.15 : 0.25,
  });
  return { ...l, ballSpeed: l.ballSpeed * lieSpeed, launchDeg: l.launchDeg + L.launch, backspinRpm: l.backspinRpm * L.spin };
}

/** Club-speed factor for a max-effort swing: a flat x1.1 (owner decision), 1 for the putter. */
export function maxEffortSpeedFactor(c: Club): number { return c.key === 'P' ? 1 : MAX_EFFORT.speedFactor; }

export function launchFor(c: Club, strike: Strike = {}): Launch {
  const maxEffort = c.key !== 'P' && (strike.maxEffort ?? false);
  return launchAt(c, strike, maxEffort ? maxEffortSpeedFactor(c) : 1);
}
