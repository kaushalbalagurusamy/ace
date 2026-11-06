// Draws the traced lie grid (the same data the server reads for physics) as terrain: a 3D ground mesh and the minimap.
import * as THREE from 'three';
import { GRIDS } from '../shared/course-grid';
import { decodeGrid } from '../shared/gridtools';
import { loadTexture, type PropSpot } from './assets';
import type { HoleInfo } from '../shared/protocol';
import { TURF_LAYERS } from './turf-bake';
import type { Turf } from './turf';

/** Class colours from assets/STYLE.md: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p path, t trees, k rock/shore. */
const COL: Record<string, [number, number, number]> = {
  o: [38, 92, 52], w: [66, 150, 208], r: [63, 155, 78], c: [88, 176, 96], f: [111, 194, 106], g: [166, 217, 139],
  s: [239, 230, 210], p: [184, 184, 186], t: [47, 122, 63], k: [138, 143, 140],
};
/** Outside the traced map on an ocean hole is open sea (still out of bounds for the rules). */
const COL_OPEN_SEA: [number, number, number] = [48, 112, 170];
const COL_OOB: [number, number, number] = [26, 58, 36], COL_OOB_STRIPE: [number, number, number] = [36, 76, 48];
/** A playable cell next to an out-of-bounds cell: drawn as the white boundary line so out of bounds is unmistakable. */
function edgeOfOob(cells: Uint8Array, g: (typeof GRIDS)[number], cx: number, cz: number): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= g.nx || z >= g.nz || cells[z * g.nx + x] === 111) return true; }
  return false;
}
const cache = new Map<string, HTMLCanvasElement>();
const grids = new Map<number, Uint8Array>();
const seaMasks = new Map<number, Uint8Array>();
/** Cells outside the traced map that are within about 80 m of real water read as open sea; elsewhere outside reads as forest. */
function openSea(hole: number, g: (typeof GRIDS)[number], cells: Uint8Array): Uint8Array {
  let m = seaMasks.get(hole); if (m) return m;
  const R = Math.round(80 / g.cell), tmp = new Uint8Array(g.nx * g.nz); m = new Uint8Array(g.nx * g.nz);
  for (let z = 0; z < g.nz; z++) { let last = -1e9; for (let x = 0; x < g.nx; x++) { if (cells[z * g.nx + x] === 119) last = x; if (x - last <= R) tmp[z * g.nx + x] = 1; } last = 1e9; for (let x = g.nx - 1; x >= 0; x--) { if (cells[z * g.nx + x] === 119) last = x; if (last - x <= R) tmp[z * g.nx + x] = 1; } }
  for (let x = 0; x < g.nx; x++) { let last = -1e9; for (let z = 0; z < g.nz; z++) { if (tmp[z * g.nx + x]) last = z; if (z - last <= R) m[z * g.nx + x] = 1; } last = 1e9; for (let z = g.nz - 1; z >= 0; z--) { if (tmp[z * g.nx + x]) last = z; if (last - z <= R) m[z * g.nx + x] = 1; } }
  seaMasks.set(hole, m); return m;
}
/** Per-cell sea data for the ocean, the coast and the terrain cut-out (one texel per cell, sim x not mirrored):
 *  `sea` 1 for water and open sea, `dist` metres from the nearest land for sea cells (0 on land, capped at 80 m).
 *  `tex` packs them as R = sea, G = dist / 80. Empty (no sea) on inland holes. */
export interface SeaField { sea: Float32Array; dist: Float32Array; tex: THREE.DataTexture; any: boolean }
const seaFields = new Map<number, SeaField>();
export function seaField(hole: number): SeaField {
  const hit = seaFields.get(hole); if (hit) return hit;
  const g = GRIDS[hole]!, cells = decoded(hole), open = openSea(hole, g, cells), n = g.nx * g.nz;
  const sea = new Float32Array(n), dist = new Float32Array(n).fill(1e9); let any = false;
  for (let i = 0; i < n; i++) if (cells[i] === 119 || (g.coastal && cells[i] === 111 && open[i])) sea[i] = 1;
  // drop small water specks (the traced graphics' dotted OB lines read as water): only bodies of 300+ cells are sea
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) if (sea[s] && !seen[s]) {
    const comp = [s]; seen[s] = 1;
    for (let k = 0; k < comp.length; k++) { const i = comp[k]!, x = i % g.nx; for (const j of [x > 0 ? i - 1 : -1, x < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx]) if (j >= 0 && j < n && sea[j] && !seen[j]) { seen[j] = 1; comp.push(j); } }
    if (comp.length < 300) for (const i of comp) sea[i] = 0; else any = true;
  }
  for (let i = 0; i < n; i++) if (!sea[i]) dist[i] = 0;
  // two-pass chamfer distance (3-4 metric) from land, in metres
  const D = (i: number, j: number, w: number) => { if (dist[j]! + w < dist[i]!) dist[i] = dist[j]! + w; };
  const c1 = g.cell, c2 = g.cell * 1.414;
  for (let z = 0; z < g.nz; z++) for (let x = 0; x < g.nx; x++) { const i = z * g.nx + x; if (x) D(i, i - 1, c1); if (z) { D(i, i - g.nx, c1); if (x) D(i, i - g.nx - 1, c2); if (x < g.nx - 1) D(i, i - g.nx + 1, c2); } }
  for (let z = g.nz - 1; z >= 0; z--) for (let x = g.nx - 1; x >= 0; x--) { const i = z * g.nx + x; if (x < g.nx - 1) D(i, i + 1, c1); if (z < g.nz - 1) { D(i, i + g.nx, c1); if (x < g.nx - 1) D(i, i + g.nx + 1, c2); if (x) D(i, i + g.nx - 1, c2); } }
  const px = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { dist[i] = Math.min(80, dist[i]!); px[i * 4] = sea[i]! * 255; px[i * 4 + 1] = Math.round((dist[i]! / 80) * 255); px[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(px, g.nx, g.nz); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const f = { sea, dist, tex, any }; seaFields.set(hole, f); return f;
}
const decoded = (hole: number) => grids.get(hole) ?? (grids.set(hole, decodeGrid(GRIDS[hole]!)), grids.get(hole)!);
/** Class char code at sim (x, z); no string allocation, for per-frame and per-instance lookups. */
export const cellCode = (hole: number, x: number, z: number): number => {
  const g = GRIDS[hole]!, cells = decoded(hole);
  const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
  return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 111 : cells[iz * g.nx + ix]!;
};
export const cellClass = (hole: number, x: number, z: number): string => String.fromCharCode(cellCode(hole, x, z));

/** One canvas pixel block per cell: `mirrorX` for the 3D plane (sim +x is three -x), `flipZ` for the minimap (far end at the top). */
export function gridCanvas(hole: number, px: number, mirrorX: boolean, flipZ: boolean): HTMLCanvasElement {
  const key = `${hole}:${px}:${mirrorX}:${flipZ}`; const hit = cache.get(key); if (hit) return hit;
  const g = GRIDS[hole]!, cells = grids.get(hole) ?? (grids.set(hole, decodeGrid(g)), grids.get(hole)!);
  const sea = openSea(hole, g, cells);
  const c = document.createElement('canvas'); c.width = g.nx * px; c.height = g.nz * px;
  const ctx = c.getContext('2d')!, img = ctx.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const ix = Math.min(g.nx - 1, Math.floor(x / px)), iz = Math.min(g.nz - 1, Math.floor(y / px));
    const cx = mirrorX ? g.nx - 1 - ix : ix, cz = flipZ ? g.nz - 1 - iz : iz;
    const ch = String.fromCharCode(cells[cz * g.nx + cx]!), isSea = ch === 'o' && g.coastal && sea[cz * g.nx + cx];
    let col = (isSea ? COL_OPEN_SEA : ch === 'o' ? COL_OOB : COL[ch]) ?? COL.o!;
    if (ch === 'o' && !isSea && px > 1 && (((x >> 2) + (y >> 2)) & 1)) col = COL_OOB_STRIPE;                  // hatched: not playable
    else if (ch !== 'o' && ch !== 'w' && edgeOfOob(cells, g, cx, cz)) col = [236, 236, 228];                  // white boundary line (OOB stakes)
    const n = px > 1 ? 1 + (((x * 73856093) ^ (y * 19349663)) % 17) / 170 - 0.05 : 1; // faint grain so large areas do not look flat
    const i = (y * c.width + x) * 4; img.data[i] = col[0] * n; img.data[i + 1] = col[1] * n; img.data[i + 2] = col[2] * n; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (px > 1) { const soft = document.createElement('canvas'); soft.width = c.width; soft.height = c.height; const s = soft.getContext('2d')!; s.filter = 'blur(1.4px)'; s.drawImage(c, 0, 0); cache.set(key, soft); return soft; }
  cache.set(key, c); return c;
}

/** Turf layer per class (order of graphics.SURFACES); trees and shore rocks stand on rough. Fringe (3) is the ring of fairway/cut/rough around a green. */
const LAYER: Record<number, number> = { 102: 0, 99: 1, 114: 2, 116: 2, 107: 2, 103: 4, 115: 5 };   // rock/shore ground (k) wears the rough turf; the boulders sit on it
const MASK_PX = 4;
const masks = new Map<number, [THREE.DataTexture, THREE.DataTexture]>();
function boxBlur(a: Uint8Array, w: number, h: number, r: number, tmp: Uint8Array) {
  for (let pass = 0; pass < 2; pass++) {
    const [src, dst, n, m, sx, sy] = pass === 0 ? [a, tmp, w, h, 1, w] : [tmp, a, h, w, w, 1];
    for (let j = 0; j < m; j++) {
      let acc = 0; const row = j * sy;
      for (let k = -r; k <= r; k++) acc += src[row + Math.min(n - 1, Math.max(0, k)) * sx]!;
      for (let i = 0; i < n; i++) {
        dst[row + i * sx] = acc / (2 * r + 1);
        acc += src[row + Math.min(n - 1, i + r + 1) * sx]! - src[row + Math.max(0, i - r) * sx]!;
      }
    }
  }
}
/** Per-surface weights from the lie grid (sim x, not mirrored), softened so surfaces blend over about a metre. A: fairway, first cut, rough, fringe. B: green, sand. */
export function turfMasks(hole: number): [THREE.DataTexture, THREE.DataTexture] {
  const hit = masks.get(hole); if (hit) return hit;
  const g = GRIDS[hole]!, cells = decoded(hole), W = g.nx * MASK_PX, H = g.nz * MASK_PX;
  const planes = Array.from({ length: 6 }, () => new Uint8Array(W * H)), tmp = new Uint8Array(W * H);
  const at = (x: number, z: number) => (x < 0 || z < 0 || x >= g.nx || z >= g.nz ? 111 : cells[z * g.nx + x]!);
  for (let cz = 0; cz < g.nz; cz++) for (let cx = 0; cx < g.nx; cx++) {
    let l = LAYER[cells[cz * g.nx + cx]!]; if (l === undefined || edgeOfOob(cells, g, cx, cz)) continue;   // keep the white OB line from the colour map
    if (l <= 2) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (at(cx + dx, cz + dz) === 103) l = 3;
    const p = planes[l]!;
    for (let y = 0; y < MASK_PX; y++) p.fill(255, (cz * MASK_PX + y) * W + cx * MASK_PX, (cz * MASK_PX + y) * W + (cx + 1) * MASK_PX);
  }
  for (const p of planes) { boxBlur(p, W, H, 2, tmp); boxBlur(p, W, H, 2, tmp); }
  const pack = (a: number, b: number, c: number, d: number) => {
    const out = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { out[i * 4] = planes[a]![i]!; out[i * 4 + 1] = planes[b]![i]!; out[i * 4 + 2] = c < 6 ? planes[c]![i]! : 0; out[i * 4 + 3] = d < 6 ? planes[d]![i]! : 0; }
    const t = new THREE.DataTexture(out, W, H); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  };
  const pair: [THREE.DataTexture, THREE.DataTexture] = [pack(0, 1, 2, 3), pack(4, 5, 6, 6)];
  masks.set(hole, pair); return pair;
}

const TILES = `float[6](${TURF_LAYERS.map(l => l.tile.toFixed(2)).join(', ')})`;
const TURF_COMMON = /* glsl */`
uniform sampler2D uDetail; varying vec2 vWxz;
#ifdef HAS_SEA
uniform sampler2D uSea; uniform vec4 uGrid;
#endif
#ifdef HAS_TURF
uniform highp sampler2DArray uAlb; uniform highp sampler2DArray uNrm;
uniform sampler2D uMaskA; uniform sampler2D uMaskB; uniform vec2 uStripe;
#ifndef HAS_SEA
uniform vec4 uGrid;
#endif
const float TILE[6] = ${TILES};
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }
#endif`;
// Blend the surfaces by the lie masks (edges jittered so they are not grid-straight), two samplings per surface for anti-tiling
// (the second rotated, larger and offset, chosen by world noise), macro colour variation, and mowing stripes across the tee-pin axis.
const TURF_MAP = /* glsl */`
#ifdef HAS_SEA
if (texture2D(uSea, (vec2(-vWxz.x, vWxz.y) - uGrid.xy) * uGrid.zw).r > 0.55) discard;   // the ocean (ocean.ts) and the cliffs (coast.ts) show through
#endif
vec3 turfN = vec3(0.5, 0.5, 1.0); float turfW = 0.0;
#ifdef HAS_DETAIL
diffuseColor.rgb *= 0.55 + 0.9 * texture2D(uDetail, vWxz * 0.16).g;
#endif
#ifdef HAS_TURF
{
  vec2 gx = dFdx(vWxz), gy = dFdy(vWxz), sim = vec2(-vWxz.x, vWxz.y);
  vec2 jit = vec2(tNoise(vWxz * 0.9), tNoise(vWxz * 0.9 + 17.3)) - 0.5;
  vec2 muv = (sim - uGrid.xy + jit * 1.2) * uGrid.zw;
  vec4 wa = texture2D(uMaskA, muv); vec2 wb = texture2D(uMaskB, muv).rg;
  float wt[6] = float[6](wa.r, wa.g, wa.b, wa.a, wb.r, wb.g);
  float sum = wa.r + wa.g + wa.b + wa.a + wb.r + wb.g;
  if (sum > 0.004) {
    const mat2 ROT = mat2(0.8085, 0.5885, -0.5885, 0.8085);
    float k = smoothstep(0.3, 0.7, tNoise(vWxz * 0.11));
    vec3 alb = vec3(0.0); vec4 nr = vec4(0.0); float best = 0.0; int dom = 0;
    for (int i = 0; i < 6; i++) {
      float w = wt[i]; if (w < 0.004) continue;
      if (w > best) { best = w; dom = i; }
      float s1 = 1.0 / TILE[i], s2 = s1 / 1.7;
      vec3 a = vec3(0.0); vec4 n = vec4(0.0);
      if (k < 0.999) { vec3 p = vec3(vWxz * s1, float(i)); a += (1.0 - k) * textureGrad(uAlb, p, gx * s1, gy * s1).rgb; n += (1.0 - k) * textureGrad(uNrm, p, gx * s1, gy * s1); }
      if (k > 0.001) { vec3 p = vec3(ROT * vWxz * s2 + 0.37, float(i)); a += k * textureGrad(uAlb, p, ROT * gx * s2, ROT * gy * s2).rgb; n += k * textureGrad(uNrm, p, ROT * gx * s2, ROT * gy * s2); }
      alb += w * a; nr += w * n;
    }
    alb /= sum; nr /= sum;
    alb *= (0.9 + 0.2 * tNoise(vWxz * 0.021)) * (0.95 + 0.1 * tNoise(vWxz * 0.19 + 5.1));
    // Pebble's bunker lips: a ragged ring of longer, darker, straw-tipped fescue where the turf meets the white sand
    float ws = wt[5] / sum, lip = smoothstep(0.04, 0.3, ws) * (1.0 - smoothstep(0.42, 0.75, ws)) * (1.0 - wt[4] / sum) * (0.6 + 0.6 * tNoise(vWxz * 2.3));
    alb = mix(alb, mix(vec3(0.17, 0.2, 0.08), vec3(0.42, 0.38, 0.2), tNoise(vWxz * 5.0)), clamp(lip, 0.0, 0.85));
    // the flat ground has no bunker bowl, so fake its face: the lip toward the sun shades the sand behind it (sun from environment.ts SUN_DIR)
    float wsSun = texture2D(uMaskB, muv + vec2(-0.507, -0.862) * 1.6 * uGrid.zw).g;
    alb *= 1.0 - 0.45 * ws * clamp(1.0 - wsSun * 1.4, 0.0, 1.0);
    float sp = dot(sim, uStripe);
    alb *= 1.0 + 0.18 * (wt[0] / sum) * (smoothstep(-0.25, 0.25, sin(sp * 0.5236)) - 0.5) + 0.06 * (wt[4] / sum) * (smoothstep(-0.3, 0.3, sin(sp * 3.1416)) - 0.5);
  #ifdef TURF_DETAIL
    float near = smoothstep(30.0, 4.0, length(vViewPosition));
    if (near > 0.0) {
      float sd = 1.0 / (TILE[dom] * 0.27);
      vec3 d = textureGrad(uAlb, vec3(vWxz * sd, float(dom)), gx * sd, gy * sd).rgb, mean = textureLod(uAlb, vec3(0.5, 0.5, float(dom)), 12.0).rgb;
      alb *= mix(1.0, clamp(dot(d, vec3(0.333)) / max(0.02, dot(mean, vec3(0.333))), 0.6, 1.5), 0.45 * near);
    }
  #endif
    turfW = clamp(sum, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, alb, turfW);
    turfN = nr.xyz;
  }
}
#endif`;

type TerrainU = { uSea: { value: THREE.Texture | null }; uDetail: { value: THREE.Texture | null }; uAlb: { value: THREE.Texture | null }; uNrm: { value: THREE.Texture | null }; uMaskA: { value: THREE.Texture | null }; uMaskB: { value: THREE.Texture | null }; uGrid: { value: THREE.Vector4 }; uStripe: { value: THREE.Vector2 } };
/** Ground mesh for a hole in three space (x mirrored, as everywhere in the client). Starts with the lie grid's canvas colours;
 *  the HD turf replaces them once `turf` resolves (if it resolves to null, a generated grass texture is multiplied in as detail instead). */
export function terrainMesh(h: Pick<HoleInfo, 'index' | 'tee' | 'pin'>, turf: Promise<Turf | null>, detail: boolean): THREE.Mesh {
  const hole = h.index, g = GRIDS[hole]!, tex = new THREE.CanvasTexture(gridCanvas(hole, 4, true, false));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ax = h.pin.x - h.tee.x, az = h.pin.z - h.tee.z, al = Math.hypot(ax, az) || 1;
  const u: TerrainU = { uSea: { value: seaField(hole).tex }, uDetail: { value: null }, uAlb: { value: null }, uNrm: { value: null }, uMaskA: { value: null }, uMaskB: { value: null },
    uGrid: { value: new THREE.Vector4(g.x0, g.z0, 1 / (g.nx * g.cell), 1 / (g.nz * g.cell)) }, uStripe: { value: new THREE.Vector2(-az / al, ax / al) } };
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  mat.userData.turf = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${TURF_COMMON}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${TURF_MAP}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef HAS_TURF\nroughnessFactor = mix(roughnessFactor, turfN.z, turfW);\n#endif')
      // flat ground: the tangent frame is world x/z, so the baked slopes become a world normal directly
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef HAS_TURF\nif (turfW > 0.0) { vec2 sl = (turfN.xy * 2.0 - 1.0) * turfW; normal = normalize((viewMatrix * vec4(normalize(vec3(sl.x, 1.0, sl.y)), 0.0)).xyz); }\n#endif');
  };
  mat.defines = seaDefs(hole);
  const w = g.nx * g.cell, d = g.nz * g.cell, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  m.position.set(-(g.x0 + w / 2), 0, g.z0 + d / 2); m.receiveShadow = true; m.userData.hole = hole;
  void turf.then(t => setTurf(m, t, detail));
  return m;
}
/** Swaps the turf on a terrain mesh (tier change); null falls back to the canvas colours with the old grass detail. */
export function setTurf(m: THREE.Mesh, t: Turf | null, detail: boolean) {
  const mat = m.material as THREE.MeshStandardMaterial, u = mat.userData.turf as TerrainU;
  if (t) {
    [u.uMaskA.value, u.uMaskB.value] = turfMasks(m.userData.hole as number); u.uAlb.value = t.alb; u.uNrm.value = t.nrm;
    mat.defines = { ...seaDefs(m.userData.hole as number), ...(detail ? { HAS_TURF: '', TURF_DETAIL: '' } : { HAS_TURF: '' }) }; mat.needsUpdate = true;
  } else void loadTexture('tex-rough').then(d => { if (d && !u.uAlb.value) { u.uDetail.value = d; mat.defines = { ...seaDefs(m.userData.hole as number), HAS_DETAIL: '' }; mat.needsUpdate = true; } });
}
export const isCoastal = (hole: number) => GRIDS[hole]!.coastal;
/** Coastal holes cut the sea out of the terrain so the ocean and cliffs below show through. */
const seaDefs = (hole: number): Record<string, string> => (GRIDS[hole]!.coastal && seaField(hole).any ? { HAS_SEA: '' } : {});

/** Deterministic prop spots from the traced grid: trees where the graphic shows trees, rocks on the shore, kept near the playing corridor. */
export function propSpots(hole: number): PropSpot[] {
  const g = GRIDS[hole]!; let seed = (hole + 1) * 2654435761 >>> 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const trees: PropSpot[] = [], rocks: PropSpot[] = [];
  for (let z = g.z0; z < g.z0 + g.nz * g.cell; z += 6) for (let x = g.x0; x < g.x0 + g.nx * g.cell; x += 6) {
    const px = x + rnd() * 6, pz = z + rnd() * 6, c = cellClass(hole, px, pz), r = rnd();
    if (c === 't' && r < 0.22 && trees.length < 150) trees.push({ kind: rnd() < 0.6 ? 'cypress' : 'pine', x: px, z: pz, scale: 0.8 + rnd() * 0.5, rotY: rnd() * 6.28 });
    else if (c === 'k' && r < 0.12 && rocks.length < 30) rocks.push({ kind: 'rock', x: px, z: pz, scale: 0.7 + rnd() * 0.8, rotY: rnd() * 6.28 });
  }
  return [...trees, ...rocks];
}

/** Rangefinder view: fits the hole's grid into a W x H canvas, tee at the bottom, pin at the top, sim +x to the right. */
export function rfView(hole: number, W: number, H: number) {
  const g = GRIDS[hole]!, gw = g.nx * g.cell, gh = g.nz * g.cell, s = Math.min(W / gw, H / gh) * 0.98, cx = g.x0 + gw / 2, cz = g.z0 + gh / 2;
  const toScreen = (x: number, z: number): [number, number] => [W / 2 + (x - cx) * s, H / 2 - (z - cz) * s];
  const toWorld = (sx: number, sy: number): { x: number; z: number } => ({ x: cx + (sx - W / 2) / s, z: cz - (sy - H / 2) / s });
  const [x0, y0] = toScreen(g.x0, g.z0 + gh);
  return { s, toScreen, toWorld, x0, y0, w: gw * s, h: gh * s };
}
