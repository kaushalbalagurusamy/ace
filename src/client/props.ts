// Code-built low-poly props in the assets/STYLE.md palette (a "made with code" asset route): flat-shaded, seeded, no textures.
// Triangle budgets: tree <= 3000, rock <= 2000 (checked in tests/props.test.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PAL = {
  cypress: ['#2F4A3A', '#3A5C46', '#284236'], pine: ['#3D5A3A', '#35502F', '#456843'], bark: '#5B4636', barkDark: '#4A382B',
  rock: ['#8A8F8C', '#7C817E', '#6F7570'], lichen: '#9AA37A',
  oak: ['#3E5B2E', '#4A6A35', '#35502A'], maple: ['#56702F', '#6B7A33', '#4F6A2C'],
};
const mats = new Map<string, THREE.MeshLambertMaterial>();
const mat = (c: string) => { let m = mats.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); mats.set(c, m); } return m; };
function prng(seed: number) { let s = (seed * 2654435761) >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** A faceted blob: icosahedron (detail 1 = 80 faces) with seeded vertex jitter, squashed by (sx, sy, sz). */
function blob(r: number, sx: number, sy: number, sz: number, jitter: number, rnd: () => number, color: string) {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position as THREE.BufferAttribute;
  const salt = rnd() * 1000;   // vertices that share a position (non-indexed faces) must move together or the mesh tears
  const h = (x: number, y: number, z: number) => { const v = Math.sin(Math.round(x * 97) * 12.9898 + Math.round(y * 97) * 78.233 + Math.round(z * 97) * 37.719 + salt) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < p.count; i++) { const k = 1 + (h(p.getX(i), p.getY(i), p.getZ(i)) - 0.5) * jitter; p.setXYZ(i, p.getX(i) * k * sx, p.getY(i) * k * sy, p.getZ(i) * k * sz); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color));
}
const trunk = (h: number, r0: number, r1: number, lean: number, color = PAL.bark) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 7, 1).translate(0, h / 2, 0), mat(color)); m.rotation.z = -lean; return m;
};

/** A bare, leaning branch (cylinder) from the trunk top outwards, for the wind-sculpted cypress silhouette. */
function branch(x0: number, y0: number, len: number, angleUp: number, dir: number, r: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r, len, 5, 1).translate(0, len / 2, 0), mat(PAL.barkDark));
  m.position.set(x0, y0, 0); m.rotation.z = -Math.PI / 2 + angleUp; m.rotation.y = dir; return m;
}
/** Monterey cypress: a long, bare, leaning trunk with a few twisted branches, and a flat-topped crown of feathery foliage planes swept
 *  downwind (+x), not a symmetric dome. variant 0: about 12 m and more leaning; variant 1: about 9 m with a flatter, wider top. */
export function makeCypress(variant: number): THREE.Group {
  const rnd = prng(101 + variant * 17), g = new THREE.Group(), H = variant ? 9 : 12, lean = variant ? 0.14 : 0.24, tall = variant ? 0.6 : 0.5;
  g.add(trunk(H * tall, 0.55, 0.22, lean, PAL.barkDark));
  const topX = Math.sin(lean) * H * tall, topY = Math.cos(lean) * H * tall;
  for (let i = 0; i < 3; i++) g.add(branch(topX * (0.5 + i * 0.25), topY * (0.55 + i * 0.2), H * (0.22 + rnd() * 0.12), 0.5 + rnd() * 0.5, 0, 0.14));
  const planes = variant ? 5 : 6;
  for (let i = 0; i < planes; i++) {
    // organic, overlapping foliage masses of different sizes, spread unevenly downwind (+x) and sideways instead of a neat stack
    const t = i / (planes - 1), y = topY + H * (0.02 + t * (variant ? 0.26 : 0.38)) + (rnd() - 0.5) * H * 0.08;
    const reach = H * (0.3 - t * 0.1) * (0.8 + rnd() * 0.5), size = reach * (0.45 + rnd() * 0.25);
    const b = blob(size, 1.7 + rnd() * 0.5, variant ? 0.36 : 0.45, 1.2 + rnd() * 0.4, 0.55, rnd, PAL.cypress[i % 3]!);
    b.position.set(topX + reach * (0.15 + 0.7 * rnd()) + t * H * 0.1, y, (rnd() - 0.5) * H * 0.34); b.rotation.y = rnd() * 3; g.add(b);
  }
  return g;
}
/** Monterey pine: tall tapered trunk with a root flare and an umbrella crown of stacked, flattened clumps in the top third. */
export function makePine(): THREE.Group {
  const rnd = prng(303), g = new THREE.Group(), H = 15;
  g.add(trunk(H * 0.82, 0.55, 0.17, 0.02));
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 0.9, 7, 1).translate(0, 0.45, 0), mat(PAL.bark)); g.add(flare);
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 5 - layer; i++) {
    const a = (i / (5 - layer)) * Math.PI * 2 + rnd() * 0.6, rad = H * (0.2 - layer * 0.05) * (0.6 + rnd() * 0.6), y = H * (0.74 + layer * 0.09);
    const b = blob(H * 0.15, 1.5, 0.5, 1.5, 0.3, rnd, PAL.pine[(i + layer) % 3]!); b.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); g.add(b);
  }
  return g;
}
/** Parkland deciduous tree (Bethpage, Aronimink): a short thick trunk and a broad rounded crown of overlapping clumps.
 *  oak: about 16 m, very wide and low-domed; maple: about 13 m, taller than wide. The crown clumps are merged into one mesh per
 *  colour so a dense tree line stays cheap (3 meshes a tree). */
export function makeDeciduous(kind: 'oak' | 'maple', variant: number): THREE.Group {
  const rnd = prng(707 + variant * 23 + (kind === 'oak' ? 0 : 400)), g = new THREE.Group(), oak = kind === 'oak';
  // the crown starts low (about a fifth of the height) so a tree line reads as foliage from the tee, not a stand of poles
  const H = oak ? 15 + variant * 2 : 12 + variant * 1.5, crownY = H * (oak ? 0.5 : 0.56), R = H * (oak ? 0.42 : 0.3);
  g.add(trunk(H * 0.36, oak ? 0.55 : 0.38, oak ? 0.3 : 0.22, (rnd() - 0.5) * 0.08));
  const byColour: THREE.BufferGeometry[][] = [[], []], cols = oak ? PAL.oak : PAL.maple;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.5, d = i === 0 ? 0 : R * (0.45 + rnd() * 0.35);
    const b = blob(R * (i === 0 ? 0.8 : 0.55 + rnd() * 0.2), 1.1, oak ? 0.85 : 1.15, 1.1, 0.45, rnd, cols[0]!);
    b.position.set(Math.cos(a) * d, crownY + (i === 0 ? R * 0.25 : (rnd() - 0.3) * R * 0.5), Math.sin(a) * d); b.updateMatrix();
    byColour[i % 2]!.push(b.geometry.applyMatrix4(b.matrix));
  }
  byColour.forEach((gs, k) => g.add(new THREE.Mesh(mergeGeometries(gs), mat(cols[k + 1]!))));
  return g;
}
/** Coastal granite. variant 0: a cluster of three rounded boulders; 1: a tall angular outcrop of leaning prisms with a flat base; 2: one smooth sea-worn boulder.
 *  Lichen patches are larger and sit on the upper faces so they read at distance. */
export function makeRock(variant: number): THREE.Group {
  const rnd = prng(505 + variant * 31), g = new THREE.Group();
  const lichen = (x: number, y: number, z: number, r: number) => { const l = blob(r, 1.2, 0.25, 1, 0.4, rnd, PAL.lichen); l.position.set(x, y, z); g.add(l); };
  if (variant === 1) {
    for (let i = 0; i < 3; i++) {
      const h = 3.2 - i * 0.7, geo = new THREE.CylinderGeometry(0.5 + rnd() * 0.3, 0.9 + rnd() * 0.3, h, 5 + (i % 2), 3).translate(0, h / 2, 0);
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) { const hsh = Math.sin(Math.round(p.getX(k) * 53) * 12.9 + Math.round(p.getY(k) * 53) * 78.2 + Math.round(p.getZ(k) * 53) * 37.7 + i * 9) * 43758.5; const f = hsh - Math.floor(hsh); p.setX(k, p.getX(k) * (0.85 + f * 0.3)); p.setZ(k, p.getZ(k) * (0.85 + f * 0.3)); }
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat(PAL.rock[i % 3]!)); m.position.set((i - 1) * 0.9, 0, i * 0.4); m.rotation.z = (i - 1) * 0.12; g.add(m);
      lichen((i - 1) * 0.9 - 0.15, h - 0.1, i * 0.4, 0.35);
    }
    return g;
  }
  const n = variant === 0 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const r = (variant === 0 ? 0.9 : 1.2) * (1 - i * 0.2), sy = 0.75, b = blob(r, 1.15 + rnd() * 0.3, sy, 1 + rnd() * 0.3, variant === 2 ? 0.22 : 0.6, rnd, PAL.rock[(i + variant) % 3]!);
    b.position.set(i * r * 1.2 * (rnd() < 0.5 ? -1 : 1), r * sy * 0.95, i * r * 0.5); g.add(b);
    lichen(b.position.x + r * 0.25, b.position.y + r * sy * 0.72, b.position.z, r * 0.42); lichen(b.position.x - r * 0.4, b.position.y + r * sy * 0.5, b.position.z + r * 0.3, r * 0.28);
  }
  return g;
}
export type PropKind = 'cypress' | 'pine' | 'rock' | 'oak' | 'maple';
const templates = new Map<string, THREE.Group>();
/** One cached template per variant; callers clone it (clones share geometry and materials, so 180 props stay cheap). */
export function makeProp(kind: PropKind, i: number): THREE.Group {
  const key = `${kind}:${kind === 'pine' ? 0 : i % (kind === 'rock' ? 3 : 2)}`; let t = templates.get(key);
  if (!t) { t = kind === 'cypress' ? makeCypress(i % 2) : kind === 'pine' ? makePine() : kind === 'rock' ? makeRock(i % 3) : makeDeciduous(kind, i % 2); templates.set(key, t); }
  return t.clone();
}
export function triangles(o: THREE.Object3D): number { let t = 0; o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) t += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count) / 3; }); return t; }
