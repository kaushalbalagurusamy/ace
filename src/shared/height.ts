// Shared height field (server physics and client visuals): real Pebble Beach elevation per hole (course-height.ts, docs/research/elevation.md).
// Heights are metres above the hole's tee; x right, z toward the pin. Bilinear on the 4 m grid, clamped at the edges; pure and deterministic.
import { HEIGHTS } from './course-height';

export interface Vec3 { x: number; y: number; z: number }
const grids: (Int16Array | undefined)[] = [];
function grid(hole: number): Int16Array {
  let g = grids[hole]; if (g) return g;
  const bin = atob(HEIGHTS[hole]!.data), dv = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  g = new Int16Array(bin.length / 2); for (let i = 0; i < g.length; i++) g[i] = dv.getInt16(i * 2, true);
  return (grids[hole] = g);
}

export function heightAt(hole: number, x: number, z: number): number {
  const H = HEIGHTS[hole]!, g = grid(hole);
  const fx = Math.min(H.nx - 1, Math.max(0, (x - H.x0) / H.cell)), fz = Math.min(H.nz - 1, Math.max(0, (z - H.z0) / H.cell));
  const i = Math.min(H.nx - 2, Math.floor(fx)), j = Math.min(H.nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, k = j * H.nx + i;
  return ((1 - v) * ((1 - u) * g[k]! + u * g[k + 1]!) + v * ((1 - u) * g[k + H.nx]! + u * g[k + H.nx + 1]!)) / 100;
}

/** Unit surface normal (y up) from central differences half a cell either side: continuous, so slopes have no seams at cell edges. */
export function normalFrom(height: (x: number, z: number) => number, x: number, z: number, d = 2): Vec3 {
  const hx = (height(x + d, z) - height(x - d, z)) / (2 * d), hz = (height(x, z + d) - height(x, z - d)) / (2 * d), n = Math.hypot(hx, 1, hz);
  return { x: -hx / n, y: 1 / n, z: -hz / n };
}
export const normalAt = (hole: number, x: number, z: number): Vec3 => normalFrom((a, b) => heightAt(hole, a, b), x, z, HEIGHTS[hole]!.cell / 2);
/** Sea level on this hole, metres relative to its tee. */
export const seaLevel = (hole: number) => -HEIGHTS[hole]!.teeElevM;

export interface StanceSlope {
  /** + = uphill along the aim line (degrees) */ alongDeg: number;
  /** + = ball above the feet (ground rising toward the ball, a right-handed golfer standing left of the line), degrees */ sideDeg: number;
}
/** Stance slope at the ball for a shot aimed `aimDeg` clockwise from +z, from the surface normal. */
export function stanceSlope(n: Vec3, aimDeg: number): StanceSlope {
  const a = (aimDeg * Math.PI) / 180, fx = Math.sin(a), fz = Math.cos(a);   // forward; right is (fz, -fx)
  const hx = -n.x / n.y, hz = -n.z / n.y, deg = (t: number) => (Math.atan(t) * 180) / Math.PI;
  return { alongDeg: deg(hx * fx + hz * fz), sideDeg: deg(hx * fz - hz * fx) };
}
