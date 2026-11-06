import { describe, expect, it } from 'vitest';
import { DOWNSWING_MS, HIP_DEPTH, POSES, TEMPO, addressHead, backswingDepth, backswingPose, lerpPose, releasePose, releaseTimes, walkPose } from '../src/client/golferanim';

const L = 0.94; // 7-iron
const hyp = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
const near = (a: readonly number[], b: readonly number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, 9));

describe('Dunaway timings', () => {
  it('hip-high sits at 17/47 of the turn and the tempo is about 3:1', () => {
    expect(HIP_DEPTH).toBeCloseTo(17 / 47, 6);
    expect(TEMPO).toBeCloseTo(47 / 15, 6);
    expect(DOWNSWING_MS).toBeCloseTo(750 / TEMPO, 6);
  });
});

describe('backswing depth', () => {
  it('follows the hold up to the full turn and stays at the top after', () => {
    expect(backswingDepth(-5)).toBe(0);
    expect(backswingDepth(375)).toBeCloseTo(0.5);
    expect(backswingDepth(750)).toBe(1);
    expect(backswingDepth(1100)).toBe(1);
  });
  it('passes through address, hands hip-high and the top at the right depths', () => {
    near(backswingPose(0, L).grip, POSES.address.grip);
    near(backswingPose(HIP_DEPTH, L).grip, POSES.hipHigh.grip);
    near(backswingPose(1, L).grip, POSES.top.grip);
  });
  it('turns the pelvis and torso further away from the target as depth grows', () => {
    let prev = Infinity;
    for (let d = 0; d <= 1.0001; d += 0.1) {
      const p = backswingPose(d, L), turn = p.pelvis[1] + p.torso[1];
      expect(turn).toBeLessThanOrEqual(prev + 1e-9); prev = turn;
    }
    expect(prev).toBeLessThan(-1.2);
  });
});

describe('address geometry', () => {
  it('puts the head on the ground one club length from the grip', () => {
    const g = POSES.address.grip, h = addressHead(g, L);
    expect(hyp([h[0] - g[0], h[1] - g[1], h[2] - g[2]])).toBeCloseTo(L, 6);
    expect(h[1]).toBeCloseTo(0.02);
    expect(h[2]).toBeGreaterThan(g[2]);   // the ball is in front of the hands
  });
  it('aims the address shaft at that head', () => {
    const p = backswingPose(0, L), h = addressHead(p.grip, L);
    const tip = p.grip.map((x, i) => x + p.shaft[i]! * L);
    tip.forEach((x, i) => expect(x).toBeCloseTo(h[i]!, 6));
  });
});

describe('release', () => {
  it('reaches impact (club back at the ball) at the end of the downswing', () => {
    const T = releaseTimes(1), r = releasePose(1, T.down, L);
    expect(r.impact).toBe(true);
    const tipY = r.pose.grip[1] + r.pose.shaft[1] * L;
    expect(tipY).toBeLessThan(0.15);
  });
  it('is not at impact just before, and is done after the finish and return', () => {
    const T = releaseTimes(1);
    expect(releasePose(1, T.down - 1, L).impact).toBe(false);
    expect(releasePose(1, T.down + T.follow + T.hold + T.back, L).done).toBe(true);
    expect(releasePose(1, T.down + T.follow, L).done).toBe(false);
  });
  it('comes down and follows through sooner for a shorter backswing', () => {
    const a = releaseTimes(1), b = releaseTimes(0.3);
    expect(b.down).toBeLessThan(a.down); expect(b.follow).toBeLessThan(a.follow);
  });
  it('a full swing finishes high, a short one stays low', () => {
    const fin = (d: number) => { const T = releaseTimes(d); return releasePose(d, T.down + T.follow, L).pose.grip[1]; };
    expect(fin(1)).toBeGreaterThan(fin(0.2) + 0.3);
  });
  it('putts strike at address and finish through by the stroke length', () => {
    const T = releaseTimes(0.5, true), r = releasePose(0.5, T.down, L, true);
    expect(r.impact).toBe(true);
    expect(r.pose.grip[0]).toBeCloseTo(POSES.puttAddress.grip[0], 2);
  });
});

describe('pose blending', () => {
  it('returns the endpoints and keeps directions unit length', () => {
    const a = POSES.address, b = POSES.top;
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
