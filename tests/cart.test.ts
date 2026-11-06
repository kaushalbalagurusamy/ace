import { describe, it, expect } from 'vitest';
import { CART, cartGround, cartSpawn, canEnter, exitSpot, forwardSpeed, stepCart, type CartState, type Ground } from '../src/shared/cart';
import { hole, HOLE_COUNT } from '../src/server/course';
import { golferSpot } from '../src/client/rules';

const DT = 1 / 60;
const at = (o: Partial<CartState> = {}): CartState => ({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, ...o });
const flat = (g: Ground) => () => g;
function drive(s: CartState, throttle: number, steer: number, secs: number, ground: (x: number, z: number) => Ground = flat('full')) {
  let bumps = 0;
  for (let t = 0; t < secs - 1e-9; t += DT) { const r = stepCart(s, { throttle, steer }, DT, ground); s = r.s; if (r.bumped > 0) bumps++; }
  return { s, bumps };
}

describe('cart kinematics (arcade)', () => {
  it('accelerates at about 6 m/s² and tops out at 18 m/s, never above', () => {
    expect(forwardSpeed(drive(at(), 1, 0, 1).s)).toBeCloseTo(CART.ACCEL, 0);
    let s = at(), max = 0;
    for (let i = 0; i < 600; i++) { s = stepCart(s, { throttle: 1, steer: 0 }, DT, flat('full')).s; max = Math.max(max, forwardSpeed(s)); }
    expect(forwardSpeed(s)).toBeCloseTo(18, 3); expect(max).toBeLessThanOrEqual(18 + 1e-9);
    expect(s.z).toBeGreaterThan(100);                                 // it actually travels forward (+z at yaw 0)
  });
  it('rough slows the top speed to 70% (12.6 m/s); a fast cart entering rough slows to it', () => {
    expect(forwardSpeed(drive(at(), 1, 0, 10, flat('rough')).s)).toBeCloseTo(18 * 0.7, 3);
    expect(forwardSpeed(drive(at({ vz: 18 }), 1, 0, 2, flat('rough')).s)).toBeCloseTo(12.6, 3);
  });
  it('brakes at about 10 m/s², then reverses slowly; coasting bleeds speed', () => {
    expect(forwardSpeed(drive(at({ vz: 18 }), -1, 0, 1).s)).toBeCloseTo(18 - CART.BRAKE, 0);
    const back = forwardSpeed(drive(at({ vz: 18 }), -1, 0, 6).s);
    expect(back).toBeLessThan(0); expect(back).toBeGreaterThanOrEqual(-CART.REVERSE - 1e-9);
    const coast = forwardSpeed(drive(at({ vz: 10 }), 0, 0, 1).s);
    expect(coast).toBeLessThan(10); expect(coast).toBeGreaterThan(5);
  });
  it('steers right with Right, cannot turn on the spot, and the turn rate tightens at speed', () => {
    expect(drive(at(), 0, 1, 1).s.yaw).toBe(0);                                     // standing still: no pivot
    const rate = (v: number) => stepCart(at({ vz: v }), { throttle: 1, steer: 1 }, DT, flat('full')).s.yaw / DT;
    expect(rate(6)).toBeGreaterThan(0);                                              // Right = clockwise from +z, toward +x
    expect(rate(18)).toBeLessThan(rate(6));
    expect(drive(at({ vz: 10 }), 1, 1, 0.5).s.x).toBeGreaterThan(0);
  });
  it('has a little drift: sideways velocity after a turn decays instead of snapping', () => {
    const s = at({ vx: 5, vz: 0 }), next = stepCart(s, { throttle: 0, steer: 0 }, DT, flat('full')).s;   // yaw 0, all velocity sideways
    expect(next.vx).toBeLessThan(5); expect(next.vx).toBeGreaterThan(4);
    expect(Math.abs(drive(s, 0, 0, 1.5).s.vx)).toBeLessThan(0.1);
  });
});

describe('blocked ground: carts stop at the edge with a soft bump', () => {
  it('a wall at z = 50 stops the cart before it, with a bump, and never lets it through', () => {
    const wall = (_x: number, z: number): Ground => (z > 50 ? 'blocked' : 'full');
    const { s, bumps } = drive(at(), 1, 0, 10, wall);
    expect(s.z).toBeLessThanOrEqual(50); expect(s.z).toBeGreaterThan(47); expect(bumps).toBeGreaterThan(0);
  });
  it('a cart already on blocked ground (pushed there) can still drive out', () => {
    const pit = (_x: number, z: number): Ground => (z < 1 ? 'blocked' : 'full');
    expect(drive(at(), 1, 0, 1, pit).s.z).toBeGreaterThan(1);
  });
  it('on every hole: greens, fringe, the tee, bunkers, water and out of bounds are blocked; rough is slow; fairway and path are full speed', () => {
    for (let i = 0; i < HOLE_COUNT; i++) {
      const h = hole(i);
      expect(cartGround(i, h.info.pin.x, h.info.pin.z), `green ${i}`).toBe('blocked');
      expect(cartGround(i, 0, 0), `tee ${i}`).toBe('blocked');
      for (let x = -120; x <= 120; x += 7) for (let z = -30; z <= h.info.lengthM + 30; z += 9) {
        const g = cartGround(i, x, z), surf = h.surfaceAt(x, z), pen = h.penaltyAt(x, z);
        if (surf === 'green' || surf === 'bunker' || pen) expect(g, `${i} ${x},${z} ${surf} ${pen}`).toBe('blocked');
        else if (surf === 'rough') expect(['rough', 'blocked']).toContain(g);
        else expect(['full', 'blocked']).toContain(g);
      }
    }
  });
  it('fringe: ground within a couple of metres of the green is blocked too', () => {
    const h = hole(0);
    let z = h.info.pin.z; while (h.surfaceAt(0, z) === 'green') z -= 0.5;   // first non-green point short of the green on the centre line
    expect(cartGround(0, 0, z - 0.3)).toBe('blocked');
  });
});

describe('enter / exit and the tee spawn', () => {
  it('E works within 3 m of the cart and not beyond', () => {
    const c = at({ x: 10, z: 10 });
    expect(canEnter({ x: 12.9, z: 10 }, c)).toBe(true);
    expect(canEnter({ x: 13.2, z: 10 }, c)).toBe(false);
  });
  it('exiting puts the golfer beside the cart, within E range so they can get back in', () => {
    const c = at({ x: 5, z: 7, yaw: 1 }), p = exitSpot(c), d = Math.hypot(p.x - c.x, p.z - c.z);
    expect(d).toBeGreaterThan(CART.RADIUS); expect(canEnter(p, c)).toBe(true);
  });
  it('on every tee each of four carts spawns parked on drivable ground, apart from the others; the first is within E range of the golfer', () => {
    for (let i = 0; i < HOLE_COUNT; i++) {
      const g = golferSpot(hole(i).info.tee), carts = [0, 1, 2, 3].map(k => cartSpawn(i, k));
      for (const c of carts) { expect(cartGround(i, c.x, c.z), `hole ${i}`).not.toBe('blocked'); expect(c.vx).toBe(0); expect(c.vz).toBe(0); expect(Math.hypot(c.x - g.x, c.z - g.z)).toBeLessThan(15); }
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) expect(Math.hypot(carts[a]!.x - carts[b]!.x, carts[a]!.z - carts[b]!.z)).toBeGreaterThanOrEqual(2 * CART.RADIUS);
      expect(canEnter(g, carts[0]!), `hole ${i}`).toBe(true);
    }
  });
});
