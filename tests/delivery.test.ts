import { describe, it, expect } from 'vitest';
import { BAG, CENTRE, LOFT_PER_FB_DEG, PATH_PER_IO_DEG, MAX_EFFORT, isValidBallPos, launchFor, maxEffortSpeedFactor, simulateShot, type Club, type BallPos } from '../src/sim';

const club = (k: string): Club => BAG.find(c => c.key === k)!;
const FULL = BAG.filter(c => c.key !== 'P');
const carry = (c: Club, s = {}) => simulateShot(launchFor(c, s)).carryM;
const std = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

describe('SS-1 perfect centre delivery', () => {
  it('every club: a centre full swing starts on line, has no curve, and is straight in flight', () => {
    for (const c of FULL) { const l = launchFor(c), r = simulateShot(l); expect(l.azimuthDeg, c.label).toBe(0); expect(l.spinAxisDeg, c.label).toBe(0); expect(Math.abs(r.offlineM) / r.carryM, c.label).toBeLessThan(0.005); }
  });
  it('no randomness without max effort or a rough lie: a seed changes nothing', () => {
    for (const c of FULL) expect(launchFor(c, { seed: 99 }), c.label).toEqual(launchFor(c));
  });
  it('the centre ball position is {fb:0, io:0} and defaults to it', () => { expect(CENTRE).toEqual({ fb: 0, io: 0 }); expect(launchFor(club('7'), { ballPos: CENTRE })).toEqual(launchFor(club('7'))); });
});

describe('SS-2 ball position (D-plane: loft from forward/back, path from closer/away, face square)', () => {
  it('constants: 1.5 degrees of loft per forward step, 1 degree of path per away step', () => { expect(LOFT_PER_FB_DEG).toBe(1.5); expect(PATH_PER_IO_DEG).toBe(1); });
  for (const key of ['1', '7', 'O']) {
    it(`${club(key).label}: forward raises launch and spin step by step, back lowers them`, () => {
      let prev: { launch: number; spin: number } | null = null;
      for (let fb = -2; fb <= 2; fb++) {
        const l = launchFor(club(key), { ballPos: { fb, io: 0 } });
        if (prev) { expect(l.launchDeg - prev.launch, `fb ${fb} launch`).toBeGreaterThan(0.4); expect(l.launchDeg - prev.launch).toBeLessThan(2.0); expect(l.backspinRpm - prev.spin, `fb ${fb} spin`).toBeGreaterThan(80); }
        prev = { launch: l.launchDeg, spin: l.backspinRpm };
      }
    });
    it(`${club(key).label}: apex rises with forward steps`, () => {
      const apex = (fb: number) => Math.max(...simulateShot(launchFor(club(key), { ballPos: { fb, io: 0 } })).samples.map(s => s.p.y));
      expect(apex(2)).toBeGreaterThan(apex(0)); expect(apex(0)).toBeGreaterThan(apex(-2));
    });
  }
  it('further from the body (D, +io) is a draw: starts right of the line, curves left; closer (A, -io) is a fade: the mirror', () => {
    for (const c of [club('1'), club('5'), club('O')]) {
      for (const io of [1, 2]) {
        const draw = launchFor(c, { ballPos: { fb: 0, io } }), fade = launchFor(c, { ballPos: { fb: 0, io: -io } });
        expect(draw.azimuthDeg, `${c.label} draw start`).toBeGreaterThan(0); expect(draw.spinAxisDeg, `${c.label} draw axis`).toBeLessThan(0);
        expect(fade.azimuthDeg).toBeLessThan(0); expect(fade.spinAxisDeg).toBeGreaterThan(0);
        // curve = landing relative to the start line; the 62° (spin loft ~61°) curves only ~0.3 m per degree of path, so it is checked by its curve, not its landing side
        const curve = (l: typeof draw) => { const r = simulateShot(l); return r.offlineM - Math.tan(l.azimuthDeg * Math.PI / 180) * r.carryM; };
        expect(curve(draw), `${c.label} io ${io} curves left`).toBeLessThan(-0.2); expect(curve(fade)).toBeGreaterThan(0.2);
        if (c.key !== 'O') { expect(simulateShot(draw).offlineM, `${c.label} io ${io} lands left`).toBeLessThan(-1); expect(simulateShot(fade).offlineM).toBeGreaterThan(1); }
      }
      expect(Math.abs(simulateShot(launchFor(c, { ballPos: { fb: 0, io: 2 } })).offlineM)).toBeGreaterThan(Math.abs(simulateShot(launchFor(c, { ballPos: { fb: 0, io: 1 } })).offlineM));
    }
  });
  it('draw and fade are mirror images within 15%', () => { const a = simulateShot(launchFor(club('7'), { ballPos: { fb: 0, io: 1 } })).offlineM, b = simulateShot(launchFor(club('7'), { ballPos: { fb: 0, io: -1 } })).offlineM; expect(Math.abs(a + b)).toBeLessThan(0.15 * Math.abs(a)); });
  it('isValidBallPos: integers -2..2 only', () => {
    for (const p of [{ fb: 0, io: 0 }, { fb: -2, io: 2 }, { fb: 2, io: -2 }]) expect(isValidBallPos(p)).toBe(true);
    for (const p of [{ fb: 3, io: 0 }, { fb: 0, io: -3 }, { fb: 0.5, io: 0 }, { fb: NaN, io: 0 }, { fb: '1', io: 0 }, { fb: 0 }, null, undefined, 5] as unknown[]) expect(isValidBallPos(p), JSON.stringify(p)).toBe(false);
  });
});

describe('SS-4 max effort is a 10% club-speed boost (owner, 2026-11-05)', () => {
  it('the speed factor is exactly 1.1 for every full-swing club', () => { for (const c of FULL) expect(maxEffortSpeedFactor(c), c.label).toBe(1.1); });
  for (const key of ['1', '7', '0', 'O']) it(`${club(key).label}: ball speed x1.1 and mean carry over seeds longer than a normal full swing`, () => {
    expect(launchFor(club(key), { maxEffort: true, seed: 1 }).ballSpeed / launchFor(club(key)).ballSpeed).toBeCloseTo(1.1, 4); // smash shifts a hair with the seeded face error
    const base = carry(club(key)), cs = Array.from({ length: 30 }, (_, i) => carry(club(key), { maxEffort: true, seed: i + 1 }));
    expect(mean(cs) / base, club(key).label).toBeGreaterThan(1.03); expect(mean(cs) / base).toBeLessThan(1.15);
  });
});

describe('SS-5 max effort accuracy: 75%, seeded', () => {
  const N = 500, driver = club('1');
  const offlines = (scale: number) => Array.from({ length: N }, (_, i) => simulateShot(launchFor(driver, { maxEffort: true, seed: 1000 + i, dispersionScale: scale })).offlineM);
  it('the spread over 500 seeded shots is about 2.5x the 0.4-degree reference spread (within 12%) and centred', () => {
    expect(MAX_EFFORT.accuracy).toBe(0.75); expect(MAX_EFFORT.speedFactor).toBe(1.1); expect(MAX_EFFORT.sigmaFaceDeg).toBe(1.0);
    const wide = offlines(1), ref = offlines(1 / 2.5);
    expect(std(wide) / std(ref)).toBeGreaterThan(2.5 * 0.88); expect(std(wide) / std(ref)).toBeLessThan(2.5 * 1.12);
    expect(Math.abs(mean(wide))).toBeLessThan(0.25 * std(wide)); expect(std(wide)).toBeGreaterThan(3);
  });
  it('absolute: max-effort driver offline std is pinned, and the same swing without max effort has zero offline spread', () => {
    // Measured once at 75% accuracy (sigma 1.0 degrees, x1.1 speed): std of offlineM over seeds 1000..1499 = 23.15 m.
    const s = std(offlines(1)); expect(s).toBeGreaterThan(20); expect(s).toBeLessThan(26);
    const clean = Array.from({ length: N }, (_, i) => simulateShot(launchFor(driver, { seed: 1000 + i })).offlineM);
    expect(Math.max(...clean.map(Math.abs))).toBe(0);
  });
  it('same seed, same shot; a different seed, a different shot; deterministic across calls', () => {
    const a = launchFor(driver, { maxEffort: true, seed: 7 }), b = launchFor(driver, { maxEffort: true, seed: 7 }), c = launchFor(driver, { maxEffort: true, seed: 8 });
    expect(a).toEqual(b); expect(a.azimuthDeg === c.azimuthDeg && a.spinAxisDeg === c.spinAxisDeg).toBe(false);
  });
});

describe('SS-6 lie and turf (PRD/03 section 4) and the tee', () => {
  const seven = club('7'), ref = launchFor(seven, { lie: 'fairway' });
  it('first cut: x0.97 speed, x0.85 spin, +0.5 degrees', () => { const l = launchFor(seven, { lie: 'firstCut' }); expect(l.ballSpeed / ref.ballSpeed).toBeCloseTo(0.97, 6); expect(l.backspinRpm / ref.backspinRpm).toBeCloseTo(0.85, 6); expect(l.launchDeg - ref.launchDeg).toBeCloseTo(0.5, 6); });
  it('rough: x0.85 speed, x0.55 spin (flyer), +1.5 degrees, and a seeded face noise within +-1.5 degrees', () => {
    const l = launchFor(seven, { lie: 'rough', seed: 3 }); expect(l.ballSpeed / ref.ballSpeed).toBeCloseTo(0.85, 3); expect(l.backspinRpm / ref.backspinRpm).toBeCloseTo(0.55, 3); // 3 places: the rough's face noise raises the 3-D spin loft (D-plane) expect(l.launchDeg - ref.launchDeg).toBeCloseTo(1.5, 6);
    expect(Math.abs(l.azimuthDeg)).toBeLessThanOrEqual(1.5 + 1e-9); expect(launchFor(seven, { lie: 'rough', seed: 3 })).toEqual(l);
    const noise = Array.from({ length: 40 }, (_, i) => launchFor(seven, { lie: 'rough', seed: i }).azimuthDeg); expect(Math.max(...noise) - Math.min(...noise)).toBeGreaterThan(1);
  });
  it('bunker: x0.55 speed for a non-wedge, x0.75 for a wedge (loft 50 or more), x0.60 spin, +2 degrees', () => {
    const iron = launchFor(seven, { lie: 'bunker' }), w = club('=') , wedge = launchFor(w, { lie: 'bunker' }), wref = launchFor(w, { lie: 'fairway' });
    expect(iron.ballSpeed / ref.ballSpeed).toBeCloseTo(0.55, 6); expect(wedge.ballSpeed / wref.ballSpeed).toBeCloseTo(0.75, 6); expect(iron.backspinRpm / ref.backspinRpm).toBeCloseTo(0.6, 6); expect(iron.launchDeg - ref.launchDeg).toBeCloseTo(2, 6);
  });
  it('fringe and green with a non-putter: x0.9 speed', () => { for (const lie of ['fringe', 'green'] as const) expect(launchFor(seven, { lie }).ballSpeed / ref.ballSpeed).toBeCloseTo(0.9, 6); });
  it('driver and 3-wood: attack angle is steeper off the ground than off the tee, so the tee launches higher with less spin', () => {
    for (const k of ['1', '2']) { const tee = launchFor(club(k), { lie: 'tee' }), grass = launchFor(club(k), { lie: 'fairway' }); expect(tee.launchDeg, club(k).label).toBeGreaterThan(grass.launchDeg); expect(tee.backspinRpm).toBeLessThan(grass.backspinRpm); }
  });
});

it('a ball position that is not centre never changes a putt (the putter ignores it)', () => { const p: BallPos = { fb: 2, io: 2 }; expect(launchFor(club('P'), { ballPos: p }).spinAxisDeg).toBe(launchFor(club('P')).spinAxisDeg); });

describe('ball-position curve size (owner playtest, 2026-11-05)', () => {
  it('Away +2 with the driver off the tee draws about 20-30 yd, and the 7-iron less', () => {
    const off = (key: string, io: number) => simulateShot(launchFor(BAG.find(c => c.key === key)!, { ballPos: { fb: 0, io }, lie: 'tee' })).offlineM * 1.0936;
    const d2 = off('1', 2), i2 = off('7', 2);
    expect(-d2).toBeGreaterThanOrEqual(20); expect(-d2).toBeLessThanOrEqual(30);
    expect(Math.abs(i2)).toBeLessThan(Math.abs(d2));
  });
});
