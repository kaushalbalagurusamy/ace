import { describe, expect, it } from 'vitest';
import { BACK_KEYS, DOWNSWING_MS, DOWN_KEYS, FOLLOW_KEYS, P_POS, POSES, TEMPO, addressHead, backswingDepth, backswingPose, lerpPose, releasePose, releaseTimes, walkPose } from '../src/client/golferanim';

const L = 0.94; // 7-iron
const hyp = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
const near = (a: readonly number[], b: readonly number[], d = 9) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, d));
const shoulderTurn = (p: { pelvis: readonly number[]; torso: readonly number[] }) => p.pelvis[1]! + p.torso[1]!;
const deg = (r: number) => (r * 180) / Math.PI;

describe('Dunaway timings', () => {
  it('backswing to downswing is about 3:1 and the downswing is the 750 ms turn divided by it', () => {
    expect(TEMPO).toBeCloseTo(47 / 15, 6);
    expect(DOWNSWING_MS).toBeCloseTo(750 / TEMPO, 6);
  });
});

describe('P1-P10 key positions', () => {
  it('has ten positions with the owner\'s shoulder and hip turns (±5°)', () => {
    expect(P_POS).toHaveLength(10);
    const want: [number, number, number][] = [[0, 0, 0], [1, -45, -17], [2, -75, -35], [3, -90, -45], [4, -45, 25], [5, -20, 40], [6, 28, 42]];
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
    const T = releaseTimes(1), at = (frac: number, keys: readonly number[]) => {   // the ms at which an eased phase passes a key
      const k = keys === DOWN_KEYS ? Math.sqrt(frac) : 1 - Math.sqrt(1 - frac);
      return keys === DOWN_KEYS ? k * T.down : T.down + k * T.follow;
    };
    const order = [[DOWN_KEYS[1], DOWN_KEYS, 4], [DOWN_KEYS[2], DOWN_KEYS, 5], [1, DOWN_KEYS, 6], [FOLLOW_KEYS[1], FOLLOW_KEYS, 7], [FOLLOW_KEYS[2], FOLLOW_KEYS, 8], [1, FOLLOW_KEYS, 9]] as const;
    let last = -1;
    for (const [frac, keys, i] of order) {
      const ms = at(frac, keys); expect(ms).toBeGreaterThan(last); last = ms;
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
  it('walk swings the feet in opposition and is idle at zero amount', () => {
    const w = walkPose(Math.PI / 2, 1);
    expect(Math.sign(w.lAnkle[2])).toBe(-Math.sign(w.rAnkle[2]));
    expect(walkPose(1, 0).lAnkle).toEqual([0, 0, 0]);
  });
});
