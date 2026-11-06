import { describe, expect, it } from 'vitest';
import { CORNERS, RIDE, WHEEL_R, cornerGround, restRide, setHeightAt, stepRide, type Ride } from '../src/shared/cartmotion';
import { CART, forwardSpeed, stepCart, type CartState } from '../src/shared/cart';

const DT = 1 / 60, FLAT = [0, 0, 0, 0];
/** Drives the real cart kinematics and feeds the ride, as poseCart does from the drawn state. */
function drive(secs: number, throttle: (t: number) => number, steer = 0, r = restRide(), s0: CartState = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0 }) {
  let s = s0, maxPitch = 0, maxRoll = 0;
  for (let t = 0; t < secs; t += DT) {
    const prevYaw = s.yaw; s = stepCart(s, { throttle: throttle(t), steer }, DT, () => 'full').s;
    r = stepRide(r, forwardSpeed(s), (s.yaw - prevYaw) / DT, FLAT, DT);
    maxPitch = Math.max(maxPitch, Math.abs(r.pitch)); maxRoll = Math.max(maxRoll, Math.abs(r.roll));
  }
  return { r, s, maxPitch, maxRoll };
}
const energy = (r: Ride) => r.heave ** 2 + r.pitch ** 2 + r.roll ** 2 + (r.heaveV ** 2 + r.pitchV ** 2 + r.rollV ** 2) / 100;

describe('wheel spin', () => {
  it('advances by distance over radius (rolling without slip)', () => {
    let r = restRide(), dist = 0;
    for (let i = 0; i < 37; i++) { const v = 0.5 + i * 0.1; r = stepRide(r, v, 0, FLAT, DT); dist += v * DT; }
    expect(r.spin).toBeCloseTo((dist / WHEEL_R) % (2 * Math.PI), 9);
  });
  it('rolls backwards in reverse', () => { expect(stepRide(restRide(), -2, 0, FLAT, 0.1).spin).toBeCloseTo(-0.2 / WHEEL_R, 9); });
});

describe('suspension', () => {
  it('pitches nose up under acceleration and nose down under braking, within the bump stops', () => {
    const acc = drive(1, () => 1); expect(acc.r.pitch).toBeLessThan(-0.01);
    const brake = drive(0.6, () => -1, 0, acc.r, acc.s); expect(brake.r.pitch).toBeGreaterThan(0.01);
    expect(Math.max(acc.maxPitch, brake.maxPitch)).toBeLessThanOrEqual(RIDE.MAX_TILT);
  });
  it('rolls outward in a turn: a right turn drops the left side (roll < 0), bounded', () => {
    const { r, maxRoll } = drive(4, () => 1, 1); expect(r.roll).toBeLessThan(-0.01); expect(maxRoll).toBeLessThanOrEqual(RIDE.MAX_TILT);
  });
  it('settles back to rest after driving stops, and never gains energy while coasting to a halt', () => {
    let { r } = drive(5, t => (t < 3 ? 1 : -1), 0.6);
    let e = Infinity;
    for (let i = 0; i < 600; i++) { r = stepRide(r, 0, 0, FLAT, DT); if (i > 60 && i % 30 === 0) { expect(energy(r)).toBeLessThanOrEqual(e + 1e-12); e = energy(r); } }
    expect(Math.abs(r.heave) + Math.abs(r.pitch) + Math.abs(r.roll)).toBeLessThan(1e-3);
  });
  it('stays stable for ten minutes of random driving at uneven frame rates', () => {
    let r = restRide(), seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let v = 0;
    for (let i = 0; i < 36000; i++) {
      const dt = 1 / 30 + rnd() * (1 / 20); v = Math.max(-CART.REVERSE, Math.min(CART.TOP, v + (rnd() - 0.45) * 2));
      r = stepRide(r, v, (rnd() - 0.5) * 2, [rnd() * 0.05, rnd() * 0.05, rnd() * 0.05, rnd() * 0.05], dt);
      expect(Number.isFinite(r.heave + r.pitch + r.roll)).toBe(true);
      expect(Math.abs(r.heave)).toBeLessThan(0.3);
    }
  });
  it('follows the ground: the body rises with a raised wheel, and the ride stays level on a uniform rise', () => {
    let r = restRide(); for (let i = 0; i < 300; i++) r = stepRide(r, 0, 0, [0.2, 0.2, 0.2, 0.2], DT);
    expect(r.heave).toBeCloseTo(0.2, 3); expect(Math.abs(r.pitch)).toBeLessThan(1e-6);
    r = restRide(); for (let i = 0; i < 300; i++) r = stepRide(r, 0, 0, [0.1, 0.1, 0, 0], DT);   // front on a 10 cm step
    expect(r.pitch).toBeCloseTo(-0.1 / (CORNERS[0]![1] * 2), 3);                                       // nose up
  });
  it('a wall knock bounces the body instead of reading as a huge deceleration', () => {
    const r = stepRide({ ...restRide(), speed: 15 }, -3, 0, FLAT, DT);
    expect(r.heaveV).toBeGreaterThan(0.5); expect(Math.abs(r.acc)).toBeLessThan(RIDE.MAX_ACC);
  });
});

describe('heightAt seam', () => {
  it('is flat by default and samples the four wheels when replaced (body +x is the cart left, sim -x)', () => {
    expect(cornerGround(3, 4, 0.7)).toEqual([0, 0, 0, 0]);
    setHeightAt((x, z) => x * 10 + z);
    try { expect(cornerGround(0, 0, 0)).toEqual(CORNERS.map(([bx, bz]) => -bx * 10 + bz)); }
    finally { setHeightAt(() => 0); }
  });
});
