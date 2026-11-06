import { describe, it, expect } from 'vitest';
import { BAG, LIE, holdSlope, launchFor, roll, runOut, simulateShot, type Terrain, type Surface } from '../src/sim';
import { COURSE_HEIGHTS, heightAt as courseHeightAt, normalAt as courseNormalAt, normalFrom, stanceSlope } from '../src/shared/height';
const HEIGHTS = COURSE_HEIGHTS.pebble!, heightAt = (i: number, x: number, z: number) => courseHeightAt('pebble', i, x, z), normalAt = (i: number, x: number, z: number) => courseNormalAt('pebble', i, x, z);
import { hole, HOLE_COUNT } from '../src/server/course';
import { playPutt, playShot } from '../src/server/race';
import { lieInfo } from '../src/client/lieinfo';
import type { BallState } from '../src/shared/protocol';

const RAD = Math.PI / 180, club = (k: string) => BAG.find(c => c.key === k)!;
/** A synthetic plane: rises `along` (tangent) toward +z and `side` toward +x. */
const plane = (along: number, side: number, surface: Surface = 'green', extra: Partial<Terrain> = {}): Terrain => {
  const height = (x: number, z: number) => along * z + side * x;
  return { height, normal: (x, z) => normalFrom(height, x, z), surface: () => surface, ...extra };
};

describe('EL-1 the shared height field', () => {
  it('covers all 18 holes, is zero at the tee and has real relief (Pebble Beach spans tens of metres)', () => {
    expect(HEIGHTS).toHaveLength(HOLE_COUNT);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < HOLE_COUNT; i++) { expect(Math.abs(heightAt(i, 0, 0))).toBeLessThan(0.02); const h = hole(i); for (let z = 0; z <= h.info.lengthM; z += 10) { const y = heightAt(i, 0, z); lo = Math.min(lo, y); hi = Math.max(hi, y); } }
    expect(hi - lo).toBeGreaterThan(20);
  });
  it('is course-aware: every hole carries its OSM anchors and the course card; an unknown course is refused', () => {
    HEIGHTS.forEach((f, i) => { expect(f.ref).toBe(i + 1); expect(f.par).toBe(hole(i).info.par); expect(f.tee[0]).toBeGreaterThan(36.55); expect(f.tee[0]).toBeLessThan(36.58); });
    expect(() => courseHeightAt('nowhere', 0, 0, 0)).toThrow(RangeError);
  });
  it('is deterministic and continuous: the same point gives the same bits; 1 mm steps change the height and 1 cm steps the normal only a little', () => {
    for (let i = 0; i < HOLE_COUNT; i++) for (let k = 0; k < 200; k++) {
      const x = -140 + ((k * 37) % 280) + 0.37, z = -30 + ((k * 53) % 400) + 0.61;
      expect(heightAt(i, x, z)).toBe(heightAt(i, x, z));
      expect(Math.abs(heightAt(i, x + 0.001, z) - heightAt(i, x, z))).toBeLessThan(0.01);  // no jumps: 1 mm moves < 1 cm even on the Carmel Bay cliffs (about 7 m/m on the 4 m grid)
      const a = normalAt(i, x, z), b = normalAt(i, x + 0.01, z + 0.01);
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.02);
      expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(1, 9);
    }
  });
  it('greens are putting surfaces: every green node slopes 3.5 % or less', () => {
    for (let i = 0; i < HOLE_COUNT; i++) {
      const h = hole(i), pin = h.info.pin;
      for (let dz = -15; dz <= 15; dz += 1.5) for (let dx = -15; dx <= 15; dx += 1.5) {
        const x = pin.x + dx, z = pin.z + dz; if (h.surfaceAt(x, z) !== 'green' || Math.hypot(dx, dz) > 8) continue;
        const n = normalAt(i, x, z); expect(Math.hypot(n.x, n.z) / n.y, `hole ${i + 1} ${dx},${dz}`).toBeLessThan(0.035);
      }
    }
  });
  it('stance slope: uphill along the aim, ball above the feet when the ground rises to the right (a right-handed golfer stands left of the ball)', () => {
    const n = plane(0.05, 0.1).normal(0, 0);
    const s = stanceSlope(n, 0); expect(s.alongDeg).toBeCloseTo(Math.atan(0.05) / RAD, 6); expect(s.sideDeg).toBeCloseTo(Math.atan(0.1) / RAD, 6);
    const back = stanceSlope(n, 180); expect(back.alongDeg).toBeCloseTo(-s.alongDeg, 6); expect(back.sideDeg).toBeCloseTo(-s.sideDeg, 6);
  });
});

describe('EL-2 carry ends on the real ground', () => {
  const at = (deg: number, k = '7') => simulateShot(launchFor(club(k), { lie: 'fairway', slope: { alongDeg: deg, sideDeg: 0 } }), {}, (_x, z) => z * Math.tan(deg * RAD));
  it('uphill carries shorter and downhill longer than flat, more so the steeper it is', () => {
    for (const k of ['1', '5', '7', '0']) {
      const f = at(0, k).carryM;
      expect(at(3, k).carryM, k).toBeLessThan(f - 5); expect(at(-3, k).carryM, k).toBeGreaterThan(f + 5);
      expect(at(6, k).carryM).toBeLessThan(at(3, k).carryM); expect(at(-6, k).carryM).toBeGreaterThan(at(-3, k).carryM);
    }
  });
  it('the uphill lie itself launches higher with more spin (D-plane: loft up, attack up by half) and the downhill lie the reverse', () => {
    const f = launchFor(club('7'), { lie: 'fairway' }), u = launchFor(club('7'), { lie: 'fairway', slope: { alongDeg: 4, sideDeg: 0 } }), d = launchFor(club('7'), { lie: 'fairway', slope: { alongDeg: -4, sideDeg: 0 } });
    expect(u.launchDeg).toBeGreaterThan(f.launchDeg + 2); expect(u.backspinRpm).toBeGreaterThan(f.backspinRpm); expect(u.ballSpeed).toBeLessThan(f.ballSpeed);
    expect(d.launchDeg).toBeLessThan(f.launchDeg - 2); expect(d.backspinRpm).toBeLessThan(f.backspinRpm);
  });
  it('flat ground is unchanged: the ground callback at zero gives the identical flight', () => {
    const l = launchFor(club('5')); expect(simulateShot(l, {}, () => 0)).toEqual(simulateShot(l));
  });
  it('the tee box ignores slope (tee boxes are level)', () => {
    expect(launchFor(club('1'), { lie: 'tee', slope: { alongDeg: 5, sideDeg: 5 } })).toEqual(launchFor(club('1'), { lie: 'tee' }));
  });
});

describe('EL-3 side slope: the curve emerges from the D-plane (right-handed golfer)', () => {
  const off = (k: string, side: number) => simulateShot(launchFor(club(k), { lie: 'fairway', slope: { alongDeg: 0, sideDeg: side } }));
  it('ball above the feet curves left (closed face, spin axis left), below the feet right', () => {
    const above = launchFor(club('7'), { lie: 'fairway', slope: { alongDeg: 0, sideDeg: 4 } }), below = launchFor(club('7'), { lie: 'fairway', slope: { alongDeg: 0, sideDeg: -4 } });
    expect(above.spinAxisDeg).toBeLessThan(-1); expect(below.spinAxisDeg).toBeGreaterThan(1);
    expect(off('7', 4).offlineM).toBeLessThan(-5); expect(off('7', -4).offlineM).toBeGreaterThan(5);
  });
  it('grows with the slope', () => {
    expect(off('7', 8).offlineM).toBeLessThan(off('7', 4).offlineM); expect(off('7', 4).offlineM).toBeLessThan(off('7', 2).offlineM);
  });
  it('grows with loft: the miss angle per degree of slope rises from driver to irons to wedges', () => {
    const angle = (k: string) => { const s = off(k, 4); return -Math.atan2(s.offlineM, s.totalM); };
    const order = ['1', '5', '9', '='].map(angle);
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
  });
  it('face per degree of side slope: about 0.5-1 for mid irons, more for wedges, little for the driver', async () => {
    const { sideSlopeFaceDeg } = await import('../src/sim');
    expect(-sideSlopeFaceDeg(34, 1)).toBeGreaterThan(0.5); expect(-sideSlopeFaceDeg(34, 1)).toBeLessThan(1);
    expect(-sideSlopeFaceDeg(54, 1)).toBeGreaterThan(1); expect(-sideSlopeFaceDeg(8, 1)).toBeLessThan(0.2);
  });
});

describe('EL-4 rolling on slopes', () => {
  it('on flat ground the roll matches the Stimp model exactly (1.83 m/s rolls 3.05 m)', () => {
    const r = roll(plane(0, 0), 0, 0, 0, 1.83, 0); expect(r.z).toBeCloseTo(3.05, 2); expect(r.x).toBe(0);
  });
  it('a putt across a 2 % side slope breaks downhill, and a putt straight uphill comes up shorter than downhill', () => {
    const r = roll(plane(0, 0.02), 0, 0, 0, 1.6, 0); expect(r.x).toBeLessThan(-0.1);
    const mirror = roll(plane(0, -0.02), 0, 0, 0, 1.6, 0); expect(mirror.x).toBeCloseTo(-r.x, 6);
    expect(roll(plane(0.02, 0), 0, 0, 0, 1.6, 0).z).toBeLessThan(roll(plane(-0.02, 0), 0, 0, 0, 1.6, 0).z - 0.5);
  });
  it('on a real green the putt breaks toward the low side', () => {
    let checked = 0;
    for (let i = 0; i < HOLE_COUNT; i++) {
      const h = hole(i), pin = h.info.pin, n = h.normalAt(pin.x, pin.z), fall = Math.hypot(n.x, n.z); if (fall / n.y < 0.012) continue;
      const dx = n.x / fall, dz = n.z / fall, ax = -dz, az = dx;              // downhill (dx,dz); putt across it along (ax,az)
      const start = { x: pin.x - ax * 4, z: pin.z - az * 4 }; if (h.surfaceAt(start.x, start.z) !== 'green') continue;
      const ball: BallState = { x: start.x, z: start.z, strokes: 0, holedOut: false, surface: 'green' };
      const r = playPutt(h, ball, (Math.atan2(ax, az) * 180) / Math.PI, 0.25 * 750); if ('error' in r) throw new Error(r.error);
      expect((r.ball.x - start.x) * dx + (r.ball.z - start.z) * dz, `hole ${i + 1}`).toBeGreaterThan(0.05); checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
  it('a ball never rests where the slope is steeper than its surface can hold', () => {
    expect(holdSlope('green')).toBeGreaterThan(0.06); expect(holdSlope('green')).toBeLessThan(0.1);   // about 8 % at Stimp 10
    const steep = roll(plane(0.15, 0, 'green'), 0, 0, 0, 0, 0); expect(steep.z).toBeLessThan(-5);          // set down on 15 %: it runs off downhill
    const held = roll(plane(0.05, 0, 'green'), 0, 0, 0, 0, 0); expect(held.z).toBe(0);                     // 5 % holds
    // real terrain: 150 seeded full shots and putts across the course rest where the slope is holdable
    let n = 0, s = 20261105; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < 150; k++) {
      const i = k % HOLE_COUNT, h = hole(i), x = (rnd() - 0.5) * 60, z = rnd() * h.info.lengthM;
      if (h.penaltyAt(x, z)) continue;
      const r = playShot(h, { x, z, strokes: 0, holedOut: false, surface: h.surfaceAt(x, z) }, { clubKey: ['1', '5', '7', '0', '='][k % 5]!, aimDeg: (rnd() - 0.5) * 60, holdMs: 300 + rnd() * 450, seed: k });
      if ('error' in r || r.penalty || r.ball.holedOut) continue;
      const nn = h.normalAt(r.ball.x, r.ball.z), surf = h.surfaceAt(r.ball.x, r.ball.z);
      expect(Math.hypot(nn.x, nn.z) / nn.y, `hole ${i + 1} rest on ${surf}`).toBeLessThanOrEqual(holdSlope(surf) + 1e-9); n++;
    }
    expect(n).toBeGreaterThan(60);
  });
  it('landing on a slope uses the surface normal: a ball dropped onto a downslope kicks forward, onto an upslope it checks', () => {
    const v = { x: 0, y: -15, z: 10 }, run = (along: number) => runOut(plane(along, 0, 'fairway'), 0, 0, v, 3000, 0);
    expect(run(-0.2).z).toBeGreaterThan(run(0).z); expect(run(0.2).z).toBeLessThan(run(0).z);
  });
});

describe('EL-5 lie info for the HUD comes from the LIE table', () => {
  it('rough, bunker, first cut and fairway show the table multipliers as percentages', () => {
    const rough = lieInfo('rough', club('7'), { alongDeg: 0, sideDeg: 0 }, { x: 0, y: 1, z: 0 });
    expect(rough.powerPct).toBe(Math.round((LIE.rough.speed - 1) * 100)); expect(rough.spinPct).toBe(Math.round((LIE.rough.spin - 1) * 100)); expect(rough.launchDeg).toBe(LIE.rough.launch);
    expect(rough.lines.join(' ')).toContain('−15% power'); expect(rough.lines.join(' ')).toContain('−45% spin');
    expect(lieInfo('bunker', club('='), { alongDeg: 0, sideDeg: 0 }, { x: 0, y: 1, z: 0 }).powerPct).toBe(Math.round((LIE.bunker.wedgeSpeed! - 1) * 100));
    expect(lieInfo('bunker', club('7'), { alongDeg: 0, sideDeg: 0 }, { x: 0, y: 1, z: 0 }).powerPct).toBe(Math.round((LIE.bunker.speed - 1) * 100));
    expect(lieInfo('fairway', club('7'), { alongDeg: 0, sideDeg: 0 }, { x: 0, y: 1, z: 0 }).powerPct).toBe(0);
  });
  it('shows the slope angles and the normal tilt but never a curve number', () => {
    const n = plane(0.05, -0.08).normal(0, 0), info = lieInfo('fairway', club('7'), stanceSlope(n, 0), n), text = info.lines.join('\n');
    expect(text).toMatch(/Uphill 2\.9°/); expect(text).toMatch(/below your feet 4\.6°/); expect(text).toMatch(/Tilt x/);
    expect(text).not.toMatch(/yd|curve|draw|fade/i);
  });
});
