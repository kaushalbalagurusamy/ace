import { describe, it, expect } from 'vitest';
import { rankPlayers, type PlayerResult } from '../src/sim';

const f = (id: string, finishTime: number, strokes: number): PlayerResult => ({ id, finishTime, strokes, holesCompleted: 18 });
const place = (r: ReturnType<typeof rankPlayers>, id: string) => r.find(p => p.id === id)?.place;

describe('AC-R1 ranking', () => {
  it('PRD worked example: B (within 1s, fewer strokes) beats A; C outside group is third', () => {
    const r = rankPlayers([f('A', 840.2, 70), f('B', 840.9, 68), f('C', 841.4, 65)]);
    expect(r.map(p => p.id)).toEqual(['B', 'A', 'C']);
    expect([place(r, 'B'), place(r, 'A'), place(r, 'C')]).toEqual([1, 2, 3]);
  });
  it('chain 0.8 s apart is anchored on the fastest, not pairwise', () => {
    // A-B 0.8, B-C 0.8, A-C 1.6: C must NOT join A's group even with the best score
    const r = rankPlayers([f('A', 100, 80), f('B', 100.8, 70), f('C', 101.6, 50)]);
    expect(r.map(p => p.id)).toEqual(['B', 'A', 'C']);
  });
  it('exactly 1.000 s behind the anchor is inside the group; 1.001 is outside', () => {
    const inside = rankPlayers([f('A', 100, 80), f('B', 101, 60)]);
    expect(inside[0]!.id).toBe('B');
    const outside = rankPlayers([f('A', 100, 80), f('B', 101.001, 60)]);
    expect(outside[0]!.id).toBe('A');
  });
  it('dead heat: equal strokes in a group share a place and the next place is skipped', () => {
    const r = rankPlayers([f('A', 100, 70), f('B', 100.5, 70), f('C', 150, 70)]);
    expect(place(r, 'A')).toBe(1);
    expect(place(r, 'B')).toBe(1);
    expect(place(r, 'C')).toBe(3);
    expect(r.map(p => p.id).slice(0, 2)).toEqual(['A', 'B']); // tie listed by time
  });
  it('a lone finisher is first; empty input is empty', () => {
    expect(rankPlayers([f('A', 5, 1)])).toEqual([{ id: 'A', place: 1 }]);
    expect(rankPlayers([])).toEqual([]);
  });
  it('DNF ordering: holes completed desc, then distance to hole asc, then strokes asc; always below finishers', () => {
    const dnf = (id: string, holes: number, dist: number, strokes: number): PlayerResult =>
      ({ id, strokes, holesCompleted: holes, distanceToHole: dist });
    const r = rankPlayers([
      dnf('far', 17, 90, 60), dnf('near', 17, 20, 99), dnf('behind', 12, 1, 10),
      dnf('tieA', 17, 20, 70), f('W', 1100, 200),
    ]);
    expect(r[0]!.id).toBe('W');
    expect(r.slice(1).map(p => p.id)).toEqual(['tieA', 'near', 'far', 'behind']); // 17 holes: dist 20 tie -> fewer strokes (70<99)
    expect(r.at(-1)!.place).toBe(5);
  });
  it('does not mutate its input', () => {
    const input = [f('A', 2, 2), f('B', 1, 1)];
    const copy = structuredClone(input);
    rankPlayers(input);
    expect(input).toEqual(copy);
  });
  it('is order-independent', () => {
    const base = [f('A', 100, 70), f('B', 100.9, 68), f('C', 101.4, 65), f('D', 300, 90)];
    const a = rankPlayers(base);
    const b = rankPlayers([...base].reverse());
    expect(b).toEqual(a);
  });
});
