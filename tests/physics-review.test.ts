import { describe, it, expect } from 'vitest';
import { BAG, launchFor, simulateShot, type Launch } from '../src/sim';

const base: Launch = { ballSpeed: 60, launchDeg: 12, azimuthDeg: 0, backspinRpm: 3000, spinAxisDeg: 0 };
const G = 9.81, rad = (d: number) => (d * Math.PI) / 180;
const vacRange = (v: number, deg: number) => (v * v * Math.sin(2 * rad(deg))) / G;
const vacApex = (v: number, deg: number) => (v * Math.sin(rad(deg))) ** 2 / (2 * G);
const club = (k: string) => BAG.find(c => c.key === k)!;

describe('review Q1: tight integrator sanity bounds (replaces the loose 2x vacuum bound)', () => {
  const v = base.ballSpeed, a = base.launchDeg;
  it('with no spin only drag acts: carry is below vacuum but not absurdly low; apex below vacuum apex', () => {
    const r = simulateShot({ ...base, backspinRpm: 0 });
    expect(r.carryM).toBeLessThan(vacRange(v, a));
    expect(r.carryM).toBeGreaterThan(0.6 * vacRange(v, a));
    expect(Math.max(...r.samples.map(s => s.p.y))).toBeLessThan(vacApex(v, a));
  });
  it('with 3000 rpm backspin lift extends carry to between 1.2x and 1.8x the vacuum range', () => {
    const r = simulateShot(base).carryM / vacRange(v, a);
    expect(r).toBeGreaterThan(1.2);
    expect(r).toBeLessThan(1.8);
  });
  it('backspin never shortens carry versus no spin at this launch', () => {
    expect(simulateShot(base).carryM).toBeGreaterThan(simulateShot({ ...base, backspinRpm: 0 }).carryM);
  });
});

describe('review finding 3: landing and roll in the sim', () => {
  it('the ball rolls out after landing: total exceeds carry by a plausible margin (driver)', () => {
    const r = simulateShot(launchFor(club('1')));
    expect(r.totalM - r.carryM).toBeGreaterThan(3);
    expect(r.totalM - r.carryM).toBeLessThan(60);
  });
  it('steeper, higher-spin wedge shots roll out less than a driver', () => {
    const roll = (k: string) => { const r = simulateShot(launchFor(club(k))); return r.totalM - r.carryM; };
    expect(roll('O')).toBeLessThan(roll('1'));
  });
});
