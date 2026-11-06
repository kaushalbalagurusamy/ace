// A course's holes for the race: the card and traced lie grids come from the registry (src/shared/courses.ts). Each hole's
// tee is the origin and its pin is on +z; one lie grid per hole drives the server's physics and the client's visuals.
import type { Surface } from '../sim';
import type { BallState, HoleInfo } from '../shared/protocol';
import { COURSES, DEFAULT_COURSE, gridKey, type CourseId } from '../shared/courses';
import { decodeGrid } from '../shared/gridtools';

/** Pebble Beach's card (the default course); other cards are COURSES[id].card. */
export const CARD = COURSES[DEFAULT_COURSE].card;
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
const cache = new Map<number, Uint8Array>();

export function hole(index: number, course: CourseId = DEFAULT_COURSE): Hole {
  const c = COURSES[course];
  if (!c) throw new RangeError(`no such course: ${course}`);
  if (!Number.isInteger(index) || index < 0 || index >= c.card.length) throw new RangeError(`no such hole: ${index}`);
  const { par, yards } = c.card[index]!, key = gridKey(course, index);
  const lengthM = yards * M_PER_YD, g = c.grids[index]!, cells = cache.get(key) ?? (cache.set(key, decodeGrid(g)), cache.get(key)!);
  const pinZ = g.pinZ ?? lengthM;   // the card yardage is measured along the play line; a dogleg's pin is nearer in a straight line
  const cls = (x: number, z: number): number => {
    const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
    return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 111 : cells[iz * g.nx + ix]!;
  };
  // green radius from the traced green's area around the pin
  let greenCells = 0;
  for (let dz = -40; dz <= 40; dz += g.cell) for (let dx = -40; dx <= 40; dx += g.cell) if (Math.hypot(dx, dz) <= 40 && cls(dx, pinZ + dz) === 103) greenCells++;
  const greenRadius = Math.sqrt((greenCells * g.cell * g.cell) / Math.PI);
  const info: HoleInfo = { course, index, par, pin: { x: 0, z: pinZ }, tee: { x: 0, z: 0 }, greenRadius, fairwayHalfWidth: 20, lengthM };
  const penaltyAt = (x: number, z: number): Penalty | null => { const c = cls(x, z); return c === 119 ? 'water' : c === 111 ? 'oob' : null; };
  return {
    info,
    surfaceAt: (x, z) => LIE[String.fromCharCode(cls(x, z))] ?? 'rough',
    penaltyAt,
    outOfBounds: (x, z) => penaltyAt(x, z) !== null,
  };
}

const built = new Map<CourseId, readonly Hole[]>();
/** Every hole of a course, built once. */
export const holesOf = (course: CourseId): readonly Hole[] => built.get(course) ?? (built.set(course, COURSES[course].card.map((_, i) => hole(i, course))), built.get(course)!);

/** A player's ball on the tee of `h`; strokes are cumulative across the round. */
export const teeBall = (h: Hole, totalStrokes: number): BallState =>
  ({ x: h.info.tee.x, z: h.info.tee.z, strokes: totalStrokes, holedOut: false, surface: h.surfaceAt(h.info.tee.x, h.info.tee.z) });
