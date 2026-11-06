import { describe, it, expect } from 'vitest';
import { BAG, launchFor, simulateShot, type Lie } from '../src/sim';
import { suggestClub, overrideSticks } from '../src/sim/autoclub';

const FULL = BAG.filter(c => c.key !== 'P');
const idx = (k: string) => FULL.findIndex(c => c.key === k);
const yd = (key: string, lie: Lie = 'fairway', length = 1) => simulateShot(launchFor(FULL[idx(key)]!, { length, lie })).totalM * 1.0936;

describe('flat-fairway pick is the shortest club that reaches', () => {
  for (const t of [100, 130, 152, 180, 210]) {
    it(`${t} yd`, () => {
      const r = suggestClub(t, 'fairway'), i = idx(r.club);
      expect(i).toBeGreaterThanOrEqual(0);
      // Spec (PRD/02 §7): inside the 62° full-swing total the pick is the 62° with a suggested partial hold.
      if (t < yd('O')) { expect(r.club).toBe('O'); expect(r.holdPct).toBeGreaterThan(0); return; }
      expect(yd(r.club)).toBeGreaterThanOrEqual(t);
      for (let j = i + 1; j < FULL.length; j++) expect(yd(FULL[j]!.key), FULL[j]!.label).toBeLessThan(t);
      expect(r.holdPct).toBeUndefined();
    });
  }
});

describe('monotone and lie/slope adjustments', () => {
  it('a longer target never picks a shorter club (40..240)', () => {
    let prev = FULL.length;
    for (let t = 40; t <= 240; t += 10) { const i = idx(suggestClub(t, 'fairway').club); expect(i, `${t}`).toBeLessThanOrEqual(prev); prev = i; }
  });
  it('rough and bunker need an equal or longer club than fairway; rough 150 strictly longer', () => {
    for (const t of [80, 110, 150, 170]) for (const lie of ['rough', 'bunker'] as const) expect(idx(suggestClub(t, lie).club), `${lie} ${t}`).toBeLessThanOrEqual(idx(suggestClub(t, 'fairway').club));
    expect(idx(suggestClub(150, 'rough').club)).toBeLessThan(idx(suggestClub(150, 'fairway').club));
  });
  it('uphill 15 adds 15 to playsYd and moves up a club; downhill 15 moves down one', () => {
    const flat = suggestClub(150, 'fairway'), up = suggestClub(150, 'fairway', { riseYd: 15 }), down = suggestClub(150, 'fairway', { riseYd: -15 });
    expect(up.playsYd).toBeCloseTo(165, 6); expect(down.playsYd).toBeCloseTo(135, 6); expect(flat.playsYd).toBeCloseTo(150, 6);
    expect(idx(up.club)).toBe(idx(flat.club) - 1); expect(idx(down.club)).toBe(idx(flat.club) + 1);
  });
});

describe('short game, putter, beyond the bag', () => {
  it('30 yd -> 62 with a hold whose sim total is within 20% of 30', () => {
    const r = suggestClub(30, 'fairway'); expect(r.club).toBe('O');
    expect(r.holdPct).toBeGreaterThanOrEqual(5); expect(r.holdPct).toBeLessThanOrEqual(90);
    const y = yd('O', 'fairway', r.holdPct! / 100); expect(Math.abs(y - 30) / 30).toBeLessThanOrEqual(0.2);
  });
  it('putter on green 25, fringe 4; not fringe 12 nor fairway 25', () => {
    expect(suggestClub(25, 'green').club).toBe('P'); expect(suggestClub(4, 'fringe').club).toBe('P');
    expect(suggestClub(12, 'fringe').club).not.toBe('P'); expect(suggestClub(25, 'fairway').club).not.toBe('P');
  });
  it('400 yd -> driver', () => { expect(suggestClub(400, 'fairway').club).toBe('1'); });
});

describe('text and override', () => {
  it('format, with and without hold', () => {
    const f = suggestClub(152, 'fairway'); expect(f.text).toBe(`Target 152 yd · plays ${Math.round(f.playsYd)} · ${f.label}`);
    const h = suggestClub(30, 'fairway'); expect(h.text).toBe(`Target 30 yd · plays ${Math.round(h.playsYd)} · ${h.label} · about ${h.holdPct}% hold`);
  });
  it('a manual club sticks until the target changes', () => {
    expect(overrideSticks({ manual: '7', target: 150 }, { target: 150 })).toBe('7');
    expect(overrideSticks({ manual: '7', target: 150 }, { target: 151 })).toBeNull();
    expect(overrideSticks({ manual: null, target: 150 }, { target: 150 })).toBeNull();
  });
});
