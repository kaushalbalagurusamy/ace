// Pure race logic: hand-built hole data, surface lookup, shot and putt resolution. No sockets, no timers.
import { BAG, isSwingLength, launchFor, rollingDecel, scoreSwing, simulateShot } from '../sim';
import type { Surface, TrajectoryPoint } from '../sim';
import type { BallState, HoleInfo } from '../shared/protocol';

const FIRST_CUT_HALF = 30;
const OOB_HALF = 70;
const CUP_RADIUS_M = 0.054;
const HOLE_SPEED_MS = 1.6;
const MAX_PUTT_MS = 15;
const MAX_DRAW_MS = 1500;
const LAND_ROLL_FRACTION = 0.3;
const DROP_WAIT_S = 2;
const LIE_SPEED: Record<Surface, number> = { fairway: 1, firstCut: 0.97, rough: 0.85, bunker: 0.75, fringe: 0.9, green: 0.9 };
const DT = 1 / 60;

export interface Hole { info: HoleInfo; surfaceAt(x: number, z: number): Surface; outOfBounds(x: number, z: number): boolean }

// shortcut: one hand-built hole; add entries here (and a per-hole surface fn) for more holes.
export function hole(_index: number): Hole {
  const info: HoleInfo = { index: 0, par: 4, pin: { x: 0, z: 380 }, tee: { x: 0, z: 0 }, greenRadius: 14, fairwayHalfWidth: 22, lengthM: 380 };
  return {
    info,
    surfaceAt(x, z) {
      if (Math.hypot(x - info.pin.x, z - info.pin.z) <= info.greenRadius) return 'green';
      const ax = Math.abs(x);
      return ax <= info.fairwayHalfWidth ? 'fairway' : ax <= FIRST_CUT_HALF ? 'firstCut' : 'rough';
    },
    outOfBounds: (x, z) => Math.abs(x) > OOB_HALF || z < -20 || z > info.pin.z + 40,
  };
}

export interface Played {
  samples: TrajectoryPoint[]; carryM: number; totalM: number; offlineM: number; clubSpeedMph: number; ballSpeedMs: number;
  grade: { z: number; x: number; c: number }; ball: BallState; penalty?: string;
  /** seconds from strike to ball at rest */ flightS: number; /** extra lock-out after the shot (drop wait) */ dropWaitS: number;
}
export interface ShotReq { clubKey: string; aimDeg: number; zMs?: number; xMs?: number; cMs?: number; length?: number }

/** Ball rolls from (x,z) at v0 along unit dir (dx,dz) with constant decel a. Stops at the cup if it passes slow enough. */
function roll(h: Hole, x: number, z: number, dx: number, dz: number, v0: number, a: number, t0: number) {
  const pts: TrajectoryPoint[] = [];
  if (v0 <= 0 || !Number.isFinite(a)) return { pts, x, z, t: t0, holed: false };
  const L = (v0 * v0) / (2 * a);
  const { pin } = h.info;
  const sStar = Math.min(L, Math.max(0, (pin.x - x) * dx + (pin.z - z) * dz));
  const d = Math.hypot(x + dx * sStar - pin.x, z + dz * sStar - pin.z);
  const vAt = Math.sqrt(Math.max(0, v0 * v0 - 2 * a * sStar));
  const holed = d <= CUP_RADIUS_M && vAt <= HOLE_SPEED_MS;
  const sEnd = holed ? sStar : L;
  const tEnd = (v0 - Math.sqrt(Math.max(0, v0 * v0 - 2 * a * sEnd))) / a;
  const at = (s: number, t: number) => ({ t: t0 + t, p: { x: x + dx * s, y: 0, z: z + dz * s } });
  for (let t = DT; t < tEnd; t += DT) pts.push(at(v0 * t - 0.5 * a * t * t, t));
  const end = holed ? { t: t0 + tEnd, p: { x: pin.x, y: 0, z: pin.z } } : at(sEnd, tEnd);
  pts.push(end);
  return { pts, x: end.p.x, z: end.p.z, t: end.t, holed };
}

function settle(h: Hole, prev: BallState, x: number, z: number, holed: boolean, base: Omit<Played, 'ball' | 'penalty' | 'dropWaitS' | 'totalM'>): Played {
  const totalM = Math.hypot(x - prev.x, z - prev.z);
  if (h.outOfBounds(x, z)) {
    const ball = { x: prev.x, z: prev.z, strokes: prev.strokes + 2, holedOut: false, surface: h.surfaceAt(prev.x, prev.z) };
    return { ...base, totalM, ball, penalty: 'Out of bounds: +1 stroke, replay from previous spot', dropWaitS: DROP_WAIT_S };
  }
  const ball = { x, z, strokes: prev.strokes + 1, holedOut: holed, surface: h.surfaceAt(x, z) };
  return { ...base, totalM, ball, dropWaitS: 0 };
}

export function playShot(h: Hole, prev: BallState, req: ShotReq): Played | { error: string } {
  const club = BAG.find(c => c.key === req.clubKey);
  if (!club || club.key === 'P') return { error: 'unknown club (use putt for the putter)' };
  const length = req.length ?? 100;
  if (!isSwingLength(length)) return { error: 'invalid swing length (use 25, 50, 75 or 100)' };
  const score = scoreSwing(req, length);
  const launch = launchFor(club, score, length);
  launch.ballSpeed *= LIE_SPEED[prev.surface as Surface] ?? 1;
  const sim = simulateShot(launch);
  const a = (req.aimDeg * Math.PI) / 180, sin = Math.sin(a), cos = Math.cos(a);
  const world = (sx: number, sz: number) => ({ x: prev.x + sx * cos + sz * sin, z: prev.z - sx * sin + sz * cos });
  const samples: TrajectoryPoint[] = sim.samples.map(s => { const w = world(s.p.x, s.p.z); return { t: s.t, p: { x: w.x, y: s.p.y, z: w.z } }; });
  const n = samples.length, last = samples[n - 1]!, before = samples[n - 2] ?? samples[0]!;
  let x = last.p.x, z = last.p.z, holed = false, flightS = last.t;
  if (!h.outOfBounds(x, z)) {
    const dt = last.t - before.t || DT;
    const hx = last.p.x - before.p.x, hz = last.p.z - before.p.z, hd = Math.hypot(hx, hz);
    if (hd > 0) {
      const r = roll(h, x, z, hx / hd, hz / hd, (LAND_ROLL_FRACTION * hd) / dt, rollingDecel(h.surfaceAt(x, z)), last.t);
      samples.push(...r.pts); ({ x, z, t: flightS, holed } = r);
    }
  }
  return settle(h, prev, x, z, holed, {
    samples, carryM: sim.carryM, offlineM: sim.offlineM, flightS, clubSpeedMph: club.maxClubSpeedMph * score.speedFactor,
    ballSpeedMs: launch.ballSpeed, grade: { z: score.nZ, x: score.nX, c: score.nC },
  });
}

export function playPutt(h: Hole, prev: BallState, aimDeg: number, drawMs: number): Played | { error: string } {
  if (prev.surface !== 'green') return { error: 'putter only works on the green' };
  const v0 = (Math.min(MAX_DRAW_MS, Math.max(0, drawMs)) / MAX_DRAW_MS) * MAX_PUTT_MS;
  const a = (aimDeg * Math.PI) / 180;
  const decel = rollingDecel('green', 10);
  const r = roll(h, prev.x, prev.z, Math.sin(a), Math.cos(a), v0, decel, 0);
  const samples = [{ t: 0, p: { x: prev.x, y: 0, z: prev.z } }, ...r.pts];
  return settle(h, prev, r.x, r.z, r.holed, {
    samples, carryM: 0, offlineM: 0, flightS: r.t, clubSpeedMph: 0, ballSpeedMs: v0, grade: { z: 0, x: 0, c: 0 },
  });
}
