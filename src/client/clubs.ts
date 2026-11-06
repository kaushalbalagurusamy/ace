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
const STEEL = mat('#C9CDD2', 0.35, 0.8), BLACK = mat('#2B2E33', 0.5, 0.3), GRIP = mat('#1d1d1d', 0.9), GLOSS_BLACK = mat('#0e0f11', 0.18, 0.4);

/** Shaft and grip from the grip end down to `bottom` metres. */
function shaftAndGrip(g: THREE.Group, bottom: number, black = false) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, bottom, 8).translate(0, -bottom / 2, 0), black ? GLOSS_BLACK : STEEL);
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

/** Turns a generated head into a club: orientation from its manifest row (hosel up, face +Z, toe -X), real head size, the hosel's
 *  axis under the grip end with a ferrule seated on the shaft, plus a code shaft and grip. */
export function fitGeneratedHead(scene: THREE.Object3D, spec: ClubSpec, orientDeg: readonly number[] = [0, 0, 0]): THREE.Group {
  const head = new THREE.Group(); head.add(scene);
  const r = THREE.MathUtils.degToRad; scene.rotation.set(r(orientDeg[0] ?? 0), r(orientDeg[1] ?? 0), r(orientDeg[2] ?? 0));
  head.updateMatrixWorld(true);
  head.scale.setScalar(headScale(vertexBox(head).getSize(new THREE.Vector3()).x, spec.head)); head.updateMatrixWorld(true);
  const putter = spec.kind === 'putter';
  if (putter) {   // the generated putter's own shaft is thin and kinked: drop everything 3.5 cm above the sole, a code shaft replaces it
    const floor = vertexBox(head).min.y + 0.035;
    eachMesh(head, m => { m.geometry = regroup(m, (_n, c) => (c.y > floor ? -1 : 0)); });
  }
  // hosel axis = the centre of the vertices within 1 cm of the top; its radius there sizes the ferrule
  const b2 = vertexBox(head), c = new THREE.Vector3(), near: THREE.Vector3[] = [];
  eachVertex(head, v => { if (v.y > b2.max.y - 0.01) near.push(v.clone()); });
  near.forEach(v => c.add(v)); c.divideScalar(Math.max(1, near.length));
  const rTop = Math.min(0.0075, Math.max(0.0062, ...near.map(v => Math.hypot(v.x - c.x, v.z - c.z))));
  const hoselTop = spec.length - (b2.max.y - b2.min.y);
  head.position.set(-c.x, -spec.length - b2.min.y, -c.z); head.updateMatrixWorld(true);
  const g = new THREE.Group(), ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.006, rTop, 0.03, 12).translate(0, -hoselTop + 0.015, 0), putter ? GLOSS_BLACK : GRIP);
  shaftAndGrip(g, hoselTop - 0.03, putter); g.add(ferrule, head);
  dressHead(head, spec);
  g.traverse(o => { o.castShadow = true; });
  return g;
}

const eachMesh = (o: THREE.Object3D, f: (m: THREE.Mesh) => void) => o.traverse(x => { if ((x as THREE.Mesh).isMesh) f(x as THREE.Mesh); });
/** Every vertex that an index still uses, in world space (dropped triangles don't count). */
function eachVertex(o: THREE.Object3D, f: (v: THREE.Vector3) => void) {
  const v = new THREE.Vector3();
  eachMesh(o, m => {
    const p = m.geometry.attributes.position!, idx = m.geometry.index;
    const n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i++) f(v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld));
  });
}
const vertexBox = (o: THREE.Object3D) => { const b = new THREE.Box3(); o.updateMatrixWorld(true); eachVertex(o, v => b.expandByPoint(v)); return b; };

/** Matte black putter head with the white face insert, chrome irons, wedges and UT with a separate grooved face (only the front
 *  of the blade, below the hosel), a gloss coat for the woods; small loft stamps on the toe. `head` sits in the club frame. */
function dressHead(head: THREE.Object3D, spec: ClubSpec) {
  const envMap = chromeEnv(), faced = spec.kind === 'iron' || spec.kind === 'wedge' || spec.kind === 'hybrid';
  head.updateMatrixWorld(true);
  const box = vertexBox(head), soleY = box.min.y;
  eachMesh(head, m => {
    const old = m.material as THREE.MeshStandardMaterial;
    if (spec.kind === 'wood') { m.material = new THREE.MeshStandardMaterial({ map: old.map, envMap, metalness: 0.25, roughness: 0.3, envMapIntensity: 0.6 }); return; }
    if (spec.kind === 'putter') {
      m.geometry = regroup(m, (n, c) => (n.z > 0.7 && c.z > box.max.z - 0.012 ? 1 : 0));   // the flat front face = the insert
      m.material = [new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.75, metalness: 0.2 }), new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.6 })];
      return;
    }
    const body = new THREE.MeshStandardMaterial({ map: old.map, envMap, metalness: 1, roughness: 0.22 });
    if (!faced) { m.material = body; return; }
    // the face: forward-facing triangles on the blade (toe side of the hosel, below its neck)
    m.geometry = regroup(m, (n, c) => (n.z > 0.3 && c.x < -0.012 && c.y < soleY + 0.06 ? 1 : 0));
    m.material = [body, groovedFace(envMap, m)];
  });
  if (spec.kind === 'putter') sightline(head, box);
  const first = head.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;
  if (spec.stamp && first) stamp(first, head, spec.stamp, spec.kind === 'wedge');
}

/** T sightline on the putter's top: a line back from the face and a cross tick along it. */
function sightline(head: THREE.Object3D, box: THREE.Box3) {
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), y = box.max.y + 0.0006, cx = (box.min.x + box.max.x) / 2, d = box.max.z - box.min.z;
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.001, d * 0.55), white); line.position.set(cx, y, box.max.z - 0.012 - d * 0.275);
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.001, 0.003), white); tick.position.set(cx, y, box.max.z - 0.012);
  const root = new THREE.Group(); root.add(line, tick); head.parent ? head.parent.updateMatrixWorld(true) : 0; head.attach(root);
}

/** Re-orders a mesh's triangles by `classify(normal, centroid)` (club frame): 0 = body, 1 = second material, -1 = dropped. */
export function regroup(m: THREE.Mesh, classify: (n: THREE.Vector3, c: THREE.Vector3) => number): THREE.BufferGeometry {
  const geo = m.geometry.clone(), pos = geo.attributes.position!, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  const idx = geo.index ?? new THREE.BufferAttribute(Uint32Array.from({ length: pos.count }, (_, i) => i), 1);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), mid = new THREE.Vector3(), out: number[][] = [[], []];
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
    mid.copy(a).add(b).add(c).divideScalar(3);
    n.subVectors(c, b).cross(a.sub(b)).normalize();
    const k = classify(n, mid); if (k >= 0) out[k]!.push(i0, i1, i2);
  }
  geo.setIndex([...out[0]!, ...out[1]!]); geo.clearGroups(); geo.addGroup(0, out[0]!.length, 0); geo.addGroup(out[0]!.length, out[1]!.length, 1);
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
  const at = new THREE.Vector3(box.min.x + 0.13 * w, box.min.y + 0.028, box.min.z + 0.25 * d);   // a small stamp on the toe
  const geo = new DecalGeometry(mesh, at, new THREE.Euler(0, 0, Math.PI), new THREE.Vector3(0.017, 0.0085, d * 0.5));
  const decal = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5 }));
  const root = head.parent ?? head; root.updateMatrixWorld(true); head.attach(decal);   // built in world space; attach keeps it in place
}

/** The club for a BAG slot: the generated model if its manifest row is PASS, else null (callers keep the code club). */
export async function loadClub(spec: ClubSpec): Promise<THREE.Object3D | null> {
  const r = await loadRaw(spec.model);
  return r ? fitGeneratedHead(r.scene, spec, r.row.orient_deg) : null;
}
