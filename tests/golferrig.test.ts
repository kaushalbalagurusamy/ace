import { describe, expect, it } from 'vitest';
import { keepReachable, requiredDrop, turnAngles } from '../src/client/golferrig';

describe('two hands on the grip', () => {
  const l = { x: 0.17, y: 1.3, z: 0 }, r = { x: -0.17, y: 1.3, z: 0 };
  it('keeps a reachable grip where it is', () => { expect(keepReachable([0, 0.9, 0.2], [0, 0.85, 0.22], l, r, 0.55, 0.55)).toEqual([0, 0.9, 0.2]); });
  it('slides an out-of-reach grip toward the shoulders until both hands reach it', () => {
    const g = keepReachable([0.1, 0.5, 0.5], [0.05, 0.45, 0.5], l, r, 0.55, 0.55), t = [g[0] - 0.05, g[1] - 0.05, g[2]];
    expect(Math.hypot(g[0] - l.x, g[1] - l.y, g[2] - l.z)).toBeLessThanOrEqual(0.5501);
    expect(Math.hypot(t[0]! - r.x, t[1]! - r.y, t[2]! - r.z)).toBeLessThanOrEqual(0.5501);
  });
});
import { P_POS } from '../src/client/golferanim';

describe('top-down turn of the P positions (closed > 0, open < 0)', () => {
  const t = P_POS.map(turnAngles);
  it('P4: shoulders at least 80° closed, hips 35-50° closed', () => {
    expect(t[3]!.shoulders).toBeGreaterThanOrEqual(80); expect(t[3]!.hips).toBeGreaterThanOrEqual(35); expect(t[3]!.hips).toBeLessThanOrEqual(50);
  });
  it('P7: hips 35-45° open, shoulders 10-25° open', () => {
    expect(-t[6]!.hips).toBeGreaterThanOrEqual(35); expect(-t[6]!.hips).toBeLessThanOrEqual(45);
    expect(-t[6]!.shoulders).toBeGreaterThanOrEqual(10); expect(-t[6]!.shoulders).toBeLessThanOrEqual(25);
  });
  it('P10: chest facing the target (at least 80° open)', () => { expect(-t[9]!.shoulders).toBeGreaterThanOrEqual(80); });
  it('P2 and P3 show the torso turn (about 45° and 75°), P5-P7 open the hips progressively and differ from P3-P1', () => {
    expect(t[1]!.shoulders).toBeGreaterThanOrEqual(38); expect(t[2]!.shoulders).toBeGreaterThanOrEqual(65);
    expect(-t[4]!.hips).toBeGreaterThanOrEqual(20); expect(-t[5]!.hips).toBeGreaterThan(-t[4]!.hips); expect(P_POS[6]!.shift[0]).toBeGreaterThanOrEqual(0.1);
  });
});

describe('feet stay on the ground', () => {
  it('drops the hip only when a straight leg cannot reach its ground target', () => {
    expect(requiredDrop([0, 0.9, 0], [0, 0.08, 0], 0.9)).toBe(0);              // already reaches
    expect(requiredDrop([0, 1.0, 0], [0, 0.08, 0], 0.8)).toBeCloseTo(0.12, 9);   // straight down: 0.92 needed, 0.8 long
    const d = requiredDrop([0.3, 1.0, 0], [0, 0.08, 0], 0.8);                   // a splayed leg reaches exactly after the drop
    expect(Math.hypot(0.3, 1.0 - d - 0.08)).toBeCloseTo(0.8, 9);
  });
});
