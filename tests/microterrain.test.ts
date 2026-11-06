import { describe, expect, it } from 'vitest';
import { bunkerProfile, dip, ground, propSpots, seaField, seaY, visualGround } from '../src/client/terrain';
import { gridOf } from '../src/shared/courses';
import { gridKey } from '../src/shared/courses';

describe('visual bunker bowls', () => {
  it('the cross-section is continuous: lip proud outside, sand floor below, nothing past 4.5 m out', () => {
    for (let s = -6; s < 6; s += 0.01) expect(Math.abs(bunkerProfile(s + 0.01) - bunkerProfile(s))).toBeLessThan(0.025);
    expect(bunkerProfile(-1.2)).toBeCloseTo(0.55); expect(bunkerProfile(1)).toBeLessThan(-0.9); expect(bunkerProfile(-4.6)).toBe(0);
  });
  it('only Pebble is sculpted; parkland bunkers stay on the physics ground', () => {
    for (const c of ['bethpage-black', 'aronimink'] as const) for (let z = 0; z < 400; z += 7) expect(dip(gridKey(c, 3), 0, z)).toBe(0);
    let n = 0; for (let z = 0; z < 500; z += 2) for (let x = -40; x < 40; x += 2) if (dip(17, x, z) < -0.5) n++;
    expect(n).toBeGreaterThan(20);   // hole 18 has real bowls
    expect(visualGround(17, 5, 5)).toBeCloseTo(ground(17, 5, 5) + dip(17, 5, 5));
  });
});

describe('coast clean-up', () => {
  it('no tree stands in or at the edge of the sea on any Pebble hole', () => {
    for (let h = 0; h < 18; h++) {
      const g = gridOf(h), sea = seaField(h).sea;
      for (const s of propSpots(h)) if (s.kind !== 'rock') {
        expect(ground(h, s.x, s.z)).toBeGreaterThan(seaY(h) + 0.3);
        expect(sea[Math.floor((s.z - g.z0) / g.cell) * g.nx + Math.floor((s.x - g.x0) / g.cell)]).toBe(0);
      }
    }
  });
  it('the flat offshore slabs on hole 8 are drawn as sea', () => {
    const g = gridOf(7), sea = seaField(7).sea, at = (x: number, z: number) => sea[Math.floor((z - g.z0) / g.cell) * g.nx + Math.floor((x - g.x0) / g.cell)];
    expect(at(93, 120)).toBe(1); expect(at(84, 264)).toBe(1);
  });
});
