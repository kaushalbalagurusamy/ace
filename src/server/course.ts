// The Pebble Beach Golf Links card (docs/research/reference-sources.md: SFGATE 2000 U.S. Open card, hole 2 played as a par 5).
// SIMPLIFICATION: every hole has a straight centre line at its true length. Doglegs and the coastline from the hole
// graphics are not modelled yet (docs/slices/course-18/spec.md).
import type { Surface } from '../sim';
import type { BallState, HoleInfo } from '../shared/protocol';

export const CARD: readonly { par: number; yards: number }[] = [
  [4, 381], [5, 502], [4, 390], [4, 331], [3, 188], [5, 524], [3, 106], [4, 418], [4, 466],
  [4, 446], [4, 380], [3, 202], [4, 406], [5, 573], [4, 397], [4, 403], [3, 208], [5, 543],
].map(([par, yards]) => ({ par: par!, yards: yards! }));
export const HOLE_COUNT = CARD.length;

const M_PER_YD = 0.9144, FIRST_CUT_HALF = 30, OOB_HALF = 70;

export interface Hole { info: HoleInfo; surfaceAt(x: number, z: number): Surface; outOfBounds(x: number, z: number): boolean }

export function hole(index: number): Hole {
  if (!Number.isInteger(index) || index < 0 || index >= HOLE_COUNT) throw new RangeError(`no such hole: ${index}`);
  const { par, yards } = CARD[index]!;
  const lengthM = yards * M_PER_YD;
  const info: HoleInfo = { index, par, pin: { x: 0, z: lengthM }, tee: { x: 0, z: 0 }, greenRadius: 14, fairwayHalfWidth: 22, lengthM };
  return {
    info,
    surfaceAt(x, z) {
      if (Math.hypot(x - info.pin.x, z - info.pin.z) <= info.greenRadius) return 'green';
      const ax = Math.abs(x);
      return ax <= info.fairwayHalfWidth ? 'fairway' : ax <= FIRST_CUT_HALF ? 'firstCut' : 'rough';
    },
    outOfBounds: (x, z) => Math.abs(x) > OOB_HALF || z < -20 || z > info.pin.z + 40,
  };
}

/** A player's ball on the tee of `h`; strokes are cumulative across the round. */
export const teeBall = (h: Hole, totalStrokes: number): BallState =>
  ({ x: h.info.tee.x, z: h.info.tee.z, strokes: totalStrokes, holedOut: false, surface: h.surfaceAt(h.info.tee.x, h.info.tee.z) });
