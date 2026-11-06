import { describe, it, expect } from 'vitest';
import { acceptMove, applyPush, atTee, contacts, type MoverState } from '../src/server/movers';
import { CART, cartSpawn } from '../src/shared/cart';
import { golferSpot } from '../src/client/rules';
import type { CartState } from '../src/shared/protocol';

const cart = (o: Partial<CartState> = {}): CartState => ({ x: 20, z: 50, yaw: 0, vx: 0, vz: 0, ...o });
const mover = (o: Partial<MoverState> = {}): MoverState => ({ x: 22, z: 50, yaw: 0, driving: false, cart: cart(), atMs: 0, ...o });
const move = (s: MoverState) => ({ t: 'move' as const, x: s.x, z: s.z, yaw: s.yaw, driving: s.driving, cart: s.cart });
const farBall = { x: -300, z: -300 };

describe('server: carts bump each other, Mario Kart style', () => {
  it('a cart-to-cart bump is equal and opposite, and harder the faster they close', () => {
    const hit = (v: number) => contacts(mover({ driving: true, cart: cart({ z: 47.8, vz: v }) }), mover({ x: 40, cart: cart() }));
    const r = hit(10), a = r.a.find(p => p.target === 'cart')!, b = r.b.find(p => p.target === 'cart')!;
    expect(a.dx).toBeCloseTo(-b.dx, 12); expect(a.dz).toBeCloseTo(-b.dz, 12);
    expect(a.dvx).toBeCloseTo(-b.dvx, 12); expect(a.dvz).toBeCloseTo(-b.dvz, 12);
    expect(a.dvz).toBeLessThan(0); expect(b.dvz).toBeGreaterThan(0);              // the rear cart is pushed back, the front one forward
    const slow = hit(3).b.find(p => p.target === 'cart')!;
    expect(b.dvz).toBeGreaterThan(slow.dvz); expect(b.strength).toBeGreaterThan(slow.strength);
  });
  it('after the push the carts no longer overlap; carts apart do not bump', () => {
    const a = mover({ driving: true, cart: cart({ z: 48, vz: 8 }) }), b = mover({ x: 40, cart: cart() }), r = contacts(a, b);
    r.a.forEach(p => applyPush(a, p)); r.b.forEach(p => applyPush(b, p));
    expect(Math.hypot(a.cart.x - b.cart.x, a.cart.z - b.cart.z)).toBeGreaterThanOrEqual(2 * CART.RADIUS);
    expect(contacts(mover({ cart: cart({ z: 40 }) }), mover({ x: 40, cart: cart() }))).toEqual({ a: [], b: [] });
  });
  it('a moving cart knocks a golfer on foot a short way; a parked cart and a driven golfer are left alone', () => {
    const driver = mover({ driving: true, cart: cart({ vz: 8 }), x: 20, z: 50 }), walker = mover({ x: 20.3, z: 51, cart: cart({ x: 60 }) });
    const k = contacts(driver, walker).b.find(p => p.target === 'golfer')!;
    expect(Math.hypot(k.dx, k.dz)).toBeGreaterThan(0.5); expect(Math.hypot(k.dx, k.dz)).toBeLessThan(4);
    expect(contacts(mover({ cart: cart(), x: 60 }), walker).b).toEqual([]);
    expect(contacts(driver, mover({ driving: true, cart: cart({ x: 60 }) })).b).toEqual([]);
  });
});

describe('server: reported moves are clamped and checked', () => {
  it('cart speed is clamped to 19 m/s, keeping its direction', () => {
    const prev = mover({ driving: true, x: 20, z: 50 }), next = acceptMove(prev, move(mover({ driving: true, cart: cart({ vx: 30, vz: 40 }) })), 100, farBall)!;
    expect(Math.hypot(next.cart.vx, next.cart.vz)).toBeCloseTo(CART.SERVER_MAX, 9); expect(next.cart.vx / next.cart.vz).toBeCloseTo(0.75, 9);
  });
  it('a plausible step is accepted; a teleport is rejected', () => {
    const prev = mover({ driving: true, x: 20, z: 50 });
    expect(acceptMove(prev, move(mover({ driving: true, cart: cart({ z: 51.8, vz: 18 }), x: 20, z: 51.8 })), 100, farBall)).not.toBeNull();
    expect(acceptMove(prev, move(mover({ driving: true, cart: cart({ z: 90 }), x: 20, z: 90 })), 100, farBall)).toBeNull();
    expect(acceptMove(prev, move(mover({ x: 120, z: 50, cart: cart() })), 100, farBall)).toBeNull();     // a golfer jumping 100 m
  });
  it('slack is a leaky-bucket allowance, not per message: 100 reports 1 ms apart cannot add 3 m each', () => {
    let s = mover({ driving: true, x: 20, z: 50 }), t = 0, accepted = 0;
    for (let i = 0; i < 100; i++) {
      t += 1; const z = s.cart.z + 3, next = acceptMove(s, move(mover({ driving: true, cart: cart({ z, vz: 18 }), x: 20, z })), t, farBall);
      if (next) { s = next; accepted++; }
    }
    expect(s.cart.z - 50).toBeLessThanOrEqual(CART.SERVER_MAX * (t / 1000) + 3 + 1e-9);
    expect(accepted).toBeLessThan(5);
    let w = mover({ x: 22, z: 50 }), wz = 50;                                      // the same on foot
    for (let i = 1; i <= 100; i++) { wz += 3; w = acceptMove(w, move(mover({ x: 22, z: wz })), i, farBall) ?? w; }
    expect(w.z - 50).toBeLessThanOrEqual(16 * 0.1 + 3 + 1e-9);
  });
  it('a normal 20 Hz stream at top speed, and 10 Hz walking at full pace, stay accepted', () => {
    let s = mover({ driving: true, x: 20, z: 50 });
    for (let i = 1; i <= 200; i++) { const z = 50 + 18 * 0.05 * i; s = acceptMove(s, move(mover({ driving: true, cart: cart({ z, vz: 18 }), x: 20, z })), i * 50, farBall)!; expect(s, `step ${i}`).not.toBeNull(); }
    let w = mover({ x: 22, z: 50 });
    for (let i = 1; i <= 100; i++) { w = acceptMove(w, move(mover({ x: 22, z: 50 + 15 * 0.1 * i })), i * 100, farBall)!; expect(w, `walk ${i}`).not.toBeNull(); }
  });
  it('while driving the golfer is where the cart is, whatever the report says', () => {
    const next = acceptMove(mover({ driving: true, x: 20, z: 50 }), move(mover({ driving: true, x: 21, z: 49 })), 100, farBall)!;
    expect([next.x, next.z]).toEqual([20, 50]);
  });
  it('entering needs the golfer within E range of the cart', () => {
    expect(acceptMove(mover({ x: 22.5 }), move(mover({ driving: true, x: 20 })), 100, farBall)).not.toBeNull();
    expect(acceptMove(mover({ x: 30 }), move(mover({ driving: true, x: 20 })), 100, farBall)).toBeNull();
  });
  it('the golfer may jump to their own ball (a penalty drop moves them there)', () => {
    const ball = { x: 150, z: 300 }, spot = golferSpot(ball);
    expect(acceptMove(mover(), move(mover({ x: spot.x, z: spot.z })), 100, ball)).not.toBeNull();
  });
});

describe('the cart follows its player to the next tee', () => {
  it('at a hole change the golfer is on the new tee, out of the cart, and the cart is parked beside them', () => {
    for (const [hole, slot] of [[1, 0], [7, 2], [17, 3]] as const) {
      const s = atTee(hole, slot, 5000), spot = golferSpot({ x: 0, z: 0 });
      expect(s.cart).toEqual(cartSpawn(hole, slot)); expect(s.driving).toBe(false);
      expect([s.x, s.z]).toEqual([spot.x, spot.z]); expect(s.atMs).toBe(5000);
    }
  });
});
