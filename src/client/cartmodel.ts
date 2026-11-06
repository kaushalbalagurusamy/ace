// Code-built Genesis Box Buggy (PRD/07, refs/cart): stylised low-poly per assets/STYLE.md. 1 unit = 1 m, Y up, origin at the
// ground centre, facing +Z. A tall glass-canopy box in dark blue, tan bench seats, a rear panel with chrome strips and a light bar,
// and chunky turf-tread wheels on silver rims standing outboard on exposed coil-over suspension. The wheels follow the ground and
// the body rides on springs above them (src/shared/cartmotion.ts); a generated body can replace the code one (fitBody).
import * as THREE from 'three';
import { loadRaw } from './assets';
import { WHEEL_R, CORNERS, restRide, stepRide, cornerGround, type Ride } from '../shared/cartmotion';

export interface CartView {
  root: THREE.Group;
  /** the sprung body (pivots at axle height): everything but the wheels; `shell` is the code body the generated one replaces */
  body: THREE.Group; shell: THREE.Group;
  spinners: THREE.Object3D[]; steer: THREE.Object3D[]; wheels: THREE.Object3D[];
  /** driver's hip point on the front bench (cart's left), and the steering wheel centre (local +z = column axis toward the driver) */
  seat: THREE.Object3D; wheel: THREE.Object3D;
  spin: number; ride: Ride; last?: { x: number; z: number; yaw: number };
}

const mat = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const BLUE = mat('#3B5785'), DARK = mat('#1E2430'), TAN = mat('#C9A77C'), PLAID = mat('#8E6B4A'), CHROME = mat('#E4E8EE'), STEEL = mat('#7A8088');
const TYRE = mat('#26272A'), RIM = mat('#C4C9D0'), LIGHT = mat('#E0463C');
const GLASS = new THREE.MeshLambertMaterial({ color: '#3A5A8C', transparent: true, opacity: 0.35, depthWrite: false });

function box(g: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b;
}

/** Wide turf tyre (refs/cart: square block lugs in rows, white sidewall lettering omitted) on a dished silver turbine rim. */
function wheel(side: number): { pivot: THREE.Group; spinner: THREE.Group } {
  const pivot = new THREE.Group(), spinner = new THREE.Group(); pivot.add(spinner);
  spinner.add(new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R - 0.03, WHEEL_R - 0.03, 0.44, 20).rotateZ(Math.PI / 2), TYRE));
  for (let i = 0; i < 22; i++) for (const row of [-0.15, 0, 0.15]) {   // three rows of block lugs, the middle row staggered
    const a = ((i + (row === 0 ? 0.5 : 0)) / 22) * Math.PI * 2, lug = box(spinner, TYRE, 0.12, 0.05, 0.1, row, Math.cos(a) * (WHEEL_R - 0.02), Math.sin(a) * (WHEEL_R - 0.02));
    lug.rotation.x = a;
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.05, 16).rotateZ(Math.PI / 2), RIM); rim.position.x = side * 0.2; spinner.add(rim);
  for (let i = 0; i < 5; i++) {                                       // dark turbine slots, so the spin reads
    const slot = box(spinner, DARK, 0.02, 0.15, 0.04, side * 0.225, 0, 0); slot.rotation.x = (i / 5) * Math.PI * 2;
    slot.geometry.translate(0, 0.14, 0);
  }
  return { pivot, spinner };
}

export function makeCart(shade: string, load = true): CartView {
  const root = new THREE.Group(), body = new THREE.Group(), frame = new THREE.Group(), shell = new THREE.Group();
  body.position.y = WHEEL_R; frame.position.y = -WHEEL_R;           // the body pitches and rolls about the axle line
  root.add(body); body.add(frame); frame.add(shell);
  // chassis and the open side tub
  // proportions follow the generated body (wheels under the body ends, a low tub between them, the canopy over all)
  box(frame, DARK, 1.2, 0.16, 3.2, 0, 0.45, 0);
  box(shell, BLUE, 1.76, 0.5, 0.75, 0, 1.2, 1.4);                     // front block, over the front wheels
  box(shell, BLUE, 1.76, 0.6, 0.75, 0, 1.25, -1.4);                   // rear block
  box(shell, BLUE, 1.76, 0.25, 1.95, 0, 0.6, 0);                      // sills between the wheels
  box(shell, TAN, 1.5, 0.3, 1.95, 0, 0.85, 0);                        // tan interior tub, seen through the open sides
  for (const z of [0.3, -0.55]) {                                     // two bench seats, tan with a plaid band
    box(shell, TAN, 1.44, 0.16, 0.55, 0, 0.99, z);
    box(shell, TAN, 1.44, 0.6, 0.12, 0, 1.32, z - 0.3);
    box(shell, PLAID, 1.44, 0.14, 0.13, 0, 1.37, z - 0.3);
  }
  box(shell, TAN, 1.5, 0.2, 0.3, 0, 1.4, 0.95);                      // tan dash
  // glass canopy box with a blue frame
  box(shell, GLASS, 1.66, 0.7, 3.4, 0, 1.8, 0);
  box(shell, BLUE, 1.8, 0.12, 3.6, 0, 2.2, 0);                        // roof
  for (const x of [-0.85, 0.85]) for (const z of [-1.72, 1.72]) box(shell, BLUE, 0.12, 0.75, 0.12, x, 1.82, z);
  for (const x of [-0.85, 0.85]) box(shell, BLUE, 0.1, 0.1, 3.5, x, 1.47, 0);   // waist rail under the glass
  // rear: blue panel with two chrome strips and a red light bar; front: a white light bar
  box(shell, CHROME, 1.6, 0.05, 0.03, 0, 1.3, -1.79); box(shell, CHROME, 1.6, 0.05, 0.03, 0, 1.4, -1.79);
  box(shell, LIGHT, 1.3, 0.06, 0.03, 0, 1.18, -1.79);
  box(shell, CHROME, 1.5, 0.07, 0.03, 0, 1.3, 1.79);
  box(frame, mat(shade), 1.5, 0.04, 0.6, 0, 2.27, -0.2).name = 'stripe';   // the player's colour on the roof, to tell carts apart (kept with either body)
  // driver's place (cart's left, front bench) and a tan steering wheel on a column from the dash (refs/cart genesis-4)
  const seat = new THREE.Object3D(); seat.position.set(0.38, 1.15, 0.2); frame.add(seat);
  const wheelC = new THREE.Object3D(), col = new THREE.Vector3(0, 0.34, -0.94).normalize();
  wheelC.position.set(0.38, 1.45, 0.66); wheelC.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), col); frame.add(wheelC);
  wheelC.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 20), TAN));
  box(wheelC, TAN, 0.3, 0.03, 0.02, 0, 0, 0);                         // spoke
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6).rotateX(Math.PI / 2), DARK); column.position.z = -0.17; wheelC.add(column);
  // wheels outboard of the body; coil-overs and lower arms ride with the body
  const spinners: THREE.Object3D[] = [], steer: THREE.Object3D[] = [], wheels: THREE.Object3D[] = [];
  for (const [x, z] of CORNERS) {
    const s = Math.sign(x), { pivot, spinner } = wheel(s); pivot.position.set(x, WHEEL_R, z); root.add(pivot); spinners.push(spinner); wheels.push(pivot);
    if (z > 0) steer.push(pivot);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), STEEL); coil.position.set(s * 0.4, 0.7, z); coil.rotation.z = s * 0.35; frame.add(coil);
    box(frame, STEEL, 0.5, 0.07, 0.12, s * 0.38, WHEEL_R, z);         // lower arm to the hub, inboard of the tyre
  }
  const v: CartView = { root, body, shell, spinners, steer, wheels, seat, wheel: wheelC, spin: 0, ride: restRide() };
  // the generated body replaces the code shell only once its manifest row is PASS (loadRaw gates it); until then the code body stays
  if (load) void loadRaw('cart-body').then(r => { if (r) fitBody(v, r.scene, r.row as BodyFit); });
  return v;
}

/** How a generated body sits (assets/manifest.json row cart-body, in the raw model's units): its turn, the radius of the wheels it
 *  was generated with (cut out by scripts/cut_cart_wheels.mjs) and its tyre-bottom height. */
export interface BodyFit { orient_deg?: number[]; wheel_r?: number; ground_y?: number; stretch_y?: number }
/** Swaps the code shell for a generated body: turned, scaled so its own wheels match the code wheels (WHEEL_R), stretched in height
 *  where the generator squashed the photos' canopy, centred, its tyre bottoms on the ground so the code wheels fill its arches; the
 *  player's roof stripe moves onto its roof. */
export function fitBody(v: CartView, gen: THREE.Object3D, fit: BodyFit = {}) {
  const g = new THREE.Group(); g.add(gen); gen.rotation.set(...((fit.orient_deg ?? [0, 0, 0]).map(d => (d * Math.PI) / 180) as [number, number, number]));
  const k = WHEEL_R / (fit.wheel_r ?? WHEEL_R), ky = k * (fit.stretch_y ?? 1); gen.scale.set(k, ky, k); gen.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(gen), c = b.getCenter(new THREE.Vector3());
  gen.position.set(-c.x, -(fit.ground_y ?? b.min.y / ky) * ky, -c.z);  // rotation is about y only, so raw heights scale straight across
  v.shell.visible = false; v.shell.parent!.add(g);
  const stripe = v.body.getObjectByName('stripe'); if (stripe) stripe.position.y = gen.position.y + b.max.y + 0.01;
  return g;
}

/** Wheels roll with the forward speed (m/s), the front pair turn with steer (-1 left .. 1 right), and the body rides its springs over
 *  the ground (cartmotion.heightAt at each wheel) with pitch from acceleration, roll from the turn rate and a bounce on knocks.
 *  The heading and position come from root (placeCart sets them first): rotation.y = -yaw, position = scene space (x mirrored). */
export function poseCart(v: CartView, speed: number, steer: number, dt: number) {
  const x = -v.root.position.x, z = v.root.position.z, yaw = -v.root.rotation.y;
  const turn = v.last && dt > 0 ? Math.atan2(Math.sin(yaw - v.last.yaw), Math.cos(yaw - v.last.yaw)) / dt : 0;
  if (v.last && Math.hypot(x - v.last.x, z - v.last.z) > 20) v.ride = { ...restRide(), speed };   // teleported (new tee): start at rest
  v.last = { x, z, yaw };
  v.ride = stepRide(v.ride, speed, turn, cornerGround(x, z, yaw), dt);
  v.spin = v.ride.spin;
  for (const s of v.spinners) s.rotation.x = v.spin;
  for (const p of v.steer) p.rotation.y = -steer * 0.45;              // model +x is the cart's left (sim x is mirrored), so right lock is negative
  v.wheels.forEach((w, i) => { w.position.y = WHEEL_R + v.ride.wheelY[i]!; });
  v.body.position.y = WHEEL_R + v.ride.heave; v.body.rotation.set(v.ride.pitch, 0, v.ride.roll);
}
