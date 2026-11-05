import { describe, it, expect } from 'vitest';
import { CARD, HOLE_COUNT, hole, teeBall } from '../src/server/course';

const M_PER_YD = 0.9144;
const PARS = [4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5];
const YARDS = [381, 502, 390, 331, 188, 524, 106, 418, 466, 446, 380, 202, 406, 573, 397, 403, 208, 543];

describe('C18-1 the card', () => {
  it('has 18 holes, par 72, the exact pars and yardages, 6,864 yd', () => {
    expect(HOLE_COUNT).toBe(18);
    expect(CARD.map(c => c.par)).toEqual(PARS);
    expect(CARD.map(c => c.yards)).toEqual(YARDS);
    expect(CARD.reduce((s, c) => s + c.par, 0)).toBe(72);
    expect(CARD.reduce((s, c) => s + c.yards, 0)).toBe(6864);
  });
  it('front nine is par 36 / 3306 yd and back nine par 36 / 3558 yd (the published subtotals)', () => {
    const sum = (a: number, b: number, k: 'par' | 'yards') => CARD.slice(a, b).reduce((s, c) => s + c[k], 0);
    expect([sum(0, 9, 'par'), sum(0, 9, 'yards')]).toEqual([36, 3306]);
    expect([sum(9, 18, 'par'), sum(9, 18, 'yards')]).toEqual([36, 3558]);
  });
});

describe('C18-2 hole(i)', () => {
  it('builds each hole from the card: tee at the origin, pin straight ahead at yards x 0.9144 m', () => {
    for (let i = 0; i < 18; i++) {
      const h = hole(i);
      expect(h.info.index, `hole ${i + 1}`).toBe(i);
      expect(h.info.par).toBe(PARS[i]);
      expect(h.info.tee).toEqual({ x: 0, z: 0 });
      expect(h.info.pin.x).toBe(0);
      expect(h.info.pin.z).toBeCloseTo(YARDS[i]! * M_PER_YD, 6);
      expect(h.info.lengthM).toBeCloseTo(YARDS[i]! * M_PER_YD, 6);
    }
  });
  it('rejects invalid indexes instead of clamping', () => {
    for (const bad of [-1, 18, 1.5, NaN, 100]) expect(() => hole(bad as number), String(bad)).toThrow(RangeError);
  });
});

describe('C18-3 surfaces and bounds on every hole', () => {
  it('green at the pin, fairway on the centre line, OOB behind the tee and beyond the pin, tee in bounds', () => {
    for (let i = 0; i < 18; i++) {
      const h = hole(i), { pin } = h.info;
      expect(h.surfaceAt(pin.x, pin.z), `hole ${i + 1} pin`).toBe('green');
      expect(h.surfaceAt(0, pin.z / 2)).toBe('fairway');
      expect(h.surfaceAt(40, pin.z / 2)).toBe('rough');
      expect(h.outOfBounds(0, 0)).toBe(false);
      expect(h.outOfBounds(0, -21)).toBe(true);
      expect(h.outOfBounds(0, pin.z + 41)).toBe(true);
      expect(h.outOfBounds(0, pin.z + 20)).toBe(false);
      expect(h.outOfBounds(71, pin.z / 2)).toBe(true);
    }
  });
  it('the green is never the whole fairway: a ball 40 m short of the pin is not on the green', () => {
    for (let i = 0; i < 18; i++) { const h = hole(i); if (h.info.pin.z > 60) expect(h.surfaceAt(0, h.info.pin.z - 40)).not.toBe('green'); }
  });
});

describe('C18-4 teeBall', () => {
  it('puts the ball on the tee with cumulative strokes, not holed out, on the right surface', () => {
    const h = hole(6);
    const b = teeBall(h, 9);
    expect(b).toEqual({ x: 0, z: 0, strokes: 9, holedOut: false, surface: h.surfaceAt(0, 0) });
  });
});
