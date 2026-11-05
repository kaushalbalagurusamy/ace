import type { Club, Launch, ShotResult, Surface, SwingLength, SwingScore, TrajectoryPoint } from './types';
import { lengthSpeedFactor } from './length';

// ALL CONSTANTS BELOW ARE PLACEHOLDER until PRD/03 §8 sources are checked.
const RHO = 1.225; // ISA sea level, kg/m^3
const MASS = 0.04593; // kg (Rules of Golf max)
const RADIUS = 0.04267 / 2; // m
const AREA = Math.PI * RADIUS * RADIUS;
const G = 9.80665;
const DT = 1 / 240;
const SAMPLE_EVERY = 4; // 240 / 60
const SPIN_DECAY = 0.03; // per second
const MPH = 0.44704;
const FT = 0.3048;
const MAX_STEPS = 240 * 60;

// PLACEHOLDER aero model: Cd rises with spin ratio, Cl saturates.
const cd = (s: number) => 0.21 + 0.2 * s;
const cl = (s: number) => Math.min(0.3, 2.2 * s);

// PLACEHOLDER roll: surface decel (PRD/03 §5) and fraction of post-bounce speed that becomes roll.
const DECEL: Record<Exclude<Surface, 'green' | 'bunker'>, number> = { fringe: 1.1, fairway: 1.4, firstCut: 2.5, rough: 5.0 };

export function rollingDecel(surface: Surface, stimp = 10): number {
  if (surface === 'bunker') return Infinity;
  if (surface === 'green') return (36 / (2 * stimp)) * FT;
  return DECEL[surface];
}

export function rollDistance(v0: number, surface: Surface, stimp = 10): number {
  if (v0 <= 0) return 0;
  return (v0 * v0) / (2 * rollingDecel(surface, stimp)); // Infinity decel => 0
}

type S = { x: number; y: number; z: number; vx: number; vy: number; vz: number };

/** Share of horizontal landing speed the ball keeps to roll out (PLACEHOLDER, PRD/03 §5 bounce model not sourced). */
export const LAND_ROLL_FRACTION = 0.3;

export function simulateShot(launch: Launch): ShotResult {
  const rad = Math.PI / 180;
  const la = launch.launchDeg * rad;
  const az = launch.azimuthDeg * rad;
  const th = launch.spinAxisDeg * rad;
  const w0 = (launch.backspinRpm * 2 * Math.PI) / 60;
  // spin axis for heading +z: backspin = -x, tilt by th rotates toward +y so lift gains +x (curves right)
  const ax = -Math.cos(th);
  const ay = Math.sin(th);
  const hz = Math.cos(la) * Math.cos(az);
  const s0: S = {
    x: 0,
    y: 0,
    z: 0,
    vx: launch.ballSpeed * Math.cos(la) * Math.sin(az),
    vy: launch.ballSpeed * Math.sin(la),
    vz: launch.ballSpeed * hz,
  };

  const deriv = (s: S, w: number): S => {
    const v = Math.hypot(s.vx, s.vy, s.vz) || 1e-9;
    const sr = (w * RADIUS) / v;
    const q = 0.5 * RHO * AREA * v;
    const dragK = (q * cd(sr)) / MASS;
    // lift direction = unit(spin x v); spin = w*(ax, ay, 0)
    const lx = ay * s.vz;
    const ly = -ax * s.vz;
    const lz = ax * s.vy - ay * s.vx;
    const ln = Math.hypot(lx, ly, lz) || 1e-9;
    const liftK = (q * v * cl(sr)) / MASS / ln;
    return {
      x: s.vx,
      y: s.vy,
      z: s.vz,
      vx: -dragK * s.vx + liftK * lx,
      vy: -dragK * s.vy + liftK * ly - G,
      vz: -dragK * s.vz + liftK * lz,
    };
  };
  const add = (s: S, d: S, h: number): S => ({
    x: s.x + d.x * h, y: s.y + d.y * h, z: s.z + d.z * h,
    vx: s.vx + d.vx * h, vy: s.vy + d.vy * h, vz: s.vz + d.vz * h,
  });

  const samples: TrajectoryPoint[] = [{ t: 0, p: { x: 0, y: 0, z: 0 } }];
  let s = s0;
  let t = 0;
  let landed = false;
  for (let n = 1; n <= MAX_STEPS; n++) {
    const w = w0 * Math.exp(-SPIN_DECAY * t); // spin held constant within a step
    const k1 = deriv(s, w);
    const k2 = deriv(add(s, k1, DT / 2), w);
    const k3 = deriv(add(s, k2, DT / 2), w);
    const k4 = deriv(add(s, k3, DT), w);
    const nx: S = {
      x: s.x + (DT / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: s.y + (DT / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      z: s.z + (DT / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
      vx: s.vx + (DT / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
      vy: s.vy + (DT / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
      vz: s.vz + (DT / 6) * (k1.vz + 2 * k2.vz + 2 * k3.vz + k4.vz),
    };
    if (nx.y <= 0) {
      const f = s.y / (s.y - nx.y); // linear interpolation to y = 0
      s = {
        x: s.x + (nx.x - s.x) * f, y: 0, z: s.z + (nx.z - s.z) * f,
        vx: s.vx + (nx.vx - s.vx) * f, vy: s.vy + (nx.vy - s.vy) * f, vz: s.vz + (nx.vz - s.vz) * f,
      };
      t += DT * f;
      landed = true;
      break;
    }
    s = nx;
    t = n * DT;
    if (n % SAMPLE_EVERY === 0) samples.push({ t, p: { x: s.x, y: s.y, z: s.z } });
  }
  if (!landed) s = { ...s, y: 0 }; // safety cap: never reached for sane launches
  samples.push({ t, p: { x: s.x, y: 0, z: s.z } });

  const carryM = Math.hypot(s.x, s.z);
  // One roll model for sim and server: after landing the ball keeps LAND_ROLL_FRACTION of its horizontal speed and
  // rolls out on a flat fairway (the server rolls it per real surface and checks the cup, starting from the same speed).
  const vh = Math.hypot(s.vx, s.vz);
  const roll = rollDistance(vh * LAND_ROLL_FRACTION, 'fairway');
  const dirx = vh > 0 ? s.vx / vh : 0;
  const dirz = vh > 0 ? s.vz / vh : 1;
  const endX = s.x + dirx * roll;
  const endZ = s.z + dirz * roll;
  return { samples, carryM, totalM: Math.hypot(endX, endZ), offlineM: endX, flightTimeS: t, landingSpeedMs: vh };
}

// ---- Bag (PRD/02 §1). Speeds = 130 mph * tour/113 (PRD/03 §2, UNVERIFIED table); wedges/putter ASSUMED. ----
const club = (key: string, label: string, loftDeg: number, maxClubSpeedMph: number): Club => ({ key, label, loftDeg, maxClubSpeedMph });
export const BAG: readonly Club[] = [
  club('1', 'Driver', 8, 130),
  club('2', '3W', 15, 123),
  club('3', '18° UT', 18, 115),
  club('4', '4i', 23, 110),
  club('5', '5i', 26, 108),
  club('6', '6i', 30, 106),
  club('7', '7i', 34, 104),
  club('8', '8i', 38, 100),
  club('9', '9i', 42, 98),
  club('0', 'PW', 46, 95),
  club('-', '50°', 50, 92),
  club('=', '54°', 54, 89),
  club('O', '62°', 62, 85),
  club('P', 'Putter', 3, 10),
];

// PLACEHOLDER delivery: driver +5 AoA, 3W +2, others struck down more with loft.
const aoa = (c: Club) => (c.key === '1' ? 5 : c.key === '2' ? 2 : c.key === '3' ? -1 : -2 - 0.06 * c.loftDeg);

export function launchFor(c: Club, score: SwingScore, length: SwingLength = 100): Launch {
  const lf = lengthSpeedFactor(length); // throws RangeError on an invalid length
  const smash = 1.48 - ((Math.min(c.loftDeg, 62) - 8) * 0.23) / 54; // 1.48 driver -> 1.25 at 62°
  const ballSpeed = c.maxClubSpeedMph * MPH * score.speedFactor * lf * smash * score.smashFactor;
  const a = aoa(c);
  const launchDeg = 0.6 * c.loftDeg + 1.25 * a + 1;
  const spinLoft = c.loftDeg - a;
  let backspinRpm = 185 * spinLoft;
  if (c.loftDeg >= 8 && c.loftDeg <= 18) backspinRpm = Math.max(2500, backspinRpm); // woods/hybrid floor
  // Swing path (X timing) sets the start line: half the path angle (PRD/02 §3: early X pulls left, late X pushes right).
  return { ballSpeed, launchDeg, azimuthDeg: 0.5 * score.pathDeg + 0, backspinRpm, spinAxisDeg: 3 * score.faceToPathDeg + 0 };
}
