import { describe, it, expect } from 'vitest';
import {
  BAG, IDEAL_MS, SWING_LENGTHS, isSwingLength, durationScale, lengthSpeedFactor,
  launchFor, scoreSwing, simulateShot, type SwingLength,
} from '../src/sim';

const YD = 1.0936133;
const perfectAt = (L: SwingLength) => {
  const d = durationScale(L);
  return scoreSwing({ zMs: IDEAL_MS.z, xMs: IDEAL_MS.x * d, cMs: IDEAL_MS.c * d }, L);
};
const club = (k: string) => BAG.find(c => c.key === k)!;
const carryYd = (k: string, L: SwingLength) => simulateShot(launchFor(club(k), perfectAt(L), L)).carryM * YD;

describe('PS-3 length validation', () => {
  it('accepts exactly 25/50/75/100', () => {
    expect([...SWING_LENGTHS]).toEqual([25, 50, 75, 100]);
    for (const v of [25, 50, 75, 100]) expect(isSwingLength(v)).toBe(true);
    for (const v of [0, 24, 26, 99, 101, -25, 12.5, NaN, Infinity, '50', null, undefined, {}]) expect(isSwingLength(v)).toBe(false);
  });
  it('scoring helpers reject an invalid length instead of guessing', () => {
    expect(() => scoreSwing({}, 60 as SwingLength)).toThrow(RangeError);
    expect(() => launchFor(club('1'), scoreSwing({}), 60 as SwingLength)).toThrow(RangeError);
  });
});

describe('PS-1 length 100 is unchanged', () => {
  it('scale and speed factor are exactly 1', () => {
    expect(durationScale(100)).toBe(1);
    expect(lengthSpeedFactor(100)).toBe(1);
  });
  it('explicit 100 equals the default for scoring and launch, for every club', () => {
    const input = { zMs: 33, xMs: 71, cMs: 140 };
    expect(scoreSwing(input, 100)).toEqual(scoreSwing(input));
    const s = scoreSwing(input);
    for (const c of BAG) expect(launchFor(c, s, 100)).toEqual(launchFor(c, s));
  });
});

describe('PS-2 timing offsets scale with length', () => {
  it('scale is in (0,1], non-decreasing with length, and shortens the downswing below 100', () => {
    let prev = 0;
    for (const L of SWING_LENGTHS) { const d = durationScale(L); expect(d).toBeGreaterThan(0); expect(d).toBeLessThanOrEqual(1); expect(d).toBeGreaterThanOrEqual(prev); prev = d; }
    expect(durationScale(25)).toBeLessThan(1);
  });
  it('perfect scaled timings give E = 0 at every length', () => {
    for (const L of SWING_LENGTHS) expect(perfectAt(L).E, `length ${L}`).toBe(0);
  });
  it('unscaled (full-swing) timings at 25% are NOT perfect, so the window really moved', () => {
    const s = scoreSwing({ zMs: IDEAL_MS.z, xMs: IDEAL_MS.x, cMs: IDEAL_MS.c }, 25);
    expect(s.E).toBeGreaterThan(0);
  });
  it('the 120 ms error window also scales: a fixed 60 ms miss costs more at 25% than at 100%', () => {
    const miss = (L: SwingLength) => { const d = durationScale(L); return scoreSwing({ zMs: 60, xMs: IDEAL_MS.x * d, cMs: IDEAL_MS.c * d }, L).nZ; };
    expect(miss(25)).toBeGreaterThan(miss(100));
  });
});

describe('PS-4 length controls distance', () => {
  it('speed factor increases with length and is in (0,1]', () => {
    let prev = 0;
    for (const L of SWING_LENGTHS) { const f = lengthSpeedFactor(L); expect(f).toBeGreaterThan(prev); expect(f).toBeLessThanOrEqual(1); prev = f; }
  });
  it('carry strictly increases with length for every non-putter club; perfect swings stay straight', () => {
    for (const c of BAG.filter(c => c.key !== 'P')) {
      let prev = 0;
      for (const L of SWING_LENGTHS) {
        const r = simulateShot(launchFor(c, perfectAt(L), L));
        expect(r.carryM, `${c.label} ${L}%`).toBeGreaterThan(prev);
        expect(Math.abs(r.offlineM) / r.carryM, `${c.label} ${L}% curvature`).toBeLessThan(0.01);
        prev = r.carryM;
      }
    }
  });
});

describe('PS-5 wedge distance control (acceptance)', () => {
  it('perfect 25% swing with the 62 degree wedge carries 40 to 75 yd', () => {
    const y = carryYd('O', 25);
    expect(y).toBeGreaterThanOrEqual(40);
    expect(y).toBeLessThanOrEqual(75);
  });
  it('the four lengths give usable, well-separated wedge distances (each step at least 10 yd apart)', () => {
    const ys = SWING_LENGTHS.map(L => carryYd('O', L));
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThan(10);
  });
});
