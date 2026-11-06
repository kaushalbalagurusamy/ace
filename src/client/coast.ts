// The coastline and the backdrop, code-generated from each hole's sea field (docs/research/pebble-look.md "Coastline"):
// cliff faces extruded down to the water along the land/sea contour (triplanar, with the generated cliff texture and a normal
// map derived from it here), the stone sea wall on 18, a generic low cream building cluster behind the 18th green (not a replica
// of the Lodge), a hazy far shore across the bay and a tree line on the inland horizon. Separate from terrain.ts on purpose.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRIDS } from '../shared/course-grid';
import { ground, seaField, seaY } from './terrain';
import { loadTexture } from './assets';
import { HAZE } from './environment';

const hash3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
/** Smooth 3D value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const s = (t: number) => t * t * (3 - 2 * t), u = s(fx), v = s(fy), w = s(fz);
  const L = (a: number, b: number, t: number) => a + (b - a) * t, h = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz);
  return 2 * L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w) - 1;
}

/** Land/sea contour of a hole in sim metres: marching squares over the cell-centre sea values at 0.5. Each segment is [ax, az, bx, bz]
 *  wound so the sea lies on its right (the seaward normal is (dz, -dx) / |d|). */
export const shoreSegments = (hole: number) => maskSegments(hole, seaField(hole).sea);
/** Marching squares over any per-cell 0/1 field of a hole (1 on the right of each segment). */
export function maskSegments(hole: number, sea: ArrayLike<number>): number[][] {
  const g = GRIDS[hole]!, out: number[][] = [];
  const v = (x: number, z: number) => sea[Math.min(g.nz - 1, Math.max(0, z)) * g.nx + Math.min(g.nx - 1, Math.max(0, x))]!;
  const P = (x: number, z: number): [number, number] => [g.x0 + (x + 0.5) * g.cell, g.z0 + (z + 0.5) * g.cell];
  for (let z = 0; z < g.nz - 1; z++) for (let x = 0; x < g.nx - 1; x++) {
    const a = v(x, z), b = v(x + 1, z), c = v(x + 1, z + 1), d = v(x, z + 1), k = a + b * 2 + c * 4 + d * 8;
    if (k === 0 || k === 15) continue;
    const [x0, z0] = P(x, z), h = g.cell / 2;
    const e: [number, number][] = [[x0 + h, z0], [x0 + g.cell, z0 + h], [x0 + h, z0 + g.cell], [x0, z0 + h]];   // bottom, right, top, left edge midpoints
    // edge pairs per case (corner order a=(0,0) b=(1,0) c=(1,1) d=(0,1)); saddles split toward the sea
    const T: Record<number, [number, number][]> = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [1, 0]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 3], [2, 1]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]] };
    for (const [i, j] of T[k]!) {
      const s = [e[i]![0]!, e[i]![1]!, e[j]![0]!, e[j]![1]!];
      // orient: sea on the right of a->b
      const mx = (s[0]! + s[2]!) / 2, mz = (s[1]! + s[3]!) / 2, dx = s[2]! - s[0]!, dz = s[3]! - s[1]!, len = Math.hypot(dx, dz) || 1;
      const px = mx + (dz / len) * 0.5, pz = mz - (dx / len) * 0.5, ix = Math.floor((px - g.x0) / g.cell - 0.5 + 0.5), iz = Math.floor((pz - g.z0) / g.cell - 0.5 + 0.5);
      if (v(ix, iz) < 0.5) out.push([s[2]!, s[3]!, s[0]!, s[1]!]); else out.push(s);
    }
  }
  return out;
}

/** `top(x, z)`: the face's top in three y at a sim point (the turf edge there); it runs down to `bottom`. */
interface FaceOpts { top: (x: number, z: number) => number; bottom: number; batter: number; rough: number; rows: number }
/** A displaced vertical skirt along the segments (sim space in, three space out: x mirrored). Shared endpoints move together. */
export function extrudeShore(segs: number[][], o: FaceOpts): THREE.BufferGeometry {
  const key = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`, nrm = new Map<string, [number, number]>();
  for (const s of segs) {
    const dx = s[2]! - s[0]!, dz = s[3]! - s[1]!, l = Math.hypot(dx, dz) || 1, n: [number, number] = [dz / l, -dx / l];
    for (const k of [key(s[0]!, s[1]!), key(s[2]!, s[3]!)]) { const a = nrm.get(k) ?? [0, 0]; nrm.set(k, [a[0] + n[0], a[1] + n[1]]); }
  }
  const pos: number[] = [];
  const vert = (x: number, z: number, r: number): [number, number, number] => {
    const n = nrm.get(key(x, z))!, l = Math.hypot(n[0], n[1]) || 1, nx = n[0] / l, nz = n[1] / l, t = r / o.rows;
    const top = o.top(x - nx * 0.8, z - nz * 0.8), H = Math.max(0, top - o.bottom), y = top - t * H;   // the top row is tucked 0.8 m under the turf
    const out = t === 0 ? -0.8 : o.batter * t * H + o.rough * Math.min(1, H / 4) * (noise3(x * 0.21, y * 0.25, z * 0.21) * 0.8 + noise3(x * 0.7, y * 0.6, z * 0.7) * 0.35);
    return [-(x + nx * out), t === 0 ? top - 0.04 : y, z + nz * out];
  };
  for (const s of segs) for (let r = 0; r < o.rows; r++) {
    const a0 = vert(s[0]!, s[1]!, r), b0 = vert(s[2]!, s[3]!, r), a1 = vert(s[0]!, s[1]!, r + 1), b1 = vert(s[2]!, s[3]!, r + 1);
    pos.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);   // x is mirrored, so this winding faces the sea in three space
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = mergeVertices(g, 1e-3); m.computeVertexNormals(); g.dispose(); return m;
}

const normalMaps = new Map<THREE.Texture, THREE.DataTexture>();
/** Normal map derived from a texture's luminance (Sobel, wrap-around), 512 px. Returns null until the image has loaded. */
export function deriveNormal(t: THREE.Texture, strength = 2.5): THREE.DataTexture | null {
  const hit = normalMaps.get(t); if (hit) return hit;
  const img = t.image as CanvasImageSource | undefined; if (!img) return null;
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data, h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = (0.2126 * d[i * 4]! + 0.7152 * d[i * 4 + 1]! + 0.0722 * d[i * 4 + 2]!) / 255;
  const H = (a: number, b: number) => h[((b + n) % n) * n + ((a + n) % n)]!, px = new Uint8Array(n * n * 4);
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const gx = H(a + 1, b - 1) + 2 * H(a + 1, b) + H(a + 1, b + 1) - H(a - 1, b - 1) - 2 * H(a - 1, b) - H(a - 1, b + 1);
    const gy = H(a - 1, b + 1) + 2 * H(a, b + 1) + H(a + 1, b + 1) - H(a - 1, b - 1) - 2 * H(a, b - 1) - H(a + 1, b - 1);
    const v = new THREE.Vector3(-gx * strength, -gy * strength, 1).normalize(), i = (b * n + a) * 4;
    px[i] = (v.x * 0.5 + 0.5) * 255; px[i + 1] = (v.y * 0.5 + 0.5) * 255; px[i + 2] = (v.z * 0.5 + 0.5) * 255; px[i + 3] = 255;
  }
  const out = new THREE.DataTexture(px, n, n); out.wrapS = out.wrapT = THREE.RepeatWrapping; out.generateMipmaps = true;
  out.minFilter = THREE.LinearMipmapLinearFilter; out.magFilter = THREE.LinearFilter; out.needsUpdate = true;
  normalMaps.set(t, out); return out;
}

/** Triplanar rock material (no UVs needed on the extruded faces): albedo + derived normal, darker and wetter near the waterline. */
export function rockMaterial(texId: string, metresPerTile: number, waterY: number, tint = '#ffffff'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const u = { uRock: { value: null as THREE.Texture | null }, uRockN: { value: null as THREE.Texture | null }, uScale: { value: 1 / metresPerTile }, uWater: { value: waterY } };
  void loadTexture(texId).then(t => { if (!t) return; u.uRock.value = t; u.uRockN.value = deriveNormal(t); mat.defines = { HAS_ROCK: '' }; mat.needsUpdate = true; });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform sampler2D uRock; uniform sampler2D uRockN; uniform float uScale; uniform float uWater;\nvec3 tpW() { vec3 w = pow(abs(normalize(vWn)), vec3(4.0)); return w / (w.x + w.y + w.z); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef HAS_ROCK
{ vec3 w = tpW(); vec3 p = vWp * uScale;
  diffuseColor.rgb *= texture2D(uRock, p.zy).rgb * w.x + texture2D(uRock, p.xz).rgb * w.y + texture2D(uRock, p.xy).rgb * w.z; }
#endif
diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(uWater - 0.3, uWater + 2.2, vWp.y));   // wet, dark rock at the waterline`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef HAS_ROCK
{ vec3 w = tpW(); vec3 p = vWp * uScale; vec3 nW = normalize(vWn);
  vec2 a = texture2D(uRockN, p.zy).xy * 2.0 - 1.0, b = texture2D(uRockN, p.xz).xy * 2.0 - 1.0, c = texture2D(uRockN, p.xy).xy * 2.0 - 1.0;
  nW = normalize(nW + w.x * vec3(0.0, a.y, a.x) + w.y * vec3(b.x, 0.0, b.y) + w.z * vec3(c.x, c.y, 0.0));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }
#endif`);
  };
  return mat;
}

/** Cliff faces (or the 18th-hole sea wall) for a coastal hole; null when the hole has no sea. */
export function makeCliffs(hole: number): THREE.Mesh | null {
  const segs = shoreSegments(hole); if (!segs.length) return null;
  // from the real turf edge down past the real sea level, so the water always meets rock; hole 18: the stone sea wall (pebble-look.md), a plain vertical backing behind the generated wall sections (seaWallMeshes)
  const y = seaY(hole), wall = hole === 17, top = (x: number, z: number) => ground(hole, x, z);
  let tall = 0; for (const s of segs) tall = Math.max(tall, top(s[0]!, s[1]!) - y);
  const geo = extrudeShore(segs, wall ? { top, bottom: y - 1.5, batter: 0, rough: 0, rows: 3 } : { top, bottom: y - 3, batter: 0.12, rough: 1.4, rows: Math.max(3, Math.round(tall / 2.5)) });
  const m = new THREE.Mesh(geo, rockMaterial(wall ? 'tex-seawall' : 'tex-cliff', wall ? 3 : 9, y));
  m.receiveShadow = true; m.castShadow = false; m.name = 'cliffs'; return m;
}

/** Where to put shore boulders: every ~14 m along the contour, a little out in the water. Sim space. */
export function shoreRockSpots(hole: number): { x: number; z: number; scale: number; rotY: number }[] {
  const out: { x: number; z: number; scale: number; rotY: number }[] = []; let acc = 0, i = 0;
  for (const s of shoreSegments(hole)) {
    const dx = s[2]! - s[0]!, dz = s[3]! - s[1]!, l = Math.hypot(dx, dz); acc += l;
    if (acc < 14) continue; acc = 0; i++;
    const r = hash3(s[0]!, s[1]!, hole), off = 1.5 + r * 4;
    out.push({ x: s[0]! + (dz / l) * off, z: s[1]! + (-dx / l) * off, scale: 0.7 + hash3(s[1]!, s[0]!, i) * 1.4, rotY: r * 6.28 });
  }
  return out;
}

/** A generic cluster of cream, low-roofed coastal buildings behind the 18th green (not a replica of the Lodge), built in code. */
export function makeBuildings(hole: number, pinZ: number): THREE.Group | null {
  if (hole !== 17) return null;
  const g = new THREE.Group(), facade = facadeTexture();
  const wall = new THREE.MeshStandardMaterial({ map: facade, color: '#ddd5c2', roughness: 0.85 }), roof = new THREE.MeshStandardMaterial({ color: '#5e5650', roughness: 0.95 });
  const plain = new THREE.MeshStandardMaterial({ color: '#e6dfcc', roughness: 0.9 });
  // [sim x, z beyond the pin, width, depth, height]: one long two-storey block and smaller wings and houses, set back from the green
  const B = BUILDINGS;
  for (const [x, dz, w, d, h] of B) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, plain, plain, wall, wall]);
    // sit on the lowest corner of the real ground so no corner floats (the uphill side is buried a little)
    const z = pinZ + dz, y0 = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ground(hole, x + a! * w / 2, z + b! * d / 2))) - 0.2;
    facade.repeat.set(1, 1); body.position.set(-x, y0 + h / 2, z);
    // a low hip roof: a 4-sided pyramid frustum, stretched to the footprint
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.72, 1, 4, 1).rotateY(Math.PI / 4), roof);
    r.scale.set(w * 1.02, h * 0.38, d * 1.08); r.position.set(-x, y0 + h + h * 0.19, z);
    body.castShadow = r.castShadow = true; body.receiveShadow = true; g.add(body, r);
  }
  // box UVs run 0..1 per face: the facade texture holds two storeys of windows, so wide walls get more columns
  g.name = 'buildings'; return g;
}
// [sim x, z beyond the pin, width, depth, height]: one long two-storey block and smaller wings and houses, set back from the green
const BUILDINGS = [[-20, 75, 62, 16, 7.5], [24, 72, 26, 13, 6], [-62, 68, 22, 12, 6.5], [55, 86, 18, 12, 5.5], [-95, 84, 16, 11, 5.5], [85, 100, 16, 10, 5.5]] as const;
/** Cypress and pines among the buildings behind 18 (the photos show the houses half hidden in trees). Sim space. */
export function buildingTrees(hole: number, pinZ: number): { kind: 'cypress' | 'pine'; x: number; z: number; scale: number; rotY: number }[] {
  if (hole !== 17) return [];
  return [[-55, 52], [-8, 55], [40, 58], [70, 74], [-80, 70], [8, 98], [-40, 100], [100, 84], [-120, 76], [30, 110]].map(([x, z], i) =>
    ({ kind: i % 3 === 2 ? 'pine' : 'cypress', x: x!, z: pinZ + z!, scale: 0.9 + hash3(x!, z!, 1) * 0.5, rotY: hash3(z!, x!, 2) * 6.28 }));
}
let facade: THREE.CanvasTexture | null = null;
function facadeTexture(): THREE.CanvasTexture {
  if (facade) return facade;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = '#e6dfcc'; x.fillRect(0, 0, 1024, 256);
  for (let f = 0; f < 2; f++) for (let i = 0; i < 14; i++) {
    const wx = 22 + i * 72, wy = 40 + f * 110;
    x.fillStyle = '#2c3a44'; x.fillRect(wx, wy, 40, 56); x.fillStyle = '#f4f0e6'; x.fillRect(wx + 19, wy, 2, 56); x.fillRect(wx, wy + 27, 40, 2);
    if (f === 0) { x.fillStyle = i % 2 ? '#3d4a3a' : '#e8e2d2'; x.fillRect(wx - 4, wy - 10, 48, 9); }   // striped awnings over the upper windows
  }
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 248, 1024, 8);
  facade = new THREE.CanvasTexture(c); facade.colorSpace = THREE.SRGBColorSpace; facade.anisotropy = 4; return facade;
}

const BACKDROP_VERT = /* glsl */`varying float vH; varying float vU; attribute float aU; void main() { vH = position.y; vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BACKDROP_FRAG = /* glsl */`uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uHaze; uniform float uTop; uniform float uMix; varying float vH; varying float vU;
void main() { float t = clamp(vH / uTop, 0.0, 1.0); vec3 c = mix(uLow, uHigh, smoothstep(0.0, 0.8, t)); c = mix(c, uHaze, uMix + 0.15 * t);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
/** A silhouette band on a circle around the hole: `profile(a)` gives the top height at angle a. Unlit, its own haze (no scene fog). */
function band(cx: number, cz: number, R: number, a0: number, a1: number, y0: number, profile: (a: number) => number, low: string, high: string, haze: number): THREE.Mesh {
  const N = 220, pos: number[] = [], us: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N, x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
    pos.push(x, y0 - 2, z, x, y0 + profile(a), z); us.push(i / N, i / N);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1)); g.setIndex(idx);
  const top = Math.max(...pos.filter((_, i) => i % 3 === 1)) - y0;
  const mat = new THREE.ShaderMaterial({ vertexShader: BACKDROP_VERT, fragmentShader: BACKDROP_FRAG, side: THREE.DoubleSide,
    uniforms: { uLow: { value: new THREE.Color(low) }, uHigh: { value: new THREE.Color(high) }, uHaze: { value: HAZE.clone() }, uTop: { value: top }, uMix: { value: haze } } });
  const m = new THREE.Mesh(g, mat); m.position.y = 0; m.renderOrder = -1; m.frustumCulled = false;
  (m.geometry as THREE.BufferGeometry).translate(0, -y0, 0); m.position.y = y0; return m;
}

/** The far shore across the bay (Carmel and Point Lobos, with hills behind) on the sea side, and a cypress/pine tree line elsewhere. */
export function makeBackdrop(hole: number, farM: number): THREE.Group {
  const g = GRIDS[hole]!, f = seaField(hole), cx = -(g.x0 + g.nx * g.cell / 2), cz = g.z0 + g.nz * g.cell / 2, grp = new THREE.Group();
  let sx = 0, sz = 0;
  if (f.any) for (let z = 0; z < g.nz; z++) for (let x = 0; x < g.nx; x++) if (f.sea[z * g.nx + x]) { sx += -(g.x0 + (x + 0.5) * g.cell) - cx; sz += g.z0 + (z + 0.5) * g.cell - cz; }
  const seaA = Math.atan2(sx, sz), hasSea = f.any && g.coastal, span = 1.1, R = Math.min(farM * 0.8, 1100);
  const y = seaY(hole), crowns = (a: number) => 14 + 7 * noise3(a * 40, 0, hole) + 5 * Math.abs(noise3(a * 160, 3, hole));
  // the inland tree line stands from sea level (the ground beyond the map) to crowns above the tee's height
  const inland = (a: number) => -y + crowns(a);
  if (hasSea) {
    const taper = (a: number) => Math.min(1, (span - Math.abs(a - seaA)) / 0.35);   // the hills fall to the water at both ends, no cut-off slab
    grp.add(band(cx, cz, R, seaA - span, seaA + span, y, a => taper(a) * (14 + 38 * (0.5 + 0.5 * noise3(a * 2.2, 1, hole)) ** 1.5 + 7 * noise3(a * 9, 2, hole)), '#3a4a44', '#7a8ea3', 0.3));
    grp.add(band(cx, cz, R - 3, seaA - span, seaA + span, y, a => taper(a) * (1.5 + 3 * Math.abs(noise3(a * 90, 5, hole))), '#b9b4a2', '#2a3a2c', 0.25));   // pale beach line and the dark shore trees
    grp.add(band(cx, cz, R * 0.75, seaA + span, seaA + Math.PI * 2 - span, y, a => inland(a) * Math.min(1, Math.min(a - seaA - span, seaA + Math.PI * 2 - span - a) / 0.3), '#1f2a1f', '#2c3a2b', 0.3));
  } else grp.add(band(cx, cz, R * 0.75, 0, Math.PI * 2, y, inland, '#1f2a1f', '#2c3a2b', 0.3));
  grp.name = 'backdrop'; return grp;
}

/** The 18th's sea wall as sections butted end to end (sim space): the main course land's seaward edge on the bay (left) side, found row by
 *  row (so offshore rocks, the far right and the beach interior are never used), smoothed, and cut into chords of `ratio` times the local
 *  wall height (turf at the edge down to `bottom`), so a section keeps the model's proportions. [ax, az] -> [bx, bz] runs with the sea on the left. */
export function seaWallSections(hole: number, ratio: number, bottom: number): { ax: number; az: number; bx: number; bz: number; topA: number; topB: number }[] {
  const g = GRIDS[hole]!, sea = seaField(hole).sea, n = g.nx * g.nz, comp = new Int32Array(n).fill(-1);
  let main = -1, mainN = 0;
  for (let s = 0, id = 0; s < n; s++) if (!sea[s] && comp[s]! < 0) {
    const q = [s]; comp[s] = id;
    for (let k = 0; k < q.length; k++) { const i = q[k]!, x = i % g.nx; for (const j of [x > 0 ? i - 1 : -1, x < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx]) if (j >= 0 && j < n && !sea[j] && comp[j]! < 0) { comp[j] = id; q.push(j); } }
    if (q.length > mainN) { mainN = q.length; main = id; } id++;
  }
  // per row: the first main-land cell scanning from the left, if open sea lies just left of it; keep the longest run without jumps
  let run: [number, number][] = [], cur: [number, number][] = [];
  for (let z = 0; z < g.nz; z++) {
    let xs = -1; for (let x = 1; x < g.nx; x++) if (comp[z * g.nx + x] === main) { if (sea[z * g.nx + x - 1]) xs = x; break; }
    const p: [number, number] = [g.x0 + xs * g.cell, g.z0 + (z + 0.5) * g.cell];
    if (xs < 0 || (cur.length && Math.abs(p[0] - cur[cur.length - 1]![0]) > 6 * g.cell)) { if (cur.length > run.length) run = cur; cur = xs < 0 ? [] : [p]; } else cur.push(p);
  }
  if (cur.length > run.length) run = cur;
  if (run.length < 8) return [];
  const smooth = (v: number[], r: number) => v.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - r); k <= Math.min(v.length - 1, i + r); k++) { s += v[k]!; c++; } return s / c; });
  // the median edge over 14 m drops one-row fingers (the tee box), then the most seaward over 2 m, eased: the face stays on or just
  // off the land, so no terrain sliver shows in front of it
  const win = (v: number[], i: number, r: number) => v.slice(Math.max(0, i - r), i + r + 1);
  const med = run.map((_, i) => { const w = win(run.map(p => p[0]), i, 3).sort((a, b) => a - b); return w[w.length >> 1]!; });
  const xs = smooth(smooth(med.map((_, i) => Math.min(...win(med, i, 1))), 4), 4), zs = run.map(p => p[1]);
  // turf height 2 m inland (the 4 m height grid smears the wall drop over the last cell), eased so the wall top runs smoothly
  const tops = smooth(smooth(run.map(([x, z]) => ground(hole, x + 2, z) + 0.1), 5), 5);
  const out: { ax: number; az: number; bx: number; bz: number; topA: number; topB: number }[] = [];
  // where the eased line would stand over 4 m out in the water (rock knobs by the tee) the wall breaks; each stretch is cut on its own
  const out4 = run.map(([x], i) => x - xs[i]! > 4), len3 = (i: number) => i >= 0 && out4.slice(i, i + 3).length === 3 && out4.slice(i, i + 3).every(Boolean);
  const bad = out4.map((b, i) => b && (len3(i - 2) || len3(i - 1) || len3(i)));   // a 1-2 row jog is no break
  for (let i0 = 0; i0 < run.length;) {
    let i1 = i0; while (i1 < run.length && !bad[i1]) i1++;
    if (i1 - i0 >= 10) {   // 20 m or more
      const X = xs.slice(i0, i1), Z = zs.slice(i0, i1), T = tops.slice(i0, i1);
      const acc = [0]; for (let i = 1; i < X.length; i++) acc.push(acc[i - 1]! + Math.hypot(X[i]! - X[i - 1]!, Z[i]! - Z[i - 1]!));
      const at = (a: number) => { let i = 1; while (i < acc.length - 1 && acc[i]! < a) i++; const t = Math.min(1, Math.max(0, (a - acc[i - 1]!) / (acc[i]! - acc[i - 1]! || 1)));
        return { x: X[i - 1]! + (X[i]! - X[i - 1]!) * t, z: Z[i - 1]! + (Z[i]! - Z[i - 1]!) * t, top: T[i - 1]! + (T[i]! - T[i - 1]!) * t }; };
      const total = acc[acc.length - 1]!;
      for (let a = 0; a < total - 1;) {
        const p = at(a), L = Math.min(total - a, Math.max(2, ratio * (p.top - bottom))), b = at(a + L);
        out.push({ ax: p.x, az: p.z, bx: b.x, bz: b.z, topA: p.top, topB: b.top }); a += L;
      }
    }
    i0 = Math.max(i1, i0 + 1);
  }
  return out;
}

/** Depth stretch of the wall section: the generated face is near vertical, the real 18th wall is a battered revetment seen from above (h18-green-bunkers). */
const BATTER = 2.5;
/** The generated sea-wall section (face toward its local +z, length along x, base at y = 0) instanced along seaWallSections: each section
 *  stretched along x to its chord, scaled uniformly in height so its top meets the turf at the edge and its foot is under the sea,
 *  its face-top line on the shore line so the terrain edge meets the wall top. Three space out. */
export function seaWallMeshes(hole: number, model: THREE.Object3D): THREE.InstancedMesh[] {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), cx = (box.min.x + box.max.x) / 2;
  const faceZ = box.min.z + 0.19 * size.z;   // seawall-r3: cap back at min z, face top 19 % of the depth in front of it, sand apron beyond the foot
  const bottom = seaY(hole) - 0.6, secs = seaWallSections(hole, size.x / size.y, bottom), out: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4(), sh = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), off = new THREE.Vector3();
  model.traverse(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh || !secs.length) return;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, secs.length);
    secs.forEach((s, j) => {
      const dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz) || 1, sc = ((s.topA + s.topB) / 2 - bottom) / size.y, sx = (l / size.x) * 1.03;   // 3 % overlap hides the joints on curves
      q.setFromAxisAngle(up, Math.atan2(dz / l, dx / l));   // local +z to the seaward normal: sim (-tz, tx), three (tz, tx)
      off.set(cx * sx, 0, faceZ * sc * BATTER).applyQuaternion(q);
      const c = new THREE.Vector3(-(s.ax + s.bx) / 2, bottom, (s.az + s.bz) / 2), k = (s.topB - s.topA) / l, t3x = -dx / l, t3z = dz / l;
      // shear the section's height along the shore so its top runs from topA to topB and neighbours meet without a step
      sh.set(1, 0, 0, 0, k * t3x, 1, k * t3z, -k * (t3x * c.x + t3z * c.z), 0, 0, 1, 0, 0, 0, 0, 1);
      im.setMatrixAt(j, sh.clone().multiply(m.compose(c.clone().sub(off), q, new THREE.Vector3(sx, sc, sc * BATTER))).multiply(mesh.matrixWorld));
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); out.push(im);
  });
  return out;
}

/** Evenly spaced placements along the shore contour (sim space): every `step` m, pushed `out` m seaward, yaw along the shore;
 *  `top` is the turf height (three y) just inland of the contour there. */
export function shorePieces(hole: number, step: number, out: number): { x: number; z: number; yaw: number; top: number }[] {
  const res: { x: number; z: number; yaw: number; top: number }[] = []; let acc = step;
  for (const s of shoreSegments(hole)) {
    const dx = s[2]! - s[0]!, dz = s[3]! - s[1]!, l = Math.hypot(dx, dz); acc += l;
    if (acc < step) continue; acc = 0;
    const mx = (s[0]! + s[2]!) / 2, mz = (s[1]! + s[3]!) / 2;
    res.push({ x: mx + (dz / l) * out, z: mz - (dx / l) * out, yaw: Math.atan2(dz, -dx), top: ground(hole, mx - (dz / l) * 0.8, mz + (dx / l) * 0.8) });
  }
  return res;
}
