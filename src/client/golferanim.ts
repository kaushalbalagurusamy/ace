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
  tgrip: V3;   /** lead wrist as an offset from the mid-shoulder point in the turned thorax frame (x lead, y up the spine, z out of the chest) */
  gripT: number;   /** 0 = use grip, 1 = use tgrip (blends between keys) */
  shaft: V3;   /** club direction, grip to head */
  face: V3;    /** clubface normal hint */
  lPole: V3; rPole: V3;  /** elbow bend directions */
  /** walk/idle: each wrist has its own target and the club hangs from the trail hand */
  free?: { l: V3; r: V3 };
}

/** Dunaway clip key frames (30 fps, frame 0 = clip start), stepped by hand with ffmpeg: takeaway, P2 (shaft parallel back),
 *  P4 (top), P7 (impact), P10 (finish). */
export const DUNAWAY = { fps: 30, takeaway: 28, p2: 45, top: 75, delivery: 85, impact: 90, through: 97, finish: 118 } as const;
const D = DUNAWAY;
/** Backswing to downswing time, 47:15 frames, about 3:1 (tour tempo). */
export const TEMPO = (D.top - D.takeaway) / (D.impact - D.top);
/** The game turns the full backswing in FULL_TURN_MS (750 ms), so the clip's other phases scale by the same factor. */
const MS_PER_FRAME = FULL_TURN_MS / (D.top - D.takeaway);
export const DOWNSWING_MS = (D.impact - D.top) * MS_PER_FRAME;   // ~239 ms P4 to P7 at full depth
export const FOLLOW_MS = (D.finish - D.impact) * MS_PER_FRAME;   // ~447 ms P7 to P10
export const HOLD_MS = 700, RETURN_MS = 400;                     // hold the finish, then ease back to standing

const P = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });
const BASE: Pose = {
  pelvis: [0, 0, 0], shift: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0], lAnkle: [0, 0, 0], rAnkle: [0, 0, 0], lHeel: 0, rHeel: 0,
  grip: [0.05, 0.8, 0.36], tgrip: [0, 0, 0], gripT: 0, shaft: [0, -0.7, 0.7], face: [1, 0, 0], lPole: [0.3, -0.2, -1], rPole: [-0.3, -0.2, -1],
};
const deg = (d: number) => (d * Math.PI) / 180;
// Turns (y) are about the spine: pelvis = hip turn, pelvis + torso = shoulder turn; negative is away from the target.
const STANCE = { lAnkle: [0.05, 0, 0] as V3, rAnkle: [-0.05, 0, 0] as V3 };
const TILT = 0.53, SPINE = 0.08;   // ~35° forward from the hips (pelvis) plus a flat upper back; kept P1 to P7 (no standing up)

/** The ten standard swing positions (right-handed). P1 and P7 aim the shaft at the ball per club (withClub). */
export const P_POS: readonly Pose[] = [
  // P1 address: hip hinge, knees flexed, spine 5° away from the target, arms hanging, hands a fist off the thighs, slight shaft lean
  P({ ...STANCE, pelvis: [TILT, 0, 0], shift: [0, -0.06, -0.14],   // ~15-20° knee flex, not a squat
    torso: [SPINE, 0, deg(5)], head: [0.22, 0, 0],
    grip: [0.08, 0.8, 0.22], lPole: [0.35, -0.2, -1], rPole: [-0.35, -0.2, -1] }),   // reachable with straight-ish arms; elbows toward the hips
  // P2 shaft parallel back: shoulders 45°, hips 17°, head outside the hands, toe up, lead arm straight
  P({ ...STANCE, pelvis: [TILT, deg(-17), 0], shift: [-0.02, -0.08, -0.14], torso: [SPINE, deg(-32), deg(5)], head: [0.22, deg(40), 0],
    grip: [-0.3, 0.9, 0.3], shaft: [-1, 0.06, 0.14], face: [0, 0.15, 1], lPole: [0, -1, -0.2], rPole: [0, -1, -0.3] }),
  // P3 lead arm parallel: shoulders 75°, hips 35°, wrists fully hinged (shaft up), trail elbow folding
  P({ ...STANCE, pelvis: [TILT, deg(-35), 0], shift: [-0.03, -0.1, -0.14], torso: [SPINE, deg(-40), deg(5)], head: [0.22, deg(70), 0], lHeel: 0.08,
    grip: [-0.4, 1.05, 0.05], shaft: [0.1, 0.8, 0.55],   // DTL: hands chest high over the trail side, shaft angled toward the ball line
    face: [0, 0.2, 1], lPole: [0, -1, 0], rPole: [0, -1, -0.1] }),
  // P4 top: shoulders 90°, hips 45°, lead arm across the chest, hands above the trail shoulder, trail elbow down, shaft along the line.
  // tgrip is in the turned thorax frame: after a 90° turn the chest faces away from the target, so the trail side of the head is OUT of the chest (+z)
  P({ ...STANCE, pelvis: [TILT, deg(-45), 0], shift: [-0.04, -0.07, -0.14], torso: [SPINE, deg(-45), deg(5)], head: [0.22, deg(85), 0], lHeel: 0.15,
    grip: [-0.25, 1.5, -0.1], tgrip: [-0.3, 0.0, 0.3], gripT: 1, shaft: [1, 0.02, -0.1], face: [0, -0.3, 1], lPole: [0, -1, 0], rPole: [0, -1, 0] }),   // hands at head height over the trail shoulder, trail elbow down
  // P5 lead arm parallel down: hands between shoulder and hip, shaft shallowed toward the trail side with ~90° lag, hips 25° open, pelvis 9 cm toward the target, shoulders 45° closed, lag (shaft ~90° to the lead arm)
  P({ ...STANCE, pelvis: [TILT, deg(30), 0], shift: [0.09, -0.1, -0.14], torso: [SPINE, deg(-75), deg(12)], head: [0.22, deg(45), 0],
    grip: [-0.3, 1.02, 0.24], shaft: [-0.3, 0.9, -0.25],   // lead arm level, shaft up and slightly behind: ~90° of lag
    face: [0, 0.2, 1], lPole: [0, -1, 0], rPole: [0, -1, -0.2], rHeel: 0.05 }),
  // P6 shaft parallel down: hips about 38° open (seen from above), shoulders 20° closed, trail knee toward the ball, hands hip high
  P({ ...STANCE, pelvis: [TILT, deg(46), 0], shift: [0.11, -0.1, -0.13], torso: [SPINE, deg(-66), deg(13)], head: [0.22, deg(20), 0],
    grip: [-0.22, 0.9, 0.3], shaft: [-1, 0, -0.05], face: [0, 0.2, 1], lPole: [0, -1, -0.2], rPole: [0, -1, -0.4], rHeel: 0.25, rAnkle: [-0.05, 0.015, 0.02] }),
  // P7 impact: hips 40° open, shoulders 20° open, pelvis over the lead foot, hands 13 cm ahead (shaft lean), trail heel up, head behind the ball
  P({ ...STANCE, pelvis: [TILT - 0.04, deg(48), 0], shift: [0.14, -0.09, -0.12], torso: [SPINE, deg(-22), deg(15)], head: [0.22, deg(-20), 0], rHeel: 0.5,
    rAnkle: [-0.05, 0.03, 0.03], grip: [0.17, 0.82, 0.27], lPole: [0.35, -0.2, -1], rPole: [-0.35, -0.2, -1] }),
  // P8 shaft parallel through: arms extended, trail arm over, club head up (toe up)
  P({ ...STANCE, pelvis: [0.42, deg(60), 0], shift: [0.1, -0.06, -0.1], torso: [0.1, deg(-10), deg(6)], head: [0.18, deg(-15), 0], rHeel: 0.6,
    rAnkle: [-0.07, 0.03, 0.03], grip: [0.42, 0.95, 0.34], shaft: [1, 0.1, 0.1], face: [0, 0.15, 1], lPole: [0, -1, 0.3], rPole: [0, -1, -0.2] }),
  // P9 trail arm parallel: chest to the target, wrists re-hinging
  P({ ...STANCE, pelvis: [0.25, deg(78), 0], shift: [0.11, -0.04, -0.06], torso: [0.04, deg(14), deg(3)], head: [0.1, deg(-35), 0], rHeel: 0.9,
    rAnkle: [-0.05, 0.06, 0.06], grip: [0.32, 1.32, 0.12], shaft: [0.2, 1, -0.4], face: [0, 0, -1], lPole: [0, -1, 0.2], rPole: [0, -1, 0] }),
  // P10 finish: belt buckle and chest to the target or left of it, weight on the lead foot, trail toe up, club behind the head
  P({ ...STANCE, pelvis: [0.08, deg(92), 0], shift: [0.12, -0.02, 0], torso: [-0.08, deg(12), deg(3)], head: [0, deg(-30), 0], rHeel: 1.2,
    rAnkle: [-0.02, 0.09, 0.09], grip: [0.02, 1.56, -0.2], shaft: [-0.6, -0.2, 0.77], face: [0, 0, -1], lPole: [0, -1, 0], rPole: [0, -1, 0] }),
];

/** Idle and putting poses. */
export const POSES = {
  idle: P({ free: { l: [0.24, 0.86, 0.04], r: [-0.24, 0.86, 0.04] }, shaft: [0, -0.62, 0.78], face: [0, 0, 1], lPole: [0, 0, -1], rPole: [0, 0, -1] }),
  puttAddress: P({ pelvis: [0.42, 0, 0], shift: [0, -0.07, -0.08], torso: [0.3, 0, 0], head: [0.25, 0, 0], lAnkle: [0.02, 0, 0], rAnkle: [-0.02, 0, 0],
    grip: [0.0, 0.8, 0.32], shaft: [0.02, -0.97, 0.25], face: [1, 0, 0], lPole: [0.2, 0, -1], rPole: [-0.2, 0, -1] }),
} satisfies Record<string, Pose>;

/** Hold fraction (0..1 of the 750 ms turn) at which P1..P4 are reached (owner spec, Dunaway tempo). */
export const BACK_KEYS = [0, 0.25, 0.55, 1] as const;
/** Release: P4->P5->P6->P7 over the downswing, P7->P8->P9->P10 over the follow-through (fractions of each phase). */
export const DOWN_KEYS = [0, 0.45, 0.75, 1] as const, FOLLOW_KEYS = [0, 0.3, 0.6, 1] as const;

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

/** Piecewise blend along `poses` at parameter t in 0..1 with `keys` (ascending, keys[0] = 0, last = 1). */
function along(poses: readonly Pose[], keys: readonly number[], t: number): Pose {
  const x = clamp01(t);
  for (let i = 1; i < keys.length; i++) if (x <= keys[i]! || i === keys.length - 1) return lerpPose(poses[i - 1]!, poses[i]!, clamp01((x - keys[i - 1]!) / (keys[i]! - keys[i - 1]!)));
  return poses[poses.length - 1]!;
}
/** P1 and P7 for a club: the shaft aimed from the hands to the head resting at the ball. */
export const swingPoses = (length: number): Pose[] => { const h = addressPoint(length); return P_POS.map((p, i) => (i === 0 || i === 6 ? withClub(p, h) : p)); };

/** Backswing pose at a hold fraction 0..1: P1 -> P2 (0.25) -> P3 (0.55) -> P4 (1.0). A partial swing stops part way. */
export function backswingPose(depth: number, length: number): Pose { return along(swingPoses(length).slice(0, 4), BACK_KEYS, depth); }

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
 *  Full swing: (backswing pose) -> P5 -> P6 -> P7 eased in, then P7 -> P8 -> P9 -> P10 eased out; a partial swing joins the
 *  downswing at its own depth and its follow-through stops at the matching fraction of the P7..P10 path. */
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
  const S = swingPoses(length), from = backswingPose(d, length);
  if (ms < T.down) {
    // the downswing keys that lie "below" the backswing depth are skipped: a half swing goes straight to P6 and P7
    const k = ease2(ms / T.down), path = d > BACK_KEYS[2] ? [from, S[4]!, S[5]!, S[6]!] : d > BACK_KEYS[1] ? [from, S[5]!, S[6]!] : [from, S[6]!];
    const keys = path.length === 4 ? DOWN_KEYS : path.length === 3 ? [0, 0.6, 1] : [0, 1];
    return { pose: along(path, keys, k), done: false, impact };
  }
  const u = ms - T.down, fin = along(S.slice(6), FOLLOW_KEYS, d);   // where this swing's follow-through ends
  if (u < T.follow) return { pose: along(S.slice(6), FOLLOW_KEYS, easeOut(u / T.follow) * d), done: false, impact };
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
