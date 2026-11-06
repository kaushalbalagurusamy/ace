// Server side of the carts (PRD/07): checks the golfer and cart states players report and resolves bumps between them. Pure, no sockets.
import { CART, cartBump, cartSpawn, golferKnock } from '../shared/cart';
import { WALK_SPEED, golferSpot, type Pt } from '../client/rules';
import type { CartState, ClientMsg } from '../shared/protocol';

export interface MoverState { x: number; z: number; yaw: number; driving: boolean; cart: CartState; /** when this state was accepted */ atMs: number }
export interface Push { target: 'cart' | 'golfer'; dx: number; dz: number; dvx: number; dvz: number; strength: number }

const SLACK_M = 3;          // network jitter (two reports arriving together) plus a bump's displacement
const BALL_JUMP_M = 4;      // the client moves the golfer to their ball after a penalty drop

/** A player on the tee of `holeIndex`: on foot beside the ball, cart parked beside them. */
export function atTee(holeIndex: number, slot: number, nowMs: number): MoverState {
  const g = golferSpot({ x: 0, z: 0 });
  return { x: g.x, z: g.z, yaw: 0, driving: false, cart: cartSpawn(holeIndex, slot), atMs: nowMs };
}

export function clampSpeed(c: CartState): CartState {
  const v = Math.hypot(c.vx, c.vz), k = v > CART.SERVER_MAX ? CART.SERVER_MAX / v : 1;
  return { ...c, vx: c.vx * k, vz: c.vz * k };
}

/** The next accepted state, or null when the report is a teleport or an enter from out of range (the caller then sends `snap`). */
export function acceptMove(prev: MoverState, m: Extract<ClientMsg, { t: 'move' }>, nowMs: number, ball: Pt): MoverState | null {
  const dt = Math.min(1, Math.max(0, (nowMs - prev.atMs) / 1000)), d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
  const cart = clampSpeed(m.cart);
  if (d(cart, prev.cart) > CART.SERVER_MAX * dt + SLACK_M) return null;
  if (m.driving && !prev.driving && d(prev, prev.cart) > CART.ENTER_M + 0.5) return null;
  const golfer = m.driving ? { x: cart.x, z: cart.z } : { x: m.x, z: m.z };
  const reach = (prev.driving ? CART.SERVER_MAX : WALK_SPEED + 1) * dt + SLACK_M;
  if (!m.driving && d(golfer, prev) > reach && d(golfer, ball) > BALL_JUMP_M) return null;
  return { ...golfer, yaw: m.yaw, driving: m.driving, cart, atMs: nowMs };
}

/** Bumps between two players on the same hole: what each must apply. Cart-cart is equal and opposite; a moving cart knocks a golfer on foot. */
export function contacts(a: MoverState, b: MoverState): { a: Push[]; b: Push[] } {
  const out: { a: Push[]; b: Push[] } = { a: [], b: [] };
  const hit = cartBump(a.cart, b.cart);
  if (hit) {
    const { nx, nz, push, dv, closing } = hit, strength = Math.min(1, 0.2 + closing / CART.TOP);
    out.a.push({ target: 'cart', dx: nx * push, dz: nz * push, dvx: nx * dv, dvz: nz * dv, strength });
    out.b.push({ target: 'cart', dx: -nx * push, dz: -nz * push, dvx: -nx * dv, dvz: -nz * dv, strength });
  }
  const knock = (c: CartState, s: MoverState, to: Push[]) => {
    const k = !s.driving && golferKnock(c, s);
    if (k) to.push({ target: 'golfer', dx: k.dx, dz: k.dz, dvx: 0, dvz: 0, strength: Math.min(1, Math.hypot(c.vx, c.vz) / CART.TOP) });
  };
  knock(a.cart, b, out.b); knock(b.cart, a, out.a);
  return out;
}

/** The server applies each push to its own copy at once, so the same contact is not resolved twice before the client reports again. */
export function applyPush(s: MoverState, p: Push) {
  if (p.target === 'golfer') { s.x += p.dx; s.z += p.dz; return; }
  s.cart = clampSpeed({ ...s.cart, x: s.cart.x + p.dx, z: s.cart.z + p.dz, vx: s.cart.vx + p.dvx, vz: s.cart.vz + p.dvz });
  if (s.driving) { s.x = s.cart.x; s.z = s.cart.z; }
}
