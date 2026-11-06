import type { HoleGrid } from './course-grid';

/** Out of bounds starts this many cells (2 m each, so about 12 m) beyond the traced land: the source graphics draw the course tightly. */
export const OOB_MARGIN_CELLS = 6;
const OOB = 111, WATER = 119, ROUGH = 114;                 // 'o', 'w', 'r'

/** Decodes one hole's run-length rows into a flat array of class character codes (row-major, row 0 = lowest z).
 *  `margin` cells of rough are grown into the out-of-bounds area around land (never into water, never over land); pass 0 for the raw trace. */
export function decodeGrid(g: HoleGrid, margin = g.margin ?? OOB_MARGIN_CELLS): Uint8Array {
  const a = new Uint8Array(g.nx * g.nz).fill(OOB);
  g.rows.forEach((row, iz) => { let ix = 0; for (const m of row.matchAll(/([a-z])(\d*)/g)) { const n = m[2] ? Number(m[2]) : 1; a.fill(m[1]!.charCodeAt(0), iz * g.nx + ix, iz * g.nx + ix + n); ix += n; } });
  if (margin <= 0) return a;
  // multi-source breadth-first growth from every land cell (anything that is not out of bounds or water) into 'o' cells
  let frontier: number[] = []; for (let i = 0; i < a.length; i++) if (a[i] !== OOB && a[i] !== WATER) frontier.push(i);
  for (let step = 0; step < margin && frontier.length; step++) {
    const next: number[] = [];
    for (const i of frontier) { const x = i % g.nx, z = (i - x) / g.nx;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= g.nx || nz >= g.nz) continue; const j = nz * g.nx + nx; if (a[j] === OOB) { a[j] = ROUGH; next.push(j); } } }
    frontier = next;
  }
  return a;
}
