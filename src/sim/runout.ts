// Bounce and roll on real terrain (docs/research/elevation.md §3). The same Penner bounce as bounceRoll (research §4.1), taken in the plane of the
// surface normal; hops are ballistic until they meet the ground; the roll feels gravity along the slope (5/7 g sin θ for a rolling sphere) and the
// surface's rolling resistance, and the ball rests only where that resistance can hold it. On flat ground it reproduces bounceRoll and rollDistance.
import { CUP_VISUAL_RADIUS_M, HOP_MIN_MS, RADIUS, bounce, captureSpeedVisual, rollingDecel } from './physics';
import type { Surface, TrajectoryPoint, Vec3 } from './types';

const G = 9.80665, HOP_DT = 1 / 120, ROLL_DT = 1 / 60, ROLL_G = (5 / 7) * G, MAX_ROLL_S = 90;

export interface Terrain {
  height(x: number, z: number): number;
  /** unit normal, y up */ normal(x: number, z: number): Vec3;
  surface(x: number, z: number): Surface;
  /** the ball stops at once here (water, out of bounds) */ stops?(x: number, z: number): boolean;
  pin?: { x: number; z: number };
  stimp?: number;
}
export interface Run { pts: TrajectoryPoint[]; x: number; z: number; t: number; holed: boolean }

/** Steepest slope (as a tangent, rise over run) a resting ball can hold on `surface`: rolling resistance >= 5/7 g sin θ. */
export function holdSlope(surface: Surface, stimp = 10): number {
  const a = rollingDecel(surface, stimp); if (!Number.isFinite(a)) return Infinity;
  const s = a / ROLL_G; return s >= 1 ? Infinity : s / Math.sqrt(1 - s * s);
}

/** Downhill acceleration of a rolling ball in the horizontal plane (m/s²). */
function downhill(T: Terrain, x: number, z: number): [number, number] { const n = T.normal(x, z); return [ROLL_G * n.y * n.x, ROLL_G * n.y * n.z]; }

/** Rolls from (x, z) at horizontal velocity (vx, vz) until it rests where the slope can hold it, drops in the cup, or stops on a penalty. */
export function roll(T: Terrain, x: number, z: number, vx: number, vz: number, t0: number, pts: TrajectoryPoint[] = []): Run {
  let t = t0;
  for (let k = 0; k < MAX_ROLL_S / ROLL_DT; k++) {
    const surf = T.surface(x, z), ar = rollingDecel(surf, T.stimp ?? 10);
    if (!Number.isFinite(ar) || T.stops?.(x, z)) break;                      // a bunker plugs it, a penalty area keeps it
    const [gx, gz] = downhill(T, x, z), gm = Math.hypot(gx, gz);
    let sp = Math.hypot(vx, vz);
    if (sp < 1e-9) { if (gm <= ar) break; vx = vz = 0; sp = 0; }              // at rest: static only if the resistance can hold it
    const dx = sp > 0 ? vx / sp : gx / gm, dz = sp > 0 ? vz / sp : gz / gm;
    const ax = gx - ar * dx, az = gz - ar * dz, along = ax * dx + az * dz;
    let dt = ROLL_DT, stop = false;
    if (sp + along * dt <= 0) { dt = sp / -along; stop = true; }             // comes to rest inside this step: exact constant-acceleration stop
    const nx = x + vx * dt + 0.5 * ax * dt * dt, nz = z + vz * dt + 0.5 * az * dt * dt;
    const nvx = stop ? 0 : vx + ax * dt, nvz = stop ? 0 : vz + az * dt;
    if (T.pin) {                                                               // cup capture (research §5.2) at the closest approach in this step
      const sx = nx - x, sz = nz - z, L2 = sx * sx + sz * sz, f = L2 > 0 ? Math.min(1, Math.max(0, ((T.pin.x - x) * sx + (T.pin.z - z) * sz) / L2)) : 0;
      const b = Math.hypot(x + sx * f - T.pin.x, z + sz * f - T.pin.z), v = sp + (Math.hypot(nvx, nvz) - sp) * f;
      if (b < CUP_VISUAL_RADIUS_M && v < captureSpeedVisual(b)) { t += dt * f; pts.push({ t, p: { x: T.pin.x, y: T.height(T.pin.x, T.pin.z), z: T.pin.z } }); return { pts, x: T.pin.x, z: T.pin.z, t, holed: true }; }
    }
    x = nx; z = nz; vx = nvx; vz = nvz; t += dt;
    pts.push({ t, p: { x, y: T.height(x, z), z } });
  }
  if (!pts.length || pts.at(-1)!.p.x !== x || pts.at(-1)!.p.z !== z) pts.push({ t, p: { x, y: T.height(x, z), z } });
  return { pts, x, z, t, holed: false };
}

/** Lands at (x, z) with world velocity `v` (m/s) and backspin (rpm), hops and rolls to rest. Samples start after the landing. */
export function runOut(T: Terrain, x: number, z: number, v: Vec3, spinRpm: number, t0: number): Run {
  const pts: TrajectoryPoint[] = [];
  let t = t0, w = (spinRpm * 2 * Math.PI) / 60, u: Vec3 = { x: 0, y: 0, z: 1 }, along = 0;
  if (T.surface(x, z) === 'bunker') return { pts, x, z, t, holed: false };   // plugs (research §4.1 note: no bounce in sand)
  for (let i = 0; i < 30; i++) {
    const n = T.normal(x, z), vn = Math.min(-1e-6, v.x * n.x + v.y * n.y + v.z * n.z);
    const tx = v.x - vn * n.x, ty = v.y - vn * n.y, tz = v.z - vn * n.z, st = Math.hypot(tx, ty, tz);
    if (st > 1e-9) u = { x: tx / st, y: ty / st, z: tz / st };
    const [a, b, w2] = bounce(st, vn, w); w = w2; along = a;
    if (b < HOP_MIN_MS) break;
    v = { x: u.x * a + n.x * b, y: u.y * a + n.y * b, z: u.z * a + n.z * b };
    let y = T.height(x, z), landed = false;
    for (let k = 1; k <= 120 * 10 && !landed; k++) {                       // ballistic hop, no air
      const nx = x + v.x * HOP_DT, nz = z + v.z * HOP_DT, ny = y + v.y * HOP_DT - 0.5 * G * HOP_DT * HOP_DT, nvy = v.y - G * HOP_DT, gy = T.height(nx, nz);
      if (k > 1 && ny <= gy) {
        const g0 = T.height(x, z), f = Math.min(1, Math.max(0, (y - g0) / (y - g0 - (ny - gy))));
        x += (nx - x) * f; z += (nz - z) * f; v = { x: v.x, y: v.y + (nvy - v.y) * f, z: v.z }; t += HOP_DT * f; landed = true;
        pts.push({ t, p: { x, y: T.height(x, z), z } });
      } else { x = nx; z = nz; y = ny; v = { ...v, y: nvy }; t += HOP_DT; if (k % 2 === 0) pts.push({ t, p: { x, y, z } }); }
    }
    if (T.surface(x, z) === 'bunker' || T.stops?.(x, z)) return { pts, x, z, t, holed: false };
  }
  const r = (5 * along - 2 * RADIUS * w) / 7, h = Math.hypot(u.x, u.z) || 1;   // skid to roll (research §4.1), along the tangent's horizontal heading
  return roll(T, x, z, (r * u.x) / h, (r * u.z) / h, t, pts);
}
