import { describe, it, expect } from 'vitest';
import { propSpots, cellClass } from '../src/client/terrain';
import { COURSE_IDS, gridKey } from '../src/shared/courses';

describe('prop spots follow the course theme', () => {
  it('parkland holes get dense oak and maple tree lines on traced canopy; Pebble keeps cypress, pine and rock', () => {
    for (const id of COURSE_IDS) for (let i = 0; i < 18; i++) {
      const key = gridKey(id, i), spots = propSpots(key), where = `${id} hole ${i + 1}`;
      if (id === 'pebble') { expect(spots.every(s => ['cypress', 'pine', 'rock'].includes(s.kind)), where).toBe(true); expect(spots.length).toBeLessThanOrEqual(180); continue; }
      expect(spots.length, where).toBeGreaterThan(60); expect(spots.length).toBeLessThanOrEqual(300);
      for (const s of spots) { expect(['oak', 'maple']).toContain(s.kind); expect(cellClass(key, s.x, s.z), where).toBe('t'); }
    }
  });
});
