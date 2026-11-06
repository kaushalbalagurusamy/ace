// Golfer animation as data (PRD/02 §6): key poses and timings taken from the Dunaway down-the-line clip (refs/swing, 30 fps),
// blended by the swing state. Pure: no three.js, no clock. golferrig.ts applies a Pose to the skinned model.
//
// Model space: metres, origin between the feet, the golfer faces +Z, his left (the target side for a right-hander) is +X.
// Euler triples are radians, three.js 'XYZ' order: x tilts forward, y turns (negative = away from the target), z side-bends.
import { FULL_TURN_MS } from '../sim/length';

export type V3 = readonly [number, number, number];
export interface Pose {
  pelvis: V3;  /** Hips rotation; legs follow by IK so the feet stay planted */
  shift: V3;   /** Hips translation, metres */
  torso: V3;   /** whole-spine rotation relative to the pelvis, spread over the three spine bones */
  head: V3;    /** head relative to the torso */
  lAnkle: V3; rAnkle: V3;  /** ankle target offsets from the rest stance, metres */
  lHeel: number; rHeel: number;  /** heel lift (foot pitch about the toes), radians */
  grip: V3;    /** lead (left) wrist, model space */
  shaft: V3;   /** club direction, grip to head */
  face: V3;    /** clubface normal hint */
  lPole: V3; rPole: V3;  /** elbow bend directions */
  /** walk/idle: each wrist has its own target and the club hangs from the trail hand */
  free?: { l: V3; r: V3 };
}

/** Dunaway clip key frames (30 fps, frame 0 = clip start), stepped by hand with ffmpeg. */
export const DUNAWAY = { fps: 30, takeaway: 28, hipHigh: 45, top: 75, delivery: 85, impact: 90, through: 97, finish: 118 } as const;
const D = DUNAWAY;
/** Where hands-at-hip-height falls in the backswing (0..1 of the turn): (45-28)/(75-28). */
export const HIP_DEPTH = (D.hipHigh - D.takeaway) / (D.top - D.takeaway);
/** Backswing to downswing time, 47:15 frames, about 3:1 (tour tempo). */
export const TEMPO = (D.top - D.takeaway) / (D.impact - D.top);
/** The game turns the full backswing in FULL_TURN_MS (750 ms), so the clip's other phases scale by the same factor. */
const MS_PER_FRAME = FULL_TURN_MS / (D.top - D.takeaway);
export const DOWNSWING_MS = (D.impact - D.top) * MS_PER_FRAME;   // ~239 ms at full depth
export const FOLLOW_MS = (D.finish - D.impact) * MS_PER_FRAME;   // ~447 ms impact to finish
export const HOLD_MS = 700, RETURN_MS = 400;                     // hold the finish, then ease back to standing

const P = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });
const BASE: Pose = {
  pelvis: [0, 0, 0], shift: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0], lAnkle: [0, 0, 0], rAnkle: [0, 0, 0], lHeel: 0, rHeel: 0,
  grip: [0.05, 0.8, 0.36], shaft: [0, -0.7, 0.7], face: [1, 0, 0], lPole: [0.3, -0.2, -1], rPole: [-0.3, -0.2, -1],
};

/** Key poses for the full swing (right-handed). grip/shaft at address and impact are replaced per club by addressShaft(). */
export const POSES = {
  idle: P({ free: { l: [0.24, 0.86, 0.04], r: [-0.24, 0.86, 0.04] }, shaft: [0, -0.62, 0.78], face: [0, 0, 1], lPole: [0, 0, -1], rPole: [0, 0, -1] }),
  address: P({ pelvis: [0.38, 0, 0], shift: [0, -0.1, -0.09], torso: [0.22, 0, 0], head: [0.1, 0, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.06, 0, 0],
    grip: [0.05, 0.8, 0.36] }),
  hipHigh: P({ pelvis: [0.38, -0.25, 0], shift: [-0.02, -0.1, -0.09], torso: [0.22, -0.5, -0.05], head: [0.1, 0.35, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.06, 0, 0],
    grip: [-0.38, 0.9, 0.34], shaft: [-1, 0.12, 0.05], face: [0, 0.2, 1], lPole: [0, -1, -0.3], rPole: [0, -1, -0.2] }),
  top: P({ pelvis: [0.36, -0.75, 0], shift: [-0.04, -0.1, -0.09], torso: [0.22, -0.85, -0.1], head: [0.1, 0.9, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.06, 0, 0], lHeel: 0.15,
    grip: [-0.3, 1.5, 0.04], shaft: [1, -0.04, -0.12], face: [0, -0.3, 1], lPole: [0, -1, 0.2], rPole: [0, -1, -0.2] }),
  delivery: P({ pelvis: [0.38, 0.2, 0], shift: [0.05, -0.1, -0.09], torso: [0.22, -0.55, 0.05], head: [0.1, 0.3, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.06, 0, 0],
    grip: [-0.25, 0.92, 0.36], shaft: [-0.7, 0.65, 0.1], face: [0, 0.3, 1], lPole: [0, -1, -0.2], rPole: [0, -1, -0.3] }),
  impact: P({ pelvis: [0.34, 0.55, 0], shift: [0.08, -0.09, -0.08], torso: [0.22, -0.25, 0.08], head: [0.1, 0.1, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.06, 0.02, 0], rHeel: 0.25,
    grip: [0.1, 0.84, 0.36] }),
  through: P({ pelvis: [0.3, 1.0, 0], shift: [0.1, -0.05, -0.04], torso: [0.2, 0.35, 0.1], head: [0.05, -0.3, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.06, 0.04, 0.04], rHeel: 0.6,
    grip: [0.45, 0.98, 0.3], shaft: [1, 0.15, 0.1], face: [0, 0.2, 1], lPole: [0, -1, 0.2], rPole: [0, -1, -0.2] }),
  finish: P({ pelvis: [0.08, 1.45, 0], shift: [0.12, -0.02, 0], torso: [-0.1, 0.35, 0.05], head: [0, -0.5, 0], lAnkle: [0.06, 0, 0], rAnkle: [-0.02, 0.08, 0.08], rHeel: 1.1,
    grip: [-0.08, 1.58, -0.14], shaft: [-0.7, -0.35, -0.55], face: [0, 0, -1], lPole: [0, -1, 0], rPole: [0, -1, 0] }),
  puttAddress: P({ pelvis: [0.42, 0, 0], shift: [0, -0.07, -0.08], torso: [0.3, 0, 0], head: [0.25, 0, 0], lAnkle: [0.02, 0, 0], rAnkle: [-0.02, 0, 0],
    grip: [0.0, 0.8, 0.32], shaft: [0.02, -0.97, 0.25], face: [1, 0, 0], lPole: [0.2, 0, -1], rPole: [-0.2, 0, -1] }),
} satisfies Record<string, Pose>;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lv = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const norm = (v: V3): V3 => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Blends two poses; directions are re-normalised, free-hand targets blend only when both poses have them. */
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out = {} as { -readonly [K in keyof Pose]: Pose[K] };
  for (const key of Object.keys(BASE) as (keyof Pose)[]) {
    const x = a[key], y = b[key];
    (out as Record<string, unknown>)[key] = typeof x === 'number' ? lerp(x, y as number, k) : lv(x as V3, y as V3, k);
  }
  out.shaft = norm(out.shaft); out.face = norm(out.face);
  if (a.free && b.free) out.free = { l: lv(a.free.l, b.free.l, k), r: lv(a.free.r, b.free.r, k) };
  else if (k < 0.5 ? a.free : b.free) out.free = (k < 0.5 ? a.free : b.free);
  return out;
}

/** Club head on the ground for a club of `length` (grip end to sole, metres) held at `grip`, ball `ballX` toward the target. */
export function addressHead(grip: V3, length: number, ballX = 0.05): V3 {
  const drop = grip[1] - 0.02, reach = Math.sqrt(Math.max(0.01, length * length - drop * drop - (ballX - grip[0]) ** 2));
  return [ballX, 0.02, grip[2] + reach];
}
/** Address or impact pose for a given club: the shaft runs from the grip to the head resting at the ball. */
function withClub(p: Pose, head: V3): Pose { return { ...p, shaft: norm([head[0] - p.grip[0], head[1] - p.grip[1], head[2] - p.grip[2]]) }; }
/** The club's address head point (also where the ball sits relative to the golfer in the stance). */
export function addressPoint(length: number, putt = false): V3 { return addressHead((putt ? POSES.puttAddress : POSES.address).grip, length, putt ? 0.02 : 0.05); }

/** Backswing depth from the hold time: 0 at the press, 1 at the full turn (750 ms); longer holds stay at the top. */
export const backswingDepth = (holdMs: number) => clamp01(holdMs / FULL_TURN_MS);

/** Backswing pose at a depth 0..1: address -> hands hip-high (at HIP_DEPTH) -> top, as in the clip. */
export function backswingPose(depth: number, length: number): Pose {
  const d = clamp01(depth), addr = withClub(POSES.address, addressPoint(length));
  return d <= HIP_DEPTH ? lerpPose(addr, POSES.hipHigh, d / HIP_DEPTH) : lerpPose(POSES.hipHigh, POSES.top, (d - HIP_DEPTH) / (1 - HIP_DEPTH));
}

/** Putting stroke: a pendulum, back at `depth` 0..1 (shoulders rock, wrists quiet). */
export function puttPose(t: number, length: number): Pose {   // t: -1 = full back, 0 = address, +1 = full through
  const a = withClub(POSES.puttAddress, addressPoint(length, true)), r = 0.35 * t;
  const head: V3 = [a.grip[0] + a.shaft[0] * length + r, 0.02, a.grip[2] + a.shaft[2] * length];
  const grip: V3 = [a.grip[0] + r * 0.4, a.grip[1] + Math.abs(t) * 0.02, a.grip[2]];
  return { ...a, torso: [a.torso[0], -0.25 * t, 0], grip, shaft: norm([head[0] - grip[0], head[1] - grip[1], head[2] - grip[2]]) };
}

/** Durations of the release phases for a backswing depth: shorter swings come down and finish sooner. */
export function releaseTimes(depth: number, putt = false) {
  const d = clamp01(depth);
  if (putt) return { down: 120 + 160 * d, follow: 200 + 200 * d, hold: 500, back: RETURN_MS };
  return { down: Math.max(110, DOWNSWING_MS * d), follow: FOLLOW_MS * (0.5 + 0.5 * d), hold: HOLD_MS, back: RETURN_MS };
}

/** Pose `ms` after the release from a backswing of `depth`; done once the golfer is back at rest. */
export function releasePose(depth: number, ms: number, length: number, putt = false): { pose: Pose; done: boolean; impact: boolean } {
  const d = clamp01(depth), T = releaseTimes(d, putt);
  const end = T.down + T.follow + T.hold + T.back, impact = ms >= T.down;
  if (putt) {
    const through = Math.min(1, 0.4 + d);
    const t = ms < T.down ? lerp(-d, 0, ease2(ms / T.down)) : lerp(0, through, easeOut(Math.min(1, (ms - T.down) / T.follow)));
    const pose = puttPose(t, length);
    if (ms <= T.down + T.follow + T.hold) return { pose, done: false, impact };
    return { pose: lerpPose(pose, POSES.idle, smooth((ms - T.down - T.follow - T.hold) / T.back)), done: ms >= end, impact };
  }
  const head = addressPoint(length), imp = withClub(POSES.impact, head);
  if (ms < T.down) {   // accelerating downswing, through the delivery position when the backswing got past hip height
    const k = ease2(ms / T.down), from = backswingPose(d, length);
    if (d <= HIP_DEPTH) return { pose: lerpPose(from, imp, k), done: false, impact };
    const f = (D.delivery - D.top) / (D.impact - D.top);
    return { pose: k < f ? lerpPose(from, POSES.delivery, k / f) : lerpPose(POSES.delivery, imp, (k - f) / (1 - f)), done: false, impact };
  }
  const thr = lerpPose(imp, POSES.through, Math.min(1, d * 1.6)), fin = lerpPose(thr, POSES.finish, d);
  const u = ms - T.down;
  if (u < T.follow) {
    const k = easeOut(u / T.follow), f = (D.through - D.impact) / (D.finish - D.impact);
    return { pose: k < f ? lerpPose(imp, thr, k / f) : lerpPose(thr, fin, (k - f) / (1 - f)), done: false, impact };
  }
  if (u < T.follow + T.hold) return { pose: fin, done: false, impact };
  return { pose: lerpPose(fin, POSES.idle, smooth((u - T.follow - T.hold) / T.back)), done: ms >= end, impact };
}

/** Walk cycle at `phase` radians; `amount` 0..1 blends from idle (speed / walk speed). */
export function walkPose(phase: number, amount: number): Pose {
  const s = Math.sin(phase), c = Math.cos(phase), a = clamp01(amount), st = 0.32 * a;
  const lift = (x: number) => Math.max(0, x) * 0.1 * a;
  const i = POSES.idle;
  return {
    ...i, pelvis: [0.05 * a, 0.12 * s * a, 0], shift: [0, -0.02 * a + 0.015 * Math.abs(c) * a, 0], torso: [0.04 * a, -0.18 * s * a, 0],
    lAnkle: [0, lift(c), st * s], rAnkle: [0, lift(-c), -st * s],
    free: { l: [i.free!.l[0], i.free!.l[1], i.free!.l[2] - 0.22 * s * a], r: [i.free!.r[0], i.free!.r[1], i.free!.r[2] + 0.22 * s * a] },
  };
}
/** Walk phase advance: one stride (half cycle) per ~1.1 m. */
export const strideRate = (speed: number) => (speed / 1.1) * Math.PI;

const ease2 = (x: number) => clamp01(x) ** 2;
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 2;
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
