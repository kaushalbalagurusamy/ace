// Clubs in the golfer's hands (PRD/02 §6, PRD/06 §4). Every club object has its origin at the grip end, the shaft running down -Y
// and the face toward +Z, so the rig can attach it with clubMatrix(). A generated head ships only behind the PASS gate; otherwise
// (or while it loads) a simple code club of the right length and head size stands in.
import * as THREE from 'three';
import { loadRaw } from './assets';

export type ClubKind = 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';
/** length: grip end to sole (m); head: heel-to-toe length (m); lie: degrees between shaft and sole line. */
export interface ClubSpec { model: string; kind: ClubKind; length: number; head: number; lie: number; dark?: boolean }
const IN = 0.0254;
const iron = (inches: number): ClubSpec => ({ model: 'club-iron', kind: 'iron', length: inches * IN, head: 0.077, lie: 62 });
/** By BAG index (ui.ts): standard men's steel lengths; head sizes from the products' published dimensions, rounded. */
export const CLUBS: readonly ClubSpec[] = [
  { model: 'club-driver', kind: 'wood', length: 45.5 * IN, head: 0.122, lie: 58, dark: true },
  { model: 'club-3w', kind: 'wood', length: 43 * IN, head: 0.105, lie: 58, dark: true },
  { model: 'club-ut', kind: 'hybrid', length: 39.5 * IN, head: 0.08, lie: 60 },
  iron(38.5), iron(38), iron(37.5), iron(37), iron(36.5), iron(36), iron(35.75),
  { model: 'club-wedge-50', kind: 'wedge', length: 35.5 * IN, head: 0.078, lie: 64 },
  { model: 'club-wedge-54', kind: 'wedge', length: 35.25 * IN, head: 0.078, lie: 64 },
  { model: 'club-wedge-62', kind: 'wedge', length: 35 * IN, head: 0.08, lie: 64 },
  { model: 'club-putter', kind: 'putter', length: 34 * IN, head: 0.105, lie: 70, dark: true },
];

type V3 = readonly [number, number, number];
/** Places a club (origin at the grip end, shaft -Y, face +Z) with its grip end at `grip`, shaft along `shaft`, face toward `face` (made perpendicular). */
export function clubMatrix(grip: V3, shaft: V3, face: V3, out = new THREE.Matrix4()): THREE.Matrix4 {
  const y = new THREE.Vector3(...shaft).normalize().negate(), f = new THREE.Vector3(...face);
  let z = f.addScaledVector(y, -f.dot(y));
  if (z.lengthSq() < 1e-8) z = new THREE.Vector3(1, 0, 0).addScaledVector(y, -y.x);   // face parallel to the shaft: any perpendicular
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return out.makeBasis(x, y, z).setPosition(grip[0], grip[1], grip[2]);
}

/** Uniform scale that gives a generated head its real heel-to-toe length, from its measured size along the heel-toe axis (x). */
export const headScale = (measured: number, real: number) => (measured > 1e-6 ? real / measured : 1);

const mat = (c: string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const STEEL = mat('#C9CDD2', 0.35, 0.8), BLACK = mat('#2B2E33', 0.5, 0.3), GRIP = mat('#1d1d1d', 0.9);

/** Shaft and grip from the grip end down to `bottom` metres. */
function shaftAndGrip(g: THREE.Group, bottom: number) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, bottom, 8).translate(0, -bottom / 2, 0), STEEL);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0085, 0.27, 10).translate(0, -0.135, 0), GRIP);
  g.add(shaft, grip);
}

/** Code club: a club silhouette of the right length, head size and lie. Toe toward -X, tilted down by (90 - lie). */
export function makeCodeClub(spec: ClubSpec): THREE.Group {
  const g = new THREE.Group(), L = spec.length, h = spec.head, m = spec.dark ? BLACK : STEEL;
  const geo = spec.kind === 'wood' ? new THREE.SphereGeometry(0.5, 14, 8).scale(h, h * (spec.model === 'club-driver' ? 0.5 : 0.36), h * 0.82)
    : spec.kind === 'putter' ? new THREE.BoxGeometry(h, 0.026, h * 0.65)
    : new THREE.BoxGeometry(h, spec.kind === 'hybrid' ? 0.042 : 0.048, spec.kind === 'hybrid' ? 0.03 : 0.012);
  const head = new THREE.Mesh(geo.translate(-h / 2, 0, spec.kind === 'putter' ? -h * 0.2 : 0), m);
  const sole = new THREE.Object3D(); sole.position.y = -L + 0.02; sole.rotation.z = THREE.MathUtils.degToRad(90 - spec.lie); sole.add(head);
  shaftAndGrip(g, L - 0.02); g.add(sole);
  g.traverse(o => { o.castShadow = true; });
  return g;
}

/** Turns a generated head into a club: orientation from its manifest row (hosel up, face +Z, toe -X), real head size, hosel top
 *  under the grip end, plus a code shaft and grip. */
export function fitGeneratedHead(scene: THREE.Object3D, spec: ClubSpec, orientDeg: readonly number[] = [0, 0, 0]): THREE.Group {
  const head = new THREE.Group(); head.add(scene);
  const r = THREE.MathUtils.degToRad; scene.rotation.set(r(orientDeg[0] ?? 0), r(orientDeg[1] ?? 0), r(orientDeg[2] ?? 0));
  head.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head), size = box.getSize(new THREE.Vector3());
  head.scale.setScalar(headScale(size.x, spec.head)); head.updateMatrixWorld(true);
  // hosel top = the highest vertex: it goes straight under the grip end, the sole sits at -length
  const top = new THREE.Vector3(0, -Infinity, 0), v = new THREE.Vector3();
  head.traverse(o => {
    const p = (o as THREE.Mesh).geometry?.attributes?.position; if (!(o as THREE.Mesh).isMesh || !p) return;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y > top.y) top.copy(v); }
  });
  const b2 = new THREE.Box3().setFromObject(head);
  head.position.set(-top.x, -spec.length - b2.min.y, -top.z);
  const g = new THREE.Group(); shaftAndGrip(g, spec.length - (top.y - b2.min.y)); g.add(head);
  g.traverse(o => { o.castShadow = true; });
  return g;
}

/** The club for a BAG slot: the generated model if its manifest row is PASS, else null (callers keep the code club). */
export async function loadClub(spec: ClubSpec): Promise<THREE.Object3D | null> {
  const r = await loadRaw(spec.model);
  return r ? fitGeneratedHead(r.scene, spec, r.row.orient_deg) : null;
}
