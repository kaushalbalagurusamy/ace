// Code-built Genesis Box Buggy (PRD/07, refs/cart): stylised low-poly per assets/STYLE.md. 1 unit = 1 m, Y up, origin at the
// ground centre, facing +Z. A tall glass-canopy box in dark blue, tan bench seats, a rear panel with chrome strips and a light bar,
// and chunky knobby wheels standing outboard on exposed coil-over suspension.
import * as THREE from 'three';

export interface CartView { root: THREE.Group; spinners: THREE.Object3D[]; steer: THREE.Object3D[]; spin: number }

const WHEEL_R = 0.45;
const mat = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const BLUE = mat('#2E4570'), DARK = mat('#1E2430'), TAN = mat('#C9A77C'), PLAID = mat('#8E6B4A'), CHROME = mat('#E4E8EE'), STEEL = mat('#7A8088');
const TYRE = mat('#24262A'), HUB = mat('#B9BEC5'), LIGHT = mat('#E0463C');
const GLASS = new THREE.MeshLambertMaterial({ color: '#3A5A8C', transparent: true, opacity: 0.35, depthWrite: false });

function box(g: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b;
}

function wheel(): { pivot: THREE.Group; spinner: THREE.Group } {
  const pivot = new THREE.Group(), spinner = new THREE.Group(); pivot.add(spinner);
  spinner.add(new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.42, 14).rotateZ(Math.PI / 2), TYRE));
  for (let i = 0; i < 14; i++) {                                      // knobby tread: staggered lugs round the tyre
    const a = (i / 14) * Math.PI * 2, lug = box(spinner, TYRE, 0.18, 0.07, 0.12, i % 2 ? 0.1 : -0.1, Math.cos(a) * (WHEEL_R + 0.02), Math.sin(a) * (WHEEL_R + 0.02));
    lug.rotation.x = a;
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.44, 8).rotateZ(Math.PI / 2), HUB); spinner.add(hub);
  box(spinner, DARK, 0.46, 0.07, 0.46, 0, 0, 0);                  // hub spokes, so the spin reads
  return { pivot, spinner };
}

export function makeCart(shade: string): CartView {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // chassis and the open side tub
  box(body, DARK, 1.4, 0.18, 2.7, 0, 0.55, 0);
  box(body, BLUE, 1.76, 0.62, 0.62, 0, 1.0, 1.25);                    // front block
  box(body, BLUE, 1.76, 0.7, 0.6, 0, 1.04, -1.26);                    // rear block
  box(body, BLUE, 1.76, 0.16, 1.9, 0, 0.74, 0);                       // sills
  box(body, TAN, 1.5, 0.3, 1.9, 0, 0.9, 0);                           // tan interior tub, seen through the open sides
  for (const z of [0.3, -0.55]) {                                     // two bench seats, tan with a plaid band
    box(body, TAN, 1.44, 0.16, 0.55, 0, 1.12, z);
    box(body, TAN, 1.44, 0.6, 0.12, 0, 1.45, z - 0.3);
    box(body, PLAID, 1.44, 0.14, 0.13, 0, 1.5, z - 0.3);
  }
  box(body, TAN, 1.5, 0.22, 0.25, 0, 1.38, 0.95);                    // tan dash
  // glass canopy box with a blue frame
  box(body, GLASS, 1.66, 0.8, 2.86, 0, 1.75, 0);
  box(body, BLUE, 1.8, 0.12, 3.12, 0, 2.2, 0);                        // roof
  box(body, mat(shade), 1.82, 0.04, 0.6, 0, 2.27, -1.1);              // the player's colour on the roof, to tell carts apart
  for (const x of [-0.85, 0.85]) for (const z of [-1.5, 1.5]) box(body, BLUE, 0.12, 0.9, 0.12, x, 1.75, z);
  for (const x of [-0.85, 0.85]) box(body, BLUE, 0.1, 0.1, 3.0, x, 1.33, 0);   // waist rail under the glass
  // rear: blue panel with two chrome strips and a red light bar; front: a white light bar
  box(body, CHROME, 1.6, 0.05, 0.03, 0, 1.18, -1.57); box(body, CHROME, 1.6, 0.05, 0.03, 0, 1.28, -1.57);
  box(body, LIGHT, 1.3, 0.06, 0.03, 0, 1.08, -1.57);
  box(body, CHROME, 1.5, 0.07, 0.03, 0, 1.2, 1.57);
  // wheels outboard of the body on exposed coil-overs
  const spinners: THREE.Object3D[] = [], steer: THREE.Object3D[] = [];
  for (const z of [1.2, -1.2]) for (const s of [-1, 1]) {
    const { pivot, spinner } = wheel(); pivot.position.set(s * 1.02, WHEEL_R, z); root.add(pivot); spinners.push(spinner);
    if (z > 0) steer.push(pivot);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6), STEEL); coil.position.set(s * 0.72, 0.8, z); coil.rotation.z = s * 0.35; root.add(coil);
    box(root, STEEL, 0.4, 0.07, 0.12, s * 0.72, WHEEL_R, z);           // lower arm to the hub
  }
  return { root, spinners, steer, spin: 0 };
}

/** Wheels roll with the forward speed (m/s) and the front pair turn with steer (-1 left .. 1 right). */
export function poseCart(v: CartView, speed: number, steer: number, dt: number) {
  v.spin = (v.spin + (speed * dt) / WHEEL_R) % (Math.PI * 2);
  for (const s of v.spinners) s.rotation.x = v.spin;
  for (const p of v.steer) p.rotation.y = -steer * 0.45;              // model +x is the cart's left (sim x is mirrored), so right lock is negative
}
