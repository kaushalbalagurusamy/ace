import { describe, it, expect } from 'vitest';
import { parText, recordHole, toPar } from '../src/shared/scorecard';

describe('live scorecard', () => {
  it('splits cumulative strokes into per-hole strokes, penalties included', () => {
    const c: number[] = [];
    recordHole(c, 0, 1); recordHole(c, 0, 3);   // hole 1: a shot, then a water ball (+2 with the penalty stroke)
    recordHole(c, 0, 5);                         // holed out in 5
    recordHole(c, 1, 7); recordHole(c, 1, 9);    // hole 2: out of bounds (+2), then holed
    expect(c).toEqual([5, 4]);
  });
  it('counts to-par only over finished holes', () => {
    const pars = [4, 5, 3];
    expect(toPar([5, 2], pars, 1, false)).toBe(1);   // hole 2 still in play
    expect(toPar([5, 4], pars, 1, true)).toBe(0);
    expect(toPar([], pars, 0, false)).toBe(0);
    expect([parText(0), parText(2), parText(-1)]).toEqual(['E', '+2', '-1']);
  });
});
