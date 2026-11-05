import { describe, it, expect } from 'vitest';
import { IDEAL_MS, BAG, launchFor, scoreSwing, simulateShot } from '../src/sim';
import { hole, playPutt, playShot, type Played } from '../src/server/race';
import type { BallState } from '../src/shared/protocol';

const h = hole(0), pin = h.info.pin;
const ball = (x: number, z: number, strokes = 0): BallState => ({ x, z, strokes, holedOut: false, surface: h.surfaceAt(x, z) });
const ok = (r: Played | { error: string }): Played => { if ('error' in r) throw new Error(r.error); return r; };
const perfect = { zMs: IDEAL_MS.z, xMs: IDEAL_MS.x, cMs: IDEAL_MS.c };

describe('hole geometry', () => {
  it('green within 14 m of the pin, fairway within 22 m of the centre line, then first cut to 30 m, then rough', () => {
    expect(h.surfaceAt(pin.x, pin.z - 13)).toBe('green');
    expect(h.surfaceAt(0, 100)).toBe('fairway');
    expect(h.surfaceAt(25, 100)).toBe('firstCut');
    expect(h.surfaceAt(40, 100)).toBe('rough');
  });
  it('out of bounds beyond 70 m wide, behind the tee, or 40 m past the pin', () => {
    expect(h.outOfBounds(71, 100)).toBe(true);
    expect(h.outOfBounds(0, -21)).toBe(true);
    expect(h.outOfBounds(0, pin.z + 41)).toBe(true);
    expect(h.outOfBounds(0, 100)).toBe(false);
  });
});

describe('putting and holing out (AC-P3 roll, PRD/03 §6 cup capture)', () => {
  const start = ball(pin.x, pin.z - 1);
  it('a putt that stops at the cup drops: holedOut, one stroke', () => {
    // v0 = sqrt(2 a d) for d = 1 m at Stimp 10 is about 1.05 m/s => draw of about 105 ms of 1500
    const r = ok(playPutt(h, start, 0, 105));
    expect(r.ball.holedOut).toBe(true);
    expect(r.ball.strokes).toBe(1);
    expect(r.ball.x).toBeCloseTo(pin.x, 6);
    expect(r.ball.z).toBeCloseTo(pin.z, 6);
  });
  it('a putt hit too hard rolls past the cup without dropping (speed above 1.6 m/s)', () => {
    const r = ok(playPutt(h, start, 0, 600));
    expect(r.ball.holedOut).toBe(false);
    expect(r.ball.z).toBeGreaterThan(pin.z);
    expect(r.ball.strokes).toBe(1);
  });
  it('a short putt stops short of the cup', () => {
    const r = ok(playPutt(h, start, 0, 40));
    expect(r.ball.holedOut).toBe(false);
    expect(r.ball.z).toBeLessThan(pin.z);
    expect(r.ball.z).toBeGreaterThan(start.z);
  });
  it('a putt aimed 10 degrees off the line misses', () => {
    expect(ok(playPutt(h, start, 10, 105)).ball.holedOut).toBe(false);
  });
  it('AC-P3 on the course: 1.83 m/s (draw 183 ms) from the same spot rolls 3.05 m +-5%', () => {
    const r = ok(playPutt(h, ball(pin.x + 5, pin.z - 8), 0, 183)); // 9.4 m from the pin: on the green, aimed away from the cup
    expect(r.ball.z - (pin.z - 8)).toBeGreaterThan(3.05 * 0.95);
    expect(r.ball.z - (pin.z - 8)).toBeLessThan(3.05 * 1.05);
  });
  it('the draw is clamped to 0..1500 ms', () => {
    const a = ok(playPutt(h, start, 0, 1500)), b = ok(playPutt(h, start, 0, 99999));
    expect(b.ball.z).toBeCloseTo(a.ball.z, 6);
    expect(ok(playPutt(h, start, 0, -50)).ball.z).toBeCloseTo(start.z, 6);
  });
  it('the putter is refused off the green', () => {
    expect('error' in playPutt(h, ball(0, 100), 0, 500)).toBe(true);
  });
  it('replay samples start at the ball, are time-ordered and end where the ball stops', () => {
    const r = ok(playPutt(h, start, 0, 300));
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
    expect(r.flightS).toBeGreaterThan(simulateShot(launchFor(BAG[0]!, scoreSwing(perfect))).flightTimeS);
  });
  it('server total equals the sim total on a flat fairway: there is one roll model', () => {
    const sim = simulateShot(launchFor(BAG[0]!, scoreSwing(perfect)));
    const r = ok(playShot(h, tee, { clubKey: '1', aimDeg: 0, ...perfect }));
    expect(Math.abs(r.totalM - sim.totalM)).toBeLessThan(0.02 * sim.totalM);
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
    const a = playShot(h, tee, { clubKey: '7', aimDeg: 3, zMs: 5, xMs: 70, cMs: 140, length: 75 });
    const b = playShot(h, tee, { clubKey: '7', aimDeg: 3, zMs: 5, xMs: 70, cMs: 140, length: 75 });
    expect(a).toEqual(b);
  });
  it('rejects the putter as a full-swing club, unknown clubs and invalid lengths', () => {
    expect('error' in playShot(h, tee, { clubKey: 'P', aimDeg: 0 })).toBe(true);
    expect('error' in playShot(h, tee, { clubKey: 'Z', aimDeg: 0 })).toBe(true);
    expect('error' in playShot(h, tee, { clubKey: '1', aimDeg: 0, length: 60 })).toBe(true);
  });
  it('rough costs distance versus fairway for the same swing (lie speed multiplier)', () => {
    const fw = ok(playShot(h, ball(0, 100), { clubKey: '7', aimDeg: 0, ...perfect }));
    const rough = ok(playShot(h, ball(40, 100), { clubKey: '7', aimDeg: 0, ...perfect }));
    expect(rough.carryM).toBeLessThan(fw.carryM + 0.0001); // carry is the sim's; rough lowers ball speed
    expect(rough.ballSpeedMs).toBeLessThan(fw.ballSpeedMs);
  });
});
