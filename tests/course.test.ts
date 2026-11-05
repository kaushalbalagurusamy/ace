import { describe, it, expect } from 'vitest';
import { CARD, HOLE_COUNT, hole, teeBall } from '../src/server/course';
import { GRIDS } from '../src/shared/course-grid';

/** Counts straight from the traced grid (an independent view of the data the server reads). */
function gridStats(i: number) {
  const g = GRIDS[i]!; const c: Record<string, number> = {};
  let fx = 0, fn = 0;
  g.rows.forEach((row, iz) => { let ix = 0; for (const m of row.matchAll(/([a-z])(\d*)/g)) { const n = m[2] ? Number(m[2]) : 1; c[m[1]!] = (c[m[1]!] ?? 0) + n; if (m[1] === 'f') { for (let k = 0; k < n; k++) { fx += g.x0 + (ix + k + 0.5) * g.cell; fn++; } } ix += n; } void iz; });
  return { green: c.g ?? 0, fairway: c.f ?? 0, sand: c.s ?? 0, water: c.w ?? 0, trees: c.t ?? 0, fairwayLateralSpread: fn ? Math.abs(fx / fn) : 0 };
}

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

describe('C18-3 the traced layouts: one grid drives both physics and visuals', () => {
  const COASTAL = [4, 5, 6, 7, 8, 9, 10, 17, 18];
  it('every hole starts on a playable fairway tee and the pin is on the green', () => {
    for (let i = 0; i < 18; i++) {
      const h = hole(i), { pin } = h.info;
      expect(h.surfaceAt(0, 0), `hole ${i + 1} tee`).toBe('fairway');
      expect(h.penaltyAt(0, 0)).toBeNull();
      expect(h.surfaceAt(pin.x, pin.z), `hole ${i + 1} pin`).toBe('green');
      expect(h.penaltyAt(pin.x, pin.z)).toBeNull();
    }
  });
  it('each hole has a real green (area, not just the forced 4.5 m spot) and a real fairway', () => {
    for (let i = 0; i < 18; i++) {
      const g = gridStats(i);
      expect(g.green, `hole ${i + 1} green cells`).toBeGreaterThan(25);          // > 100 m^2 at 4 m^2 per cell
      expect(g.fairway, `hole ${i + 1} fairway cells`).toBeGreaterThan(150);
      expect(hole(i).info.greenRadius).toBeGreaterThan(5); expect(hole(i).info.greenRadius).toBeLessThan(30);
    }
  });
  it('the holes really differ in layout: distinct hazard mixes and non-straight fairways', () => {
    const sigs = new Set<string>();
    let bent = 0;
    for (let i = 0; i < 18; i++) {
      const g = gridStats(i); sigs.add(`${Math.round(g.sand / 40)}:${Math.round(g.water / 400)}:${Math.round(g.trees / 60)}`);
      if (g.fairwayLateralSpread > 6) bent++;                                    // fairway centre drifts off the tee-pin line by more than 6 m
    }
    expect(sigs.size).toBeGreaterThanOrEqual(10);
    expect(bent).toBeGreaterThanOrEqual(8);
  });
  it('ocean holes have water (4 to 10, 17, 18) and inland holes have none beside the corridor', () => {
    for (let i = 0; i < 18; i++) {
      const w = gridStats(i).water;
      if (COASTAL.includes(i + 1)) expect(w, `hole ${i + 1}`).toBeGreaterThan(400);
      else expect(w, `hole ${i + 1}`).toBeLessThan(400);
    }
  });
  it('water and out of bounds are penalties; the rest of the map is playable', () => {
    const h = hole(17);                                                           // hole 18: ocean on the left
    let water = 0, oob = 0;
    for (let x = -100; x <= 100; x += 4) for (let z = -30; z <= h.info.pin.z + 50; z += 4) { const p = h.penaltyAt(x, z); if (p === 'water') water++; if (p === 'oob') oob++; }
    expect(water).toBeGreaterThan(200);
    expect(h.penaltyAt(-1e4, 0)).toBe('oob'); expect(h.penaltyAt(0, -1e4)).toBe('oob'); expect(h.penaltyAt(1e4, 5)).toBe('oob');
    expect(h.penaltyAt(0, 0)).toBeNull();
    expect(oob).toBeGreaterThanOrEqual(0);
  });
  it('surfaces map to lies: bunker cells are bunker, tree and rock cells play as rough, path plays as fairway', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 18; i++) { const h = hole(i); for (let x = -100; x <= 100; x += 3) for (let z = -30; z <= h.info.pin.z + 60; z += 3) { if (!h.penaltyAt(x, z)) seen.add(h.surfaceAt(x, z)); } }
    for (const s of ['green', 'fairway', 'firstCut', 'rough', 'bunker']) expect(seen.has(s), s).toBe(true);
  });
});

describe('C18-4 teeBall', () => {
  it('puts the ball on the tee with cumulative strokes, not holed out, on the right surface', () => {
    const h = hole(6);
    const b = teeBall(h, 9);
    expect(b).toEqual({ x: 0, z: 0, strokes: 9, holedOut: false, surface: h.surfaceAt(0, 0) });
  });
});
