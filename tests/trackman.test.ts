// TrackMan calibration: docs/research/trackman-physics.md §6 validation cases at the simulator level (docs/slices/trackman-calibration/spec.md TM-1..TM-14).
import { describe, it, expect } from 'vitest';
import { BAG, airDensity, bounceRoll, captureSpeed, impact, launchFor, rollDistance, simulateShot, type Air, type Delivery, type Launch, type Surface } from '../src/sim';

const MPH = 0.44704, YD = 1.0936133, RAD = Math.PI / 180;
const launch = (mph: number, deg: number, rpm: number): Launch => ({ ballSpeed: mph * MPH, launchDeg: deg, azimuthDeg: 0, backspinRpm: rpm, spinAxisDeg: 0 });
const fly = (l: Launch, air?: Air) => {
  const r = simulateShot(l, air);
  return { carry: r.carryM * YD, total: r.totalM * YD, apex: r.apexM * YD, land: r.landing.angleDeg };
};
/** K for the PGA driver row, 2545 / (115·sin 14.7°) = 87.2 (§2.3 prints it rounded to 87). */
const K_DRIVER = 2545 / (115 * Math.sin(14.7 * RAD));
const within = (v: number, lo: number, hi: number, what: string) => { expect(v, what).toBeGreaterThanOrEqual(lo); expect(v, what).toBeLessThanOrEqual(hi); };
const near = (v: number, target: number, tol: number, what: string) => within(v, target - tol, target + tol, what);

describe('TM-1..3 flight from measured launch conditions (research §6 cases 1-3)', () => {
  it('case 1, PGA driver 2024: 171 mph, 10.4°, 2545 rpm -> carry 282 ± 6, apex 35 ± 3, land 39 ± 3°', () => {
    const f = fly(launch(171, 10.4, 2545)); near(f.carry, 282, 6, 'carry'); near(f.apex, 35, 3, 'apex'); near(f.land, 39, 3, 'land');
  });
  it('case 2, PGA driver prior edition: 167 mph, 10.9°, 2686 rpm -> carry 275 ± 6, apex 32 ± 3, land 38 ± 3°', () => {
    const f = fly(launch(167, 10.9, 2686)); near(f.carry, 275, 6, 'carry'); near(f.apex, 32, 3, 'apex'); near(f.land, 38, 3, 'land');
  });
  it('case 3, PGA 7-iron 2024: 123 mph, 16.1°, 7124 rpm -> carry 176 ± 6, apex 34 ± 3, land 51 ± 3°', () => {
    const f = fly(launch(123, 16.1, 7124)); near(f.carry, 176, 6, 'carry'); near(f.apex, 34, 3, 'apex'); near(f.land, 51, 3, 'land');
  });
});

describe('TM-4..7 impact model (research §2, §6 cases 4-7)', () => {
  const imp = (d: Delivery): Launch => impact(d);
  it('case 4, PGA driver: club 115, A -0.9°, SL 14.7°, square -> ball 171 ± 2 mph, launch 10.4 ± 1°, spin 2545 ± 250', () => {
    const l = imp({ clubMph: 115, attackDeg: -0.9, loftDeg: -0.9 + 14.7, smashBase: 1.54, k: K_DRIVER });
    near(l.ballSpeed / MPH, 171, 2, 'ball'); near(l.launchDeg, 10.4, 1, 'launch'); near(l.backspinRpm, 2545, 250, 'spin');
    expect(l.azimuthDeg).toBe(0); expect(l.spinAxisDeg).toBe(0);
  });
  it('case 5, PGA 6-iron: club 94, A -3.7°, SL 24.3° -> ball 130 ± 2, launch 14.0 ± 1.5°, spin 6204 ± 400, carry 188 ± 7', () => {
    const l = imp({ clubMph: 94, attackDeg: -3.7, loftDeg: -3.7 + 24.3, smashBase: 1.525, k: 160 });
    near(l.ballSpeed / MPH, 130, 2, 'ball'); near(l.launchDeg, 14.0, 1.5, 'launch'); near(l.backspinRpm, 6204, 400, 'spin');
    near(fly(l).carry, 188, 7, 'carry');
  });
  const case6 = (l: Launch) => {
    near(l.ballSpeed / MPH, 196, 3, 'ball'); near(l.launchDeg, 13.8, 1, 'launch'); within(l.backspinRpm, 2160, 2730, 'spin');
    const f = fly(l); near(f.carry, 326, 12, 'carry'); within(f.apex, 58 - 3, 61 + 3, 'apex'); within(f.land, 52 - 3, 54 + 3, 'land');
  };
  it('case 6, the normalised driver: club 130, A +5°, dynamic loft 16° -> ball 196 ± 3, launch 13.8 ± 1°, spin 2160-2730, carry 326 ± 12', () => {
    case6(imp({ clubMph: 130, attackDeg: 5, loftDeg: 16, smashBase: 1.54, k: K_DRIVER }));
  });
  it('case 6 is the in-game driver off the tee (owner decision: 130 mph, +5°)', () => { case6(launchFor(BAG[0]!, { lie: 'tee' })); });
  it('case 7, 3-wood off the tee: club 110, A +2°, loft 12.2° (SL 10.2°) -> ball 164 ± 3, launch 10.2 ± 1°, spin 2590 ± 300, carry 257-267 ± 8, land 37-42 ± 3°', () => {
    const l = imp({ clubMph: 110, attackDeg: 2, loftDeg: 12.2, smashBase: 1.47 / Math.cos(14.5 * RAD), k: 133 });
    near(l.ballSpeed / MPH, 164, 3, 'ball'); near(l.launchDeg, 10.2, 1, 'launch'); near(l.backspinRpm, 2590, 300, 'spin');
    const f = fly(l); within(f.carry, 257 - 8, 267 + 8, 'carry'); within(f.land, 37 - 3, 42 + 3, 'land');
  });
});

describe('TM-8 air density signs (research §3.4, case 8)', () => {
  const l = launch(171, 10.4, 2545), carry = (air: Air) => fly(l, air).carry;
  it('standard air is 21 °C, 50% RH, sea level: about 1.194 kg/m³', () => { expect(airDensity()).toBeCloseTo(1.194, 2); });
  it('Denver (1609 m) carries further than sea level by +11 to +14 yd (± 50%)', () => {
    const d = carry({ elevM: 1609 }) - carry({}); within(d, 11 * 0.5, 14 * 1.5, 'Denver gain');
  });
  it('5 °C < 21 °C < 35 °C', () => { expect(carry({ tempC: 5 })).toBeLessThan(carry({ tempC: 21 })); expect(carry({ tempC: 21 })).toBeLessThan(carry({ tempC: 35 })); });
});

describe('TM-9 USGA/R&A overall distance standard (case 9)', () => {
  it('(a) current ODS: 176 mph, 10°, 2520 rpm -> carry 289.5 (model) and carry plus roll 300 to 320 yd', () => {
    const f = fly(launch(176, 10, 2520)); near(f.carry, 289.5, 6, 'carry'); within(f.total, 300, 320, 'total');
  });
  it('(b) 2028 ODS: 183 mph, 11°, 2220 rpm -> carry 302.8 (model)', () => { near(fly(launch(183, 11, 2220)).carry, 302.8, 6, 'carry'); });
  // KNOWN RESEARCH CONFLICT, kept as a tripwire: (b)'s own hops on Penner tee turf are 16.9 yd, so total <= 320 needs ~0 roll,
  // which breaks case 10 (firm fairway 30 ± 4, USGA field data). The research's suggested 25-30 yd roll gives (b) about 328 yd.
  it.fails('(b) carry plus roll 300 to 320 yd (fails while case 10 holds; see comment)', () => { within(fly(launch(183, 11, 2220)).total, 300, 320, 'total'); });
});

describe('TM-10, TM-11 bounce and roll (research §4.1-4.2, cases 10-11)', () => {
  const run = (mph: number, deg: number, rpm: number, surface: Surface = 'fairway') => bounceRoll({ speedMs: mph * MPH, angleDeg: deg, spinRpm: rpm }, surface).distanceM * YD;
  it('case 10: a driver landing at 62.8 mph, 39.5°, 1982 rpm bounces and rolls 30 ± 4 yd on a firm fairway', () => { near(run(62.8, 39.5, 1982), 30, 4, 'bounce + roll'); });
  it('case 11: a PW landing at 47 mph, 55°, 8200 rpm checks: net -5 to +3 yd; with 0 rpm it releases at least 8 yd further', () => {
    within(run(47, 55, 8200), -5, 3, 'with spin'); expect(run(47, 55, 0) - run(47, 55, 8200)).toBeGreaterThanOrEqual(8); expect(run(47, 55, 0)).toBeGreaterThan(6);
  });
  it('case 11: the checked wedge spins back on a green too', () => { expect(bounceRoll({ speedMs: 47 * MPH, angleDeg: 55, spinRpm: 8200 }, 'green').rollMs).toBeLessThan(0); });
  // KNOWN RESEARCH CONFLICT, kept as a tripwire: the research's ">= 8 yd" was modelled with a roll decel of 1-3 m/s²; case 10 (sourced)
  // needs 4.5 m/s² on this bounce, which leaves the 0 rpm PW at 7.2 yd (5.8 yd of hops plus 1.4 yd of roll).
  it.fails('case 11: with 0 rpm it rolls at least 8 yd (fails while case 10 holds; see comment)', () => { expect(run(47, 55, 0)).toBeGreaterThanOrEqual(8); });
});

describe('TM-12, TM-13 green and cup (research §4.3, §5.2, cases 12-13)', () => {
  it('case 12: 1.83 m/s on Stimp 10 rolls 3.05 m ± 1%', () => { near(rollDistance(1.83, 'green', 10), 3.05, 0.0305, 'roll'); });
  it('case 13: centred 1.30 m/s holes and 1.35 m/s does not; 40 mm off centre 0.75 m/s holes', () => {
    const vc = captureSpeed;
    expect(1.3 <= vc(0)).toBe(true); expect(1.35 <= vc(0)).toBe(false); expect(0.75 <= vc(0.04)).toBe(true);
    expect(vc(0)).toBeCloseTo(1.314, 2); expect(vc(0.054)).toBe(0);
  });
});

describe('TM-14 the in-game bag (130 mph driver, Tour-average ratios)', () => {
  const FULL = BAG.filter(c => c.key !== 'P');
  const carry = (k: string) => simulateShot(launchFor(BAG.find(c => c.key === k)!, { lie: 'fairway' })).carryM * YD;
  it('driver off the tee carries 320 to 345 yd and the PW 130 to 150 yd from the fairway', () => {
    within(simulateShot(launchFor(BAG[0]!, { lie: 'tee' })).carryM * YD, 320, 345, 'driver'); within(carry('0'), 130, 150, 'PW');
  });
  it('carries are ordered by loft from the 3W down and every full swing is straight (< 1% offline)', () => {
    for (let i = 2; i < FULL.length; i++) expect(carry(FULL[i]!.key), FULL[i]!.label).toBeLessThan(carry(FULL[i - 1]!.key));
    for (const c of FULL) { const r = simulateShot(launchFor(c, { lie: 'fairway' })); expect(Math.abs(r.offlineM) / r.carryM, c.label).toBeLessThan(0.01); }
  });
});
