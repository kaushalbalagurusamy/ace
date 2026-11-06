// Golfer animation as data (PRD/02 §6): key poses and timings taken from the Dunaway down-the-line clip (refs/swing, 30 fps),
// blended by the swing state. Pure: no three.js, no clock. golferrig.ts applies a Pose to the skinned model.
//
// Model space: metres, origin between the feet, the golfer faces +Z, his left (the target side for a right-hander) is +X.
// Euler triples are radians, three.js 'XYZ' order: x tilts forward, y turns (negative = away from the target), z side-bends.
import { FULL_TURN_MS } from '../sim/length';
import { BASE, P_KEYED, POSES } from './swingprior';
import { SWING_CAPTURE } from './motion/swingcapture';
import { GAIT_CAPTURE } from './motion/gaitcapture';

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

// ---- walking and running: captured gait cycles (src/client/motion/gaitcapture.ts), foot-locked ----
type Cycle = (typeof GAIT_CAPTURE)[keyof typeof GAIT_CAPTURE];
/** The captured cycles by their capture speed: Muybridge's walk (~1.4 m/s), a 3 m/s treadmill jog and a 9 m/s treadmill sprint. */
export const GAITS: readonly Cycle[] = [GAIT_CAPTURE.walk, GAIT_CAPTURE.jog, GAIT_CAPTURE.sprint];
/** Fastest believable cadence, cycles per second: 5 steps a second, an elite sprinter's. */
export const MAX_CADENCE = 2.5;
/** Longest ground contact of one foot, metres: about 1.1 leg lengths of the rig (0.78 m hip to ankle), as for a sprinter. */
export const MAX_CONTACT_M = 0.85;
/** Which captured cycles play at `speed` (m/s) and how much of the second: pure walk up to 2 m/s, pure jog from 2.6 to 6 (the
 *  5 m/s Shift pace; no human walks at 5 m/s, so it is a jog), pure sprint from 8 (the 15 m/s default run). */
export function gaitMix(speed: number): { a: Cycle; b: Cycle; k: number } {
  const [w, j, s] = GAITS as [Cycle, Cycle, Cycle];
  if (speed < 2) return { a: w, b: w, k: 0 };
  if (speed < 2.6) return { a: w, b: j, k: smooth((speed - 2) / 0.6) };
  if (speed < 6) return { a: j, b: j, k: 0 };
  if (speed < 8) return { a: j, b: s, k: smooth((speed - 6) / 2) };
  return { a: s, b: s, k: 0 };
}
/** A cycle's cadence at `speed`: the capture's, time-scaled by (speed / capture speed)^0.4 (people lengthen the stride more than
 *  they quicken it) and capped at MAX_CADENCE; the stride makes up the rest. */
const cycleRate = (c: Cycle, speed: number) => Math.min(MAX_CADENCE, Math.max(0.6 * c.cadence, c.cadence * (Math.max(0.3, speed) / c.speed) ** 0.4));
/** Gait phase advance, cycles per second (one cycle = two steps, from left-foot strike). */
export function gaitCadence(speed: number): number { const m = gaitMix(speed); return lerp(cycleRate(m.a, speed), cycleRate(m.b, speed), m.k); }
/** Stride scale for a cycle at `speed`: how much further than captured the body travels per cycle (stride x scale x cadence = speed). */
export const strideScale = (c: Cycle, speed: number) => Math.max(0.3, speed) / (c.stride * gaitCadence(speed));
/** Each foot's stance at `speed`, as [start, duration] in cycle fractions. Faster than the capture, the foot stays down for the same
 *  ground distance it did in the clip (sprinters' contacts shorten, legs do not lengthen), so its stance takes a smaller share of
 *  the cycle and the swing a larger one; slower, the share grows up to 80%, then the stance travel shrinks instead. */
export function gaitStance(c: Cycle, speed: number): { l: [number, number]; r: [number, number]; zScale: number } {
  // the ground a foot covers in one contact is also capped at MAX_CONTACT_M (the clip's own contacts, at a 15% height threshold,
  // read long; past it the rig's legs cannot reach without the hips sinking into a lunge), so the whole foot path is scaled to fit
  const s = strideScale(c, speed), D = c.stance[1] - c.stance[0], Dr = Math.min(0.8, D / s, MAX_CONTACT_M / (c.stride * s));
  return { l: [c.stance[0], Dr], r: [c.stance[2], Dr], zScale: (s * Dr) / D };
}
const sampleAt = (c: Cycle, phase: number) => {
  const n = c.samples.length, x = (((phase % 1) + 1) % 1) * n, i = Math.floor(x) % n, j = (i + 1) % n, t = x - Math.floor(x);
  return c.samples[i]!.map((v, k) => lerp(v, c.samples[j]![k]!, t));
};
function cyclePose(c: Cycle, phase: number, speed: number): Pose {
  const q = sampleAt(c, phase), v3 = (r: readonly number[], k: number, sz = 1): V3 => [r[k]!, r[k + 1]!, r[k + 2]! * sz];
  const st = gaitStance(c, speed), D = c.stance[1] - c.stance[0];
  // a foot's own phase is warped so its runtime stance [0, Dr] plays the captured stance [0, D] and the rest plays the swing
  const foot = (on: number, Dr: number) => {
    const f = (((phase - on) % 1) + 1) % 1, g = f <= Dr ? (f * D) / Dr : D + ((f - Dr) * (1 - D)) / (1 - Dr);
    return sampleAt(c, on + g);
  };
  const L = foot(st.l[0], st.l[1]), R = foot(st.r[0], st.r[1]), lean = q[0]!, py = q[1]!, ty = q[3]!, idle = POSES.idle;
  return { ...idle, pelvis: [0.3 * lean, py, q[2]!], torso: [0.7 * lean, ty, 0], head: [-0.8 * lean, -0.6 * (py + ty), 0], shift: [0, q[4]!, 0],
    lAnkle: v3(L, 5, st.zScale), rAnkle: v3(R, 8, st.zScale), lHeel: L[11]!, rHeel: R[12]!, free: { l: v3(q, 13), r: v3(q, 16) }, lPole: v3(q, 19), rPole: v3(q, 22) };
}
/** Walking or running at `speed` m/s, `phase` in cycles (advance it by gaitCadence(speed) per second); below 0.8 m/s it blends
 *  into the idle at time `t` seconds, and at 0.3 m/s and under it is the idle. */
export function gaitPose(phase: number, speed: number, t = 0): Pose {
  const m = gaitMix(speed), a = cyclePose(m.a, phase, speed);
  const g = m.k > 0 ? lerpPose(a, cyclePose(m.b, phase, speed), m.k) : a;
  const k = smooth((speed - 0.3) / 0.5);
  return k >= 1 ? g : lerpPose(idlePose(t), g, k);
}

/** Standing idle at time `t` seconds, authored: breathing (15 a minute: chest and arms rise a little) and a slow weight shift from
 *  foot to foot (every ~12 s: the hips slide over the loaded foot and its hip rises), feet planted. */
export function idlePose(t: number): Pose {
  const i = POSES.idle, b = Math.sin(t * Math.PI * 2 * 0.25), w = Math.sin(t * Math.PI * 2 * 0.083);
  const arm = (p: V3): V3 => [p[0] + 0.02 * w, p[1] + 0.006 * b, p[2]];
  return { ...i, shift: [0.025 * w, -0.004 + 0.003 * b, 0], pelvis: [0, 0, 0.04 * w], torso: [-0.012 * b, 0, -0.03 * w], head: [0.01 * b, 0, 0.01 * w],
    free: { l: arm(i.free!.l), r: arm(i.free!.r) } };
}

/** Driver's seat (the cart's seat seam is the hip point; this model space has the hips at the origin's height of the rig, so the
 *  caller lowers the model by the rest hip height): sitting upright, feet on the floor ahead, both hands on the rim at ten and two,
 *  turned with the wheel by `steer` (-1 left .. 1 right). Wheel centre and column axis are the cart's (cartmodel.ts seat/wheel). */
export function seatedPose(steer = 0, wheel: V3 = SEATED_WHEEL, axis: V3 = [0, 0.34, -0.94]): Pose {
  const n = norm(axis), u = norm([0, -n[2], n[1]]), a = -steer * 0.9, R = 0.15;   // u: "up" in the rim's plane
  const rim = (ang: number): V3 => { const c = Math.cos(ang), s = Math.sin(ang); return [wheel[0] + R * c, wheel[1] + R * s * u[1], wheel[2] + R * s * u[2]]; };
  return { ...POSES.idle, pelvis: [-0.12, 0, 0], torso: [0.16, 0, 0], head: [-0.04, 0, 0], shift: [0, 0, 0],
    lAnkle: [-0.03, 0.42, 0.48], rAnkle: [0.03, 0.42, 0.48], free: { l: rim(0.6 + a), r: rim(Math.PI - 0.6 + a) }, lPole: [0.6, -1, -0.2], rPole: [-0.6, -1, -0.2] };
}
/** The steering wheel centre relative to the seated golfer's model space (seat (0.38, 1.15, 0.2) -> wheel (0.38, 1.45, 0.66) in the
 *  cart, hips at the rig's rest height 1.011). */
const SEATED_WHEEL: V3 = [0, 1.011 + 0.3, -0.028 + 0.46];

const ease2 = (x: number) => clamp01(x) ** 2;
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 2;
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
