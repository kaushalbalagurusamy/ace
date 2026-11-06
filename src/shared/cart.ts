// Genesis Box Buggy (PRD/07): arcade cart kinematics, where a cart may drive, the tee spawn, and cart bumps.
// Pure and shared: the client drives with it, the server checks reports and resolves bumps with it. Sim space (x right, z forward), metres.
import { GRIDS } from './course-grid';
import { decodeGrid } from './gridtools';
import { golferSpot, type Pt } from '../client/rules';

export const CART = {
  TOP: 18, ACCEL: 6, BRAKE: 10, COAST: 2, REVERSE: 5,   // m/s and m/s²
  ROUGH: 0.7,                                           // top-speed factor in rough
  DRIFT: 5,                                             // 1/s: how fast sideways slip dies away
  STEER: 2.2,                                           // rad/s peak turn rate
  RADIUS: 1.3,                                          // circle collider (m)
  ENTER_M: 3,                                           // E range
  BOUNCE: 0.2,                                          // fraction of speed kept, reversed, after hitting blocked ground
  SERVER_MAX: 19,                                       // the server clamps reported speeds to this
};
export const GOLFER_RADIUS = 0.4;
const TEE_KEEP_OFF_M = 3, FRINGE_M = 2;

export interface CartState { x: number; z: number; yaw: number; vx: number; vz: number }
export interface CartInput { throttle: number; steer: number }
export type Ground = 'blocked' | 'rough' | 'full';

const grids: (Uint8Array | undefined)[] = [];
const G = 'g'.charCodeAt(0);
function cls(i: number, x: number, z: number): number {
  const g = GRIDS[i]!, cells = (grids[i] ??= decodeGrid(g));
  const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
  return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 111 : cells[iz * g.nx + ix]!;
}
/** Where a cart may go on hole i: kept off greens and their fringe, the tee, bunkers, water and out of bounds; rough, trees and rocks are slow. */
export function cartGround(i: number, x: number, z: number): Ground {
  if (Math.hypot(x, z) <= TEE_KEEP_OFF_M) return 'blocked';            // every hole's tee is at the origin
  const c = String.fromCharCode(cls(i, x, z));
  if ('gswo'.includes(c)) return 'blocked';
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) if (cls(i, x + dx * FRINGE_M, z + dz * FRINGE_M) === G) return 'blocked';
  return 'rtk'.includes(c) ? 'rough' : 'full';
}

export const forwardSpeed = (s: CartState) => s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw);
/** Turn rate for full lock: none at a standstill, peaking around 4 m/s, tighter at speed; reverses with the direction of travel. */
export const steerRate = (v: number) => Math.sign(v) * CART.STEER * Math.min(1, Math.abs(v) / 4) / (1 + Math.abs(v) / 12);

/** One fixed step. `bumped` is the speed at which the cart hit blocked ground (0 if it did not). */
export function stepCart(s: CartState, inp: CartInput, dt: number, ground: (x: number, z: number) => Ground): { s: CartState; bumped: number } {
  const here = ground(s.x, s.z), top = CART.TOP * (here === 'rough' ? CART.ROUGH : 1);
  const yaw = s.yaw + inp.steer * steerRate(forwardSpeed(s)) * dt;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let vf = s.vx * fx + s.vz * fz, vr = s.vx * fz - s.vz * fx;          // forward and rightward speed in the new heading: turning leaves some slip
  const t = Math.sign(inp.throttle), target = t > 0 ? top : t < 0 ? -CART.REVERSE : 0;
  const rate = Math.abs(vf) > top || vf * target < 0 ? CART.BRAKE : t === 0 ? CART.COAST : CART.ACCEL;
  vf = vf < target ? Math.min(target, vf + rate * dt) : Math.max(target, vf - rate * dt);
  vr *= Math.exp(-CART.DRIFT * dt);
  let vx = vf * fx + vr * fz, vz = vf * fz - vr * fx;
  const nx = s.x + vx * dt, nz = s.z + vz * dt;
  if (here !== 'blocked' && ground(nx, nz) === 'blocked') {             // soft bump: stay at the edge, roll back a little
    const bumped = Math.hypot(vx, vz); vx *= -CART.BOUNCE; vz *= -CART.BOUNCE;
    return { s: { x: s.x, z: s.z, yaw, vx, vz }, bumped };
  }
  return { s: { x: nx, z: nz, yaw, vx, vz }, bumped: 0 };
}

export const canEnter = (golfer: Pt, cart: CartState) => Math.hypot(golfer.x - cart.x, golfer.z - cart.z) <= CART.ENTER_M;
/** The golfer steps out on the driver's (left) side. */
export const exitSpot = (c: CartState): Pt => ({ x: c.x - Math.cos(c.yaw) * 1.8, z: c.z + Math.sin(c.yaw) * 1.8 });

const spawns = new Map<number, CartState[]>();
/** Parked carts beside the tee, facing the pin: slot k takes the k-th nearest drivable spot to the golfer, 2 radii clear of the earlier slots. */
export function cartSpawn(holeIndex: number, slot: number): CartState {
  let list = spawns.get(holeIndex);
  if (!list) {
    const g = golferSpot({ x: 0, z: 0 }), cand: Pt[] = [];
    for (let x = -12; x <= 12; x += 0.4) for (let z = -12; z <= 12; z += 0.4) cand.push({ x: g.x + x, z: g.z + z });
    cand.sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z));
    const free = (p: Pt) => [-1, 0, 1].every(dx => [-1, 0, 1].every(dz => cartGround(holeIndex, p.x + dx * 0.8, p.z + dz * 0.8) !== 'blocked'));
    list = [];
    for (const p of cand) {
      if (list.length === 4) break;
      if (free(p) && list.every(c => Math.hypot(c.x - p.x, c.z - p.z) >= 2 * CART.RADIUS + 0.4)) list.push({ x: p.x, z: p.z, yaw: 0, vx: 0, vz: 0 });
    }
    spawns.set(holeIndex, list);
  }
  return { ...(list[slot % 4] ?? { x: 6, z: 0, yaw: 0, vx: 0, vz: 0 }) };
}

export interface Body { x: number; z: number; vx: number; vz: number }
/** Cart-to-cart bump, Mario Kart style: equal and opposite. A moves by +n·push and gains +n·dv; B gets the negatives. null when apart. */
export function cartBump(a: Body, b: Body): { nx: number; nz: number; push: number; dv: number; closing: number } | null {
  let dx = a.x - b.x, dz = a.z - b.z; const d = Math.hypot(dx, dz);
  if (d >= 2 * CART.RADIUS) return null;
  if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
  const closing = Math.max(0, (b.vx - a.vx) * dx + (b.vz - a.vz) * dz);
  return { nx: dx, nz: dz, push: (2 * CART.RADIUS - d) / 2 + 0.05, dv: 1.5 + 0.8 * closing, closing };
}
/** A moving cart that reaches a golfer on foot knocks them a short way out of its path (never through the cart). */
export function golferKnock(cart: Body, golfer: Pt): { dx: number; dz: number } | null {
  const sp = Math.hypot(cart.vx, cart.vz); let dx = golfer.x - cart.x, dz = golfer.z - cart.z; const d = Math.hypot(dx, dz);
  if (sp < 1.5 || d >= CART.RADIUS + GOLFER_RADIUS) return null;
  if (d < 1e-6) { dx = cart.vz; dz = -cart.vx; } else { dx /= d; dz /= d; }
  const n = Math.hypot(dx, dz) || 1, k = CART.RADIUS + GOLFER_RADIUS - d + 1 + 0.1 * sp;
  return { dx: (dx / n) * k, dz: (dz / n) * k };
}
