// Turf texture baking (runs in turf-worker.ts at load time): pulls each photo's mean colour toward the course palette so the
// lies stay readable, and derives a normal + roughness map from luminance (height) with a wrap-around Sobel. Pure, no DOM.
import { SURFACES, type SurfaceId } from './graphics';

export interface TurfLayer { /** palette mean, sRGB 0-255: the olive Poa/rye turf and near-white sand of the real photos (docs/research/pebble-look.md) */ target: [number, number, number]; /** world metres per tile */ tile: number; /** relief of the blades in m */ depth: number }
export const TURF: Record<SurfaceId, TurfLayer> = {
  fairway: { target: [84, 134, 38], tile: 2.2, depth: 0.006 },
  firstcut: { target: [76, 120, 36], tile: 2.6, depth: 0.01 },
  rough: { target: [70, 96, 40], tile: 3.2, depth: 0.02 },
  fringe: { target: [92, 140, 46], tile: 2, depth: 0.004 },
  green: { target: [108, 152, 62], tile: 1.8, depth: 0.002 },
  sand: { target: [236, 230, 218], tile: 3.5, depth: 0.004 },
};
export const TURF_LAYERS = SURFACES.map(s => TURF[s]);
/** How far the photo's mean is pulled to the palette (1 = exactly the palette mean). */
const PULL = 0.7;

/** `px` is RGBA, n x n. Returns the tinted albedo (n x n RGBA) and a half-size map: R,G = slope x,z (0.5 = flat), B = roughness, A = 255. */
export function bakeLayer(px: ArrayLike<number>, n: number, layer: TurfLayer): { albedo: Uint8Array; normal: Uint8Array } {
  const count = n * n; let sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < count * 4; i += 4) { sr += px[i]!; sg += px[i + 1]!; sb += px[i + 2]!; }
  const gain = [sr, sg, sb].map((s, c) => Math.min(2.2, Math.max(0.45, 1 + PULL * (layer.target[c]! / Math.max(1, s / count) - 1))));
  const albedo = new Uint8Array(count * 4);
  for (let i = 0; i < count * 4; i += 4) {
    albedo[i] = Math.min(255, px[i]! * gain[0]!); albedo[i + 1] = Math.min(255, px[i + 1]! * gain[1]!); albedo[i + 2] = Math.min(255, px[i + 2]! * gain[2]!); albedo[i + 3] = 255;
  }
  // height = luminance at half size (2x2 average), normalised to 0..1
  const m = n >> 1, h = new Float32Array(m * m); let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
    let l = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) { const i = ((2 * y + dy) * n + 2 * x + dx) * 4; l += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!; }
    const v = (h[y * m + x] = l / 4); if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < m * m; i++) h[i] = (h[i]! - lo) / span;
  const strength = (layer.depth * m) / layer.tile;   // slope per normalised height step: relief over one texel's width in metres
  const normal = new Uint8Array(m * m * 4), H = (x: number, y: number) => h[((y + m) % m) * m + ((x + m) % m)]!;
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
    const gx = H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1);
    const gy = H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1);
    const o = (y * m + x) * 4, sx = Math.max(-1, Math.min(1, (-gx / 8) * strength)), sz = Math.max(-1, Math.min(1, (-gy / 8) * strength));
    normal[o] = Math.round((sx * 0.5 + 0.5) * 255); normal[o + 1] = Math.round((sz * 0.5 + 0.5) * 255);
    normal[o + 2] = Math.round((1 - 0.28 * H(x, y)) * 255); normal[o + 3] = 255;   // blade tips a little glossier than the shaded gaps
  }
  return { albedo, normal };
}
