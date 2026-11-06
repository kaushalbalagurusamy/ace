import { describe, expect, it } from 'vitest';
import { BACK_KEYS, DOWNSWING_MS, P_FRAMES, P_POS, POSES, SWING_CURVE, TEMPO, backswingFrame, addressHead, backswingDepth, backswingPose, lerpPose, releasePose, releaseTimes, GAITS, MAX_CADENCE, gaitCadence, gaitMix, gaitPose, idlePose, seatedPose } from '../src/client/golferanim';

const L = 0.94; // 7-iron
const hyp = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
const near = (a: readonly number[], b: readonly number[], d = 9) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, d));
const shoulderTurn = (p: { pelvis: readonly number[]; torso: readonly number[] }) => p.pelvis[1]! + p.torso[1]!;
const deg = (r: number) => (r * 180) / Math.PI;

// The swing is now the pose-estimated Dunaway clip (src/client/motion/swingcapture.ts), not hand-keyed poses: the phase frames
// and tempo are detected from the capture, so these tests check the captured curve against the same owner spec as before.
describe('Dunaway timings (captured)', () => {
  it('backswing to downswing is about 3:1 (tour tempo) and the downswing is the 750 ms turn divided by it', () => {
    expect(TEMPO).toBeGreaterThan(2.5); expect(TEMPO).toBeLessThan(3.5);
    expect(TEMPO).toBeCloseTo((P_FRAMES[3] - P_FRAMES[0]) / (P_FRAMES[6] - P_FRAMES[3]), 9);
    expect(DOWNSWING_MS).toBeCloseTo(750 / TEMPO, 6);
  });
  it('the curve is one pose per captured frame, P1..P10 are frames of it in order, and it moves smoothly frame to frame', () => {
    expect(P_FRAMES[0]).toBe(0); expect(P_FRAMES[9]).toBe(SWING_CURVE.length - 1);
    for (let i = 1; i < 10; i++) expect(P_FRAMES[i]!).toBeGreaterThan(P_FRAMES[i - 1]!);
    P_FRAMES.forEach((f, i) => expect(P_POS[i]).toBe(SWING_CURVE[f]));
    for (let i = 1; i < SWING_CURVE.length; i++) {   // no pops: under 25° of turn per 33 ms frame except through impact
      const a = SWING_CURVE[i - 1]!, b = SWING_CURVE[i]!;
      expect(Math.abs(deg(shoulderTurn(b) - shoulderTurn(a))), `frame ${i}`).toBeLessThan(25);
    }
  });
});

describe('P1-P10 key positions', () => {
  it('has ten positions with the owner\'s shoulder and hip turns (±5°)', () => {
    expect(P_POS).toHaveLength(10);
    const want: [number, number, number][] = [[0, 0, 0], [1, -45, -17], [2, -75, -35], [3, -90, -45], [4, -45, 30], [5, -20, 46], [6, 26, 48]];
    for (const [i, sh, hip] of want) { expect(Math.abs(deg(shoulderTurn(P_POS[i]!)) - sh)).toBeLessThanOrEqual(5); expect(Math.abs(deg(P_POS[i]!.pelvis[1]!) - hip)).toBeLessThanOrEqual(5); }
    expect(deg(shoulderTurn(P_POS[9]!))).toBeGreaterThanOrEqual(90);   // P10: chest to the target or left of it
  });
  it('keeps the spine angle from P1 through P7 (no standing up)', () => {
    for (let i = 1; i <= 6; i++) expect(Math.abs(P_POS[i]!.pelvis[0]! + P_POS[i]!.torso[0]! - (P_POS[0]!.pelvis[0]! + P_POS[0]!.torso[0]!))).toBeLessThan(0.06);
  });
});

describe('backswing', () => {
  it('follows the hold up to the full turn and stays at the top after', () => {
    expect(backswingDepth(-5)).toBe(0);
    expect(backswingDepth(375)).toBeCloseTo(0.5);
    expect(backswingDepth(750)).toBe(1);
    expect(backswingDepth(1100)).toBe(1);
  });
  it('reaches P2 at 0.25, P3 at 0.55 and P4 at a 1.0 hold', () => {
    expect(BACK_KEYS).toEqual([0, 0.25, 0.55, 1]);
    near(backswingPose(0.25, L).grip, P_POS[1]!.grip);
    near(backswingPose(0.55, L).grip, P_POS[2]!.grip);
    near(backswingPose(1, L).grip, P_POS[3]!.grip);
    near(backswingPose(backswingDepth(750), L).torso, P_POS[3]!.torso);
    expect(backswingFrame(1)).toBe(P_FRAMES[3]);   // a full hold reaches the captured top
  });
  it('the pose lookup is monotonic in the hold fraction: the shoulders only turn further and the hands only rise', () => {
    let turn = Infinity, y = -Infinity;
    for (let d = 0; d <= 1.0001; d += 0.02) {
      const p = backswingPose(d, L);
      expect(shoulderTurn(p)).toBeLessThanOrEqual(turn + 1e-9); turn = shoulderTurn(p);
      expect(p.grip[1]).toBeGreaterThanOrEqual(y - 1e-9); y = p.grip[1];
    }
  });
});

describe('address geometry', () => {
  it('puts the head on the ground one club length from the grip, with the hands ahead of the ball', () => {
    const g = P_POS[0]!.grip, h = addressHead(g, L, 0);
    expect(hyp([h[0] - g[0], h[1] - g[1], h[2] - g[2]])).toBeCloseTo(L, 6);
    expect(h[1]).toBeCloseTo(0.02);
    expect(g[0]).toBeGreaterThan(h[0]);   // shaft lean toward the target
  });
});

describe('release', () => {
  it('runs P5, P6, P7 then P8, P9, P10 in order', () => {
    // the captured downswing and follow-through play at the clip's own frame rate (scaled), so each key is passed at its frame time
    const T = releaseTimes(1), K = P_FRAMES, at = (i: number) => (i <= 6 ? ((K[i]! - K[3]) / (K[6] - K[3])) * T.down : T.down + ((K[i]! - K[6]) / (K[9] - K[6])) * T.follow);
    let last = -1;
    for (const i of [4, 5, 6, 7, 8, 9]) {
      const ms = at(i); expect(ms).toBeGreaterThan(last); last = ms;
      const p = releasePose(1, ms - (i === 6 ? 1e-6 : 0), L).pose;
      if (i !== 6) near(p.grip, P_POS[i]!.grip, 4); else near(p.grip, P_POS[6]!.grip, 3);
    }
  });
  it('reaches impact (club back at the ball) at the end of the downswing', () => {
    const T = releaseTimes(1), r = releasePose(1, T.down, L);
    expect(r.impact).toBe(true);
    expect(r.pose.grip[1] + r.pose.shaft[1] * L).toBeLessThan(0.15);
  });
  it('is done after the finish and the return to standing', () => {
    const T = releaseTimes(1);
    expect(releasePose(1, T.down - 1, L).impact).toBe(false);
    expect(releasePose(1, T.down + T.follow + T.hold + T.back, L).done).toBe(true);
    expect(releasePose(1, T.down + T.follow, L).done).toBe(false);
  });
  it('a partial swing comes down sooner and its follow-through stops short of P10', () => {
    const a = releaseTimes(1), b = releaseTimes(0.3);
    expect(b.down).toBeLessThan(a.down); expect(b.follow).toBeLessThan(a.follow);
    const fin = (d: number) => { const T = releaseTimes(d); return releasePose(d, T.down + T.follow, L).pose.grip[1]; };
    expect(fin(1)).toBeGreaterThan(fin(0.2) + 0.3);
  });
  it('putts strike at address', () => {
    const T = releaseTimes(0.5, true), r = releasePose(0.5, T.down, L, true);
    expect(r.impact).toBe(true);
    expect(r.pose.grip[0]).toBeCloseTo(POSES.puttAddress.grip[0], 2);
  });
});

describe('pose blending', () => {
  it('returns the endpoints and keeps directions unit length', () => {
    const a = P_POS[0]!, b = P_POS[3]!;
    near(lerpPose(a, b, 0).grip, a.grip);
    near(lerpPose(a, b, 1).grip, b.grip);
    expect(hyp(lerpPose(a, b, 0.5).shaft)).toBeCloseTo(1, 9);
  });
});

// Walking and running are captured cycles (src/client/motion/gaitcapture.ts) replacing the hand-authored sine walk.
describe('captured gait: foot locking', () => {
  /** Runs at a steady `speed` and returns, for each stance of each foot, how far the planted foot moved over the ground (m). */
  function drift(speed: number) {
    const { a } = gaitMix(speed), out: number[] = [], dt = 1 / 480, edge = 1 / 96;   // stance ends fall between samples: skip half a sample
    for (const [foot, on, off] of [['lAnkle', a.stance[0], a.stance[1]], ['rAnkle', a.stance[2], a.stance[3]]] as const) {
      for (let cyc = 0; cyc < 3; cyc++) {
        let phase = cyc + on + edge, root = 0, lo = Infinity, hi = -Infinity, yMax = 0;
        while (phase <= cyc + off - edge) {   // the planted foot over the ground while the golfer moves at `speed`
          const p = gaitPose(phase, speed)[foot]; lo = Math.min(lo, root + p[2]); hi = Math.max(hi, root + p[2]); yMax = Math.max(yMax, p[1]);
          phase += gaitCadence(speed) * dt; root += speed * dt;
        }
        out.push(hi - lo); expect(yMax, `${foot} lifts in stance at ${speed} m/s`).toBeLessThan(0.005);
      }
    }
    return out;
  }
  for (const v of [1.4, 5, 15]) it(`the planted foot drifts under 2 cm per stance at ${v} m/s`, () => {
    for (const d of drift(v)) expect(d).toBeLessThan(0.02);
  });
  it('cadence rises with speed but never past 5 steps a second; the stride makes up the rest', () => {
    let last = 0;
    for (let v = 0.5; v <= 15; v += 0.5) { const c = gaitCadence(v); expect(c).toBeLessThanOrEqual(MAX_CADENCE + 1e-9); expect(c).toBeGreaterThanOrEqual(last - 0.25); last = c; }
    expect(gaitCadence(15)).toBe(MAX_CADENCE);
    expect(gaitMix(1.4).a).toBe(GAITS[0]); expect(gaitMix(5).a).toBe(GAITS[1]); expect(gaitMix(15).a).toBe(GAITS[2]);
  });
  it('the cycles are left-right alternating: the feet are half a cycle apart', () => {
    for (const g of GAITS) expect(Math.abs(((g.stance[2] - g.stance[0] + 1) % 1) - 0.5)).toBeLessThan(0.05);
  });
});

describe('idle and seated', () => {
  it('standing still is the idle (breathing and weight shift), feet planted', () => {
    const a = gaitPose(0.3, 0, 2), b = idlePose(2);
    near(a.shift, b.shift); expect(a.lAnkle).toEqual([0, 0, 0]);
    expect(Math.abs(idlePose(3).shift[0] - idlePose(9).shift[0])).toBeGreaterThan(0.01);   // weight moves foot to foot
  });
  it('seated hands sit on the rim and turn with the wheel', () => {
    const p = seatedPose(0), q = seatedPose(1), c = [0, 1.311, 0.432];
    for (const h of [p.free!.l, p.free!.r]) expect(Math.hypot(h[0] - c[0]!, h[1] - c[1]!, h[2] - c[2]!)).toBeCloseTo(0.15, 6);
    expect(p.free!.l[0]).toBeGreaterThan(p.free!.r[0]);
    expect(q.free!.l[1]).not.toBeCloseTo(p.free!.l[1], 3);
  });
});
