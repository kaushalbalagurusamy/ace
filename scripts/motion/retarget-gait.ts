// Retargets pose-estimated side-view walking and running (scripts/motion/capture_pose.py output) onto the golfer rig as gait
// cycles, written to src/client/motion/gaitcapture.ts. Sources and licences: refs/motion/sources.json (main checkout, gitignored).
//
// Usage: npx tsx scripts/motion/retarget-gait.ts <name>=<capture.json>:<first>:<last>:<beltMps|walk> ...
//   beltMps: treadmill belt speed (the stride length per cycle is belt speed x cycle time, which also checks the capture's scale);
//   'walk': an overground sequence of one cycle (Muybridge), its cadence assumed at a natural 0.92 cycles/s (110 steps/min).
//
// Per frame (side view: the camera's depth axis is his left-right, which barely moves in a gait): trunk lean, pelvis roll, small
// pelvis/shoulder counter-rotation, hip height above the lower ankle (vertical bob), both ankles relative to their hip joint,
// foot pitch, both wrists and elbow bend directions, scaled from the subject's leg to the rig's. Cycles run from left-foot strike
// to the next; every full cycle in the steady part is resampled to 48 phases and averaged. Foot locking: each foot's stance
// (its lowest stretch of the cycle) moves backward in a straight line at exactly the stride length per cycle, the swing keeps the
// captured path with the joins blended, so at runtime (golferanim.gaitPose) phase rate x stride = speed and the planted foot
// never slides.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LM, clamp, deswap, fill, len, load, mid, norm, pole, r4, side, smoothSeries, sub, type P3 } from './mocap';

// rig rest joints (model space, metres), measured on assets/models/golfer.glb through scripts/qa/golfer.html
const RIG = { lUpLeg: [0.093, 0.915, -0.028] as P3, lFoot: [0.171, 0.141, -0.003] as P3, rFoot: [-0.175, 0.146, -0.004] as P3, leg: 0.778, trackX: 0.075 };
const NS = 48;   // samples per cycle

interface Spec { name: string; path: string; a: number; b: number; belt: number | null }
const specs: Spec[] = process.argv.slice(2).map(s => { const [name, rest] = s.split('='); const [path, a, b, belt] = rest!.split(':');
  return { name: name!, path: path!, a: Number(a), b: Number(b), belt: belt === 'walk' ? null : Number(belt) }; });

const out: Record<string, unknown> = {}, checks: number[] = [];   // pass the treadmill clips before the walk
for (const sp of specs) {
  const cap = load(sp.path);
  const rawW = fill(cap, 'world', sp.a, sp.b), rawI = fill(cap, 'image', sp.a, sp.b); deswap(rawI, rawW);
  const I = smoothSeries(rawI);
  let W = smoothSeries(rawW).map(f => f.map(p => side(p)));
  // face +z: MediaPipe gives the nose ahead of the hips; a subject running toward image left is turned 180° about y
  const facing = W.reduce((s, f) => s + (f[LM.nose]![2]! - mid(f[LM.lHip] as P3, f[LM.rHip] as P3)[2]), 0);
  if (facing < 0) W = W.map(f => f.map(p => [-p[0]!, p[1]!, -p[2]!, p[3]!]));
  const N = W.length, w = (i: number, j: number) => W[i]![j]! as unknown as P3;
  const capLeg = W.reduce((s, _, i) => s + len(sub(w(i, LM.lHip), w(i, LM.lKnee))) + len(sub(w(i, LM.lKnee), w(i, LM.lAnk))), 0) / N, S = RIG.leg / capLeg;

  // per-frame channels
  const lean = (i: number) => { const t = sub(mid(w(i, LM.lSh), w(i, LM.rSh)), mid(w(i, LM.lHip), w(i, LM.rHip))); return Math.atan2(t[2], t[1]); };
  const yaw = (a: number, b: number, i: number) => { const d = sub(w(i, a), w(i, b)); return -Math.atan2(d[2], d[0]); };   // + = left side forward... euler y sign
  const footImg = (i: number, h: number, t: number) => Math.max(I[i]![h]![1]!, I[i]![t]![1]!);
  const ch = (i: number) => {
    const hip = mid(w(i, LM.lHip), w(i, LM.rHip)), low = Math.min(w(i, LM.lAnk)[1], w(i, LM.rAnk)[1]);
    const shiftY = S * (hip[1] - low) - (RIG.lUpLeg[1] - RIG.lFoot[1]);
    const ank = (a: number, h: number, foot: P3, sx: number): number[] => { const d = sub(w(i, a), w(i, h)); return [sx * RIG.trackX - foot[0], RIG.lUpLeg[1] + shiftY + S * d[1] - foot[1], RIG.lUpLeg[2] + S * d[2] - foot[2]]; };
    const pitch = (h: number, t: number) => { const d = sub(w(i, h), w(i, t)); return Math.atan2(d[1], Math.abs(d[2])); };
    const wr = (j: number) => { const d = sub(w(i, j), hip); return [S * d[0], 1.011 + shiftY + S * d[1], -0.028 + S * d[2]]; };
    const lp = pole(w(i, LM.lSh), w(i, LM.lEl), w(i, LM.lWr)).dir, rp = pole(w(i, LM.rSh), w(i, LM.rEl), w(i, LM.rWr)).dir;
    const roll = Math.atan2(w(i, LM.lHip)[1] - w(i, LM.rHip)[1], Math.max(0.1, Math.abs(w(i, LM.lHip)[0] - w(i, LM.rHip)[0])));
    const py = clamp(yaw(LM.lHip, LM.rHip, i), -0.3, 0.3), sy = clamp(yaw(LM.lSh, LM.rSh, i), -0.5, 0.5);
    return [lean(i), py, clamp(roll, -0.15, 0.15), clamp(sy - py, -0.45, 0.45), shiftY, ...ank(LM.lAnk, LM.lHip, RIG.lFoot, 1), ...ank(LM.rAnk, LM.rHip, RIG.rFoot, -1),
      pitch(LM.lHeel, LM.lToe), pitch(LM.rHeel, LM.rToe), ...wr(LM.lWr), ...wr(LM.rWr), ...lp, ...rp,
      footImg(i, LM.lHeel, LM.lToe), footImg(i, LM.rHeel, LM.rToe)];   // 25, 26: lowest image point of each foot (stance detection only)
  };
  const C = Array.from({ length: N }, (_, i) => ch(i));
  // left-foot strikes: the left ankle at its foremost (local max of z, 4-frame window), above the median
  const lz = C.map(c => c[7]!), med = [...lz].sort((p, q) => p - q)[N >> 1]!;
  let strikes: number[] = [];
  if (sp.belt === null) strikes = [lz.indexOf(Math.max(...lz)), lz.indexOf(Math.max(...lz)) + N];   // one looped cycle
  else for (let i = 4; i < N - 4; i++) if (lz[i]! > med && lz.slice(i - 4, i + 5).every(x => x <= lz[i]!)) strikes.push(i);
  const all = strikes.slice(1).map((s, k) => [strikes[k]!, s] as const), mlen = [...all.map(([a, b]) => b - a)].sort((p, q) => p - q)[all.length >> 1]!;
  const cycles = all.filter(([a, b]) => Math.abs(b - a - mlen) <= 0.2 * mlen).slice(-5);   // drop missed or doubled strikes
  if (!cycles.length) throw new Error(`${sp.name}: no cycle found`);
  const at = (f: number, k: number) => { const n = ((f % N) + N) % N, i = Math.floor(n), j = (i + 1) % N, t = n - i; return C[i]![k]! * (1 - t) + C[j]![k]! * t; };
  const nch = C[0]!.length, avg = Array.from({ length: NS }, (_, s) => Array.from({ length: nch }, (_, k) =>
    cycles.reduce((acc, [a, b]) => acc + at(a + ((b - a) * s) / NS, k), 0) / cycles.length));
  const frames = cycles.reduce((s, [a, b]) => s + (b - a), 0) / cycles.length, cadence = sp.belt === null ? 0.92 : cap.fps / frames;
  // ---- bilateral symmetry: in a side view the far limbs are half hidden, so each side is the visibility-weighted mean of itself
  // and the other side half a cycle later (mirrored across the body); trunk channels are made (anti)symmetric the same way ----
  const visOf = (j: number) => cap.frames.slice(sp.a, sp.b + 1).reduce((s, f) => s + (f.world?.[j]?.[3] ?? 0), 0);
  // arms cross the body twice a cycle and their labels flip unreliably, so averaging the two would cancel the swing: the
  // nearer (more visible) arm drives both
  const wl = visOf(LM.lAnk) / (visOf(LM.lAnk) + visOf(LM.rAnk)), wa = visOf(LM.lWr) >= visOf(LM.rWr) ? 1 : 0;
  const half = (s: number) => avg[(s + NS / 2) % NS]!, sym: number[][] = avg.map(r => [...r]);
  for (let s = 0; s < NS; s++) {
    const r = avg[s]!, h = half(s), o = sym[s]!;
    for (const k of [0, 4]) o[k] = (r[k]! + h[k]!) / 2;
    for (const k of [1, 2, 3]) o[k] = (r[k]! - h[k]!) / 2;
    const pair = (l: number, rr: number, n: number, mx: boolean, wt: number) => { for (let c = 0; c < n; c++) {
      const m = mx && c === 0 ? -1 : 1;
      o[l + c] = wt * r[l + c]! + (1 - wt) * m * h[rr + c]!; o[rr + c] = (1 - wt) * r[rr + c]! + wt * m * h[l + c]!; } };
    pair(5, 8, 3, true, wl); pair(11, 12, 1, false, wl); pair(25, 26, 1, false, wl); pair(13, 16, 3, true, wa); pair(19, 22, 3, true, wa);
  }
  avg.splice(0, NS, ...sym);
  // trunk lean: a circular 5-sample median (a single bad frame of a 12-frame plate tipped the walk 60° back), clamped to a runner's
  // range; hip height: the captured bob kept, its highest point set 2-3 cm under standing height (MediaPipe's metric height is
  // compressed, which sank the hips into a crouch)
  const leanS = avg.map((_, s) => [-2, -1, 0, 1, 2].map(k => avg[(s + k + NS) % NS]![0]!).sort((p, q) => p - q)[2]!);
  const top = Math.max(...avg.map(r => r[4]!)), peak = sp.belt === null ? -0.02 : -0.03;
  avg.forEach((r, s) => { r[0] = clamp(leanS[s]!, -0.05, 0.35); for (const k of [4, 14, 17]) r[k] = r[k]! - top + peak;   // the wrists ride with the hips
    for (const k of [14, 17]) r[k] = clamp(r[k]!, 0.78, 1.5); });   // a hand never below the thigh (a mis-detected Muybridge frame put one at the knee)
  if (sp.name === 'sprint') {
    // supervisor review: the captured sprint's arm swing reads about half the clip's (the far arm is hidden, the near one blurred)
    // and its trunk lean 9-13° against ~15°: the wrists swing twice as far fore and aft about their mean, the lean is centred on 15°
    const mean = (k: number) => avg.reduce((t, r) => t + r[k]!, 0) / NS, mz = [mean(15), mean(18)], ml = mean(0);
    for (const r of avg) { r[15] = mz[0]! + 2 * (r[15]! - mz[0]!); r[18] = mz[1]! + 2 * (r[18]! - mz[1]!); r[0] = r[0]! - ml + (15 * Math.PI) / 180; }
  }
  // ---- foot locking ----
  // stance: the longest circular run of phases where the foot is at its lowest. Treadmill clips (one static camera, a level belt)
  // use the image: contact is the same image height every step, within 15% of the foot's vertical range. Muybridge's frames come
  // from a row of cameras, so the walk uses the world height of the ankle below the hip instead (within 3 cm of its lowest).
  const stanceOf = (ki: number, ky: number) => {
    const img = sp.belt !== null, ys = avg.map(r => (img ? r[ki]! : -r[ky]!)), hi = Math.max(...ys), lo = Math.min(...ys);
    if (!img) {   // the walk: a fixed 60% duty (one foot always down, double support at each end), placed where the foot is lowest
      const D = Math.round(0.6 * NS); let bs = 0, bv = -Infinity;
      for (let s = 0; s < NS; s++) { let v = 0; for (let k = 0; k < D; k++) v += ys[(s + k) % NS]!; if (v > bv) { bv = v; bs = s; } }
      return { on: bs, off: bs + D - 1 };
    }
    const low = ys.map(y => y >= hi - 0.15 * (hi - lo));
    let best = [0, 0]; for (let s = 0; s < NS; s++) { if (!low[s] || low[(s + NS - 1) % NS]) continue; let e = s; while (low[(e + 1) % NS] && e - s < NS - 1) e++; if (e - s > best[1]! - best[0]!) best = [s, e]; }
    return { on: best[0]!, off: best[1]! };   // inclusive sample indices; off may exceed NS (wraps)
  };
  const strideFromStance = (kz: number, st: { on: number; off: number }) => -(avg[st.off % NS]![kz]! - avg[st.on]![kz]!) / ((st.off - st.on) / NS);
  const sL = stanceOf(25, 6), sR = stanceOf(26, 9);
  const measured = (strideFromStance(7, sL) + strideFromStance(10, sR)) / 2;
  // an overground walk has no belt to measure against: its captured stride is divided by the treadmill clips' mean scale check
  const fix = checks.length ? checks.reduce((s, x) => s + x, 0) / checks.length : 1;
  const stride = sp.belt === null ? measured / fix : sp.belt / cadence;   // metres travelled per cycle
  if (sp.belt !== null) checks.push(measured / stride);
  for (const [ky, kz, st] of [[6, 7, sL], [9, 10, sR]] as const) {
    const len = st.off - st.on, zMid = avg.slice(st.on, st.off + 1).reduce((s, _, k) => s + avg[(st.on + k) % NS]![kz]!, 0) / (len + 1);
    const line = (k: number) => zMid - stride * ((k - len / 2) / NS);
    const dz0 = line(0) - avg[st.on]![kz]!, dz1 = line(len) - avg[st.off % NS]![kz]!, y0 = avg[st.on]![ky]!, y1 = avg[st.off % NS]![ky]!;
    for (let k = 0; k <= len; k++) { const r = avg[(st.on + k) % NS]!; r[kz] = line(k); r[ky] = 0; }
    const sw = NS - len;   // swing: blend the corrections from toe-off back to the next strike
    for (let k = 1; k < sw; k++) { const r = avg[(st.off + k) % NS]!, t = k / sw; r[kz]! += dz1 + (dz0 - dz1) * t; r[ky] = Math.max(0, r[ky]! - (y1 + (y0 - y1) * t)); }
  }
  // foot pitch relative to the stance mean (flat foot = 0); poles re-normalised
  for (const [k, st] of [[11, sL], [12, sR]] as const) { const flat = avg[(st.on + ((st.off - st.on) >> 1)) % NS]![k]!; for (const r of avg) r[k] = clamp(r[k]! - flat, -0.5, 1.2); }
  for (const r of avg) for (const k of [19, 22]) { const n = norm([r[k]!, r[k + 1]!, r[k + 2]!]); r[k] = n[0]; r[k + 1] = n[1]; r[k + 2] = n[2]; }
  const det = cap.frames.slice(sp.a, sp.b + 1).filter(f => f.world).length / (sp.b - sp.a + 1);
  const quality = { detected: r4(det), cycles: cycles.length, captureScaleCheck: sp.belt === null ? null : r4(measured / stride), legScale: r4(S) };
  console.log(sp.name, 'cycles', cycles.map(c => c.join('-')).join(' '), 'cadence', cadence.toFixed(3), 'stride', stride.toFixed(3), 'stance L', sL, 'R', sR, quality);
  out[sp.name] = { source: sp.path.split('/').pop(), speed: r4(stride * cadence), cadence: r4(cadence), stride: r4(stride), stance: [sL.on / NS, sL.off / NS, sR.on / NS, sR.off / NS].map(r4), quality,
    samples: avg.map(r => r.slice(0, 25).map(r4)) };
}
const dst = resolve(import.meta.dirname, '../../src/client/motion/gaitcapture.ts');
writeFileSync(dst, `// GENERATED by scripts/motion/retarget-gait.ts — do not edit by hand. Side-view walking and running, pose-estimated per frame
// with MediaPipe Pose Landmarker (heavy), retargeted onto the golfer rig and foot-locked; one cycle each from left-foot strike,
// ${NS} samples. Sources (licences in refs/motion/sources.json): the walk is Eadweard Muybridge, Animal Locomotion plate 2 (1887,
// public domain); the jog (3 m/s) and sprint (9 m/s) are treadmill videos by Arellano, McDermott, Kram and Grabowski, PLOS ONE
// 2015 (CC BY 4.0). Channels per sample: lean, pelvisYaw, pelvisRoll, torsoYaw, shiftY, lAnkle xyz, rAnkle xyz, lHeel, rHeel,
// lWrist xyz, rWrist xyz, lPole xyz, rPole xyz. stance = [left on, left off, right on, right off] as cycle fractions.
export const GAIT_CAPTURE = ${JSON.stringify(out, null, 1).replace(/\n\s+(-?[\d.]+)/g, ' $1').replace(/\n\s+\]/g, ' ]')} as const;
`);
console.log('wrote', dst);
