import { describe, it, expect } from 'vitest';
import { seaField, seaY } from '../src/client/terrain';
import { shorePieces } from '../src/client/coast';
import { GRIDS } from '../src/shared/course-grid';

describe('coast on real elevation', () => {
  it('the sea field has no water specks under 300 cells and no land specks under 40 cells', () => {
    for (const h of [6, 7, 16, 17]) {
      const g = GRIDS[h]!, sea = seaField(h).sea, n = g.nx * g.nz, seen = new Uint8Array(n);
      for (let s = 0; s < n; s++) if (!seen[s]) {
        const v = sea[s]!, comp = [s]; seen[s] = 1;
        for (let k = 0; k < comp.length; k++) { const i = comp[k]!, x = i % g.nx; for (const j of [x > 0 ? i - 1 : -1, x < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx]) if (j >= 0 && j < n && sea[j] === v && !seen[j]) { seen[j] = 1; comp.push(j); } }
        expect(comp.length).toBeGreaterThanOrEqual(v ? 300 : 40);
      }
    }
  });
  it('shore pieces stand on turf at or above the real sea level', () => {
    for (const h of [6, 7, 16, 17]) for (const p of shorePieces(h, 30, 0)) expect(p.top).toBeGreaterThanOrEqual(seaY(h) - 0.01);
  });
});
