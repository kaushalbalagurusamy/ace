// Every `hole` parameter here is a courses.gridKey (course and hole in one number).
// Draws the traced lie grid (the same data the server reads for physics) as terrain: a 3D ground mesh and the minimap.
import * as THREE from 'three';
import { COURSES, COURSE_IDS, HOLES_PER_COURSE, gridOf, keyOf } from '../shared/courses';
import type { HoleGrid } from '../shared/course-grid';
import { decodeGrid } from '../shared/gridtools';
import { loadTexture, type PropSpot } from './assets';
import type { HoleInfo } from '../shared/protocol';
import { TURF_LAYERS } from './turf-bake';
import type { Turf } from './turf';
import { COURSE_HEIGHTS, heightAt, normalAt, seaLevel } from '../shared/height';

const courseOf = (key: number) => COURSE_IDS[Math.floor(key / HOLES_PER_COURSE)]!;
/** Ground height (m above the tee) at sim (x, z) on a hole (grid key): the same field the server's physics uses. */
export const ground = (hole: number, x: number, z: number) => heightAt(courseOf(hole), hole % HOLES_PER_COURSE, x, z);
export const groundNormal = (hole: number, x: number, z: number) => normalAt(courseOf(hole), hole % HOLES_PER_COURSE, x, z);
/** Real sea level on a hole, m relative to its tee (shared/height.ts); only coastal holes draw it. */
export const seaY = (hole: number) => seaLevel(courseOf(hole), hole % HOLES_PER_COURSE);
/** The plane under the map: sea level on a coastal course; a parkland course has no sea, so the lowest ground on the hole (not tens of metres down). */
export function baseY(hole: number): number {
  if (themeOf(hole) === 'coastal') return seaY(hole);
  const H = COURSE_HEIGHTS[courseOf(hole)]![hole % HOLES_PER_COURSE]!, b = atob(H.data); let lo = 0;
  for (let i = 0; i < b.length; i += 2) lo = Math.min(lo, (b.charCodeAt(i) | (b.charCodeAt(i + 1) << 8)) << 16 >> 16);
  return lo / 100;
}

/** Class colours from assets/STYLE.md: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p path, t trees, k rock/shore. */
const COL: Record<string, [number, number, number]> = {
  o: [38, 92, 52], w: [66, 150, 208], r: [63, 155, 78], c: [88, 176, 96], f: [111, 194, 106], g: [166, 217, 139],
  s: [239, 230, 210], p: [184, 184, 186], t: [47, 122, 63], k: [138, 143, 140],
};
/** Outside the traced map on an ocean hole is open sea (still out of bounds for the rules). */
const COL_OPEN_SEA: [number, number, number] = [48, 112, 170];
const COL_OOB: [number, number, number] = [26, 58, 36], COL_OOB_STRIPE: [number, number, number] = [36, 76, 48];
/** A playable cell next to an out-of-bounds cell: drawn as the white boundary line so out of bounds is unmistakable. */
function edgeOfOob(cells: Uint8Array, g: HoleGrid, cx: number, cz: number): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= g.nx || z >= g.nz || cells[z * g.nx + x] === 111) return true; }
  return false;
}
const cache = new Map<string, HTMLCanvasElement>();
const grids = new Map<number, Uint8Array>();
const seaMasks = new Map<number, Uint8Array>();
/** Cells outside the traced map that are within about 80 m of real water read as open sea; elsewhere outside reads as forest. */
function openSea(hole: number, g: HoleGrid, cells: Uint8Array): Uint8Array {
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
  const g = gridOf(hole), cells = decoded(hole), open = openSea(hole, g, cells), n = g.nx * g.nz;
  const sea = new Float32Array(n), dist = new Float32Array(n).fill(1e9); let any = false;
  for (let i = 0; i < n; i++) if (cells[i] === 119 || (g.coastal && cells[i] === 111 && open[i])) sea[i] = 1;
  /** Flips every 4-connected component of cells equal to `v` that is smaller than `min` cells. */
  const specks = (v: number, min: number, flat = false) => {
    const seen = new Uint8Array(n), sy = seaY(hole);
    for (let s = 0; s < n; s++) if (sea[s] === v && !seen[s]) {
      const comp = [s]; seen[s] = 1;
      for (let k = 0; k < comp.length; k++) { const i = comp[k]!, x = i % g.nx; for (const j of [x > 0 ? i - 1 : -1, x < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx]) if (j >= 0 && j < n && sea[j] === v && !seen[j]) { seen[j] = 1; comp.push(j); } }
      // flat: a land patch under `min` cells that never rises 1.5 m above the real sea level is traced-graphic noise, not an island
      const low = flat && comp.every(i => ground(hole, g.x0 + (i % g.nx + 0.5) * g.cell, g.z0 + (Math.floor(i / g.nx) + 0.5) * g.cell) < sy + 1.5);
      if (comp.length < min && (!flat || low)) for (const i of comp) sea[i] = 1 - v; else if (v) any = true;
    }
  };
  specks(1, 300);   // drop small water specks (the traced graphics' dotted OB lines read as water): only bodies of 300+ cells are sea
  if (any) { specks(0, 40); specks(0, 2000, true); }   // and small land specks out in the sea (stray path/sand cells of the same dotted lines), and flat offshore slabs, are drawn as sea
  for (let i = 0; i < n; i++) if (!sea[i]) dist[i] = 0;
  // two-pass chamfer distance (3-4 metric) from land, in metres
  const D = (i: number, j: number, w: number) => { if (dist[j]! + w < dist[i]!) dist[i] = dist[j]! + w; };
  const c1 = g.cell, c2 = g.cell * 1.414;
  for (let z = 0; z < g.nz; z++) for (let x = 0; x < g.nx; x++) { const i = z * g.nx + x; if (x) D(i, i - 1, c1); if (z) { D(i, i - g.nx, c1); if (x) D(i, i - g.nx - 1, c2); if (x < g.nx - 1) D(i, i - g.nx + 1, c2); } }
  for (let z = g.nz - 1; z >= 0; z--) for (let x = g.nx - 1; x >= 0; x--) { const i = z * g.nx + x; if (x < g.nx - 1) D(i, i + 1, c1); if (z < g.nz - 1) { D(i, i + g.nx, c1); if (x < g.nx - 1) D(i, i + g.nx + 1, c2); if (x) D(i, i + g.nx - 1, c2); } }
  const px = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { dist[i] = Math.min(80, dist[i]!); px[i * 4] = sea[i]! * 255; px[i * 4 + 1] = Math.round((dist[i]! / 80) * 255); px[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(px, g.nx, g.nz); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;   // mips: the terrain asks 'near the sea?' from a blurred level
  const f = { sea, dist, tex, any }; seaFields.set(hole, f); return f;
}
const decoded = (hole: number) => grids.get(hole) ?? (grids.set(hole, decodeGrid(gridOf(hole))), grids.get(hole)!);
/** Class char code at sim (x, z); no string allocation, for per-frame and per-instance lookups. */
export const cellCode = (hole: number, x: number, z: number): number => {
  const g = gridOf(hole), cells = decoded(hole);
  const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
  return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 111 : cells[iz * g.nx + ix]!;
};
export const cellClass = (hole: number, x: number, z: number): string => String.fromCharCode(cellCode(hole, x, z));

/** One canvas pixel block per cell: `mirrorX` for the 3D plane (sim +x is three -x), `flipZ` for the minimap (far end at the top). */
export function gridCanvas(hole: number, px: number, mirrorX: boolean, flipZ: boolean): HTMLCanvasElement {
  const key = `${hole}:${px}:${mirrorX}:${flipZ}`; const hit = cache.get(key); if (hit) return hit;
  const g = gridOf(hole), cells = grids.get(hole) ?? (grids.set(hole, decodeGrid(g)), grids.get(hole)!);
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
  const g = gridOf(hole), cells = decoded(hole), W = g.nx * MASK_PX, H = g.nz * MASK_PX;
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
uniform sampler2D uDetail; varying vec2 vWxz; varying float vUpY; varying float vWy;
#ifdef HAS_FINE
uniform sampler2D uFine; uniform vec4 uGridF; varying float vFine; varying vec2 vBunk;
#endif
#ifdef HAS_SEA
uniform sampler2D uSea; uniform vec4 uGrid; uniform float uSeaY;
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
#ifdef HAS_FINE
{ ivec2 fs = textureSize(uFine, 0); vec2 fu = (vec2(-vWxz.x, vWxz.y) - uGridF.xy) * uGridF.zw;
  if (vFine < 0.5 && texelFetch(uFine, clamp(ivec2(floor(fu * vec2(fs))), ivec2(0), fs - 1), 0).r > 0.5) discard; }   // a fine tile is drawn here
#endif
#ifdef HAS_SEA
if (textureLod(uSea, (vec2(-vWxz.x, vWxz.y) - uGrid.xy) * uGrid.zw, 0.0).r > 0.55) discard;   // the ocean (ocean.ts) and the cliffs (coast.ts) show through
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
#ifdef HAS_FINE
  // on a sculpted bunker the sand ends crisply at the foot of the grass face (the geometry's own edge), not along the blurred mask
  bool bowl = vFine > 0.5 && vBunk.x >= 0.0;
  if (bowl) { float rest = sum - wt[5], s = clamp(vBunk.x, 0.0, 1.0); for (int i = 0; i < 5; i++) wt[i] = rest > 0.01 ? wt[i] / rest * (1.0 - s) : (i == 2 ? 1.0 - s : 0.0); wt[5] = s; sum = 1.0; }
#endif
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
  #ifdef HAS_FINE
    if (bowl) lip = 0.0;
  #endif
    alb = mix(alb, mix(vec3(0.17, 0.2, 0.08), vec3(0.42, 0.38, 0.2), tNoise(vWxz * 5.0)), clamp(lip, 0.0, 0.85));
    // the flat ground has no bunker bowl, so fake its face: the lip toward the sun shades the sand behind it (sun from environment.ts SUN_DIR)
  #ifdef HAS_FINE
    // real bowls here (fineTiles): the light does the face; the sand is raked in lines that fade before they alias
    float rph = dot(sim, vec2(0.6, 0.8)) * 19.0 + tNoise(vWxz * 0.35) * 7.0, rfw = fwidth(rph);
    alb *= 1.0 + ws * (0.07 * sin(rph + 2.0 * tNoise(vWxz * 1.3)) * (1.0 - smoothstep(0.6, 2.2, rfw)) + 0.06);
    alb *= mix(vec3(1.0), vec3(1.05, 1.0, 0.9), ws);   // warm cream in the sun, not grey-white
    if (bowl) alb *= mix(1.0, 0.72 + 0.2 * tNoise(vWxz * 3.0), vBunk.y);   // the dense, darker grass collar down the face
  #else
    float wsSun = texture2D(uMaskB, muv + vec2(-0.507, -0.862) * 1.6 * uGrid.zw).g;
    alb *= 1.0 - 0.45 * ws * clamp(1.0 - wsSun * 1.4, 0.0, 1.0);
  #endif
  #ifdef HAS_SEA
    // traced sand on the cliff tops and shore reads as native scrub and fescue in the photos (h08-chasm, h06-cliffs), not white bunker sand
    float coast = smoothstep(0.02, 0.12, textureLod(uSea, muv, 4.0).r) * ws;
  #ifdef HAS_FINE
    if (bowl) coast = 0.0;
  #endif
    alb = mix(alb, mix(vec3(0.075, 0.1, 0.03), vec3(0.16, 0.14, 0.07), tNoise(vWxz * 0.6)) * (0.8 + 0.4 * tNoise(vWxz * 4.0)), coast);
  #endif
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
#ifdef HAS_SEA
  // steep ground by the sea is bare cliff (h08-chasm, h06-cliffs): tawny-ochre sandstone in bands, greying toward the water, dark and wet at it
  float rock = smoothstep(0.9, 0.74, vUpY) * smoothstep(0.0, 0.03, textureLod(uSea, (sim - uGrid.xy) * uGrid.zw, 3.0).r);
#ifdef HAS_FINE
  if (vFine > 0.5) rock = 0.0;   // a sculpted bunker face is turf, not cliff
#endif
  if (rock > 0.0) {
    float hs = vWy - uSeaY, band = tNoise(vec2((vWxz.x + vWxz.y) * 0.08, vWy * 1.1)), grain = tNoise(vWxz * 1.7 + vWy);
    vec3 ochre = mix(vec3(0.3, 0.18, 0.08), vec3(0.47, 0.3, 0.14), band) * (0.8 + 0.4 * grain);
    vec3 rc = mix(vec3(0.36, 0.35, 0.33) * (0.8 + 0.4 * grain), ochre, smoothstep(1.5, 7.0, hs)) * mix(0.55, 1.0, smoothstep(0.2, 1.6, hs));
    diffuseColor.rgb = mix(diffuseColor.rgb, rc, rock); turfW *= 1.0 - rock;
  }
#endif
}
#endif`;

type TerrainU = { uSeaY: { value: number }; uFine: { value: THREE.Texture | null }; uSea: { value: THREE.Texture | null }; uDetail: { value: THREE.Texture | null }; uAlb: { value: THREE.Texture | null }; uNrm: { value: THREE.Texture | null }; uMaskA: { value: THREE.Texture | null }; uMaskB: { value: THREE.Texture | null }; uGrid: { value: THREE.Vector4 }; uStripe: { value: THREE.Vector2 }; uGridF: { value: THREE.Vector4 } };
/** Ground mesh for a hole in three space (x mirrored, as everywhere in the client). Starts with the lie grid's canvas colours;
 *  the HD turf replaces them once `turf` resolves (if it resolves to null, a generated grass texture is multiplied in as detail instead). */
export function terrainMesh(h: Pick<HoleInfo, 'course' | 'index' | 'tee' | 'pin'>, turf: Promise<Turf | null>, detail: boolean): THREE.Mesh {
  const hole = keyOf(h), g = gridOf(hole), tex = new THREE.CanvasTexture(gridCanvas(hole, 4, true, false));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ax = h.pin.x - h.tee.x, az = h.pin.z - h.tee.z, al = Math.hypot(ax, az) || 1;
  const u: TerrainU = { uSeaY: { value: seaY(hole) }, uFine: { value: null }, uSea: { value: seaField(hole).tex }, uDetail: { value: null }, uAlb: { value: null }, uNrm: { value: null }, uMaskA: { value: null }, uMaskB: { value: null },
    uGrid: { value: new THREE.Vector4(g.x0, g.z0, 1 / (g.nx * g.cell), 1 / (g.nz * g.cell)) }, uStripe: { value: new THREE.Vector2(-az / al, ax / al) }, uGridF: { value: new THREE.Vector4(g.x0, g.z0, 1 / (g.nx * g.cell), 1 / (g.nz * g.cell)) } };
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  mat.userData.turf = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz; varying float vUpY; varying float vWy;\n#ifdef HAS_FINE\nattribute float aFine; varying float vFine; attribute vec2 aBunk; varying vec2 vBunk;\n#endif').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = (modelMatrix * vec4(position, 1.0)).xz; vWy = (modelMatrix * vec4(position, 1.0)).y; vUpY = normalize(mat3(modelMatrix) * objectNormal).y;\n#ifdef HAS_FINE\nvFine = aFine; vBunk = aBunk;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${TURF_COMMON}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${TURF_MAP}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef HAS_TURF\nroughnessFactor = mix(roughnessFactor, turfN.z, turfW);\n#endif')
      // the baked turf slopes tilt the terrain's own world normal (gentle ground: adding them in world x/z is close enough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef HAS_TURF\nif (turfW > 0.0) { vec2 sl = (turfN.xy * 2.0 - 1.0) * turfW; vec3 gw = normalize((vec4(normal, 0.0) * viewMatrix).xyz); normal = normalize((viewMatrix * vec4(normalize(gw + vec3(sl.x, 0.0, sl.y)), 0.0)).xyz); }\n#endif');
  };
  mat.defines = seaDefs(hole);
  // one vertex per height node (4 m), displaced by the shared height field; the lie colours and turf masks stay on the 2 m grid as textures
  const w = g.nx * g.cell, d = g.nz * g.cell, hh = COURSE_HEIGHTS[courseOf(hole)]![hole % HOLES_PER_COURSE]!, geo = new THREE.PlaneGeometry(w, d, hh.nx - 1, hh.nz - 1).rotateX(-Math.PI / 2);
  const cx = -(g.x0 + w / 2), cz = g.z0 + d / 2, pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) pos.setY(i, ground(hole, -(pos.getX(i) + cx), pos.getZ(i) + cz));   // three x is mirrored sim x
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, 0, cz); m.receiveShadow = true; m.userData.hole = hole;
  const fine = fineTiles(hole, geo, hh.nx - 1, hh.nz - 1, cx, cz);
  if (fine) {   // the sculpted bunkers and mounds: same material, the coarse ground is discarded under them
    geo.setAttribute('aFine', new THREE.Float32BufferAttribute(new Float32Array(pos.count), 1));
    const f = new THREE.Mesh(fine, mat); f.receiveShadow = true; m.add(f);
    u.uFine.value = micro(hole).mask;
  }
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
export const isCoastal = (hole: number) => gridOf(hole).coastal;
/** Coastal holes cut the sea out of the terrain so the ocean and cliffs below show through; holes with sculpted bunkers hide the coarse ground under the fine tiles. */
const seaDefs = (hole: number): Record<string, string> => ({ ...(gridOf(hole).coastal && seaField(hole).any ? { HAS_SEA: '' } : {}), ...(micro(hole).tiles.length ? { HAS_FINE: '' } : {}) });

// ---- Visual micro-terrain (Pebble only): bunker bowls with steep grass faces and a lip, and mounds around the 17th and 18th greens.
// Client-side drawing only: the server's lie and physics keep the shared height field; the ball, golfers, cart and grass are drawn
// on visualGround so they sit in the bowl rather than float over it.
const SAND = 115, GREEN_C = 103, FAIRWAY = 102, TILE_CELLS = 8, FINE_SEGS = 24;
interface Micro { sd: Float32Array; green: Float32Array; fair: Float32Array; seaD: Float32Array; mounds: boolean; tiles: number[]; mask: THREE.DataTexture | null }
const micros = new Map<number, Micro>();
/** Chamfer distance (m) from each cell to the nearest cell where `src` is true (0 on those cells). */
function distTo(g: HoleGrid, src: (i: number) => boolean): Float32Array {
  const n = g.nx * g.nz, d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = src(i) ? 0 : 1e9;
  const D = (i: number, j: number, w: number) => { if (d[j]! + w < d[i]!) d[i] = d[j]! + w; }, c1 = g.cell, c2 = g.cell * 1.414;
  for (let z = 0; z < g.nz; z++) for (let x = 0; x < g.nx; x++) { const i = z * g.nx + x; if (x) D(i, i - 1, c1); if (z) { D(i, i - g.nx, c1); if (x) D(i, i - g.nx - 1, c2); if (x < g.nx - 1) D(i, i - g.nx + 1, c2); } }
  for (let z = g.nz - 1; z >= 0; z--) for (let x = g.nx - 1; x >= 0; x--) { const i = z * g.nx + x; if (x < g.nx - 1) D(i, i + 1, c1); if (z < g.nz - 1) { D(i, i + g.nx, c1); if (x < g.nx - 1) D(i, i + g.nx + 1, c2); if (x) D(i, i + g.nx - 1, c2); } }
  return d;
}
function micro(hole: number): Micro {
  const hit = micros.get(hole); if (hit) return hit;
  const g = gridOf(hole), n = g.nx * g.nz, none: Micro = { sd: new Float32Array(0), green: new Float32Array(0), fair: new Float32Array(0), seaD: new Float32Array(0), mounds: false, tiles: [], mask: null };
  if (courseOf(hole) !== 'pebble') { micros.set(hole, none); return none; }   // parkland courses keep their flat bunkers
  const cells = decoded(hole), sea = seaField(hole).sea, sand = new Uint8Array(n);
  // bunkers only: traced sand within reach of the sea is native scrub on the cliff tops (terrain shader), not a bowl
  const seaD = distTo(g, i => !!sea[i]), seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) if (cells[s] === SAND && !seen[s]) {
    const comp = [s]; seen[s] = 1; let near = 0;
    for (let k = 0; k < comp.length; k++) { const i = comp[k]!, x = i % g.nx; for (const j of [x > 0 ? i - 1 : -1, x < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx]) if (j >= 0 && j < n && cells[j] === SAND && !seen[j]) { seen[j] = 1; comp.push(j); } }
    for (const i of comp) near += seaD[i]! < 8 ? 1 : 0;
    if (near < comp.length * 0.2) for (const i of comp) sand[i] = 1;
  }
  // signed distance to the bunker edge, metres, positive in the sand; the edge sits half a cell from the cell centres
  const din = distTo(g, i => !sand[i]), dout = distTo(g, i => !!sand[i]), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) sd[i] = sand[i] ? din[i]! - g.cell / 2 : -(dout[i]! - g.cell / 2);
  // a 3x3 box pass (plus a little back for the shrink) rounds off the 2 m cell staircase, so the lips curve instead of zigzagging
  for (let pass = 0; pass < 1; pass++) { const src = sd.slice(); for (let z = 1; z < g.nz - 1; z++) for (let x = 1; x < g.nx - 1; x++) { let a = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) a += Math.max(-8, src[(z + dz) * g.nx + x + dx]!); sd[z * g.nx + x] = a / 9 + 0.35; } }
  const k = hole % HOLES_PER_COURSE, mounds = k === 16 || k === 17;
  const m: Micro = { sd, mounds, tiles: [], mask: null,
    green: mounds ? distTo(g, i => cells[i] === GREEN_C) : new Float32Array(0), fair: mounds ? distTo(g, i => cells[i] === FAIRWAY) : new Float32Array(0), seaD };
  micros.set(hole, m);
  // 16 m tiles where the offset is non-zero anywhere on their fine vertices get a fine mesh; the coarse ground is hidden there
  const tx = Math.ceil(g.nx / TILE_CELLS), tz = Math.ceil(g.nz / TILE_CELLS), T = TILE_CELLS * g.cell, step = T / FINE_SEGS, px = new Uint8Array(n);
  for (let j = 0; j < tz; j++) for (let i = 0; i < tx; i++) {
    let hit = false; const x0 = g.x0 + i * T, z0 = g.z0 + j * T;
    for (let b = 0; b <= FINE_SEGS && !hit; b++) for (let a = 0; a <= FINE_SEGS && !hit; a++) if (dip(hole, x0 + a * step, z0 + b * step) !== 0) hit = true;
    if (!hit) continue;
    m.tiles.push(j * tx + i);
    for (let cz = j * TILE_CELLS; cz < Math.min(g.nz, (j + 1) * TILE_CELLS); cz++) px.fill(255, cz * g.nx + i * TILE_CELLS, cz * g.nx + Math.min(g.nx, (i + 1) * TILE_CELLS));
  }
  if (m.tiles.length) { m.mask = new THREE.DataTexture(px, g.nx, g.nz, THREE.RedFormat); m.mask.unpackAlignment = 1; m.mask.needsUpdate = true; }
  return m;
}
/** Bilinear sample of a per-cell field at sim (x, z) (cell centres). */
function cellLerp(g: HoleGrid, f: Float32Array, x: number, z: number): number {
  const fx = Math.min(g.nx - 1, Math.max(0, (x - g.x0) / g.cell - 0.5)), fz = Math.min(g.nz - 1, Math.max(0, (z - g.z0) / g.cell - 0.5));
  const i = Math.min(g.nx - 2, Math.floor(fx)), j = Math.min(g.nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, k = j * g.nx + i;
  return (1 - v) * ((1 - u) * f[k]! + u * f[k + 1]!) + v * ((1 - u) * f[k + g.nx]! + u * f[k + g.nx + 1]!);
}
const sstep = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
/** Bunker cross-section by signed distance to the traced edge (m, + in the sand): a rounded grass lip about 0.55 m proud a few metres
 *  out, a steep grass face down to the edge, then a sand floor 1 m down that dishes a little more toward the middle. */
export function bunkerProfile(sd: number): number {
  if (sd >= 0) return -1.0 - 0.3 * sstep(0, 5, sd);
  if (sd > -1.2) return 0.55 - 1.55 * sstep(-1.2, 0, sd);
  return 0.55 * sstep(-4.5, -1.2, sd);
}
/** How far the drawn ground departs from the physics ground at sim (x, z) (metres, 0 off Pebble and away from bunkers and mounds). */
export function dip(hole: number, x: number, z: number): number {
  const m = micro(hole); if (!m.sd.length) return 0;
  const g = gridOf(hole), sd = cellLerp(g, m.sd, x, z);
  let off = sd > -4.5 ? bunkerProfile(sd) : 0;
  if (m.mounds) {
    const gd = cellLerp(g, m.green, x, z);
    if (gd > 2.5 && gd < 18) {
      const w = Math.sin(Math.PI * (gd - 2.5) / 15.5) * sstep(1, 6, cellLerp(g, m.fair, x, z)) * sstep(3, 8, cellLerp(g, m.seaD, x, z));
      if (w > 0) off += (hole % HOLES_PER_COURSE === 16 ? 1.7 : 1.1) * w * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.23 + Math.sin(z * 0.17) * 2.1) * Math.cos(z * 0.21 - x * 0.07)));
    }
  }
  return Math.abs(off) < 1e-4 ? 0 : off;
}
/** The drawn ground: the physics height plus the visual bunker bowls and green mounds. For the ball, golfers, cart, grass and camera. */
export const visualGround = (hole: number, x: number, z: number) => ground(hole, x, z) + dip(hole, x, z);

/** Fine 16 m tiles over the bunkers and mounds (2/3 m spacing), in the terrain mesh's local frame, for `coarse` (the 4 m plane, before its
 *  position is set). Each tile follows the coarse triangles exactly plus the offset, with a skirt so no crack shows where it meets them. */
function fineTiles(hole: number, coarse: THREE.BufferGeometry, segX: number, segZ: number, cx: number, cz: number): THREE.BufferGeometry | null {
  const m = micro(hole); if (!m.tiles.length) return null;
  const g = gridOf(hole), w = g.nx * g.cell, d = g.nz * g.cell, sw = w / segX, sh = d / segZ, P = coarse.attributes.position!, N = coarse.attributes.normal!;
  const node = (i: number, j: number) => j * (segX + 1) + i;
  /** coarse triangle interpolation (PlaneGeometry splits each quad along (i, j+1)-(i+1, j)) of height and normal at sim (x, z) */
  const coarseAt = (x: number, z: number, n: THREE.Vector3) => {
    const u = Math.min(segX - 1e-6, Math.max(0, (g.x0 + w - x) / sw)), v = Math.min(segZ - 1e-6, Math.max(0, (z - g.z0) / sh)), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const [A, Bn, C, wa, wb, wc] = fu + fv <= 1 ? [node(i, j), node(i, j + 1), node(i + 1, j), 1 - fu - fv, fv, fu] : [node(i + 1, j + 1), node(i, j + 1), node(i + 1, j), fu + fv - 1, 1 - fu, 1 - fv];
    n.set(N.getX(A) * wa + N.getX(Bn) * wb + N.getX(C) * wc, N.getY(A) * wa + N.getY(Bn) * wb + N.getY(C) * wc, N.getZ(A) * wa + N.getZ(Bn) * wb + N.getZ(C) * wc);
    return P.getY(A) * wa + P.getY(Bn) * wb + P.getY(C) * wc;
  };
  const tx = Math.ceil(g.nx / TILE_CELLS), T = TILE_CELLS * g.cell, st = T / FINE_SEGS, R = FINE_SEGS + 1;
  const pos: number[] = [], nrm: number[] = [], bunk: number[] = [], idx: number[] = [], n = new THREE.Vector3(), e = 0.25;
  for (const t of m.tiles) {
    const x0 = g.x0 + (t % tx) * T, z0 = g.z0 + Math.floor(t / tx) * T, base = pos.length / 3;
    for (let b = 0; b < R; b++) for (let a = 0; a < R; a++) {
      const x = x0 + a * st, z = z0 + b * st, y = coarseAt(x, z, n) + dip(hole, x, z);
      // offset slope tilts the coarse normal (three x is mirrored sim x)
      const fx = -(dip(hole, x + e, z) - dip(hole, x - e, z)) / (2 * e), fz = (dip(hole, x, z + e) - dip(hole, x, z - e)) / (2 * e);
      n.divideScalar(Math.max(0.2, n.y)).add({ x: -fx, y: 0, z: -fz } as THREE.Vector3).normalize();
      pos.push(-x - cx, y, z - cz); nrm.push(n.x, n.y, n.z);
      const sd = cellLerp(g, m.sd, x, z); bunk.push(sd > -4.5 ? sstep(-0.2, 0.2, sd) : -1, sstep(-1.7, -1.0, sd) * (1 - sstep(-0.1, 0.1, sd)));   // sand weight (-1: leave the mask), grass face
    }
    for (let b = 0; b < FINE_SEGS; b++) for (let a = 0; a < FINE_SEGS; a++) { const p = base + b * R + a; idx.push(p, p + 1, p + R, p + 1, p + R + 1, p + R); }   // sim x runs to three -x, so this winding faces up
    // skirt: each edge vertex again 0.4 m lower
    const ring = [...Array.from({ length: R }, (_, a) => a), ...Array.from({ length: R - 1 }, (_, b) => (b + 1) * R + FINE_SEGS), ...Array.from({ length: R - 1 }, (_, a) => FINE_SEGS * R + FINE_SEGS - 1 - a), ...Array.from({ length: R - 2 }, (_, b) => (FINE_SEGS - 1 - b) * R)];
    const s0 = pos.length / 3;
    for (const r of ring) { const k = (base + r) * 3; pos.push(pos[k]!, pos[k + 1]! - 0.4, pos[k + 2]!); nrm.push(nrm[k]!, nrm[k + 1]!, nrm[k + 2]!); bunk.push(bunk[(base + r) * 2]!, bunk[(base + r) * 2 + 1]!); }
    for (let q = 0; q < ring.length; q++) { const a = base + ring[q]!, b2 = base + ring[(q + 1) % ring.length]!, a1 = s0 + q, b1 = s0 + (q + 1) % ring.length; idx.push(a, b2, a1, b2, b1, a1, a, a1, b2, b2, a1, b1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aFine', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1)); geo.setAttribute('aBunk', new THREE.Float32BufferAttribute(bunk, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
  return geo;
}

/** Deterministic prop spots from the traced grid: trees where the graphic shows trees, rocks on the shore, kept near the playing corridor. */
export const themeOf = (hole: number) => COURSES[COURSE_IDS[Math.floor(hole / HOLES_PER_COURSE)]!].theme;
/** Tree density on Pebble's open clifftop holes (0-based), from the photos: the 7th and 8th are treeless links ground (h07, h08-chasm), 6, 9 and 10 sparse. */
const OPEN_LINKS: Record<number, number> = { 5: 0.35, 6: 0, 7: 0.08, 8: 0.35, 9: 0.35 };
/** A tree spot stands on dry land: at least 0.3 m above the real sea and no sea cell within 4 m (the terrain is cut away at the shore). */
function dryLand(hole: number, x: number, z: number): boolean {
  if (ground(hole, x, z) < seaY(hole) + 0.3) return false;
  const g = gridOf(hole), sea = seaField(hole).sea, cx = Math.floor((x - g.x0) / g.cell), cz = Math.floor((z - g.z0) / g.cell);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const ix = cx + dx, iz = cz + dz; if (ix >= 0 && iz >= 0 && ix < g.nx && iz < g.nz && sea[iz * g.nx + ix]) return false; }
  return true;
}
export function propSpots(hole: number): PropSpot[] {
  if (themeOf(hole) === 'parkland') return treeLines(hole);
  const g = gridOf(hole), sea = seaField(hole).sea; let seed = (hole + 1) * 2654435761 >>> 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const trees: PropSpot[] = [], rocks: PropSpot[] = [];
  for (let z = g.z0; z < g.z0 + g.nz * g.cell; z += 6) for (let x = g.x0; x < g.x0 + g.nx * g.cell; x += 6) {
    const px = x + rnd() * 6, pz = z + rnd() * 6, r = rnd(), c = sea[Math.floor((pz - g.z0) / g.cell) * g.nx + Math.floor((px - g.x0) / g.cell)] ? 'w' : cellClass(hole, px, pz);   // land specks drawn as sea get no props
    if (c === 't' && r < 0.22 * (OPEN_LINKS[hole % HOLES_PER_COURSE] ?? 1) && trees.length < 150 && dryLand(hole, px, pz)) trees.push({ kind: rnd() < 0.6 ? 'cypress' : 'pine', x: px, z: pz, scale: 0.8 + rnd() * 0.5, rotY: rnd() * 6.28 });
    else if (c === 'k' && r < 0.12 && rocks.length < 30) rocks.push({ kind: 'rock', x: px, z: pz, scale: 0.7 + rnd() * 0.8, rotY: rnd() * 6.28 });
  }
  return [...trees, ...rocks];
}

/** Parkland: dense oak and maple tree lines where the traced canopy meets open ground (the band within 5 cells, about 10 m),
 *  on a jittered 5 m lattice, nearest the playing corridor first; the deep woods behind are the canopy colour of the terrain. */
function treeLines(hole: number): PropSpot[] {
  const g = gridOf(hole), cells = decoded(hole), T = 116, OOB = 111, N = g.nx * g.nz, DEPTH = 5;
  const dist = new Uint8Array(N).fill(255); let front: number[] = [];
  for (let i = 0; i < N; i++) if (cells[i] !== T && cells[i] !== OOB) { dist[i] = 0; front.push(i); }
  for (let d = 1; d <= DEPTH && front.length; d++) {
    const next: number[] = [];
    for (const i of front) { const x = i % g.nx, z = (i - x) / g.nx;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= g.nx || nz >= g.nz) continue; const j = nz * g.nx + nx; if (cells[j] === T && dist[j] === 255) { dist[j] = d; next.push(j); } } }
    front = next;
  }
  let seed = (hole + 1) * 2654435761 >>> 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const zMax = g.z0 + g.nz * g.cell, cand: { s: PropSpot; p: number }[] = [];
  for (let z = g.z0; z < zMax; z += 5) for (let x = g.x0; x < g.x0 + g.nx * g.cell; x += 5) {
    const px = x + rnd() * 5, pz = z + rnd() * 5, ix = Math.floor((px - g.x0) / g.cell), iz = Math.floor((pz - g.z0) / g.cell);
    const k = rnd(), r = rnd(), sc = 0.75 + rnd() * 0.4;
    if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) continue;
    const d = dist[iz * g.nx + ix]!; if (d === 255 || d === 0) continue;
    cand.push({ s: { kind: k < 0.6 ? 'oak' : 'maple', x: px, z: pz, scale: sc, rotY: r * 6.28 }, p: d * 25 + Math.abs(px) * 0.5 });
  }
  return cand.sort((a, b) => a.p - b.p).slice(0, 300).map(c => c.s);
}

/** Rangefinder view: fits the hole's grid into a W x H canvas, tee at the bottom, pin at the top, sim +x to the right. */
export function rfView(hole: number, W: number, H: number) {
  const g = gridOf(hole), gw = g.nx * g.cell, gh = g.nz * g.cell, s = Math.min(W / gw, H / gh) * 0.98, cx = g.x0 + gw / 2, cz = g.z0 + gh / 2;
  const toScreen = (x: number, z: number): [number, number] => [W / 2 + (x - cx) * s, H / 2 - (z - cz) * s];
  const toWorld = (sx: number, sy: number): { x: number; z: number } => ({ x: cx + (sx - W / 2) / s, z: cz - (sy - H / 2) / s });
  const [x0, y0] = toScreen(g.x0, g.z0 + gh);
  return { s, toScreen, toWorld, x0, y0, w: gw * s, h: gh * s };
}
