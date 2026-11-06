// The course registry: every selectable course with its card, its traced lie grids and a visual theme hint. Shared by the
// server (lies, penalties, pins) and the client (terrain, mini map, rangefinder), so both read the same data.
import { GRIDS as PEBBLE_GRIDS, type HoleGrid } from './course-grid';
import { CARD as BETHPAGE_CARD, GRIDS as BETHPAGE_GRIDS } from './course-grid-bethpage-black';
import { CARD as ARONIMINK_CARD, GRIDS as ARONIMINK_GRIDS } from './course-grid-aronimink';

export const COURSE_IDS = ['pebble', 'bethpage-black', 'aronimink'] as const;
export type CourseId = (typeof COURSE_IDS)[number];
export const DEFAULT_COURSE: CourseId = 'pebble';
export const isCourseId = (v: unknown): v is CourseId => typeof v === 'string' && (COURSE_IDS as readonly string[]).includes(v);

export interface Course {
  id: CourseId; name: string; place: string;
  /** coastal: ocean beyond the traced map, cypress and pine; parkland: forest beyond it, deciduous and oak tree lines */
  theme: 'coastal' | 'parkland';
  /** a one-line look for the scene and the lobby card */
  look: string;
  card: readonly { par: number; yards: number }[];
  grids: readonly HoleGrid[];
  /** Ground height (m) at sim (x, z) on hole `hole` (0-based). The one seam for elevation: flat for now. */
  heightAt(hole: number, x: number, z: number): number;
}

const card = (rows: number[][]) => rows.map(([par, yards]) => ({ par: par!, yards: yards! }));
const flat = () => 0;

export const COURSES: Record<CourseId, Course> = {
  // docs/research/reference-sources.md: SFGATE 2000 U.S. Open card, hole 2 played as a par 5
  pebble: {
    id: 'pebble', name: 'Pebble Beach Golf Links', place: 'Pebble Beach, California', theme: 'coastal', look: 'Coastal links on Carmel Bay', grids: PEBBLE_GRIDS, heightAt: flat,
    card: card([[4, 381], [5, 502], [4, 390], [4, 331], [3, 188], [5, 524], [3, 106], [4, 418], [4, 466],
      [4, 446], [4, 380], [3, 202], [4, 406], [5, 573], [4, 397], [4, 403], [3, 208], [5, 543]]),
  },
  // BlueGolf course database, Blue (back) tees; layouts traced from its satellite hole maps (docs/research/reference-sources.md)
  'bethpage-black': {
    id: 'bethpage-black', name: 'Bethpage Black', place: 'Farmingdale, New York', theme: 'parkland', look: 'Parkland: heavy tree lines, deep bunkers with fescue faces',
    grids: BETHPAGE_GRIDS, heightAt: flat, card: card(BETHPAGE_CARD),
  },
  // BlueGolf course database, Black (back) tees
  aronimink: {
    id: 'aronimink', name: 'Aronimink Golf Club', place: 'Newtown Square, Pennsylvania', theme: 'parkland', look: 'Donald Ross parkland: ponds, creeks and mature trees',
    grids: ARONIMINK_GRIDS, heightAt: flat, card: card(ARONIMINK_CARD),
  },
};

export const HOLES_PER_COURSE = 18;
/** One number per hole of every course (Pebble's holes keep keys 0..17), so per-hole caches and lookups need a single key. */
export const gridKey = (course: CourseId, hole: number): number => COURSE_IDS.indexOf(course) * HOLES_PER_COURSE + hole;
export const gridOf = (key: number): HoleGrid => COURSES[COURSE_IDS[Math.floor(key / HOLES_PER_COURSE)]!].grids[key % HOLES_PER_COURSE]!;
export const keyOf = (h: { course?: CourseId; index: number }): number => gridKey(h.course ?? DEFAULT_COURSE, h.index);
