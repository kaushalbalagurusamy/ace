import { describe, expect, it } from 'vitest';
import { requiredDrop, turnAngles } from '../src/client/golferrig';
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
