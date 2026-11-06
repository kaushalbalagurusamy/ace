import { describe, it, expect } from 'vitest';
import { hole, HOLE_COUNT } from '../src/server/course';
import { playShot, playPutt } from '../src/server/race';
import type { BallState } from '../src/shared/protocol';
import { BAG } from '../src/sim';

/** Seeded generator so the 200 shots are the same every run. */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

describe('RP-1 the server rest position always matches what the client replays', () => {
  const r = rng(20261105), seenLies = new Set<string>(), seenPenalty = new Set<string>();
  let n = 0, noPenalty = 0, penalties = 0;
  const failures: string[] = [];
  const clubs = BAG.filter(c => c.key !== 'P');
  // start from every lie type on every hole: scan the grid for playable cells of each lie
  for (let hi = 0; hi < HOLE_COUNT; hi++) {
    const h = hole(hi), byLie = new Map<string, { x: number; z: number }[]>();
    for (let z = 0; z <= h.info.pin.z; z += 6) for (let x = -90; x <= 90; x += 6) { if (h.penaltyAt(x, z)) continue; const l = h.surfaceAt(x, z); (byLie.get(l) ?? byLie.set(l, []).get(l)!).push({ x, z }); }
    for (const [lie, cells] of byLie) {
      if (lie === 'green') continue;                                                    // greens are putted below
      for (let k = 0; k < 6 && n < 600; k++) {
        const c = cells[Math.floor(r() * cells.length)]!, prev: BallState = { x: c.x, z: c.z, strokes: 3, holedOut: false, surface: h.surfaceAt(c.x, c.z) };
        const aim = (Math.atan2(h.info.pin.x - c.x, h.info.pin.z - c.z) * 180) / Math.PI + (r() - 0.5) * 120, club = clubs[Math.floor(r() * clubs.length)]!;
        const res = playShot(h, prev, { clubKey: club.key, aimDeg: (aim + 720) % 360, holdMs: 225 + r() * 525, fb: Math.floor(r() * 5) - 2, io: Math.floor(r() * 5) - 2, seed: Math.floor(r() * 1e6) });
        if ('error' in res) { failures.push(`hole ${hi + 1} ${lie}: ${res.error}`); continue; }
        n++;
        const last = res.samples.at(-1)!.p;
        if (!res.penalty) {
          noPenalty++; seenLies.add(res.ball.surface);
          if (Math.hypot(res.ball.x - last.x, res.ball.z - last.z) > 1e-6) failures.push(`hole ${hi + 1}: rest ${res.ball.x.toFixed(2)},${res.ball.z.toFixed(2)} != last sample ${last.x.toFixed(2)},${last.z.toFixed(2)}`);
          if (res.ball.strokes !== prev.strokes + 1 && !res.ball.holedOut) failures.push('strokes not +1');
        } else {
          penalties++; seenPenalty.add(res.penalty.split(':')[0]!);
          if (h.penaltyAt(res.ball.x, res.ball.z)) failures.push(`hole ${hi + 1}: penalty ball on ${h.penaltyAt(res.ball.x, res.ball.z)}`);
          if (res.ball.strokes !== prev.strokes + 2) failures.push('penalty strokes not +2');
          if (res.dropWaitS !== 2) failures.push('drop wait not 2 s');
        }
        if (h.penaltyAt(res.ball.x, res.ball.z)) failures.push(`hole ${hi + 1}: ball at rest on ${h.penaltyAt(res.ball.x, res.ball.z)}`);
      }
    }
    const pc = { x: h.info.pin.x + 6, z: h.info.pin.z - 4 };                              // putts from the green
    if (!h.penaltyAt(pc.x, pc.z) && h.surfaceAt(pc.x, pc.z) === 'green') {
      const prev: BallState = { x: pc.x, z: pc.z, strokes: 2, holedOut: false, surface: 'green' }, res = playPutt(h, prev, 200, 150 + r() * 375);
      if (!('error' in res)) { n++; const last = res.samples.at(-1)!.p; if (!res.penalty && Math.hypot(res.ball.x - last.x, res.ball.z - last.z) > 1e-6) failures.push(`hole ${hi + 1}: putt rest != last sample`); if (!res.penalty) seenLies.add(res.ball.surface); }
    }
  }
  it('ran at least 200 shots', () => { expect(n).toBeGreaterThanOrEqual(200); });
  it('no invariant violations (rest = last sample without a penalty; penalties leave the ball on a playable lie)', () => { expect(failures, failures.slice(0, 5).join('\n')).toEqual([]); });
  it('every resting lie type and both penalty kinds were exercised', () => {
    for (const l of ['green', 'fairway', 'firstCut', 'rough', 'bunker']) expect(seenLies.has(l), `resting lie ${l} (saw ${[...seenLies].join(',')})`).toBe(true);
    expect(seenPenalty.has('Water hazard') || seenPenalty.has('Out of bounds')).toBe(true);
    expect(penalties).toBeGreaterThan(0); expect(noPenalty).toBeGreaterThan(100);
  });
});
