import { describe, it, expect } from 'vitest';
import {
  BAG, MIN_LENGTH, MAX_LENGTH, FULL_TURN_MS, MAX_EFFORT_HOLD_MS, isValidLength, clampLength, lengthFromHold, effortFromHold,
  lengthSpeedFactor, puttSpeedMs, rollDistance, launchFor, simulateShot,
} from '../src/sim';

const YD = 1.0936133;
const LENGTHS = [0.05, 0.1, 0.25, 0.33, 0.5, 0.62, 0.75, 0.9, 1];
const club = (k: string) => BAG.find(c => c.key === k)!;
const carryYd = (k: string, L: number) => simulateShot(launchFor(club(k), { length: L })).carryM * YD;

describe('length helpers', () => {
  it('constants', () => { expect([MIN_LENGTH, MAX_LENGTH, FULL_TURN_MS, MAX_EFFORT_HOLD_MS]).toEqual([0.05, 1, 750, 1100]); });
  it('isValidLength accepts finite numbers only', () => {
    for (const v of [0, 0.05, 0.5, 1, 7, -3]) expect(isValidLength(v)).toBe(true);
    for (const v of [NaN, Infinity, -Infinity, '0.5', null, undefined, {}, []]) expect(isValidLength(v)).toBe(false);
  });
  it('clampLength clamps to [0.05, 1] and rejects non-finite input', () => {
    expect(clampLength(-1)).toBe(0.05); expect(clampLength(0)).toBe(0.05); expect(clampLength(0.3)).toBe(0.3); expect(clampLength(1)).toBe(1); expect(clampLength(9)).toBe(1);
    expect(() => clampLength(NaN)).toThrow(RangeError); expect(() => clampLength(Infinity)).toThrow(RangeError);
  });
  it('lengthFromHold: 750 ms is a full turn, past full stays 1, floor 0.05', () => {
    expect(lengthFromHold(750)).toBe(1); expect(lengthFromHold(375)).toBeCloseTo(0.5, 10); expect(lengthFromHold(5000)).toBe(1); expect(lengthFromHold(0)).toBe(0.05); expect(lengthFromHold(-40)).toBe(0.05);
    expect(() => lengthFromHold(NaN)).toThrow(RangeError);
  });
});

describe('SS-7 effortFromHold: the server decides length and max effort from the reported hold time', () => {
  it('a normal hold is a partial or full swing, never max effort, up to just under 1.10 s', () => {
    expect(effortFromHold(375, false)).toEqual({ length: 0.5, maxEffort: false }); expect(effortFromHold(750, false)).toEqual({ length: 1, maxEffort: false });
    expect(effortFromHold(900, false)).toEqual({ length: 1, maxEffort: false }); expect(effortFromHold(1099, false)).toEqual({ length: 1, maxEffort: false });
  });
  it('1.10 s and beyond is a max-effort full swing', () => { for (const t of [1100, 1101, 5000]) expect(effortFromHold(t, false)).toEqual({ length: 1, maxEffort: true }); });
  it('the putter never has max effort: holding past full caps at length 1', () => { for (const t of [750, 1100, 9000]) expect(effortFromHold(t, true)).toEqual({ length: 1, maxEffort: false }); expect(effortFromHold(0, true).length).toBe(0.05); });
  it('a non-finite hold is rejected', () => { for (const t of [NaN, Infinity, -Infinity]) expect(() => effortFromHold(t, false)).toThrow(RangeError); });
});

describe('SS-3 length controls distance smoothly', () => {
  it('speed factor: anchored at the documented points, monotone, continuous, 1 at full', () => {
    const pts: [number, number][] = [[0.05, 0.25], [0.25, 0.62], [0.5, 0.76], [0.75, 0.86], [1, 1]];
    for (const [L, f] of pts) expect(lengthSpeedFactor(L), `L=${L}`).toBeCloseTo(f, 10);
    let prev = lengthSpeedFactor(0.05);
    for (let L = 0.06; L <= 1.0001; L += 0.01) { const f = lengthSpeedFactor(Math.min(1, L)); expect(f).toBeGreaterThan(prev); expect(f - prev).toBeLessThan(0.02); prev = f; }
  });
  it('rejects lengths outside [0.05, 1] and non-finite ones', () => { for (const L of [0, 0.04, 1.01, 2, NaN, Infinity]) { expect(() => lengthSpeedFactor(L), String(L)).toThrow(RangeError); expect(() => puttSpeedMs(L)).toThrow(RangeError); } });
  it('carry strictly increases with length for every non-putter club; centre swings stay straight', () => {
    for (const c of BAG.filter(c => c.key !== 'P')) {
      let prev = 0;
      for (const L of LENGTHS) { const r = simulateShot(launchFor(c, { length: L })); expect(r.carryM, `${c.label} ${L}`).toBeGreaterThan(prev); expect(Math.abs(r.offlineM) / r.carryM).toBeLessThan(0.01); prev = r.carryM; }
    }
  });
  it('the 62 degree wedge: 25% carries 40 to 75 yd, the shortest swing 2 to 20 yd, and the range is continuous', () => {
    expect(carryYd('O', 0.25)).toBeGreaterThanOrEqual(40); expect(carryYd('O', 0.25)).toBeLessThanOrEqual(75);
    expect(carryYd('O', MIN_LENGTH)).toBeGreaterThan(2); expect(carryYd('O', MIN_LENGTH)).toBeLessThan(20);
    const ys = LENGTHS.map(L => carryYd('O', L)); for (let i = 1; i < ys.length; i++) { expect(ys[i]!).toBeGreaterThan(ys[i - 1]!); expect(ys[i]! - ys[i - 1]!).toBeLessThan(45); }
  });
  it('literal anchors: speed factor 0.62 at 25% and 0.86 at 75%; putt start speed 5.74 m/s at full hold, roll proportional to hold', () => {
    expect(lengthSpeedFactor(0.25)).toBeCloseTo(0.62, 12); expect(lengthSpeedFactor(0.75)).toBe(0.86);
    expect(puttSpeedMs(1)).toBeCloseTo(5.74, 10); expect(puttSpeedMs(0.25)).toBeCloseTo(2.87, 10);
    // roll is proportional to the hold: half the hold rolls half as far, and a full putt rolls about 30 m on Stimp 10
    const roll = (L: number) => rollDistance(puttSpeedMs(L), 'green');
    expect(roll(1)).toBeGreaterThan(28); expect(roll(1)).toBeLessThan(32);
    for (const L of [0.1, 0.3, 0.5, 0.8]) expect(roll(L) / roll(1)).toBeCloseTo(L, 6);
  });
});
