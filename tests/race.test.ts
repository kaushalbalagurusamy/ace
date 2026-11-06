import { describe, it, expect } from 'vitest';
import { BAG, LAND_ROLL_FRACTION, launchFor, rollDistance, simulateShot } from '../src/sim';
import { hole, playPutt, playShot, type Played } from '../src/server/race';
import type { BallState } from '../src/shared/protocol';

const h = hole(0), pin = h.info.pin;
const ball = (x: number, z: number, strokes = 0): BallState => ({ x, z, strokes, holedOut: false, surface: h.surfaceAt(x, z) });
const ok = (r: Played | { error: string }): Played => { if ('error' in r) throw new Error(r.error); return r; };
const perfect = { holdMs: 750, seed: 1 };   // a full normal swing: the server turns the hold into length 1, no max effort

/** Finds a spot on the hole with the given lie and room around it (scans the traced grid; independent of any layout assumption). */
function findLie(h: ReturnType<typeof hole>, lie: string, minZ = 40, maxZ = 200): { x: number; z: number } {
  for (let z = minZ; z <= maxZ; z += 3) for (let x = -60; x <= 60; x += 3) {
    if (h.surfaceAt(x, z) !== lie || h.penaltyAt(x, z)) continue;
    let all = true; for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]] as [number, number][]) if (h.surfaceAt(x + dx, z + dz) !== lie) all = false;
    if (all) return { x, z };
  }
  throw new Error(`no ${lie} spot on the hole`);
}

describe('putting and holing out (AC-P3 roll, PRD/03 §6 cup capture)', () => {
  const start = ball(pin.x, pin.z - 1);
  it('a putt that stops at the cup drops: holedOut, one stroke', () => {
    // v0 = sqrt(2 a d) for d = 1 m at Stimp 10 is about 1.05 m/s => length 0.07 (the old 105 ms draw)
    const r = ok(playPutt(h, start, 0, 0.07));
    expect(r.ball.holedOut).toBe(true);
    expect(r.ball.strokes).toBe(1);
    expect(r.ball.x).toBeCloseTo(pin.x, 6);
    expect(r.ball.z).toBeCloseTo(pin.z, 6);
  });
  it('a putt hit too hard rolls past the cup without dropping (speed above 1.6 m/s)', () => {
    const r = ok(playPutt(h, start, 0, 0.15)); // 2.25 m/s: about 2.0 m/s over the cup, above the 1.6 m/s capture limit
    expect(r.ball.holedOut).toBe(false);
    expect(r.ball.z).toBeGreaterThan(pin.z);
    expect(r.ball.strokes).toBe(1);
  });
  it('the shortest putt (length 0.05, 0.75 m/s) stops about half a metre out, short of the cup', () => {
    const r = ok(playPutt(h, start, 0, 0.05));
    expect(r.ball.holedOut).toBe(false);
    expect(r.ball.z).toBeLessThan(pin.z);
    expect(r.ball.z).toBeGreaterThan(start.z);
  });
  it('a putt aimed 10 degrees off the line misses', () => {
    expect(ok(playPutt(h, start, 10, 0.07)).ball.holedOut).toBe(false);
  });
  it('AC-P3 on the course: 1.83 m/s (length 0.122) from the same spot rolls 3.05 m +-5%', () => {
    const r = ok(playPutt(h, ball(pin.x + 5, pin.z - 8), 0, 183 / 1500)); // 9.4 m from the pin: on the green, aimed away from the cup
    expect(r.ball.z - (pin.z - 8)).toBeGreaterThan(3.05 * 0.95);
    expect(r.ball.z - (pin.z - 8)).toBeLessThan(3.05 * 1.05);
  });
  it('length is clamped to 0.05..1: more than 1 equals 1, and zero or negative equals the 0.05 minimum', () => {
    const one = ok(playPutt(h, start, 0, 1)), huge = ok(playPutt(h, start, 0, 99));
    expect(huge.ball.z).toBeCloseTo(one.ball.z, 6);
    const min = ok(playPutt(h, start, 0, 0.05)), zero = ok(playPutt(h, start, 0, 0)), neg = ok(playPutt(h, start, 0, -3));
    expect(zero.ball.z).toBeCloseTo(min.ball.z, 6); expect(neg.ball.z).toBeCloseTo(min.ball.z, 6);
  });
  it('a non-finite length is rejected', () => {
    for (const bad of [NaN, Infinity, -Infinity]) expect('error' in playPutt(h, start, 0, bad), String(bad)).toBe(true);
  });
  it('the putter is refused off the green', () => {
    expect('error' in playPutt(h, ball(0, 100), 0, 0.3)).toBe(true);
  });
  it('replay samples start at the ball, are time-ordered and end where the ball stops', () => {
    const r = ok(playPutt(h, start, 0, 0.2));
    expect(r.samples[0]!.p).toEqual({ x: start.x, y: 0, z: start.z });
    for (let i = 1; i < r.samples.length; i++) expect(r.samples[i]!.t).toBeGreaterThanOrEqual(r.samples[i - 1]!.t);
    const end = r.samples.at(-1)!.p;
    expect(end.x).toBeCloseTo(r.ball.x, 6); expect(end.z).toBeCloseTo(r.ball.z, 6);
    expect(r.flightS).toBeCloseTo(r.samples.at(-1)!.t, 6);
  });
});

describe('full shots: roll consistency (review finding 3) and penalties', () => {
  const tee = ball(0, 0);
  it('perfect driver from the tee: straight, one stroke, rolls past carry, replay time covers flight plus roll', () => {
    const r = ok(playShot(h, tee, { clubKey: '1', aimDeg: 0, ...perfect }));
    expect(r.ball.strokes).toBe(1);
    expect(Math.abs(r.ball.x)).toBeLessThan(0.01 * r.carryM);
    expect(r.totalM).toBeGreaterThan(r.carryM);
    expect(r.flightS).toBeGreaterThan(simulateShot(launchFor(BAG[0]!)).flightTimeS);
  });
  it('server total = sim carry + one roll-out from LAND_ROLL_FRACTION of the landing speed on the landing lie (one roll model)', () => {
    const sim = simulateShot(launchFor(BAG[0]!));
    const r = ok(playShot(h, tee, { clubKey: '1', aimDeg: 0, ...perfect }));
    expect(r.penalty).toBeUndefined();
    const landing = h.surfaceAt(0, sim.carryM);
    const expected = sim.carryM + rollDistance(LAND_ROLL_FRACTION * sim.landingSpeedMs, landing);
    expect(Math.abs(r.totalM - expected)).toBeLessThan(0.03 * expected);
  });
  it('aim rotates the shot about the ball: 90 degrees aim sends a drive sideways (out of bounds, penalty)', () => {
    const r = ok(playShot(h, tee, { clubKey: '1', aimDeg: 90, ...perfect }));
    expect(r.penalty).toMatch(/Out of bounds/);
    expect(r.ball.strokes).toBe(2);               // stroke plus penalty
    expect([r.ball.x, r.ball.z]).toEqual([0, 0]);  // replay from the previous spot
    expect(r.dropWaitS).toBe(2);
  });
  it('a ball already out of bounds cannot become a hole-out', () => {
    const r = ok(playShot(h, tee, { clubKey: '1', aimDeg: 180, ...perfect }));
    expect(r.ball.holedOut).toBe(false);
  });
  it('same inputs give identical results (server owns the simulation)', () => {
    const a = playShot(h, tee, { clubKey: '7', aimDeg: 3, zMs: 5, xMs: 70, cMs: 140, length: 0.75 });
    const b = playShot(h, tee, { clubKey: '7', aimDeg: 3, zMs: 5, xMs: 70, cMs: 140, length: 0.75 });
    expect(a).toEqual(b);
  });
  it('hold times: short holds floor at the minimum length, long holds are one max-effort shot, non-finite holds are rejected', () => {
    const sw = (holdMs: number) => playShot(h, tee, { clubKey: '1', aimDeg: 0, holdMs, seed: 5 });
    expect(sw(-2)).toEqual(sw(0));                                  // floored at length 0.05
    expect(sw(1100)).toEqual(sw(5000));                             // 1.10 s and beyond: the same max-effort shot (same seed)
    expect(ok(sw(1100)).carryM).toBeGreaterThan(ok(sw(750)).carryM * 1.1);   // max effort carries clearly further than a normal full swing
    for (const bad of [NaN, Infinity]) expect('error' in sw(bad), String(bad)).toBe(true);
  });
  it('ball position and its range: fb/io outside -2..2 or non-integer are rejected; a draw lands left of a centre ball and a fade right', () => {
    const bp = (fb: number, io: number) => playShot(h, tee, { clubKey: '5', aimDeg: 0, holdMs: 750, fb, io, seed: 1 });
    for (const [fb, io] of [[3, 0], [0, -3], [0.5, 0], [NaN, 0]] as const) expect('error' in bp(fb, io), `${fb},${io}`).toBe(true);
    expect(ok(bp(0, 2)).offlineM).toBeLessThan(ok(bp(0, 0)).offlineM - 1); expect(ok(bp(0, -2)).offlineM).toBeGreaterThan(ok(bp(0, 0)).offlineM + 1);
  });
  it('rejects the putter as a full-swing club and unknown clubs', () => {
    expect('error' in playShot(h, tee, { clubKey: 'P', aimDeg: 0 })).toBe(true);
    expect('error' in playShot(h, tee, { clubKey: 'Z', aimDeg: 0 })).toBe(true);
  });
  it('the rough lie costs 15% of ball speed versus the fairway for the same swing (PRD/03 section 4: 0.85)', () => {
    const f = findLie(h, 'fairway', 60), r = findLie(h, 'rough', 60);
    const fw = ok(playShot(h, ball(f.x, f.z), { clubKey: '7', aimDeg: 0, ...perfect })), ro = ok(playShot(h, ball(r.x, r.z), { clubKey: '7', aimDeg: 0, ...perfect }));
    expect(ro.ballSpeedMs / fw.ballSpeedMs).toBeCloseTo(0.85, 6);
  });
  it('the bunker lie costs 25% of ball speed (0.75) for a full club', () => {
    const f = findLie(h, 'fairway', 60), b = findLie(h, 'bunker', 0, 400);
    const fw = ok(playShot(h, ball(f.x, f.z), { clubKey: '9', aimDeg: 0, ...perfect })), bk = ok(playShot(h, ball(b.x, b.z), { clubKey: '9', aimDeg: 0, ...perfect }));
    expect(bk.ballSpeedMs / fw.ballSpeedMs).toBeCloseTo(0.75, 6);
  });
});

describe('penalty area relief (PRD/04: +1 and the legal drop nearest the hole, plus the 2 s wait)', () => {
  const h18 = hole(17);                                         // ocean on the left of hole 18
  const CLUB_LEN = 1.2, perfect7 = { holdMs: 750, seed: 1 };
  /** Finds an aim from the tee that ends in water by scanning, so the test does not assume any layout. */
  function waterShot() {
    for (let aim = -170; aim <= 170; aim += 5) {
      const r = playShot(h18, ball18(0, 0), { clubKey: '7', aimDeg: (aim + 360) % 360, ...perfect7 });
      if (!('error' in r) && r.penalty?.startsWith('Water')) return { r, aim };
    }
    throw new Error('no water shot found on hole 18');
  }
  const ball18 = (x: number, z: number): BallState => ({ x, z, strokes: 0, holedOut: false, surface: h18.surfaceAt(x, z) });
  /** Where the ball last crossed onto ground that was not water, walking the replay backwards from the end. */
  function entryPoint(samples: { p: { x: number; z: number } }[]) {
    for (let i = samples.length - 1; i >= 0; i--) { const p = samples[i]!.p; if (h18.penaltyAt(p.x, p.z) !== 'water') return p; }
    return samples[0]!.p;
  }
  it('water: +1 stroke, a 2 s drop wait and the ball dropped on a playable lie', () => {
    const { r } = waterShot();
    expect(r.ball.strokes).toBe(2);                              // the stroke and the penalty stroke
    expect(r.dropWaitS).toBe(2);
    expect(h18.penaltyAt(r.ball.x, r.ball.z)).toBeNull();
    expect(r.ball.holedOut).toBe(false);
  });
  it('the drop is legal: within two club-lengths of the entry point, or back on the line from the pin through it; never nearer the hole', () => {
    const { r } = waterShot(), e = entryPoint(r.samples), pin = h18.info.pin;
    const dEntry = Math.hypot(r.ball.x - e.x, r.ball.z - e.z), nearer = Math.hypot(r.ball.x - pin.x, r.ball.z - pin.z) < Math.hypot(e.x - pin.x, e.z - pin.z) - 1e-6;
    // back on the line: collinear with pin -> entry point and farther from the pin
    const ux = e.x - pin.x, uz = e.z - pin.z, L = Math.hypot(ux, uz) || 1, vx = r.ball.x - pin.x, vz = r.ball.z - pin.z;
    const cross = Math.abs(ux * vz - uz * vx) / L, onLine = cross < 0.5 && Math.hypot(vx, vz) >= L - 1e-6;
    expect(nearer, 'not nearer the hole than where it entered').toBe(false);
    expect(dEntry <= 2 * CLUB_LEN + 0.5 || onLine, `drop ${dEntry.toFixed(1)} m from entry`).toBe(true);
  });
  it('relief is not just a replay from the previous spot: the ball is dropped near the hazard edge', () => {
    const { r } = waterShot(), e = entryPoint(r.samples);
    expect(Math.hypot(r.ball.x - e.x, r.ball.z - e.z)).toBeLessThan(Math.max(8, 0.9 * Math.hypot(e.x, e.z)));   // closer to the entry point than the tee unless the entry is the tee
  });
  it('out of bounds stays stroke and distance: replay from the previous spot, +1, 2 s', () => {
    const r = ok(playShot(hole(0), ball(0, 0), { clubKey: '1', aimDeg: 90, ...perfect }));
    expect(r.penalty).toMatch(/Out of bounds/); expect([r.ball.x, r.ball.z]).toEqual([0, 0]); expect(r.ball.strokes).toBe(2); expect(r.dropWaitS).toBe(2);
  });
});
