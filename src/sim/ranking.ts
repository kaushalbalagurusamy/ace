import type { Placement, PlayerResult } from './types';

const GROUP_WINDOW_S = 1.0;
const EPS = 1e-9; // inclusive window despite float error

const byId = (a: PlayerResult, b: PlayerResult) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function rankPlayers(players: readonly PlayerResult[]): Placement[] {
  const fin = players.filter((p) => p.finishTime !== undefined).sort((a, b) => a.finishTime! - b.finishTime! || byId(a, b));
  const out: Placement[] = [];
  let i = 0;
  while (i < fin.length) {
    const limit = fin[i]!.finishTime! + GROUP_WINDOW_S + EPS;
    let j = i;
    while (j < fin.length && fin[j]!.finishTime! <= limit) j++;
    const group = fin.slice(i, j).sort((a, b) => a.strokes - b.strokes || a.finishTime! - b.finishTime! || byId(a, b));
    const base = out.length + 1;
    for (const p of group) out.push({ id: p.id, place: base + group.filter((q) => q.strokes < p.strokes).length });
    i = j;
  }
  const dnf = players
    .filter((p) => p.finishTime === undefined)
    .sort(
      (a, b) =>
        b.holesCompleted - a.holesCompleted ||
        (a.distanceToHole ?? Infinity) - (b.distanceToHole ?? Infinity) ||
        a.strokes - b.strokes ||
        byId(a, b),
    );
  const base = out.length + 1;
  const key = (p: PlayerResult) => `${p.holesCompleted}|${p.distanceToHole ?? Infinity}|${p.strokes}`;
  dnf.forEach((p, k) => {
    const first = dnf.findIndex((q) => key(q) === key(p));
    out.push({ id: p.id, place: base + first });
  });
  return out;
}
