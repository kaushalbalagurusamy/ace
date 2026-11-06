import { describe, expect, it } from 'vitest';
import { bunkerProfile, dip, ground, visualGround } from '../src/client/terrain';
import { gridKey } from '../src/shared/courses';

describe('visual bunker bowls', () => {
  it('the cross-section is continuous: lip proud outside, sand floor below, nothing past 4.5 m out', () => {
    for (let s = -6; s < 6; s += 0.01) expect(Math.abs(bunkerProfile(s + 0.01) - bunkerProfile(s))).toBeLessThan(0.02);
    expect(bunkerProfile(-1.4)).toBeCloseTo(0.4); expect(bunkerProfile(1)).toBeLessThan(-0.7); expect(bunkerProfile(-4.6)).toBe(0);
  });
  it('only Pebble is sculpted; parkland bunkers stay on the physics ground', () => {
    for (const c of ['bethpage-black', 'aronimink'] as const) for (let z = 0; z < 400; z += 7) expect(dip(gridKey(c, 3), 0, z)).toBe(0);
    let n = 0; for (let z = 0; z < 500; z += 2) for (let x = -40; x < 40; x += 2) if (dip(17, x, z) < -0.5) n++;
    expect(n).toBeGreaterThan(20);   // hole 18 has real bowls
    expect(visualGround(17, 5, 5)).toBeCloseTo(ground(17, 5, 5) + dip(17, 5, 5));
  });
});
