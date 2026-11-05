// The Pebble Beach Golf Links card (docs/research/reference-sources.md: SFGATE 2000 U.S. Open card, hole 2 played as a par 5).
// Layouts are traced from the SFGATE hole graphics (scripts/trace_holes.py -> src/shared/course-grid.ts): the tee is the
// origin, the pin is on +z at the card yardage, and one lie grid per hole drives the server's physics and the client's visuals.
import type { Surface } from '../sim';
import type { BallState, HoleInfo } from '../shared/protocol';
import { GRIDS } from '../shared/course-grid';
import { decodeGrid } from '../shared/gridtools';

export const CARD: readonly { par: number; yards: number }[] = [
  [4, 381], [5, 502], [4, 390], [4, 331], [3, 188], [5, 524], [3, 106], [4, 418], [4, 466],
  [4, 446], [4, 380], [3, 202], [4, 406], [5, 573], [4, 397], [4, 403], [3, 208], [5, 543],
].map(([par, yards]) => ({ par: par!, yards: yards! }));
export const HOLE_COUNT = CARD.length;

const M_PER_YD = 0.9144;

export type Penalty = 'water' | 'oob';
export interface Hole {
  info: HoleInfo;
  /** the lie under (x, z); hazards that are penalties report 'rough' here, use penaltyAt for those */
  surfaceAt(x: number, z: number): Surface;
  /** water or out of bounds (beyond the traced map counts as out of bounds); null when the spot is playable */
  penaltyAt(x: number, z: number): Penalty | null;
  outOfBounds(x: number, z: number): boolean;
}

const LIE: Record<string, Surface> = { g: 'green', f: 'fairway', p: 'fairway', c: 'firstCut', r: 'rough', t: 'rough', k: 'rough', s: 'bunker', w: 'rough', o: 'rough' };
const cache: (Uint8Array | undefined)[] = [];

export function hole(index: number): Hole {
  if (!Number.isInteger(index) || index < 0 || index >= HOLE_COUNT) throw new RangeError(`no such hole: ${index}`);
  const { par, yards } = CARD[index]!;
  const lengthM = yards * M_PER_YD, g = GRIDS[index]!, cells = (cache[index] ??= decodeGrid(g));
  const cls = (x: number, z: number): number => {
    const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
    return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 111 : cells[iz * g.nx + ix]!;
  };
  // green radius from the traced green's area around the pin
  let greenCells = 0;
  for (let dz = -40; dz <= 40; dz += g.cell) for (let dx = -40; dx <= 40; dx += g.cell) if (Math.hypot(dx, dz) <= 40 && cls(dx, lengthM + dz) === 103) greenCells++;
  const greenRadius = Math.sqrt((greenCells * g.cell * g.cell) / Math.PI);
  const info: HoleInfo = { index, par, pin: { x: 0, z: lengthM }, tee: { x: 0, z: 0 }, greenRadius, fairwayHalfWidth: 20, lengthM };
  const penaltyAt = (x: number, z: number): Penalty | null => { const c = cls(x, z); return c === 119 ? 'water' : c === 111 ? 'oob' : null; };
  return {
    info,
    surfaceAt: (x, z) => LIE[String.fromCharCode(cls(x, z))] ?? 'rough',
    penaltyAt,
    outOfBounds: (x, z) => penaltyAt(x, z) !== null,
  };
}

/** A player's ball on the tee of `h`; strokes are cumulative across the round. */
export const teeBall = (h: Hole, totalStrokes: number): BallState =>
  ({ x: h.info.tee.x, z: h.info.tee.z, strokes: totalStrokes, holedOut: false, surface: h.surfaceAt(h.info.tee.x, h.info.tee.z) });
