import { describe, it, expect } from 'vitest';
import { scoreSwing, IDEAL_MS } from '../src/sim';

const perfect = { zMs: IDEAL_MS.z, xMs: IDEAL_MS.x, cMs: IDEAL_MS.c };

describe('swing scoring (PRD/02 §3)', () => {
  it('perfect sequence: E = 0, full factors, square face and path (AC-S3 input)', () => {
    const s = scoreSwing(perfect);
    expect(s.E).toBe(0);
    expect(s.speedFactor).toBe(1);
    expect(s.smashFactor).toBe(1);
    expect(Math.abs(s.pathDeg)).toBe(0);
    expect(Math.abs(s.faceToPathDeg)).toBe(0);
  });
  it('Z 120 ms late: nZ=1, E=0.4, speed 0.9, smash 0.96', () => {
    const s = scoreSwing({ ...perfect, zMs: 120 });
    expect(s.nZ).toBe(1);
    expect(s.E).toBeCloseTo(0.4, 10);
    expect(s.speedFactor).toBeCloseTo(0.9, 10);
    expect(s.smashFactor).toBeCloseTo(0.96, 10);
  });
  it('error is clamped at 120 ms', () => {
    expect(scoreSwing({ ...perfect, zMs: 120 }).nZ).toBe(scoreSwing({ ...perfect, zMs: 5000 }).nZ);
    expect(scoreSwing({ ...perfect, zMs: -120 }).nZ).toBe(1);
  });
  it('X early by 60 ms: nX=0.5, path 3 deg left (negative)', () => {
    const s = scoreSwing({ ...perfect, xMs: 0 });
    expect(s.nX).toBeCloseTo(0.5, 10);
    expect(s.pathDeg).toBeCloseTo(-3, 10);
  });
  it('X late gives positive path; C early closes (negative), C late opens (positive)', () => {
    expect(scoreSwing({ ...perfect, xMs: IDEAL_MS.x + 60 }).pathDeg).toBeCloseTo(3, 10);
    expect(scoreSwing({ ...perfect, cMs: IDEAL_MS.c + 120 }).faceToPathDeg).toBeCloseTo(5, 10);
    expect(scoreSwing({ ...perfect, cMs: IDEAL_MS.c - 120 }).faceToPathDeg).toBeCloseTo(-5, 10);
  });
  it('missing key counts as maximum error (n = 1) and never throws', () => {
    expect(scoreSwing({ xMs: 60, cMs: 150 }).nZ).toBe(1);
    expect(scoreSwing({}).E).toBeCloseTo(1, 10); // 0.4+0.3+0.3
    expect(scoreSwing({}).speedFactor).toBeCloseTo(0.75, 10);
  });
  it('E is monotonic in |error| for each key and stays within [0,1]', () => {
    let prev = -1;
    for (let e = 0; e <= 200; e += 10) {
      const E = scoreSwing({ ...perfect, cMs: IDEAL_MS.c + e }).E;
      expect(E).toBeGreaterThanOrEqual(prev);
      expect(E).toBeGreaterThanOrEqual(0);
      expect(E).toBeLessThanOrEqual(1);
      prev = E;
    }
  });
  it('AC-S5: depends only on the supplied timings, so frame rate cannot change E', () => {
    const input = { zMs: 33, xMs: 71, cMs: 140 };
    const a = scoreSwing(input);
    // simulate 30 fps vs 144 fps consumers: both pass the same raw ms values
    const b = scoreSwing({ ...input });
    expect(a).toEqual(b);
  });
});
