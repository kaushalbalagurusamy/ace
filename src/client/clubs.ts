// Clubs in the golfer's hands (PRD/02 §6, PRD/06 §4). Every club object has its origin at the grip end, the shaft running down -Y
// and the face toward +Z, so the rig can attach it with clubMatrix(). A generated head ships only behind the PASS gate; otherwise
// (or while it loads) a simple code club of the right length and head size stands in.
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { loadRaw } from './assets';

export type ClubKind = 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';
/** length: grip end to sole (m); head: heel-to-toe length (m); lie: degrees between shaft and sole line; loft: degrees;
 *  stamp: text engraved on the toe of the back. */
export interface ClubSpec { model: string; kind: ClubKind; length: number; head: number; lie: number; loft: number; dark?: boolean; stamp?: string }
const IN = 0.0254;
const iron = (inches: number, loft: number): ClubSpec => ({ model: 'club-iron', kind: 'iron', length: inches * IN, head: 0.077, lie: 62, loft });
/** By BAG index (ui.ts): driver 45.5", 3W 43", UT 39.5", 4i 38.5" down 0.5" per iron, wedges 35.5", putter 34"; head sizes from
 *  the products' published dimensions, rounded; lofts from PRD/02 §1. */
export const CLUBS: readonly ClubSpec[] = [
  { model: 'club-driver', kind: 'wood', length: 45.5 * IN, head: 0.122, lie: 58, loft: 8, dark: true },
  { model: 'club-3w', kind: 'wood', length: 43 * IN, head: 0.105, lie: 58, loft: 15, dark: true },
  { model: 'club-ut', kind: 'hybrid', length: 39.5 * IN, head: 0.08, lie: 60, loft: 18, stamp: '18°' },
  iron(38.5, 23), iron(38, 26), iron(37.5, 30), iron(37, 34), iron(36.5, 38), iron(36, 42), iron(35.5, 46),
  { model: 'club-wedge-50', kind: 'wedge', length: 35.5 * IN, head: 0.078, lie: 64, loft: 50, stamp: '50' },
  { model: 'club-wedge-54', kind: 'wedge', length: 35.5 * IN, head: 0.078, lie: 64, loft: 54, stamp: '54' },
  { model: 'club-wedge-62', kind: 'wedge', length: 35.5 * IN, head: 0.08, lie: 64, loft: 62, stamp: '62' },
  { model: 'club-putter', kind: 'putter', length: 34 * IN, head: 0.105, lie: 70, loft: 3, dark: true },
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
function shaftAndGrip(g: THREE.Group, bottom: number, black = false) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, bottom, 8).translate(0, -bottom / 2, 0), black ? BLACK : STEEL);
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
  shaftAndGrip(g, L - 0.02, spec.kind === 'putter'); g.add(sole);
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
  const b2 = new THREE.Box3().setFromObject(head), hoselTop = spec.length - (top.y - b2.min.y);
  head.position.set(-top.x, -spec.length - b2.min.y, -top.z); head.updateMatrixWorld(true);
  // hosel radius just under its top: a ferrule tapers from it to the shaft, closing the step
  let rTop = 0.006;
  head.traverse(o => {
    const p = (o as THREE.Mesh).geometry?.attributes?.position; if (!(o as THREE.Mesh).isMesh || !p) return;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y > -hoselTop - 0.015) rTop = Math.max(rTop, Math.hypot(v.x, v.z)); }
  });
  const black = spec.kind === 'putter', g = new THREE.Group();
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, Math.min(rTop, 0.0075), 0.03, 12).translate(0, -hoselTop + 0.015, 0), black ? BLACK : GRIP);
  shaftAndGrip(g, hoselTop - 0.03, black); g.add(ferrule, head);
  dressHead(head, spec);
  g.traverse(o => { o.castShadow = true; });
  return g;
}

/** Chrome (metalness 1, low roughness, a code environment map) for irons, wedges, the UT and the putter body, a gloss coat for the
 *  woods. Irons, wedges and the UT get a separate grooved face (triangles facing the loft direction), so the back's texture no
 *  longer shows mirrored on the face; lofts are stamped on the toe of the back. `head` sits in the club frame. */
function dressHead(head: THREE.Object3D, spec: ClubSpec) {
  const envMap = chromeEnv(), loft = THREE.MathUtils.degToRad(spec.loft), faced = spec.kind === 'iron' || spec.kind === 'wedge' || spec.kind === 'hybrid';
  const faceDir = new THREE.Vector3(0, Math.sin(loft), Math.cos(loft));
  head.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = []; head.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    const old = m.material as THREE.MeshStandardMaterial, wood = spec.kind === 'wood';
    const body = new THREE.MeshStandardMaterial({ map: old.map, envMap, metalness: wood ? 0.25 : spec.kind === 'putter' ? 0.7 : 1, roughness: wood ? 0.3 : 0.22, envMapIntensity: wood ? 0.6 : 1 });
    if (!faced) { m.material = body; continue; }
    const split = splitFace(m, faceDir);
    m.geometry = split; m.material = [body, groovedFace(envMap, m)];
  }
  if (spec.stamp && meshes[0]) stamp(meshes[0], head, spec.stamp, spec.kind === 'wedge');
}

/** Re-orders a mesh's triangles into two groups: 0 = the rest, 1 = those whose normal (club frame) is within ~50° of `dir`. */
export function splitFace(m: THREE.Mesh, dir: THREE.Vector3): THREE.BufferGeometry {
  const geo = m.geometry.clone(), pos = geo.attributes.position!, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  const idx = geo.index ?? new THREE.BufferAttribute(Uint32Array.from({ length: pos.count }, (_, i) => i), 1);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), face: number[] = [], rest: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    n.subVectors(c, b).cross(a.sub(b)).applyMatrix3(nm).normalize();
    (n.dot(dir) > 0.65 ? face : rest).push(i0, i1, i2);
  }
  geo.setIndex([...rest, ...face]); geo.clearGroups(); geo.addGroup(0, rest.length, 0); geo.addGroup(rest.length, face.length, 1);
  return geo;
}

let env: THREE.CubeTexture | null = null;
/** A small neutral studio cube map painted in code (no HDR file): enough for chrome to read as chrome. */
export function chromeEnv(): THREE.CubeTexture {
  if (env) return env;
  const face = (top: string, bottom: string) => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, gr = x.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
  };
  const side = face('#f4f6f8', '#5a5e63');   // neutral studio gradient: tinted skies turned the chrome green
  env = new THREE.CubeTexture([side, side, face('#ffffff', '#e8f2fa'), face('#3c3f43', '#3c3f43'), side, side]);
  env.colorSpace = THREE.SRGBColorSpace; env.needsUpdate = true;
  return env;
}

/** Chrome face with score lines every 3.6 mm parallel to the sole, from each fragment's club-frame height. */
function groovedFace(envMap: THREE.CubeTexture, m: THREE.Mesh) {
  const mat = new THREE.MeshStandardMaterial({ color: '#dfe3e7', metalness: 1, roughness: 0.3, envMap });
  const s = new THREE.Vector3(); m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(new THREE.Matrix4().copy(m.matrixWorld).invert());   // club up, in mesh space
  mat.onBeforeCompile = sh => {
    sh.uniforms.uUp = { value: up }; sh.uniforms.uStep = { value: 0.0036 / s.y };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH; uniform vec3 uUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = dot(position, uUp);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH; uniform float uStep;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  { float f = fract(vH / uStep); diffuseColor.rgb *= mix(0.35, 1.0, smoothstep(0.1, 0.2, f) * (1.0 - smoothstep(0.8, 0.9, f))); }');
  };
  return mat;
}

/** Engraves `text` on the toe of the back (the club frame's -Z side, toe toward -X) as a projected decal. */
function stamp(mesh: THREE.Mesh, head: THREE.Object3D, text: string, mirror = false) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d')!;
  if (mirror) { x.translate(128, 0); x.scale(-1, 1); }   // shortcut: the wedge meshes' back faces the other way to the UT's; mirror the text rather than find each mesh's back
  x.fillStyle = '#16181b'; x.font = 'bold 46px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 34);
  head.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head), w = box.max.x - box.min.x, d = box.max.z - box.min.z;
  const at = new THREE.Vector3(box.min.x + 0.3 * w, box.min.y + 0.032, box.min.z + 0.25 * d);   // toe, a little above the sole
  const geo = new DecalGeometry(mesh, at, new THREE.Euler(0, 0, Math.PI), new THREE.Vector3(0.026, 0.013, d * 0.5));
  const decal = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5 }));
  const root = head.parent ?? head; root.updateMatrixWorld(true); head.attach(decal);   // built in world space; attach keeps it in place
}

/** The club for a BAG slot: the generated model if its manifest row is PASS, else null (callers keep the code club). */
export async function loadClub(spec: ClubSpec): Promise<THREE.Object3D | null> {
  const r = await loadRaw(spec.model);
  return r ? fitGeneratedHead(r.scene, spec, r.row.orient_deg) : null;
}
