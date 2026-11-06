// Pure race logic: hand-built hole data, surface lookup, shot and putt resolution. No sockets, no timers.
import { BAG, effortFromHold, isValidBallPos, isValidLength, launchFor, lengthSpeedFactor, maxEffortSpeedFactor, puttSpeedMs, roll, runOut, simulateShot } from '../sim';
import type { Lie, Terrain, TrajectoryPoint } from '../sim';
import { stanceSlope } from '../shared/height';
import type { BallState, HoleInfo } from '../shared/protocol';

const DROP_WAIT_S = 2;
const TEE_RADIUS_M = 3; // a ball this close to the hole's tee is teed up
const DT = 1 / 60;

export { hole, type Hole } from './course';
import type { Hole } from './course';

export interface Played {
  samples: TrajectoryPoint[]; carryM: number; totalM: number; offlineM: number; clubSpeedMph: number; ballSpeedMs: number;
  effort: { fb: number; io: number; maxEffort: boolean; length: number }; ball: BallState; penalty?: string;
  /** seconds from strike to ball at rest */ flightS: number; /** extra lock-out after the shot (drop wait) */ dropWaitS: number;
}
export interface ShotReq { clubKey: string; aimDeg: number; holdMs: number; fb?: number; io?: number; seed?: number }

/** The hole as the run-out sees it: real ground, its lies, the cup, and penalty areas where a rolling ball stops. */
const terrain = (h: Hole): Terrain => ({ height: h.heightAt, normal: h.normalAt, surface: h.surfaceAt, stops: h.outOfBounds, pin: h.info.pin, stimp: 10 });

const CLUB_LEN_M = 1.2; // a driver-ish club length; relief is within two of them

/** Rules of Golf relief from a penalty area: from where the ball last crossed onto non-water ground (the entry point), the nearest-the-hole
 *  playable spot that is no nearer the hole, either within two club-lengths (lateral) or back on the line from the pin through the entry point. */
export function waterRelief(h: Hole, samples: { p: { x: number; z: number } }[]): { x: number; z: number } | null {
  let e = samples[0]?.p; if (!e) return null;
  for (let i = samples.length - 1; i >= 0; i--) { const q = samples[i]!.p; if (h.penaltyAt(q.x, q.z) !== 'water') { e = q; break; } }
  const pin = h.info.pin, d = (x: number, z: number) => Math.hypot(x - pin.x, z - pin.z), dE = d(e.x, e.z);
  let best: { x: number; z: number } | null = null, bestD = Infinity;
  const consider = (x: number, z: number) => { if (h.penaltyAt(x, z) || d(x, z) < dE - 1e-6) return; const dd = d(x, z); if (dd < bestD) { bestD = dd; best = { x, z }; } };
  for (let dx = -2 * CLUB_LEN_M; dx <= 2 * CLUB_LEN_M + 1e-9; dx += 0.3) for (let dz = -2 * CLUB_LEN_M; dz <= 2 * CLUB_LEN_M + 1e-9; dz += 0.3) if (Math.hypot(dx, dz) <= 2 * CLUB_LEN_M) consider(e.x + dx, e.z + dz);
  const L = dE || 1, ux = (e.x - pin.x) / L, uz = (e.z - pin.z) / L;
  for (let t = 0; t <= 120; t += 0.5) if (!h.penaltyAt(e.x + ux * t, e.z + uz * t)) { consider(e.x + ux * t, e.z + uz * t); break; }   // back on the line: first playable point
  return best;
}

function settle(h: Hole, prev: BallState, x: number, z: number, holed: boolean, base: Omit<Played, 'ball' | 'penalty' | 'dropWaitS' | 'totalM'>): Played {
  const totalM = Math.hypot(x - prev.x, z - prev.z);
  if (h.penaltyAt(x, z) === 'water') {
    const drop = waterRelief(h, base.samples) ?? { x: prev.x, z: prev.z };   // no legal point found: stroke and distance
    const ball = { x: drop.x, z: drop.z, strokes: prev.strokes + 2, holedOut: false, surface: h.surfaceAt(drop.x, drop.z) };
    return { ...base, totalM, ball, penalty: 'Water hazard: +1 stroke, dropped within two club-lengths no nearer the hole', dropWaitS: DROP_WAIT_S };
  }
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
  if (!isValidLength(req.holdMs)) return { error: 'invalid hold time (must be a finite number)' };
  const ballPos = { fb: req.fb ?? 0, io: req.io ?? 0 };
  if (!isValidBallPos(ballPos)) return { error: 'invalid ball position (fb and io are integers from -3 to 3)' };
  const { length, maxEffort } = effortFromHold(Math.max(0, req.holdMs), false);
  const onTee = Math.hypot(prev.x - h.info.tee.x, prev.z - h.info.tee.z) <= TEE_RADIUS_M;
  const lie: Lie = onTee ? 'tee' : h.surfaceAt(prev.x, prev.z);
  const slope = stanceSlope(h.normalAt(prev.x, prev.z), req.aimDeg);           // the curve this lie predisposes comes out of the D-plane (launchFor)
  const launch = launchFor(club, { length, ballPos, maxEffort, seed: req.seed ?? 0, lie, slope });
  const a = (req.aimDeg * Math.PI) / 180, sin = Math.sin(a), cos = Math.cos(a);
  const world = (sx: number, sz: number) => ({ x: prev.x + sx * cos + sz * sin, z: prev.z - sx * sin + sz * cos });
  const y0 = h.heightAt(prev.x, prev.z);
  const sim = simulateShot(launch, {}, (sx, sz) => { const w = world(sx, sz); return h.heightAt(w.x, w.z) - y0; });   // carry ends on the real ground
  const samples: TrajectoryPoint[] = sim.samples.map(s => { const w = world(s.p.x, s.p.z); return { t: s.t, p: { x: w.x, y: s.p.y + y0, z: w.z } }; });
  const n = samples.length, last = samples[n - 1]!, before = samples[n - 2] ?? samples[0]!;
  let x = last.p.x, z = last.p.z, holed = false, flightS = last.t;
  if (!h.outOfBounds(x, z)) {
    const hx = last.p.x - before.p.x, hz = last.p.z - before.p.z, hd = Math.hypot(hx, hz);
    if (hd > 0) {
      const { speedMs, angleDeg, spinRpm } = sim.landing, vh = speedMs * Math.cos((angleDeg * Math.PI) / 180);
      const r = runOut(terrain(h), x, z, { x: (vh * hx) / hd, y: -speedMs * Math.sin((angleDeg * Math.PI) / 180), z: (vh * hz) / hd }, spinRpm, flightS);
      samples.push(...r.pts); ({ x, z, t: flightS, holed } = r);
    }
  }
  return settle(h, prev, x, z, holed, {
    samples, carryM: sim.carryM, offlineM: sim.offlineM, flightS, clubSpeedMph: club.maxClubSpeedMph * lengthSpeedFactor(length) * (maxEffort ? maxEffortSpeedFactor(club) : 1),
    ballSpeedMs: launch.ballSpeed, effort: { fb: ballPos.fb, io: ballPos.io, maxEffort, length },
  });
}

export function playPutt(h: Hole, prev: BallState, aimDeg: number, holdMs: number): Played | { error: string } {
  if (prev.surface !== 'green') return { error: 'putter only works on the green' };
  if (!isValidLength(holdMs)) return { error: 'invalid hold time (must be a finite number)' };
  const { length } = effortFromHold(Math.max(0, holdMs), true);
  const v0 = puttSpeedMs(length);
  const a = (aimDeg * Math.PI) / 180;
  const r = roll(terrain(h), prev.x, prev.z, v0 * Math.sin(a), v0 * Math.cos(a), 0);   // greens break: gravity along the slope
  const samples = [{ t: 0, p: { x: prev.x, y: h.heightAt(prev.x, prev.z), z: prev.z } }, ...r.pts];
  return settle(h, prev, r.x, r.z, r.holed, {
    samples, carryM: 0, offlineM: 0, flightS: r.t, clubSpeedMph: 0, ballSpeedMs: v0, effort: { fb: 0, io: 0, maxEffort: false, length },
  });
}
