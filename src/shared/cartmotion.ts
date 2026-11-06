// Cart ride motion (PRD/07): wheel spin, per-wheel spring-damper suspension over the ground, body pitch under acceleration and
// braking, roll in turns and a bounce on bumps. Pure: cartmodel.ts applies the result to the meshes; tests drive it directly.
// Body frame: x = the cart's left, y up, z forward, metres. Pitch > 0 drops the nose (three.js rotation.x), roll > 0 lifts the left.

/** Ground height (m) at a sim-space point. Seam for the terrain: flat until real heights land; replace this export. */
export let heightAt = (_x: number, _z: number): number => 0;
export const setHeightAt = (f: (x: number, z: number) => number) => { heightAt = f; };

export const WHEEL_R = 0.45;
/** Wheel contact points in the body frame: [x, z] for front-left, front-right, rear-left, rear-right. Track and wheelbase are the
 *  generated body's (refs/cart photos via Rodin: wheels flush under the body sides, not outboard), scaled to WHEEL_R. */
export const CORNERS: readonly (readonly [number, number])[] = [[0.8, 1.43], [-0.8, 1.43], [0.8, -1.43], [-0.8, -1.43]];
export const RIDE = {
  HZ: 1.6, ZETA: 0.45,          // body natural frequency on its springs and damping ratio: one soft overshoot, like a cart on coil-overs
  CG: 0.6,                      // centre of mass height above the axles (m): the lever arm for pitch and roll
  MAX_TILT: 0.12,               // rad: pitch and roll are clamped here (a hard stop on the bump rubbers)
  MAX_ACC: 14,                  // m/s²: inertial loads beyond this are clipped (network jitter, wall bumps)
  BUMP_DV: 3,                   // a speed change this big in one step is a knock, not driving: it becomes a bounce instead
};

export interface Ride {
  heave: number; heaveV: number; pitch: number; pitchV: number; roll: number; rollV: number;
  /** per-wheel ground height under each corner (m) and its compression (m, > 0 = squeezed) */
  wheelY: number[]; comp: number[];
  spin: number; speed: number; acc: number;
}
export const restRide = (): Ride => ({ heave: 0, heaveV: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0, wheelY: [0, 0, 0, 0], comp: [0, 0, 0, 0], spin: 0, speed: 0, acc: 0 });

const W = 2 * Math.PI * RIDE.HZ, K = (W * W) / 4, C = (2 * RIDE.ZETA * W) / 4;   // per-corner spring and damper for unit mass
const IP = CORNERS.reduce((s, c) => s + c[1] * c[1], 0) / 4, IR = CORNERS.reduce((s, c) => s + c[0] * c[0], 0) / 4;   // inertia giving the same frequency in pitch and roll
const clamp = (x: number, m: number) => Math.max(-m, Math.min(m, x));

/** One frame. `speed` forward m/s, `yawRate` rad/s (> 0 turns toward the cart's right), `ground` the four corner heights. */
export function stepRide(r: Ride, speed: number, yawRate: number, ground: readonly number[], dt: number): Ride {
  if (dt <= 0) return { ...r, speed, wheelY: [...ground] };
  const dv = speed - r.speed, knock = Math.abs(dv) > RIDE.BUMP_DV;
  const acc = knock ? r.acc : clamp(dv / dt, RIDE.MAX_ACC);
  const n = Math.ceil(dt / (1 / 120)), h = dt / n;                     // substeps keep the semi-implicit integration stable at any frame rate
  let { heave, heaveV, pitch, pitchV, roll, rollV } = r;
  if (knock) { heaveV += 0.12 * Math.abs(dv); pitchV += 0.08 * Math.sign(dv) * Math.min(6, Math.abs(dv)); }   // bounce, nose kicked by the wall
  const lat = clamp(speed * yawRate, RIDE.MAX_ACC);                     // centripetal, toward the cart's right for yawRate > 0
  const gv = ground.map((g, i) => (g - r.wheelY[i]!) / dt);
  const comp = [0, 0, 0, 0];
  for (let s = 0; s < n; s++) {
    let fh = 0, fp = 0, fr = 0;
    CORNERS.forEach(([x, z], i) => {
      const y = heave - pitch * z + roll * x, yv = heaveV - pitchV * z + rollV * x;
      const f = K * (ground[i]! - y) + C * (gv[i]! - yv); comp[i] = ground[i]! - y;
      fh += f; fp -= f * z; fr += f * x;
    });
    // inertia: accelerating squats the rear (nose up, pitch < 0); a turn to the right leans the body outward (left side down, roll < 0)
    heaveV += fh * h; pitchV += (fp / IP - acc * RIDE.CG) * h; rollV += (fr / IR - lat * RIDE.CG) * h;
    heave += heaveV * h; pitch += pitchV * h; roll += rollV * h;
    if (Math.abs(pitch) > RIDE.MAX_TILT) { pitch = clamp(pitch, RIDE.MAX_TILT); pitchV = 0; }
    if (Math.abs(roll) > RIDE.MAX_TILT) { roll = clamp(roll, RIDE.MAX_TILT); rollV = 0; }
  }
  return { heave, heaveV, pitch, pitchV, roll, rollV, wheelY: [...ground], comp, spin: (r.spin + (speed * dt) / WHEEL_R) % (2 * Math.PI), speed, acc };
}

/** Corner ground heights for a cart at sim (x, z) heading yaw (sim: forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw)). */
export function cornerGround(x: number, z: number, yaw: number): number[] {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return CORNERS.map(([bx, bz]) => heightAt(x - bx * fz + bz * fx, z + bx * fx + bz * fz));   // body +x (left) is sim -right
}
