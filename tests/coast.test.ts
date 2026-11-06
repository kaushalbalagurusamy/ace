import { describe, it, expect } from 'vitest';
import { seaField, seaY } from '../src/client/terrain';
import { seaWallSections, shorePieces } from '../src/client/coast';
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
  it("the 18th's sea wall runs butted along the left shore, tops above the sea, beside land", () => {
    const g = GRIDS[17]!, sea = seaField(17).sea, bottom = seaY(17) - 0.6, secs = seaWallSections(17, 2.5, bottom);
    const isSea = (x: number, z: number) => sea[Math.floor((z - g.z0) / g.cell) * g.nx + Math.floor((x - g.x0) / g.cell)] === 1;
    expect(secs.length).toBeGreaterThan(30);
    expect(secs[secs.length - 1]!.bz - secs[0]!.az).toBeGreaterThan(400);   // most of the hole, tee end to green
    let breaks = 0;
    secs.forEach((s, i) => {
      const p = secs[i - 1];
      if (p && Math.hypot(s.ax - p.bx, s.az - p.bz) > 1e-6) breaks++;
      else if (p) expect(s.topA).toBeCloseTo(p.topB, 6);   // butted, no step
      expect(breaks).toBeLessThanOrEqual(4);   // only at rock knobs and the corner by the green
      expect(Math.min(s.topA, s.topB)).toBeGreaterThan(seaY(17) + 1);
      const l = Math.hypot(s.bx - s.ax, s.bz - s.az), mx = (s.ax + s.bx) / 2 + ((s.bz - s.az) / l) * 6, mz = (s.az + s.bz) / 2 - ((s.bx - s.ax) / l) * 6;
      expect(isSea(mx, mz), `section ${i} at z ${s.az.toFixed(0)}`).toBe(false);   // land 6 m inland of the face (sea on the left of a->b)
      expect(s.ax).toBeLessThan(60);   // the bay side, never the right of the hole
    });
  });
});
