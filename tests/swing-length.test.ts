import { describe, it, expect } from 'vitest';
import {
  BAG, IDEAL_MS, MIN_LENGTH, MAX_LENGTH, FULL_TURN_MS, isValidLength, clampLength, lengthFromHold,
  durationScale, lengthSpeedFactor, puttSpeedMs, launchFor, scoreSwing, simulateShot,
} from '../src/sim';

const YD = 1.0936133;
const LENGTHS = [0.05, 0.1, 0.25, 0.33, 0.5, 0.62, 0.75, 0.9, 1];
const perfectAt = (L: number) => { const d = durationScale(L); return scoreSwing({ zMs: IDEAL_MS.z, xMs: IDEAL_MS.x * d, cMs: IDEAL_MS.c * d }, L); };
const club = (k: string) => BAG.find(c => c.key === k)!;
const carryYd = (k: string, L: number) => simulateShot(launchFor(club(k), perfectAt(L), L)).carryM * YD;

describe('SH-1 length helpers', () => {
  it('constants', () => { expect([MIN_LENGTH, MAX_LENGTH, FULL_TURN_MS]).toEqual([0.05, 1, 750]); });
  it('isValidLength accepts finite numbers only', () => {
    for (const v of [0, 0.05, 0.5, 1, 7, -3]) expect(isValidLength(v)).toBe(true);
    for (const v of [NaN, Infinity, -Infinity, '0.5', null, undefined, {}, []]) expect(isValidLength(v)).toBe(false);
  });
  it('clampLength clamps to [0.05, 1] and rejects non-finite input', () => {
    expect(clampLength(-1)).toBe(0.05); expect(clampLength(0)).toBe(0.05); expect(clampLength(0.3)).toBe(0.3);
    expect(clampLength(1)).toBe(1); expect(clampLength(9)).toBe(1);
    expect(() => clampLength(NaN)).toThrow(RangeError); expect(() => clampLength(Infinity)).toThrow(RangeError);
  });
  it('lengthFromHold: 750 ms is a full turn, past full pauses, floor 0.05', () => {
    expect(lengthFromHold(750)).toBe(1); expect(lengthFromHold(375)).toBeCloseTo(0.5, 10);
    expect(lengthFromHold(5000)).toBe(1); expect(lengthFromHold(0)).toBe(0.05); expect(lengthFromHold(-40)).toBe(0.05);
    expect(lengthFromHold(10)).toBe(0.05);
    expect(() => lengthFromHold(NaN)).toThrow(RangeError);
  });
});

describe('SH-2 timing scale is continuous and length 1 is the old full swing', () => {
  it('durationScale: anchored at the documented points, monotone, continuous, 1 at full', () => {
    const pts: [number, number][] = [[0.05, 0.48], [0.25, 0.6], [0.5, 0.75], [0.75, 0.9], [1, 1]];
    for (const [L, d] of pts) expect(durationScale(L), `L=${L}`).toBeCloseTo(d, 10);
    let prev = 0;
    for (let L = 0.05; L <= 1.0001; L += 0.01) { const d = durationScale(Math.min(1, L)); expect(d).toBeGreaterThanOrEqual(prev); expect(d - prev).toBeLessThan(0.01); prev = d; }
    expect(durationScale(0.375)).toBeCloseTo(0.675, 10); // midway between 0.6 and 0.75
  });
  it('rejects lengths outside [0.05, 1] and non-finite ones', () => {
    for (const L of [0, 0.04, 1.01, 2, NaN, Infinity]) { expect(() => durationScale(L), String(L)).toThrow(RangeError); expect(() => lengthSpeedFactor(L)).toThrow(RangeError); expect(() => puttSpeedMs(L)).toThrow(RangeError); }
  });
  it('perfect scaled timings give E = 0 at any length', () => { for (const L of LENGTHS) expect(perfectAt(L).E, `L=${L}`).toBe(0); });
  it('unscaled (full-swing) timings at 25% are not perfect: the window moved', () => {
    expect(scoreSwing({ zMs: 0, xMs: IDEAL_MS.x, cMs: IDEAL_MS.c }, 0.25).E).toBeGreaterThan(0);
  });
  it('a fixed 60 ms miss costs more on a shorter swing (the 120 ms window scales)', () => {
    const miss = (L: number) => scoreSwing({ zMs: 60, xMs: IDEAL_MS.x * durationScale(L), cMs: IDEAL_MS.c * durationScale(L) }, L).nZ;
    expect(miss(0.25)).toBeGreaterThan(miss(1));
  });
  it('length 1 (explicit or default) is exactly the old full swing', () => {
    const input = { zMs: 33, xMs: 71, cMs: 140 };
    expect(durationScale(1)).toBe(1); expect(lengthSpeedFactor(1)).toBe(1);
    expect(scoreSwing(input, 1)).toEqual(scoreSwing(input));
    const s = scoreSwing(input);
    for (const c of BAG) expect(launchFor(c, s, 1)).toEqual(launchFor(c, s));
  });
});

describe('SH-3 speed and carry rise smoothly with length', () => {
  it('lengthSpeedFactor: anchored, monotone, continuous, 1 at full', () => {
    const pts: [number, number][] = [[0.05, 0.18], [0.25, 0.5], [0.5, 0.68], [0.75, 0.86], [1, 1]];
    for (const [L, f] of pts) expect(lengthSpeedFactor(L), `L=${L}`).toBeCloseTo(f, 10);
    let prev = 0;
    for (let L = 0.05; L <= 1.0001; L += 0.01) { const f = lengthSpeedFactor(Math.min(1, L)); expect(f).toBeGreaterThan(prev); expect(f - prev).toBeLessThan(0.02); prev = f; }
  });
  it('carry strictly increases with length for every non-putter club; perfect swings stay straight', () => {
    for (const c of BAG.filter(c => c.key !== 'P')) {
      let prev = 0;
      for (const L of LENGTHS) {
        const r = simulateShot(launchFor(c, perfectAt(L), L));
        expect(r.carryM, `${c.label} ${L}`).toBeGreaterThan(prev);
        expect(Math.abs(r.offlineM) / r.carryM, `${c.label} ${L} curvature`).toBeLessThan(0.01);
        prev = r.carryM;
      }
    }
  });
});

describe('SH-4 wedge distance control (acceptance)', () => {
  it('perfect 25% swing with the 62 degree wedge carries 40 to 75 yd', () => {
    const y = carryYd('O', 0.25); expect(y).toBeGreaterThanOrEqual(40); expect(y).toBeLessThanOrEqual(75);
  });
  it('very short swings give chips: the shortest 62 degree swing carries 2 to 20 yd', () => {
    const y = carryYd('O', MIN_LENGTH); expect(y).toBeGreaterThan(2); expect(y).toBeLessThan(20);
  });
  it('the 62 degree wedge covers a continuous range from a chip to a full shot', () => {
    const ys = LENGTHS.map(L => carryYd('O', L));
    for (let i = 1; i < ys.length; i++) { expect(ys[i]!).toBeGreaterThan(ys[i - 1]!); expect(ys[i]! - ys[i - 1]!).toBeLessThan(45); }
  });
});

describe('SH-5 putt speed curve', () => {
  it('puttSpeedMs = 15 m/s x length and matches the old drawMs curve', () => {
    for (const drawMs of [75, 105, 183, 600, 1500]) expect(puttSpeedMs(drawMs / 1500)).toBeCloseTo((drawMs / 1500) * 15, 10);
    expect(puttSpeedMs(1)).toBe(15); expect(puttSpeedMs(0.05)).toBeCloseTo(0.75, 10);
  });
});
