// Retargets the pose-estimated Dunaway swing (scripts/motion/capture_pose.py output) onto the golfer rig as a continuous swing
// curve, one Pose per captured frame from P1 (address) to P10 (finish), written to src/client/motion/swingcapture.ts.
//
// Usage: npx tsx scripts/motion/retarget-swing.ts <capture.json> <first> <last> [rigArmM]
//
// What comes from the capture (down the line, so depth is the camera's weak axis):
//   hip and shoulder turn (top-down angle of the hip and shoulder lines), forward spine tilt, head turn, the pelvis dip and
//   move toward the ball (relative to the feet), heel lift, the lead-wrist path (model space, and in the thorax frame near the
//   top) and both elbow bend directions, plus the phase timing (P1-P10 detected from the wrist path in the image).
// What comes from the hand-keyed prior (src/client/swingprior.ts), time-warped onto the detected phases: the club shaft and
//   face (MediaPipe has no club), the lateral shift toward the target and the side bend (both along the camera axis), ankles.
// Fusion: at each P key the captured turns, tilt, head, shift and heels are held inside the P-system ranges (the top-down turn
//   measurements in tests/golferrig.test.ts); the correction is interpolated between keys, so the captured shape survives.
// Address and impact pin the lead wrist to the prior's P1/P7 grip (where the club must meet the ball); the backswing is made
//   monotonic (the shoulders only turn further and the hands only rise) because the game scrubs it with the hold time.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { P_KEYED } from '../../src/client/swingprior';
import { lerpPose, type Pose, type V3 } from '../../src/client/golferanim';
import { LM, add, clamp, cross, dot, dtl, fill, fuse, len, load, mid, mul, norm, pole, r4, smooth, smoothSeries, sub, unwrap, type P3 } from './mocap';

const [capPath, a0s, a1s, armS] = process.argv.slice(2);
if (!capPath) throw new Error('usage: retarget-swing.ts <capture.json> <first> <last> [rigArmM]');
const cap = load(capPath), A0 = Number(a0s ?? 0), A1 = Number(a1s ?? cap.frames.length - 1), RIG_ARM = Number(armS ?? 0.55);
const deg = (d: number) => (d * Math.PI) / 180;

const W = smoothSeries(fill(cap, 'world', A0, A1)).map(f => f.map(p => dtl(p)));
const I = smoothSeries(fill(cap, 'image', A0, A1));
const N = W.length, w = (i: number, j: number) => W[i]![j]! as P3, v = (i: number, j: number) => I[i]![j]![1]!;

// ---- phases from the lead wrist in the image (v grows downward) ----
const lwI = (i: number) => I[i]![LM.lWr]!;
const speed = (i: number) => (i <= 0 || i >= N - 1 ? 0 : Math.hypot(lwI(i + 1)[0]! - lwI(i - 1)[0]!, lwI(i + 1)[1]! - lwI(i - 1)[1]!));
const argBy = (a: number, b: number, f: (i: number) => number) => { let best = a; for (let i = a; i <= b; i++) if (f(i) > f(best)) best = i; return best; };
const fastest = argBy(2, N - 3, speed);
// top = the END of the hands-highest plateau (the transition), impact = the hands' lowest point after it
const high = argBy(Math.max(0, fastest - 40), fastest, i => -v(i, LM.lWr));
let top = high; while (top + 1 < fastest && v(top + 1, LM.lWr) <= v(high, LM.lWr) + 0.005) top++;
const impact = argBy(top + 3, Math.min(N - 1, fastest + 6), i => v(i, LM.lWr));
const home = lwI(0), still = (i: number) => Math.hypot(lwI(i)[0]! - home[0]!, lwI(i)[1]! - home[1]!) <= 0.012;
let p1 = top; while (p1 > 0 && !still(p1)) p1--;
// "hip-pocket" height for P2/P6/P8 (shaft parallel to the ground): 30% of the way from the address wrist up to the lead shoulder
const pocket = (i: number) => v(p1, LM.lWr) - 0.3 * (v(p1, LM.lWr) - v(i, LM.lSh));
const first = (a: number, b: number, ok: (i: number) => boolean, dflt: number) => { for (let i = a; i <= b; i++) if (ok(i)) return i; return dflt; };
const p3 = first(p1 + 1, top, i => v(i, LM.lWr) <= v(i, LM.lSh), Math.round(p1 + (top - p1) * 0.6));   // lead arm parallel
const p2 = first(p1 + 1, p3 - 1, i => v(i, LM.lWr) <= pocket(i), Math.round(p1 + (p3 - p1) * 0.45));
const p5 = first(top + 1, impact - 2, i => v(i, LM.lWr) >= v(i, LM.lSh), Math.round(top + (impact - top) * 0.45));
const p6 = first(p5 + 1, impact - 1, i => v(i, LM.lWr) >= pocket(i), Math.round(p5 + (impact - p5) * 0.5));
const p8 = first(impact + 1, N - 1, i => v(i, LM.lWr) <= pocket(i), impact + 3);
const p9 = first(p8 + 1, N - 1, i => v(i, LM.rWr) <= v(i, LM.rSh), p8 + 4);                            // trail arm parallel
const p10 = argBy(p9 + 2, Math.min(N - 1, p9 + 25), i => -v(i, LM.lWr));                                // finish: hands highest
const KEYS = [p1, p2, p3, top, p5, p6, impact, p8, p9, p10];
for (let k = 1; k < KEYS.length; k++) if (!(KEYS[k]! > KEYS[k - 1]!)) throw new Error(`phase detection out of order: ${KEYS.join(',')}`);
console.log('phases (clip frames)', KEYS.map(k => k + A0).join(' '));

// ---- the prior, time-warped so its keys land on the detected phases ----
function prior(i: number): Pose {
  if (i <= KEYS[0]!) return P_KEYED[0]!;
  for (let k = 1; k < KEYS.length; k++) if (i <= KEYS[k]!) return lerpPose(P_KEYED[k - 1]!, P_KEYED[k]!, (i - KEYS[k - 1]!) / (KEYS[k]! - KEYS[k - 1]!));
  return P_KEYED[9]!;
}
const PR = Array.from({ length: N }, (_, i) => prior(i));

// ---- captured channels ----
// turn angles get a wide (11-frame) median: a shoulder depth flips for up to 5 frames in the transition; turns are monotonic between the top and the finish, which a median keeps exactly
const closedAngle = (a: number, b: number) => smooth(unwrap(W.map((_, i) => { const d = sub(w(i, a), w(i, b)); return Math.atan2(d[2], d[0]); })), 11);
const rel = (s: number[]) => s.map(x => x - s[p1]!);
const hipTD = rel(closedAngle(LM.lHip, LM.rHip)), shTD = rel(closedAngle(LM.lSh, LM.rSh)), headTD = rel(closedAngle(LM.lEar, LM.rEar));
const trunk = (i: number) => sub(mid(w(i, LM.lSh), w(i, LM.rSh)), mid(w(i, LM.lHip), w(i, LM.rHip)));
const tiltAll = W.map((_, i) => { const t = trunk(i); return Math.atan2(Math.hypot(t[0], t[2]), t[1]); });
// a top-down turn of td seen through a forward tilt t is an euler turn y about the tilted spine: tan(td) = cos(t) tan(y)
const eulerTurn = (td: number, t: number) => Math.atan2(Math.sin(td) / Math.cos(t), Math.cos(td));
const pelTilt = PR.map(p => p.pelvis[0]);
const totTilt = PR.map(p => p.pelvis[0] + p.torso[0]);
const capPelY = hipTD.map((td, i) => -eulerTurn(td, pelTilt[i]!));
const capShY = shTD.map((td, i) => -eulerTurn(td, totTilt[i]!));
const capHeadWorld = headTD.map(td => -td);
// pelvis relative to the feet (MediaPipe's origin is the mid-hip), and the lift of each heel above its toe
const feetMid = (i: number) => mid(w(i, LM.lAnk), w(i, LM.rAnk));
const capShift = W.map((_, i) => sub(mul(feetMid(p1), 1), feetMid(i)));
const heel = (h: number, t: number) => rel(W.map((_, i) => { const d = sub(w(i, h), w(i, t)); return Math.atan2(d[1], Math.hypot(d[0], d[2])); }));
const capLHeel = heel(LM.lHeel, LM.lToe), capRHeel = heel(LM.rHeel, LM.rToe);
const capArm = W.reduce((s, _, i) => s + len(sub(w(i, LM.lSh), w(i, LM.lEl))) + len(sub(w(i, LM.lEl), w(i, LM.lWr))), 0) / N, S = RIG_ARM / capArm;
console.log('captured arm', capArm.toFixed(3), 'm, scale to rig', S.toFixed(3));

// ---- fusion with the P-system ranges at the keys ----
const r = (k: number, val: number, tol: number) => ({ f: KEYS[k]!, lo: val - tol, hi: val + tol });
const keysFor = (get: (p: Pose) => number, tol: (k: number) => number) => KEYS.map((_, k) => r(k, get(P_KEYED[k]!), tol(k)));
const turnTol = (k: number) => (k <= 6 ? deg(4) : k === 9 ? deg(12) : deg(15));
const pelY = fuse(capPelY, keysFor(p => p.pelvis[1], turnTol));
const shY = fuse(capShY, keysFor(p => p.pelvis[1] + p.torso[1], turnTol));
// P1-P7 keep the address spine angle (no standing up): those keys are held within 0.02 rad of the prior's P1 tilt
const tilt0 = P_KEYED[0]!.pelvis[0] + P_KEYED[0]!.torso[0];
const tilt = fuse(tiltAll, KEYS.map((f, k) => (k <= 6 ? { f, lo: tilt0 - 0.02, hi: tilt0 + 0.02 } : r(k, P_KEYED[k]!.pelvis[0] + P_KEYED[k]!.torso[0], 0.15))));
const headW = fuse(capHeadWorld.map((h, i) => clamp(h, shY[i]! - deg(100), shY[i]! + deg(100))), keysFor(p => p.pelvis[1] + p.torso[1] + p.head[1], k => (k <= 6 ? deg(12) : deg(25))));
const shiftY = fuse(capShift.map(s => clamp(s[1] * S, -0.12, 0.08)), keysFor(p => p.shift[1] - P_KEYED[0]!.shift[1], () => 0.03));
const shiftZ = fuse(capShift.map(s => clamp(s[2] * S, -0.12, 0.2)), keysFor(p => p.shift[2] - P_KEYED[0]!.shift[2], () => 0.04));
const heelKeys = (side: 'l' | 'r') => keysFor(p => (side === 'l' ? p.lHeel : p.rHeel), k => (k === 0 ? 0 : k >= 6 ? 0.2 : 0.1));
const lHeel = fuse(capLHeel, heelKeys('l')).map(x => clamp(x, 0, 1.3)), rHeel = fuse(capRHeel, heelKeys('r')).map(x => clamp(x, 0, 1.3));
// lead wrist: model-space path from address (scaled to the rig's arm), pinned to the prior's grip at P1 and P7
const lw = (i: number) => w(i, LM.lWr);
const gripCap = W.map((_, i) => add(P_KEYED[0]!.grip as unknown as P3, mul(sub(lw(i), lw(p1)), S)));
// x (toward the target) is the camera's depth axis, so it is held close to the prior; y and z (up, toward the ball) are seen well
const grip = [0, 1, 2].map(ax => fuse(gripCap.map(g => g[ax]!), KEYS.map((f, k) => {
  const pk = P_KEYED[k]!.grip[ax]!, tol = k === 0 || k === 6 ? 0 : ax === 0 ? 0.08 : 0.15; return { f, lo: pk - tol, hi: pk + tol };
})));
// lead wrist in the turned thorax frame (x lead shoulder line, y up the spine, z out of the chest), used around the top
const tgrip = W.map((_, i) => {
  const x = norm(sub(w(i, LM.lSh), w(i, LM.rSh))), t = trunk(i), y = norm(sub(t, mul(x, dot(t, x)))), z = cross(x, y);
  const d = mul(sub(lw(i), mid(w(i, LM.lSh), w(i, LM.rSh))), S); return [dot(d, x), dot(d, y), dot(d, z)] as P3;
});
const tg = [0, 1, 2].map(ax => fuse(tgrip.map(t => t[ax]!), [{ f: top, lo: P_KEYED[3]!.tgrip[ax]! - 0.12, hi: P_KEYED[3]!.tgrip[ax]! + 0.12 }]));
// the game scrubs the backswing with the hold time, so P1..P4 must be monotonic: shoulders only turn further, hands only rise
// (kept between the address and top values, then a running extreme)
for (let i = p1; i <= top; i++) { shY[i] = clamp(shY[i]!, shY[top]!, shY[p1]!); grip[1]![i] = clamp(grip[1]![i]!, grip[1]![p1]!, grip[1]![top]!); }
for (let i = p1 + 1; i <= top; i++) { shY[i] = Math.min(shY[i]!, shY[i - 1]!); grip[1]![i] = Math.max(grip[1]![i]!, grip[1]![i - 1]!); }
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const poles = (s: number, e: number, wr: number, pr: (p: Pose) => V3) => W.map((_, i) => {
  const { dir, bend } = pole(w(i, s), w(i, e), w(i, wr)), k = smoothstep(0.02, 0.07, bend), p = norm(pr(PR[i]!) as unknown as P3);
  return norm(add(mul(p, 1 - k), mul(dir, k)));
});
const lPole = poles(LM.lSh, LM.lEl, LM.lWr, p => p.lPole), rPole = poles(LM.rSh, LM.rEl, LM.rWr, p => p.rPole);

// ---- assemble one Pose per frame from P1 to P10 ----
const v3 = (a: readonly number[]): V3 => [r4(a[0]!), r4(a[1]!), r4(a[2]!)];
const frames: number[][] = [];
for (let i = p1; i <= p10; i++) {
  const p = PR[i]!, py = r4(pelY[i]!), ty = r4(shY[i]!) - py, tz = p.torso[0];   // rounded first so pelvis + torso is exactly the fused turn
  const pose: Pose = { ...p,
    pelvis: v3([tilt[i]! - tz, py, p.pelvis[2]]), torso: v3([tz, ty, p.torso[2]]), head: v3([p.head[0], headW[i]! - shY[i]!, p.head[2]]),
    shift: v3([p.shift[0], P_KEYED[0]!.shift[1] + shiftY[i]!, P_KEYED[0]!.shift[2] + shiftZ[i]!]),
    lHeel: r4(lHeel[i]!), rHeel: r4(rHeel[i]!), grip: v3([grip[0]![i]!, grip[1]![i]!, grip[2]![i]!]), tgrip: v3([tg[0]![i]!, tg[1]![i]!, tg[2]![i]!]),
    lPole: v3(lPole[i]!), rPole: v3(rPole[i]!) };
  frames.push(pack(pose));
}
function pack(p: Pose): number[] {
  return [...p.pelvis, ...p.shift, ...p.torso, ...p.head, ...p.lAnkle, ...p.rAnkle, p.lHeel, p.rHeel, ...p.grip, ...p.tgrip, p.gripT, ...p.shaft, ...p.face, ...p.lPole, ...p.rPole].map(r4);
}
// quality: how far the fusion had to move the capture at the keys (degrees), and the detection rate
const moved = (capd: number[], fused: number[]) => KEYS.map(k => Math.round(((fused[k]! - capd[k]!) * 180) / Math.PI));
const detected = cap.frames.slice(A0, A1 + 1).filter(f => f.world).length / (A1 - A0 + 1);
const vis = cap.frames.slice(A0 + p1, A0 + p10 + 1).flatMap(f => (f.world ? [LM.lSh, LM.rSh, LM.lEl, LM.lWr, LM.lHip, LM.rHip, LM.lAnk, LM.rAnk].map(j => f.world![j]![3]!) : []));
const quality = { detected: r4(detected), meanVisibility: r4(vis.reduce((s, x) => s + x, 0) / vis.length), hipCorrectionDeg: moved(capPelY, pelY), shoulderCorrectionDeg: moved(capShY, shY) };
console.log('quality', JSON.stringify(quality));

const out = resolve(import.meta.dirname, '../../src/client/motion/swingcapture.ts');
writeFileSync(out, `// GENERATED by scripts/motion/retarget-swing.ts — do not edit by hand. The Dunaway swing (refs/swing, down the line, ${cap.fps} fps),
// pose-estimated per frame with MediaPipe Pose Landmarker (heavy, world landmarks), smoothed, fused with the P-system prior and
// retargeted onto the golfer rig: one packed Pose per captured frame from P1 (address) to P10 (finish). See golferanim.ts unpack().
export const SWING_CAPTURE = {
  source: 'refs/swing/dunaway-dtl-sybervision.mp4 frames ${A0 + p1}-${A0 + p10}',
  fps: ${cap.fps},
  /** P1..P10 as indices into frames */
  keys: [${KEYS.map(k => k - p1).join(', ')}],
  quality: ${JSON.stringify(quality)},
  frames: [
${frames.map(f => `    [${f.join(',')}],`).join('\n')}
  ],
} as const;
`);
console.log('wrote', out, frames.length, 'frames');
