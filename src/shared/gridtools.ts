import type { HoleGrid } from './course-grid';

/** Decodes one hole's run-length rows into a flat array of class character codes (row-major, row 0 = lowest z). */
export function decodeGrid(g: HoleGrid): Uint8Array {
  const a = new Uint8Array(g.nx * g.nz).fill(111); // 'o'
  g.rows.forEach((row, iz) => { let ix = 0; for (const m of row.matchAll(/([a-z])(\d*)/g)) { const n = m[2] ? Number(m[2]) : 1; a.fill(m[1]!.charCodeAt(0), iz * g.nx + ix, iz * g.nx + ix + n); ix += n; } });
  return a;
}
