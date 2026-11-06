// Fescue tufts on the bunker lips (docs/research/pebble-look.md "Turf": steep faces with a ragged lip of longer, darker,
// straw-tipped grass). Code-generated: one InstancedMesh of blade clumps on every turf cell that borders sand.
import * as THREE from 'three';
import { GRIDS } from '../shared/course-grid';
import { cellCode } from './terrain';

const SAND = 115, GREEN = 103;
const hash = (x: number, z: number, k: number) => { const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };

function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], N = 9;
  for (let b = 0; b < N; b++) {
    const a = (b / N) * Math.PI * 2 + b * 0.9, r = 0.02 + 0.05 * ((b * 37) % 5) / 5, h = 0.32 + 0.3 * ((b * 53) % 7) / 7, lean = 0.12 + 0.08 * (b % 3);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, tx = Math.cos(a + 1.57) * 0.014, tz = Math.sin(a + 1.57) * 0.014;
    pos.push(cx - tx, 0, cz - tz, cx + tx, 0, cz + tz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    col.push(0.16, 0.2, 0.08, 0.16, 0.2, 0.08, 0.62, 0.56, 0.3);   // dark olive base, straw tips (fescue-lip swatch #56553F with blond stems)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}
let geo: THREE.BufferGeometry | null = null;
const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

/** Lip tufts for one hole (three space); `perCell` tufts on each 2 m turf cell next to sand (not on the green). */
export function makeFescue(hole: number, perCell: number): THREE.InstancedMesh | null {
  if (perCell <= 0) return null;
  const g = GRIDS[hole]!, spots: [number, number][] = [];
  for (let iz = 0; iz < g.nz; iz++) for (let ix = 0; ix < g.nx; ix++) {
    const x = g.x0 + (ix + 0.5) * g.cell, z = g.z0 + (iz + 0.5) * g.cell, c = cellCode(hole, x, z);
    if (c === SAND || c === GREEN || c === 111 || c === 119) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cellCode(hole, x + dx! * g.cell, z + dz! * g.cell) === SAND)) continue;
    for (let k = 0; k < perCell; k++) spots.push([x + (hash(x, z, k) - 0.5) * g.cell, z + (hash(z, x, k + 7) - 0.5) * g.cell]);
  }
  if (!spots.length) return null;
  const im = new THREE.InstancedMesh(geo ??= tuftGeometry(), mat, spots.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3();
  spots.forEach(([x, z], i) => im.setMatrixAt(i, m.compose(p.set(-x, 0, z), q.setFromAxisAngle(up, hash(x, z, 3) * 6.28), s.setScalar(0.8 + 0.7 * hash(z, x, 5)))));
  im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'fescue'; return im;
}
