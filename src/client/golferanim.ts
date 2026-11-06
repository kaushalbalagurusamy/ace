// Golfer animation as data (PRD/02 §6): key poses and timings taken from the Dunaway down-the-line clip (refs/swing, 30 fps),
// blended by the swing state. Pure: no three.js, no clock. golferrig.ts applies a Pose to the skinned model.
//
// Model space: metres, origin between the feet, the golfer faces +Z, his left (the target side for a right-hander) is +X.
// Euler triples are radians, three.js 'XYZ' order: x tilts forward, y turns (negative = away from the target), z side-bends.
import { FULL_TURN_MS } from '../sim/length';
import { BASE, P_KEYED, POSES } from './swingprior';
import { SWING_CAPTURE } from './motion/swingcapture';

export type V3 = readonly [number, number, number];
export interface Pose {
  pelvis: V3;  /** Hips rotation; legs follow by IK so the feet stay planted */
  shift: V3;   /** Hips translation, metres */
  torso: V3;   /** whole-spine rotation relative to the pelvis, spread over the three spine bones */
  head: V3;    /** head relative to the torso */
  lAnkle: V3; rAnkle: V3;  /** ankle target offsets from the rest stance, metres */
  lHeel: number; rHeel: number;  /** heel lift (foot pitch about the toes), radians */
  grip: V3;    /** lead (left) wrist, model space */
  tgrip: V3;   /** lead wrist as an offset from the mid-shoulder point in the turned thorax frame (x lead, y up the spine, z out of the chest) */
  gripT: number;   /** 0 = use grip, 1 = use tgrip (blends between keys) */
  shaft: V3;   /** club direction, grip to head */
  face: V3;    /** clubface normal hint */
  lPole: V3; rPole: V3;  /** elbow bend directions */
  /** walk/idle: each wrist has its own target and the club hangs from the trail hand */
  free?: { l: V3; r: V3 };
}

/** Unpacks one captured frame (the field order of pack() in scripts/motion/retarget-swing.ts). */
export function unpack(f: readonly number[]): Pose {
  const v = (i: number): V3 => [f[i]!, f[i + 1]!, f[i + 2]!];
  return { pelvis: v(0), shift: v(3), torso: v(6), head: v(9), lAnkle: v(12), rAnkle: v(15), lHeel: f[18]!, rHeel: f[19]!, grip: v(20), tgrip: v(23),
    gripT: f[26]!, shaft: v(27), face: v(30), lPole: v(33), rPole: v(36) };
}
/** The swing as the game plays it: the Dunaway clip pose-estimated frame by frame and retargeted onto the rig (src/client/motion),
 *  one Pose per 30 fps frame from P1 (address) to P10 (finish). This curve, not the hand-keyed prior, is the source of truth. */
export const SWING_CURVE: readonly Pose[] = SWING_CAPTURE.frames.map(unpack);
/** P1..P10 as frame indices into SWING_CURVE, detected from the lead-wrist path in the reference. */
export const P_FRAMES = SWING_CAPTURE.keys;
const K = P_FRAMES;
/** Captured phase frames (30 fps, 0 = address). */
export const DUNAWAY = { fps: SWING_CAPTURE.fps, takeaway: K[0], p2: K[1], top: K[3], impact: K[6], finish: K[9] } as const;
const D = DUNAWAY;
/** Backswing to downswing time from the captured phases, about 3:1 (tour tempo). */
export const TEMPO = (D.top - D.takeaway) / (D.impact - D.top);
/** The game turns the full backswing in FULL_TURN_MS (750 ms), so the clip's other phases scale by the same factor. */
const MS_PER_FRAME = FULL_TURN_MS / (D.top - D.takeaway);
export const DOWNSWING_MS = (D.impact - D.top) * MS_PER_FRAME;   // P4 to P7 at full depth
export const FOLLOW_MS = (D.finish - D.impact) * MS_PER_FRAME;   // P7 to P10
export const HOLD_MS = 700, RETURN_MS = 400;                     // hold the finish, then ease back to standing
export { POSES };
/** The ten standard swing positions (right-handed) as captured. swingPoses() aims P1 and P7 at the ball per club. */
export const P_POS: readonly Pose[] = K.map(i => SWING_CURVE[i]!);
/** The hand-keyed P1-P10 the capture was fused with (P-system ranges, club shaft and face). */
export { P_KEYED };

/** Hold fraction (0..1 of the 750 ms turn) at which P1..P4 are reached (owner spec, Dunaway tempo). */
export const BACK_KEYS = [0, 0.25, 0.55, 1] as const;

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
export function addressPoint(length: number, putt = false): V3 { return addressHead((putt ? POSES.puttAddress : P_POS[0]!).grip, length, putt ? 0.02 : 0.0); }   // ball just behind the hands: shaft lean

/** Backswing depth from the hold time: 0 at the press, 1 at the full turn (750 ms); longer holds stay at the top. */
export const backswingDepth = (holdMs: number) => clamp01(holdMs / FULL_TURN_MS);

/** Piecewise-linear map of x through the points (xs[i], ys[i]) (xs ascending), clamped at the ends. */
function warp(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]!) return lerp(ys[i - 1]!, ys[i]!, (x - xs[i - 1]!) / (xs[i]! - xs[i - 1]!));
  return ys[ys.length - 1]!;
}
/** The captured curve at fractional frame f for a club of `length`. MediaPipe sees no club, so the shaft comes from the prior,
 *  except that it aims from the hands to the ball at address and impact for this club, easing back to the prior by P2 and P6/P8. */
export function curvePose(f: number, length: number): Pose {
  const n = SWING_CURVE.length - 1, x = Math.min(n, Math.max(0, f)), i = Math.min(n - 1, Math.floor(x));
  const p = lerpPose(SWING_CURVE[i]!, SWING_CURVE[i + 1]!, x - i);
  const w = x <= K[1] ? 1 - smooth((x - K[0]) / (K[1] - K[0])) : x >= K[5] && x <= K[7] ? 1 - smooth(x < K[6] ? (K[6] - x) / (K[6] - K[5]) : (x - K[6]) / (K[7] - K[6])) : 0;
  return w > 0 ? { ...p, shaft: norm(lv(p.shaft, withClub(p, addressPoint(length)).shaft, w)) } : p;
}
/** P1..P10 for a club (P1 and P7 with the shaft aimed at the ball). */
export const swingPoses = (length: number): Pose[] => K.map(i => curvePose(i, length));

/** Captured frame for a hold fraction 0..1: P1 at 0, P2 at 0.25, P3 at 0.55, P4 at 1.0 (owner's keys), the clip's own motion between. */
export const backswingFrame = (depth: number) => warp(clamp01(depth), BACK_KEYS, [K[0], K[1], K[2], K[3]]);
/** Backswing pose at a hold fraction 0..1. A partial swing stops part way along the captured backswing. */
export function backswingPose(depth: number, length: number): Pose { return curvePose(backswingFrame(depth), length); }

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

/** Pose `ms` after the release from a backswing of `depth`; done once the golfer is back at rest.
 *  Full swing: the captured downswing P4 -> P7 then follow-through P7 -> P10, played at the clip's own speed (its acceleration and
 *  deceleration are in the capture), scaled so the backswing takes FULL_TURN_MS. A partial swing joins the captured downswing at
 *  its own depth (blending in from where its backswing stopped) and its follow-through stops at the matching fraction of P7..P10. */
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
  if (ms < T.down) {
    const k = clamp01(ms / T.down), g = K[6] - d * (K[6] - K[3]);   // full depth starts at the top (P4); none starts at impact
    const p = curvePose(lerp(g, K[6], k), length);
    return { pose: d >= 1 ? p : lerpPose(backswingPose(d, length), p, smooth(k / 0.4)), done: false, impact };
  }
  const u = ms - T.down, end9 = K[6] + d * (K[9] - K[6]), fin = curvePose(end9, length);   // where this swing's follow-through ends
  if (u < T.follow) return { pose: curvePose(lerp(K[6], end9, u / T.follow), length), done: false, impact };
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
