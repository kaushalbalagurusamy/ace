// Draws the traced lie grid (the same data the server reads for physics) as terrain: a 3D ground mesh and the minimap.
import * as THREE from 'three';
import { GRIDS } from '../shared/course-grid';
import { decodeGrid } from '../shared/gridtools';
import { loadTexture, type PropSpot } from './assets';

/** Class colours from assets/STYLE.md: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p path, t trees, k rock/shore. */
const COL: Record<string, [number, number, number]> = {
  o: [38, 92, 52], w: [66, 150, 208], r: [63, 155, 78], c: [88, 176, 96], f: [111, 194, 106], g: [166, 217, 139],
  s: [239, 230, 210], p: [184, 184, 186], t: [47, 122, 63], k: [138, 143, 140],
};
/** Outside the traced map on an ocean hole is open sea (still out of bounds for the rules). */
const COL_OPEN_SEA: [number, number, number] = [48, 112, 170];
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
export const cellClass = (hole: number, x: number, z: number): string => {
  const g = GRIDS[hole]!, cells = grids.get(hole) ?? (grids.set(hole, decodeGrid(g)), grids.get(hole)!);
  const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
  return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 'o' : String.fromCharCode(cells[iz * g.nx + ix]!);
};

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
    const ch = String.fromCharCode(cells[cz * g.nx + cx]!), col = (ch === 'o' && g.coastal && sea[cz * g.nx + cx] ? COL_OPEN_SEA : COL[ch]) ?? COL.o!;
    const n = px > 1 ? 1 + (((x * 73856093) ^ (y * 19349663)) % 17) / 170 - 0.05 : 1; // faint grain so large areas do not look flat
    const i = (y * c.width + x) * 4; img.data[i] = col[0] * n; img.data[i + 1] = col[1] * n; img.data[i + 2] = col[2] * n; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (px > 1) { const soft = document.createElement('canvas'); soft.width = c.width; soft.height = c.height; const s = soft.getContext('2d')!; s.filter = 'blur(1.4px)'; s.drawImage(c, 0, 0); cache.set(key, soft); return soft; }
  cache.set(key, c); return c;
}

/** Ground mesh for a hole in three space (x mirrored, as everywhere in the client). A generated grass texture is multiplied in as fine detail once it loads. */
export function terrainMesh(hole: number): THREE.Mesh {
  const g = GRIDS[hole]!, tex = new THREE.CanvasTexture(gridCanvas(hole, 4, true, false));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshLambertMaterial({ map: tex }), uniforms = { uDetail: { value: null as THREE.Texture | null } };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDetail = uniforms.uDetail;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vWxz;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef HAS_DETAIL\n diffuseColor.rgb *= 0.55 + 0.9 * texture2D(uDetail, vWxz * 0.16).g;\n#endif');
  };
  mat.defines = {}; // the detail multiply is switched on only once the texture has loaded
  loadTexture('tex-rough').then(t => { if (t) { uniforms.uDetail.value = t; mat.defines = { HAS_DETAIL: '' }; mat.needsUpdate = true; } });
  const w = g.nx * g.cell, d = g.nz * g.cell, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  m.position.set(-(g.x0 + w / 2), 0, g.z0 + d / 2);
  return m;
}
export const isCoastal = (hole: number) => GRIDS[hole]!.coastal;

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
