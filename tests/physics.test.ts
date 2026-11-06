import { describe, it, expect } from 'vitest';
import { rollDistance, rollingDecel, simulateShot, launchFor, BAG, type Launch } from '../src/sim';

const base: Launch = { ballSpeed: 60, launchDeg: 12, azimuthDeg: 0, backspinRpm: 3000, spinAxisDeg: 0 };

describe('rolling', () => {
  it('AC-P3: Stimp 10, 1.83 m/s rolls 3.05 m +-5%', () => {
    const d = rollDistance(1.83, 'green', 10);
    expect(d).toBeGreaterThan(3.05 * 0.95);
    expect(d).toBeLessThan(3.05 * 1.05);
  });
  it('green decel follows 36/(2S) ft/s^2: faster green, smaller decel', () => {
    expect(rollingDecel('green', 10)).toBeCloseTo(0.5486, 3);
    expect(rollingDecel('green', 12)).toBeLessThan(rollingDecel('green', 10));
  });
  it('distance scales with v^2 and zero speed rolls zero', () => {
    expect(rollDistance(0, 'green', 10)).toBe(0);
    expect(rollDistance(3.66, 'green', 10) / rollDistance(1.83, 'green', 10)).toBeCloseTo(4, 6);
  });
  it('rough stops a ball sooner than fairway, fairway sooner than green', () => {
    const v = 5;
    expect(rollDistance(v, 'rough')).toBeLessThan(rollDistance(v, 'fairway'));
    expect(rollDistance(v, 'fairway')).toBeLessThan(rollDistance(v, 'green', 10));
  });
  it('bunker ball stops (zero roll)', () => {
    expect(rollDistance(5, 'bunker')).toBe(0);
  });
});

describe('flight', () => {
  it('AC-P4: identical input gives bitwise-identical trajectory', () => {
    expect(simulateShot(base)).toEqual(simulateShot({ ...base }));
  });
  it('samples start at t=0 at the origin, are 60 Hz, and end on the ground', () => {
    const r = simulateShot(base);
    expect(r.samples[0]!.t).toBe(0);
    expect(r.samples[0]!.p).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.samples[1]!.t).toBeCloseTo(1 / 60, 9);
    expect(r.samples.at(-1)!.p.y).toBeLessThanOrEqual(0.05);
    expect(r.samples.every(s => Number.isFinite(s.p.x + s.p.y + s.p.z))).toBe(true);
  });
  it('a straight shot has ~zero offline; carry is positive and below 2x the vacuum range (Magnus lift beats vacuum, drag cuts it)', () => {
    const r = simulateShot(base);
    expect(Math.abs(r.offlineM)).toBeLessThan(0.01 * r.carryM);
    const v = base.ballSpeed, a = base.launchDeg * Math.PI / 180;
    expect(r.carryM).toBeGreaterThan(0);
    expect(r.carryM).toBeLessThan(2 * v * v * Math.sin(2 * a) / 9.81);
    expect(r.totalM).toBeGreaterThanOrEqual(r.carryM);
  });
  it('AC-P2: positive spin-axis tilt curves right, more tilt curves more, negative curves left', () => {
    const t = (d: number) => simulateShot({ ...base, spinAxisDeg: d }).offlineM;
    expect(t(0)).toBeCloseTo(0, 1);
    expect(t(5)).toBeGreaterThan(0.5);
    expect(t(10)).toBeGreaterThan(t(5));
    expect(t(-5)).toBeLessThan(-0.5);
    expect(t(-5)).toBeCloseTo(-t(5), 1);
  });
  it('more backspin gives a higher apex', () => {
    const apex = (rpm: number) => Math.max(...simulateShot({ ...base, backspinRpm: rpm }).samples.map(s => s.p.y));
    expect(apex(6000)).toBeGreaterThan(apex(2000));
  });
  it('faster ball goes further', () => {
    expect(simulateShot({ ...base, ballSpeed: 70 }).carryM).toBeGreaterThan(simulateShot(base).carryM);
  });
});

describe('bag and launch', () => {
  it('has 14 clubs on the PRD keys in order', () => {
    expect(BAG.map(c => c.key)).toEqual(['1','2','3','4','5','6','7','8','9','0','-','=','O','P']);
    expect(BAG[0]!.loftDeg).toBe(8);
    expect(BAG[0]!.maxClubSpeedMph).toBe(130);
  });
  it('AC-S3: perfect swing flies straight (<1% curvature) with every non-putter club', () => {
    for (const c of BAG.filter(c => c.key !== 'P')) {
      const r = simulateShot(launchFor(c));
      expect(r.carryM, c.label).toBeGreaterThan(10);
      expect(Math.abs(r.offlineM) / r.carryM, c.label).toBeLessThan(0.01);
    }
  });
  it('perfect swing: driver outcarries 7i outcarries PW outcarries 62-degree wedge', () => {
    const carry = (k: string) => simulateShot(launchFor(BAG.find(c => c.key === k)!)).carryM;
    expect(carry('1')).toBeGreaterThan(carry('7'));
    expect(carry('7')).toBeGreaterThan(carry('='));
    expect(carry('=')).toBeGreaterThan(carry('O'));
  });
});
