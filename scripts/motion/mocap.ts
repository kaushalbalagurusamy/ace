// Shared motion-capture helpers for the retarget scripts: MediaPipe landmarks (scripts/motion/capture_pose.py) to the game's
// model space, temporal smoothing, and the fusion of a captured channel with key ranges (the single-camera depth fix).
import { readFileSync } from 'node:fs';

export type P3 = [number, number, number];
export interface Capture { fps: number; width: number; height: number; frames: { n: number; world: number[][] | null; image: number[][] | null }[] }
/** MediaPipe Pose landmark indices. */
export const LM = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26,
  lAnk: 27, rAnk: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 } as const;

export const load = (path: string): Capture => JSON.parse(readFileSync(path, 'utf8')) as Capture;

/** Fills missing frames by holding the nearest detection, so every frame has 33 landmarks. */
export function fill(c: Capture, key: 'world' | 'image', a: number, b: number): number[][][] {
  const out: number[][][] = []; let last: number[][] | null = null;
  for (let i = a; i <= b; i++) { const f = c.frames[i]?.[key] ?? null; if (f) last = f; out.push((last ?? []).map(p => [...p])); }
  const first = out.findIndex(f => f.length); for (let i = 0; i < first; i++) out[i] = out[first]!;
  return out;
}

/** Side-view label fix: when the legs (or arms) cross, MediaPipe often swaps left and right for a few frames. Each frame's pair is
 *  assigned to the limb it continues from (least image-space movement from the previous frame), in both image and world landmarks. */
export function deswap(img: number[][][], world: number[][][]) {
  const limbs = [[[25, 26], [27, 28], [29, 30], [31, 32]], [[13, 14], [15, 16], [17, 18], [19, 20], [21, 22]]];
  for (let i = 1; i < img.length; i++) for (const limb of limbs) {
    const d = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
    let keep = 0, swap = 0;
    for (const [l, r] of limb) { const p = img[i - 1]!, c = img[i]!; keep += d(c[l!]!, p[l!]!) + d(c[r!]!, p[r!]!); swap += d(c[l!]!, p[r!]!) + d(c[r!]!, p[l!]!); }
    if (swap < keep * 0.7) for (const f of [img[i]!, world[i]!]) for (const [l, r] of limb) { const t = f[l!]!; f[l!] = f[r!]!; f[r!] = t; }
  }
}

/** Running median (removes single-frame depth flips) then a 5-tap Savitzky-Golay (quadratic) smoother, edges clamped. */
export function smooth(xs: number[], med = 5): number[] {
  const n = xs.length, at = (a: number[], i: number) => a[Math.min(n - 1, Math.max(0, i))]!, h = med >> 1;
  const m = xs.map((_, i) => { const w: number[] = []; for (let k = -h; k <= h; k++) w.push(at(xs, i + k)); return w.sort((p, q) => p - q)[h]!; });
  const sg = [-3, 12, 17, 12, -3];
  return m.map((_, i) => sg.reduce((s, c, k) => s + c * at(m, i + k - 2), 0) / 35);
}

/** Per landmark, per axis smoothing of a frame series. */
export function smoothSeries(fr: number[][][]): number[][][] {
  const out = fr.map(f => f.map(p => [...p]));
  for (let j = 0; j < 33; j++) for (let ax = 0; ax < 3; ax++) {
    const s = smooth(fr.map(f => f[j]![ax]!)); s.forEach((v, i) => { out[i]![j]![ax] = v; });
  }
  return out;
}

/** MediaPipe world (x image right, y down, z away from the camera; origin mid-hip) to model space for a camera that looks along
 *  the golfer's target line from behind (down the line): x = toward the target, y up, z = toward the ball (the way he faces). */
export const dtl = (p: number[]): P3 => [p[2]!, -p[1]!, p[0]!];
/** For a side-on camera with the subject moving toward image right (running/walking): x = his left (away from the camera),
 *  y up, z = forward (image right). Same mapping as dtl: the subject faces image right in both clips. */
export const side = dtl;

export const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
export const mid = (a: P3, b: P3): P3 => mul(add(a, b), 0.5);
export const len = (a: P3) => Math.hypot(a[0], a[1], a[2]);
export const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: P3): P3 => mul(a, 1 / (len(a) || 1));
export const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Unwraps an angle series (radians) so it never jumps by 2π. */
export function unwrap(a: number[]): number[] { const o = [...a]; for (let i = 1; i < o.length; i++) { while (o[i]! - o[i - 1]! > Math.PI) o[i]! -= 2 * Math.PI; while (o[i]! - o[i - 1]! < -Math.PI) o[i]! += 2 * Math.PI; } return o; }

/** Fusion of a captured channel with key constraints: at each key frame the value is clamped into [lo, hi]; the correction this
 *  needs is interpolated linearly between keys (held flat outside them), so the captured shape between keys is kept. */
export function fuse(cap: number[], keys: { f: number; lo: number; hi: number }[]): number[] {
  const k = [...keys].sort((a, b) => a.f - b.f).map(q => ({ f: q.f, d: clamp(cap[q.f]!, q.lo, q.hi) - cap[q.f]! }));
  return cap.map((v, i) => {
    if (!k.length) return v;
    if (i <= k[0]!.f) return v + k[0]!.d;
    for (let j = 1; j < k.length; j++) if (i <= k[j]!.f) { const t = (i - k[j - 1]!.f) / (k[j]!.f - k[j - 1]!.f || 1); return v + k[j - 1]!.d + (k[j]!.d - k[j - 1]!.d) * t; }
    return v + k[k.length - 1]!.d;
  });
}

/** Elbow bend direction: the elbow's offset from the shoulder-wrist line, normalised, with its length (0 for a straight arm). */
export function pole(sh: P3, el: P3, wr: P3): { dir: P3; bend: number } {
  const u = norm(sub(wr, sh)), e = sub(el, sh), off = sub(e, mul(u, dot(e, u)));
  return { dir: norm(off), bend: len(off) };
}
